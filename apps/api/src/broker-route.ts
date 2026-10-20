import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { brokerKey, hashPassword, verifyPassword, sealCredential } from './broker-security.js';
interface Dependencies {
 pool: Pool; readJson: (req: IncomingMessage) => Promise<Record<string, unknown>>;
 json: (res: ServerResponse, status: number, body: unknown) => void;
}
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function createBrokerRoute({pool,readJson,json}: Dependencies) {
 const attempts = new Map<string,{count:number;until:number}>();
 return async (req: IncomingMessage,res: ServerResponse): Promise<boolean> => {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  if (!path.startsWith('/api/v1/broker/')) return false;
  res.setHeader('Cache-Control','no-store');
  try {
   if (['/api/v1/broker/register','/api/v1/broker/login'].includes(path) && req.method === 'POST') {
    const ip=req.socket.remoteAddress || 'unknown', now=Date.now();
    for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const bucket=attempts.get(ip)||{count:0,until:now+60000}; bucket.count++; attempts.set(ip,bucket);
    if(bucket.count>10){json(res,429,{error:'LOGIN_RATE_LIMIT'});return true;}
    const body=await readJson(req),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<12||password.length>256){json(res,400,{error:'BROKER_LOGIN_INPUT'});return true;}
    let userId: string;
    if(path.endsWith('/register')) {
     const client=await pool.connect();
     try {
      const passwordHash=await hashPassword(password);
      await client.query('BEGIN');
      const user=await client.query(`INSERT INTO spaartrack.app_user(email,display_name) VALUES($1,'Broker owner') RETURNING id`,[email]);
      userId=user.rows[0].id;
      await client.query('INSERT INTO spaartrack.broker_owner(user_id,password_hash) VALUES($1,$2)',[userId,passwordHash]);
      await client.query('COMMIT');
     } catch {await client.query('ROLLBACK');json(res,409,{error:'BROKER_REGISTRATION_FAILED'});return true;} finally{client.release();}
    } else {
     const result=await pool.query(`SELECT u.id,b.password_hash FROM spaartrack.broker_owner b JOIN spaartrack.app_user u ON u.id=b.user_id WHERE lower(u.email)=$1 AND u.status='ACTIVE' AND u.deleted_at IS NULL`,[email]);
     const valid=await verifyPassword(password,result.rows[0]?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`);
     if(!result.rowCount||!valid){json(res,401,{error:'BROKER_LOGIN_FAILED'});return true;} userId=result.rows[0].id;
    }
    const token=randomBytes(32).toString('base64url');
    await pool.query(`INSERT INTO spaartrack.broker_session(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')`,[hash(token),userId]);
    json(res,201,{token});return true;
   }
   const token=req.headers.authorization?.replace(/^Bearer /,'')||'';
   const auth=await pool.query(`SELECT s.user_id FROM spaartrack.broker_session s JOIN spaartrack.app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.status='ACTIVE' AND u.deleted_at IS NULL`,[hash(token)]);
   if(!auth.rowCount){json(res,401,{error:'BROKER_LOGIN_REQUIRED'});return true;}
   const userId=auth.rows[0].user_id;
   if(path==='/api/v1/broker/logout'&&req.method==='POST'){await pool.query('DELETE FROM spaartrack.broker_session WHERE token_hash=$1',[hash(token)]);json(res,200,{ok:true});return true;}
   const root='/api/v1/broker/trading212';
   if(path===root && req.method==='GET'){
    const result=await pool.query(`SELECT c.id,c.display_name,c.status,c.provider_metadata,c.last_successful_sync_at,c.last_error_code,
      (SELECT row_to_json(r) FROM (SELECT id,status,records_seen,records_created,records_updated,records_duplicate,error_code,diagnostics FROM spaartrack.sync_run WHERE connection_id=c.id ORDER BY created_at DESC LIMIT 1) r) AS last_run
      FROM spaartrack.external_connection c WHERE c.user_id=$1 AND c.provider_metadata->>'adapter'='trading212-live-v1' ORDER BY c.created_at DESC`,[userId]);
    json(res,200,{connections:result.rows});return true;
   }
   if(path===root && req.method==='POST'){
    const body=await readJson(req), apiKey=String(body.api_key||'').trim(),apiSecret=String(body.api_secret||'').trim();
    if(!apiKey||!apiSecret||apiKey.includes(':')||/[\r\n]/.test(apiKey+apiSecret)||apiKey.length>1024||apiSecret.length>1024||!['live','demo'].includes(String(body.environment))||!['INVEST','STOCKS_ISA'].includes(String(body.account_type))){json(res,400,{error:'BROKER_CONNECTION_INPUT'});return true;}
    const id=randomUUID(),sealed=sealCredential({apiKey,apiSecret},brokerKey(),`${userId}/${id}`),client=await pool.connect();
    try {
     await client.query('BEGIN');
     const provider=await client.query(`INSERT INTO spaartrack.provider(slug,name,provider_type,api_version,status) VALUES('trading212-live','Trading 212','BROKER','v0','ACTIVE') ON CONFLICT(slug) DO UPDATE SET api_version='v0' RETURNING id`);
     const ref=await client.query(`INSERT INTO spaartrack.credential_secret_ref(user_id,vault_path,secret_kind,key_version) VALUES($1,$2,'API_KEY','aes-256-gcm-v1') RETURNING id`,[userId,`vault://broker/${id}`]);
     await client.query(`INSERT INTO spaartrack.external_connection(id,user_id,provider_id,auth_mode,status,display_name,credential_ref_id,provider_metadata) VALUES($1,$2,$3,'API_KEY','AUTH_PENDING',$4,$5,$6)`,[id,userId,provider.rows[0].id,String(body.display_name||'Trading 212').slice(0,100),ref.rows[0].id,JSON.stringify({adapter:'trading212-live-v1',environment:body.environment,account_type:body.account_type,read_only:true})]);
     await client.query('INSERT INTO spaartrack.broker_credential(connection_id,ciphertext,iv,tag) VALUES($1,$2,$3,$4)',[id,sealed.ciphertext,sealed.iv,sealed.tag]);
     await enqueue(client,id,'INITIAL',res);
     await client.query('COMMIT');json(res,202,{id,status:'QUEUED'});
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}return true;
   }
   const match=path.match(/^\/api\/v1\/broker\/trading212\/([0-9a-f-]{36})\/(sync|revoke|results)$/);
   if(match){
    const client=await pool.connect();
    try{
     await client.query('BEGIN');
     const connection=await client.query(`SELECT * FROM spaartrack.external_connection WHERE id=$1 AND user_id=$2 AND provider_metadata->>'adapter'='trading212-live-v1' FOR UPDATE`,[match[1],userId]);
     if(!connection.rowCount){await client.query('ROLLBACK');json(res,404,{error:'CONNECTION_NOT_FOUND'});return true;}
     if(match[2]==='results'&&req.method==='GET'){
      const results=await client.query(`SELECT external_id,item_type,posting_status,payload_json FROM spaartrack.sync_result_item WHERE sync_run_id=(SELECT id FROM spaartrack.sync_run WHERE connection_id=$1 AND status='SUCCEEDED' ORDER BY created_at DESC LIMIT 1) ORDER BY external_id LIMIT 200`,[match[1]]);
      await client.query('COMMIT');json(res,200,{items:results.rows,display_limit:200,posting_boundary:'application-review-only'});return true;
     }
     if(req.method!=='POST'){await client.query('ROLLBACK');json(res,405,{error:'METHOD_NOT_ALLOWED'});return true;}
     if(match[2]==='revoke'){
      await client.query(`UPDATE spaartrack.external_connection SET status='REVOKED',disconnected_at=now(),updated_at=now() WHERE id=$1`,[match[1]]);
      await client.query('DELETE FROM spaartrack.broker_credential WHERE connection_id=$1',[match[1]]);
      await client.query(`UPDATE spaartrack.credential_secret_ref SET revoked_at=now() WHERE id=$1`,[connection.rows[0].credential_ref_id]);
      await client.query(`UPDATE spaartrack.sync_run SET status='CANCELLED',finished_at=now() WHERE connection_id=$1 AND status IN ('QUEUED','RUNNING')`,[match[1]]);
      await brokerAudit(client,userId,match[1],'REVOKE',res);
      await client.query('COMMIT');json(res,200,{status:'REVOKED'});return true;
     }
     if(connection.rows[0].status==='REVOKED'){await client.query('ROLLBACK');json(res,409,{error:'CONNECTION_REVOKED'});return true;}
     const active=await client.query(`SELECT id FROM spaartrack.sync_run WHERE connection_id=$1 AND status IN ('QUEUED','RUNNING')`,[match[1]]);
     if(active.rowCount){await client.query('COMMIT');json(res,202,{id:active.rows[0].id,status:'QUEUED'});return true;}
     // One account-wide sync at a time and at least five seconds between account-summary requests.
     const recent=await client.query(`SELECT 1 FROM spaartrack.sync_run WHERE connection_id=$1 AND created_at>now()-interval '5 seconds'`,[match[1]]);
     if(recent.rowCount){await client.query('ROLLBACK');json(res,429,{error:'SYNC_RATE_LIMIT'});return true;}
     await enqueue(client,match[1],'MANUAL',res);await client.query('COMMIT');json(res,202,{status:'QUEUED'});return true;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   }
   json(res,404,{error:'NOT_FOUND'});
  } catch {json(res,503,{error:'BROKER_UNAVAILABLE'});}
  return true;
 };
}
async function enqueue(client: Pick<Pool,'query'>,id:string,trigger:string,res:ServerResponse){
 const context={adapter:'trading212-live-v1',trace_id:String(res.getHeader('x-trace-id')||randomUUID()),correlation_id:String(res.getHeader('x-correlation-id')||randomUUID())};
 await client.query(`INSERT INTO spaartrack.sync_run(connection_id,status,trigger_type,diagnostics) VALUES($1,'QUEUED',$2,$3)`,[id,trigger,JSON.stringify(context)]);
 await client.query(`UPDATE spaartrack.external_connection SET status='SYNCING',last_error_code=NULL,updated_at=now() WHERE id=$1`,[id]);
 const owner=await client.query('SELECT user_id FROM spaartrack.external_connection WHERE id=$1',[id]);
 await brokerAudit(client,owner.rows[0].user_id,id,'SYNC',res);
}

async function brokerAudit(client: Pick<Pool,'query'>,userId:string,id:string,action:string,res:ServerResponse){
 await client.query(`INSERT INTO spaartrack.audit_log(user_id,actor_type,actor_id,action,entity_type,entity_id,after_json,trace_id,correlation_id) VALUES($1::uuid,'USER',$1::text,$2,'BROKER_CONNECTION',$3,'{"read_only":true}',$4,$5)`,[userId,action,id,String(res.getHeader('x-trace-id')||''),String(res.getHeader('x-correlation-id')||'')]);
}
