import { Pool } from 'pg';
import { writeFileSync } from 'node:fs';
import { processBrokerJob } from './broker-sync.js';
const pool=new Pool({connectionString:process.env.DATABASE_URL});
let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
while(!stopped){
 try{await processBrokerJob(pool);writeFileSync('/tmp/broker-worker-ready',String(Date.now()));}
 catch{console.error(JSON.stringify({service:'broker-worker',operation:'queue_unavailable'}));}
 await new Promise(resolve=>setTimeout(resolve,2000));
}
await pool.end();
