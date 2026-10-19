'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const makePlugin=require('../index'),barometer=require('../barometer');
describe('History endpoint and lifecycle',()=>{
 it('records only local observations, validates ranges, persists on stop and restores on start',async ()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'barometer-api-')),subs=[],timers=new Set();
  const si=global.setInterval,ci=global.clearInterval;
  global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=fn=>timers.delete(fn);
  const app={selfId:'boat',debug:()=>{},error:e=>{throw Error(String(e));},getDataDirPath:()=>dir,handleMessage:()=>{},subscriptionmanager:{subscribe:(s,u,e,cb)=>{subs.push({s,cb});u.push(()=>{});}}};
  const p=makePlugin(app);let handler;
  p.registerWithRouter({get:(route,fn)=>{assert.equal(route,'/history');handler=fn;}});
  const query=hours=>{let status=200,result;handler({query:{hours}},{set:()=>{},status:n=>{status=n;return {json:v=>result=v};},json:v=>result=v});return {status,result};};
  try {
   barometer.clear();p.start({rate:60,altitude:0});
   const recorder=subs.find(x=>x.s.context==='vessels.boat');assert(recorder);
   recorder.cb({context:'vessels.boat',updates:[{timestamp:new Date(Date.now()-1000).toISOString(),$source:'sensor',values:[{path:'environment.outside.pressure',value:101200}]}]});
   assert.equal(query(6).result.history.records.length,1);assert.equal(query(72).status,400);
   p.stop();assert.equal(timers.size,0);assert.equal(query(6).result.running,false);
   await new Promise(resolve=>setTimeout(resolve,30));
   p.start({rate:60,altitude:0});assert.equal(query(48).result.history.records.length,1);p.stop();
   await new Promise(resolve=>setTimeout(resolve,30));
  }finally{global.setInterval=si;global.clearInterval=ci;}
  fs.rmSync(dir,{recursive:true,force:true});
 });
});
