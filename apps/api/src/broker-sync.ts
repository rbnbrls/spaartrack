import type { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { Trading212Adapter, type BrokerSnapshot } from '../../../packages/integration-contracts/src/trading212.js';
import { brokerKey, openCredential } from './broker-security.js';
/** Durable PostgreSQL queue. The worker holds a session advisory lock per connection.
 * Reclaim a RUNNING job only after its old worker has released/lost that lock. */
export async function processBrokerJob(pool: Pool, factory?: (options: ConstructorParameters<typeof Trading212Adapter>[0]) => {sync():Promise<BrokerSnapshot>}): Promise<boolean> {
 const client=await pool.connect();let connectionId:string|undefined;let run:any;
 try{
  const pending=await client.query(`SELECT r.* FROM spaartrack.sync_run r JOIN spaartrack.external_connection c ON c.id=r.connection_id WHERE r.status IN ('QUEUED','RUNNING') AND c.status<>'REVOKED' AND r.diagnostics->>'adapter'='trading212-live-v1' ORDER BY r.created_at LIMIT 20`);
  for(const candidate of pending.rows){
   const lock=await client.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',[candidate.connection_id]);
   if(lock.rows[0].locked){connectionId=candidate.connection_id;run=candidate;break;}
  }
  if(!run)return false;
  // The selection preceded lock acquisition, so recheck the durable job state.
  const claimed=await client.query(`UPDATE spaartrack.sync_run SET status='RUNNING',started_at=now() WHERE id=$1 AND status IN ('QUEUED','RUNNING') RETURNING id`,[run.id]);
  if(!claimed.rowCount)return false;
  const result=await client.query(`SELECT c.user_id,c.status,c.provider_metadata,b.ciphertext,b.iv,b.tag FROM spaartrack.external_connection c JOIN spaartrack.broker_credential b ON b.connection_id=c.id WHERE c.id=$1 AND c.status<>'REVOKED'`,[connectionId]);
  if(!result.rowCount)throw new Error('CONNECTION_REVOKED');
  const row=result.rows[0];
  const credentials=openCredential(row,brokerKey(),`${row.user_id}/${connectionId}`);
  const options={environment:row.provider_metadata.environment,credentials,beforeRequest:async()=>{
   const active=await client.query(`SELECT 1 FROM spaartrack.external_connection WHERE id=$1 AND status<>'REVOKED'`,[connectionId]);
   if(!active.rowCount)throw new Error('CONNECTION_REVOKED');
  },context:{traceId:run.diagnostics.trace_id,correlationId:run.diagnostics.correlation_id}};
  const snapshot=await (factory?factory(options):new Trading212Adapter(options)).sync();
  await client.query('BEGIN');
  const current=await client.query(`SELECT status,provider_metadata FROM spaartrack.external_connection WHERE id=$1 FOR UPDATE`,[connectionId]);
  if(current.rows[0]?.status==='REVOKED') {await client.query('ROLLBACK');return true;}
  const metadata=current.rows[0].provider_metadata;
  if(metadata.broker_account_id && metadata.broker_account_id!==String(snapshot.summary.id))throw new Error('TRADING212_ACCOUNT_CHANGED');
  const previous=await client.query(`SELECT DISTINCT ON (external_id) external_id,payload_json FROM spaartrack.sync_result_item WHERE connection_id=$1 ORDER BY external_id,created_at DESC`,[connectionId]);
  const known=new Map(previous.rows.map(r=>[r.external_id,JSON.stringify(r.payload_json)]));
  // JSONB key ordering differs from JSON serialization; compare canonical values in PostgreSQL.
  let created=0,updated=0,duplicates=0;
  const unique=new Map(snapshot.records.map(record=>[record.external_id,record]));
  for(const record of unique.values()){
   const payload=JSON.stringify({kind:record.kind,...record.data});let type='NEW';
   if(known.has(record.external_id)){
    const equal=await client.query(`SELECT $1::jsonb=$2::jsonb AS equal`,[known.get(record.external_id),payload]);
    type=equal.rows[0].equal?'DUPLICATE':'UPDATED';
   }
   if(type==='NEW')created++;else if(type==='UPDATED')updated++;else duplicates++;
   await client.query(`INSERT INTO spaartrack.sync_result_item(sync_run_id,connection_id,external_id,item_type,payload_json) VALUES($1,$2,$3,$4,$5) ON CONFLICT(sync_run_id,external_id) DO NOTHING`,[run.id,connectionId,record.external_id,type,payload]);
  }
  const raw=JSON.stringify(snapshot);
  await client.query(`INSERT INTO spaartrack.raw_provider_payload(connection_id,sync_run_id,payload_type,provider_endpoint,content_type,payload_json,checksum_sha256,schema_version) VALUES($1,$2,'API_RESPONSE','trading212/v0/read','application/json',$3,$4,'trading212-live-v1')`,[connectionId,run.id,raw,createHash('sha256').update(raw).digest('hex')]);
  await client.query(`INSERT INTO spaartrack.provider_account(connection_id,external_account_id,account_type,name,base_currency_code,provider_metadata) VALUES($1,$2,$3,'Trading 212',$4,$5) ON CONFLICT(connection_id,external_account_id) DO UPDATE SET provider_metadata=EXCLUDED.provider_metadata,updated_at=now()`,[connectionId,String(snapshot.summary.id),metadata.account_type==='STOCKS_ISA'?'ISA':'INVESTMENT',snapshot.summary.currency,JSON.stringify({summary:snapshot.summary,fetched_at:snapshot.fetchedAt})]);
  await client.query(`UPDATE spaartrack.external_connection SET status='HEALTHY',last_sync_started_at=$2,last_sync_completed_at=now(),last_successful_sync_at=now(),last_error_code=NULL,provider_metadata=provider_metadata||$3::jsonb,updated_at=now() WHERE id=$1`,[connectionId,run.started_at||new Date().toISOString(),JSON.stringify({broker_account_id:String(snapshot.summary.id),summary:snapshot.summary,fetched_at:snapshot.fetchedAt})]);
  await client.query(`UPDATE spaartrack.sync_run SET status='SUCCEEDED',finished_at=now(),records_seen=$2,records_created=$3,records_updated=$4,records_duplicate=$5,diagnostics=diagnostics||$6::jsonb WHERE id=$1`,[run.id,unique.size,created,updated,duplicates,JSON.stringify({positions:snapshot.records.filter(r=>r.kind==='position').length,orders:snapshot.records.filter(r=>r.kind==='order').length,dividends:snapshot.records.filter(r=>r.kind==='dividend').length,transactions:snapshot.records.filter(r=>r.kind==='transaction').length,ledger_untouched:true})]);
  await client.query(`INSERT INTO spaartrack.sync_checkpoint(connection_id,provider_cursor,last_activity_at,last_balance_at,last_position_at) VALUES($1,$2,now(),now(),now()) ON CONFLICT(connection_id) DO UPDATE SET provider_cursor=EXCLUDED.provider_cursor,last_activity_at=now(),last_balance_at=now(),last_position_at=now(),updated_at=now()`,[connectionId,snapshot.fetchedAt]);
  await client.query('COMMIT');
  console.log(JSON.stringify({service:'broker-worker',operation:'sync_completed',release:process.env.APP_RELEASE||'local',trace_id:run.diagnostics.trace_id,correlation_id:run.diagnostics.correlation_id,records:unique.size}));
  return true;
 }catch(error){
  await client.query('ROLLBACK');
  if(run){
   const message=error instanceof Error?error.message:'';
   const code=/^(TRADING212_(HTTP_\d{3}|NETWORK|SCHEMA(_ID)?|PAGINATION_(LIMIT|UNSAFE)|ACCOUNT_CHANGED)|CONNECTION_REVOKED)$/.test(message)?message:'BROKER_SYNC_FAILED';
   await client.query(`UPDATE spaartrack.sync_run SET status='FAILED',error_code=$2,finished_at=now() WHERE id=$1 AND status<>'CANCELLED'`,[run.id,code]);
   await client.query(`UPDATE spaartrack.external_connection SET status='ERROR',last_error_code=$2,last_sync_completed_at=now(),updated_at=now() WHERE id=$1 AND status<>'REVOKED'`,[connectionId,code]);
   console.log(JSON.stringify({service:'broker-worker',operation:'sync_failed',release:process.env.APP_RELEASE||'local',trace_id:run.diagnostics.trace_id,correlation_id:run.diagnostics.correlation_id,error_code:code}));
  }
  return true;
 }finally{
  if(connectionId)await client.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[connectionId]);
  client.release();
 }
}
