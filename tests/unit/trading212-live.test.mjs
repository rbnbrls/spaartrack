import test from 'node:test';
import assert from 'node:assert/strict';
import { Trading212Adapter } from '../../packages/integration-contracts/src/trading212.ts';
import { sealCredential, openCredential, hashPassword, verifyPassword } from '../../apps/api/src/broker-security.ts';
const summary={id:123,currency:'EUR',totalValue:120,cash:{availableToTrade:20},investments:{currentValue:100}};
const credentials={apiKey:'synthetic-key',apiSecret:'synthetic-secret'};
const context={traceId:'trace-test',correlationId:'correlation-test'};
function adapter(handler){return new Trading212Adapter({environment:'demo',credentials,context,fetch:handler,sleep:async()=>{}});}
test('TC-US-0802-live: encrypted credentials are bound to owner/connection; passwords verified',async()=>{
 const key=Buffer.alloc(32,7), box=sealCredential(credentials,key,'owner/connection');
 assert.ok(!JSON.stringify(box).includes('synthetic-secret'));
 assert.deepEqual(openCredential(box,key,'owner/connection'),credentials);
 assert.throws(()=>openCredential(box,key,'someone-else'));
 assert.throws(()=>openCredential({...box,tag:'AAAA'},key,'owner/connection'));
 const hash=await hashPassword('synthetic-long-password');
 assert.equal(await verifyPassword('synthetic-long-password',hash),true);
 assert.equal(await verifyPassword('wrong',hash),false);
});
test('TC-US-0803-live: GET-only Basic authentication, trace context, pagination and fill identities',async()=>{
 const calls=[];
 const a=adapter(async(url,options)=>{calls.push({url:String(url),options});const p=new URL(url);
 if(p.pathname.endsWith('/summary'))return Response.json(summary);
 if(p.pathname.endsWith('/positions'))return Response.json([{instrument:{ticker:'SYN_US_EQ',currency:'USD'},quantity:2,currentPrice:50,walletImpact:{currency:'EUR',currentValue:100}}]);
 if(p.pathname.endsWith('/orders'))return Response.json({items:[{order:{id:9,side:'BUY'},fill:{id:p.searchParams.has('cursor')?12:11,type:'TRADE',quantity:1,price:50,filledAt:'2026-10-19T10:00:00Z',walletImpact:{currency:'EUR',netValue:-50}}}],nextPagePath:p.searchParams.has('cursor')?null:'/api/v0/equity/history/orders?cursor=2&limit=50'});
 return Response.json({items:[],nextPagePath:null});});
 const result=await a.sync();assert.equal(result.records.filter(x=>x.kind==='order').length,2);
 assert.equal(new Set(result.records.map(x=>x.external_id)).size,result.records.length);
 assert.equal(result.summary.totalValue,120);
 for(const {url,options} of calls){assert.ok(url.startsWith('https://demo.trading212.com/'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Basic '+Buffer.from('synthetic-key:synthetic-secret').toString('base64'));assert.equal(options.headers['X-Correlation-ID'],'correlation-test');}
});
test('TC-US-0803-live: hostile pagination, schema drift and auth errors fail closed without leaking provider body',async()=>{
 for(const next of ['https://evil.test/steal','//evil.test/steal','/api/v0/equity/orders','/api/v0/equity/history/orders?cursor=1']){
 const a=adapter(async url=>String(url).endsWith('/summary')?Response.json(summary):String(url).endsWith('/positions')?Response.json([]):Response.json({items:[],nextPagePath:next}));
 await assert.rejects(a.sync(),/PAGINATION/);
 }
 await assert.rejects(adapter(async()=>Response.json({unexpected:true})).sync(),/SCHEMA/);
 for(const code of [401,403])await assert.rejects(adapter(async()=>new Response('synthetic-secret',{status:code})).sync(),e=>e.message===`TRADING212_HTTP_${code}`);
});
test('TC-US-0803-live: rate limit retries honor delay and exhaust safely',async()=>{
 let calls=0;const delays=[];
 const a=new Trading212Adapter({environment:'demo',credentials,context,sleep:async ms=>delays.push(ms),fetch:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'7'}});}});
 await assert.rejects(a.sync(),/TRADING212_HTTP_429/);assert.equal(calls,3);assert.deepEqual(delays,[7000,7000]);
});
test('TC-US-0803-live: revocation is rechecked before every provider request',async()=>{
 let calls=0;
 const a=new Trading212Adapter({environment:'demo',credentials,context,sleep:async()=>{},beforeRequest:async()=>{if(calls)throw new Error('CONNECTION_REVOKED');},fetch:async()=>{calls++;return Response.json(summary);}});
 await assert.rejects(a.sync(),/CONNECTION_REVOKED/);assert.equal(calls,1);
});
test('TC-US-0803-live: rate-limit reset header is respected when Retry-After is absent',async()=>{
 const delays=[];const reset=Math.ceil(Date.now()/1000)+8;
 const a=new Trading212Adapter({environment:'demo',credentials,context,sleep:async ms=>delays.push(ms),fetch:async()=>new Response('',{status:429,headers:{'x-ratelimit-reset':String(reset)}})});
 await assert.rejects(a.sync(),/HTTP_429/);assert.equal(delays.length,2);assert.ok(delays.every(ms=>ms>=7000&&ms<=10000));
});
