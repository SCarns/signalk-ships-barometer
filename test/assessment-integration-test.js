'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const makePlugin=require('../index'),barometer=require('../barometer');
function run(enabled,body){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'barometer-assessment-')),subscriptions=[],messages=[],timers=new Map();let id=0;
 const si=global.setInterval,ci=global.clearInterval;
 global.setInterval=fn=>{timers.set(++id,fn);return id;};global.clearInterval=n=>timers.delete(n);
 const app={selfId:'test-vessel',debug:()=>{},error:e=>{throw Error(String(e));},getDataDirPath:()=>dir,handleMessage:(id,d)=>messages.push(d),subscriptionmanager:{subscribe:(s,unsub,error,cb)=>{subscriptions.push({s,cb});unsub.push(()=>{});}}};
 const plugin=makePlugin(app);barometer.clear();
 try{plugin.start({rate:60,altitude:0,localAssessment:enabled,assessmentPressureSource:'Outside',assessmentTemperatureSource:'Outside',assessmentHumiditySource:'signalk-node-red'});body({plugin,dir,subscriptions,messages,timers});plugin.stop();assert.equal(timers.size,0);}finally{global.setInterval=si;global.clearInterval=ci;}
}
describe('Assessment plugin lifecycle',()=>{
 it('adds no subscription, output or assessment file when disabled',()=>run(false,x=>{assert.equal(x.subscriptions.length,1);assert.equal(x.messages.length,0);assert(!fs.existsSync(path.join(x.dir,'local-assessment.json')));}));
 it('subscribes locally and publishes the optional path with unchanged legacy forecasts',()=>run(true,x=>{
  assert.equal(x.subscriptions.length,2);assert.equal(x.subscriptions[1].s.context,'vessels.test-vessel');
  assert.equal(x.messages[0].updates[0].values[0].path,'environment.outside.weather.assessment');
  const now=new Date().toISOString();x.subscriptions[1].cb({context:'vessels.test-vessel',updates:[{timestamp:now,$source:'Outside',values:[{path:'environment.outside.temperature',value:288.15}]}]});
  x.subscriptions[1].cb({context:'vessels.test-vessel',updates:[{timestamp:now,$source:'signalk-node-red',values:[{path:'environment.outside.humidity',value:.96}]}]});
  [...x.timers.values()][0]();assert.equal(x.messages.at(-1).updates[0].values[0].value.moistureState,'near_saturation');
  x.subscriptions[0].cb({updates:[{values:[{path:'environment.wind.directionTrue',value:Math.PI},{path:'environment.outside.pressure',value:101500}]}]});
  assert.equal(x.messages.at(-1).updates[0].values.length,21);
  [...x.timers.values()][1]();const saved=JSON.parse(fs.readFileSync(path.join(x.dir,'local-assessment.json')));assert.equal(saved.latest.temperature.source,'Outside');
 }));
 it('ignores another vessel in assessment ingestion',()=>run(true,x=>{x.subscriptions[1].cb({context:'vessels.other',updates:[{timestamp:new Date().toISOString(),$source:'Outside',values:[{path:'environment.outside.temperature',value:288.15}]}]});[...x.timers.values()][0]();assert(!x.messages.at(-1).updates[0].values[0].value.inputs.temperature);}));
});
