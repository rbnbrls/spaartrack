// Explicit synthetic-only GUI harness. Never ship this entrypoint in the app image.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import pg from '/app/node_modules/pg/lib/index.js';
import {createBrokerRoute} from '/app/dist/apps/api/src/broker-route.js';
import {processBrokerJob} from '/app/dist/apps/api/src/broker-sync.js';
import {Trading212Adapter} from '/app/dist/packages/integration-contracts/src/trading212.js';
if(!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Disposable test database required');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
const route=createBrokerRoute({pool,json,readJson:async req=>{let body='';for await(const chunk of req)body+=chunk;return JSON.parse(body||'{}');}});
const factory=options=>new Trading212Adapter({...options,sleep:async()=>{},fetch:async(url)=>{
 if(options.credentials.apiKey!=='synthetic-key'||options.credentials.apiSecret!=='synthetic-secret')return new Response('',{status:401});
 const path=new URL(url).pathname;
 if(path.endsWith('/summary'))return Response.json({id:123,currency:'EUR',totalValue:1250,cash:{availableToTrade:250},investments:{currentValue:1000}});
 if(path.endsWith('/positions'))return Response.json([{instrument:{name:'Synthetic Equity',ticker:'SYN_US_EQ',currency:'USD'},quantity:10,currentPrice:100,walletImpact:{currency:'EUR',currentValue:1000}}]);
 if(path.endsWith('/orders'))return Response.json({items:[{order:{id:1,side:'BUY',instrument:{ticker:'SYN_US_EQ'}},fill:{id:2,quantity:10,price:100}}],nextPagePath:null});
 if(path.endsWith('/dividends'))return Response.json({items:[{reference:'div-1',amount:5,currency:'EUR',paidOn:'2026-10-19'}],nextPagePath:null});
 if(path.endsWith('/transactions'))return Response.json({items:[{reference:'cash-1',amount:1250,currency:'EUR',type:'DEPOSIT'}],nextPagePath:null});
 throw new Error('Unexpected synthetic provider request');
}});
createServer(async(req,res)=>{
 res.setHeader('x-trace-id',randomUUID());res.setHeader('x-correlation-id',randomUUID());
 try{
  if(await route(req,res))return;
  if(req.url.startsWith('/api/')){json(res,200,{});return;}
  const file=req.url==='/trading212.js'?'trading212.js':req.url==='/manifest.webmanifest'?'manifest.webmanifest':'index.html';
  res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.webmanifest')?'application/manifest+json':'text/html');
  res.end(await readFile(`/web/${file}`));
 }catch{json(res,500,{error:'SYNTHETIC_TEST_FAILURE'});}
}).listen(8080);
while(true){await processBrokerJob(pool,factory);await new Promise(resolve=>setTimeout(resolve,500));}
