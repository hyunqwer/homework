import assert from 'node:assert/strict';
import {PlannerSync} from './dist/cloud-core.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
  let remote=null,writes=0,applied=null,checkpoint=null;const statuses=[];
  const engine=new PlannerSync({write:async(payload,base)=>{writes++;if((remote?.revision||0)!==base)throw Object.assign(Error(),{code:'planner/conflict'});remote={payload,revision:base+1};return remote.revision;},apply:p=>applied=p,status:s=>statuses.push(s),checkpoint:c=>checkpoint=c});
  return{engine,statuses,get applied(){return applied},get writes(){return writes},get checkpoint(){return checkpoint},get remote(){return remote},set remote(r){remote=r}};
}
{
 const f=fixture();f.engine.receive(null);assert.equal(f.statuses.at(-1),'empty');assert.equal(f.writes,0);
 f.engine.save('initial');await tick();assert.equal(f.remote.payload,'initial');assert.equal(f.applied,'initial');assert.equal(f.checkpoint,null);
 f.engine.receive({revision:0,payload:'stale'});assert.equal(f.applied,'initial');
}
{
 const f=fixture();f.remote={revision:1,payload:'base'};f.engine.receive(f.remote);
 f.remote={revision:2,payload:'another device'};f.engine.save('my edit');await tick();
 assert.equal(f.statuses.at(-1),'conflict');assert.equal(f.remote.payload,'another device');assert.equal(f.checkpoint.payload,'my edit');
 f.engine.receive(f.remote);assert.equal(f.applied,'base');assert.equal(f.engine.useRemote(),true);assert.equal(f.applied,'another device');assert.equal(f.checkpoint,null);
}
{
 let resolveWrite,writes=[];const saved=[];
 const e=new PlannerSync({write:(p,r)=>{writes.push([p,r]);return new Promise(resolve=>resolveWrite=()=>resolve(r+1));},apply:p=>saved.push(p),status(){},checkpoint(){}});
 e.receive(null);e.save('first');e.save('second');e.receive({revision:1,payload:'first'});assert.equal(writes.length,1);
 resolveWrite();await tick();assert.deepEqual(writes,[['first',0],['second',1]]);assert.deepEqual(saved,[]);
 resolveWrite();await tick();assert.equal(e.pending,null);assert.equal(e.revision,2);assert.deepEqual(saved,['second']);
}
{
 let attempt=0,backup;const status=[];
 const e=new PlannerSync({write:async()=>{if(!attempt++)throw Error('offline');return 2},apply(){},status:s=>status.push(s),checkpoint:s=>backup=s});
 e.receive({revision:1,payload:'base'});e.save('offline edit');await tick();assert.equal(status.at(-1),'error');assert.equal(backup.payload,'offline edit');
 const f=fixture();f.remote={revision:1,payload:'base'};f.engine.restore(backup);f.engine.receive(f.remote);await tick();assert.equal(f.remote.payload,'offline edit');
}
{
 const f=fixture();f.remote={revision:3,payload:'newer'};f.engine.restore({revision:1,payload:'old offline edit'});f.engine.receive(f.remote);
 assert.equal(f.statuses.at(-1),'conflict');assert.equal(f.writes,0);f.engine.close();f.engine.save('ignored');assert.equal(f.writes,0);
}
console.log('PASS: explicit first migration, revision transaction conflicts, queued edits, no stale rollback, pending recovery, offline/device conflicts, closed sessions.');
