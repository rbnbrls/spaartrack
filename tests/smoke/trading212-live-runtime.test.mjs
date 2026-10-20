import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
// Runs against a disposable synthetic database and the compiled image, never against a real broker.
test('TC-US-0803-live-runtime: owner isolation, queue, retry, dedupe, cancellation, revoke, audit and ledger invariance', {skip:process.env.BROKER_RUNTIME_TEST!=='1'},async()=>{
 const {default:pg}=await import('/app/node_modules/pg/lib/index.js');
 const {createBrokerRoute}=await import('/app/dist/apps/api/src/broker-route.js');
 const {processBrokerJob}=await import('/app/dist/apps/api/src/broker-sync.js');
 const {Trading212Adapter}=await import('/app/dist/packages/integration-contracts/src/trading212.js');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
 const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
 const readJson=async req=>{let text='';for await(const chunk of req)text+=chunk;return JSON.parse(text||'{}');};
 const route=createBrokerRoute({pool,json,readJson});
 const server=createServer((req,res)=>{res.setHeader('x-trace-id','synthetic-trace');res.setHeader('x-correlation-id','synthetic-correlation');route(req,res).catch(()=>json(res,500,{}));});
 await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
 const base=`http://localhost:${server.address().port}/api/v1/broker`;
 let token='';
 const call=async(path,body,method)=>{const res=await fetch(base+path,{method:method||(body?'POST':'GET'),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,body:await res.json()};};
 try{
  const before=(await pool.query('SELECT count(*) FROM spaartrack.ledger_transaction')).rows[0].count;
  assert.equal((await call('/trading212')).status,401);
  const email=`synthetic-broker-${randomUUID()}@example.test`,password='synthetic-owner-password';
  let res=await call('/register',{email,password});assert.equal(res.status,201);token=res.body.token;const ownerToken=token;
  assert.equal((await call('/login',{email,password:'wrong-password-long'})).status,401);
  assert.equal((await call('/login',{email,password})).status,201);
  res=await call('/trading212',{display_name:'Synthetic broker',environment:'demo',account_type:'INVEST',api_key:'synthetic-key',api_secret:'synthetic-secret'});
  assert.equal(res.status,202);const id=res.body.id;
  const stored=(await pool.query('SELECT * FROM spaartrack.broker_credential WHERE connection_id=$1',[id])).rows[0];assert.ok(stored.ciphertext);assert.ok(!JSON.stringify(stored).includes('synthetic-secret'));
  assert.equal((await call(`/trading212/${id}/sync`,{})).status,202);
  assert.equal((await pool.query('SELECT count(*) FROM spaartrack.sync_run WHERE connection_id=$1',[id])).rows[0].count,'1');
  res=await call('/register',{email:`synthetic-other-${randomUUID()}@example.test`,password});token=res.body.token;
  assert.deepEqual((await call('/trading212')).body.connections,[]);
  assert.equal((await call(`/trading212/${id}/revoke`,{})).status,404);
  assert.equal((await call(`/trading212/${id}/results`)).status,404);token=ownerToken;
  const fixtureFetch=async url=>{
   const path=new URL(url).pathname;
   if(path.endsWith('/summary'))return Response.json({id:123,currency:'EUR',totalValue:120,cash:{availableToTrade:20},investments:{currentValue:100}});
   if(path.endsWith('/positions'))return Response.json([{instrument:{ticker:'SYN_US_EQ',currency:'USD'},quantity:2,currentPrice:50,walletImpact:{currency:'EUR',currentValue:100}}]);
   if(path.endsWith('/orders'))return Response.json({items:[{order:{id:1,side:'BUY'},fill:{id:2,quantity:2,price:50}}],nextPagePath:null});
   if(path.endsWith('/dividends'))return Response.json({items:[{reference:'same-id',amount:5,currency:'EUR',paidOn:'2026-10-19'}],nextPagePath:null});
   return Response.json({items:[{reference:'same-id',amount:100,currency:'EUR',type:'DEPOSIT'}],nextPagePath:null});
  };
  const factory=options=>new Trading212Adapter({...options,fetch:fixtureFetch,sleep:async()=>{}});
  assert.equal(await processBrokerJob(pool,factory),true);
  res=await call('/trading212');let connection=res.body.connections[0];
  assert.equal(connection.status,'HEALTHY');assert.equal(connection.last_run.records_created,4);assert.equal(connection.last_run.diagnostics.trace_id,'synthetic-trace');
  assert.equal((await call(`/trading212/${id}/results`)).body.items.length,4);
  async function queue(){await pool.query(`UPDATE spaartrack.sync_run SET created_at=now()-interval '10 seconds' WHERE connection_id=$1`,[id]);assert.equal((await call(`/trading212/${id}/sync`,{})).status,202);}
  await queue();await processBrokerJob(pool,factory);connection=(await call('/trading212')).body.connections[0];assert.equal(connection.last_run.records_duplicate,4);assert.equal(connection.last_run.records_created,0);
  // A second worker must not consume the same connection while the first owns its lock.
  await queue();let unblock;let started;const barrier=new Promise(resolve=>{started=resolve;});
  const active=processBrokerJob(pool,options=>({sync:async()=>{started();await new Promise(resolve=>{unblock=resolve;});return factory(options).sync();}}));
  await barrier;assert.equal(await processBrokerJob(pool,factory),false);unblock();await active;
  const checkpoint=(await pool.query('SELECT provider_cursor FROM spaartrack.sync_checkpoint WHERE connection_id=$1',[id])).rows[0].provider_cursor;
  await queue();await processBrokerJob(pool,()=>({sync:async()=>{throw new Error('TRADING212_HTTP_403');}}));
  connection=(await call('/trading212')).body.connections[0];assert.equal(connection.status,'ERROR');assert.equal(connection.last_error_code,'TRADING212_HTTP_403');
  assert.equal((await pool.query('SELECT provider_cursor FROM spaartrack.sync_checkpoint WHERE connection_id=$1',[id])).rows[0].provider_cursor,checkpoint);
  // Simulate a worker dying after claim: the lock is gone; replay must be safe.
  await queue();await pool.query(`UPDATE spaartrack.sync_run SET status='RUNNING' WHERE connection_id=$1 AND status='QUEUED'`,[id]);await processBrokerJob(pool,factory);
  assert.equal((await call('/trading212')).body.connections[0].status,'HEALTHY');
  await queue();await processBrokerJob(pool,options=>({sync:async()=>{const snapshot=await factory(options).sync();assert.equal((await call(`/trading212/${id}/revoke`,{})).status,200);return snapshot;}}));
  assert.equal((await call('/trading212')).body.connections[0].status,'REVOKED');
  assert.equal((await pool.query('SELECT count(*) FROM spaartrack.broker_credential WHERE connection_id=$1',[id])).rows[0].count,'0');
  assert.equal((await call(`/trading212/${id}/sync`,{})).status,409);
  assert.equal((await pool.query('SELECT count(*) FROM spaartrack.ledger_transaction')).rows[0].count,before);
  const audit=await pool.query(`SELECT action FROM spaartrack.audit_log WHERE entity_id=$1`,[id]);assert.ok(audit.rows.some(row=>row.action==='REVOKE'));
  assert.equal((await call('/logout',{})).status,200);assert.equal((await call('/trading212')).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));await pool.end();}
});
