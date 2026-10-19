'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const makePlugin=require('../index'),barometer=require('../barometer');
describe('Forecast comparison isolation',()=>{
 it('does not publish provider pressure or change forecast engine outputs',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'barometer-isolation-')),messages=[],subs=[],timers=new Map();let id=0,calls=0;
  const originalSet=global.setInterval,originalClear=global.clearInterval;
  global.setInterval=fn=>{timers.set(++id,fn);return id;};global.clearInterval=n=>timers.delete(n);
  const now=Date.now();const app={selfId:'boat',debug(){},error(e){throw Error(e);},getDataDirPath:()=>dir,
   getSelfPath:()=>({timestamp:new Date(now).toISOString(),value:{latitude:42,longitude:-86}}),
   weatherApi:{async getForecasts(){calls++;return [{type:'point',date:new Date(now+3600000).toISOString(),issuedAt:new Date(now-3600000).toISOString(),outside:{pressure:105000}}];}},
   handleMessage:(_id,d)=>messages.push(d),subscriptionmanager:{subscribe:(s,u,_error,cb)=>{subs.push({s,cb});u.push(()=>{});}}};
  let plugin;
  try {
   barometer.clear();plugin=makePlugin(app);plugin.start({rate:60,altitude:0,forecastComparison:true});
   await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(messages.length,0);assert.equal(barometer.getAll().length,0);
   const delta={context:'vessels.boat',updates:[{timestamp:new Date().toISOString(),$source:'sensor',values:[{path:'environment.outside.pressure',value:101000}]}]};
   const engine=subs.find(x=>x.s.context==='*');engine.cb(delta);assert(messages.length>0);
   const originalCount=messages.length;let route;plugin.registerWithRouter({get:(_url,fn)=>route=fn});
   let result;route({query:{hours:24}},{set(){},json:r=>result=r});assert.equal(result.comparison.future[0].pressure,105000);assert.equal(result.history.records.length,0);
   assert.equal(messages.length,originalCount);assert.equal(barometer.getAll().length,1);assert.equal(barometer.getAll()[0].meta.value,101000);
   plugin.stop();assert.equal(timers.size,0);await new Promise(resolve=>setTimeout(resolve,30));
  } finally {global.setInterval=originalSet;global.clearInterval=originalClear;fs.rmSync(dir,{recursive:true,force:true});}
 });
});
