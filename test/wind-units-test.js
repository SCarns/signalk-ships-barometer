'use strict';
const assert = require('assert');
const barometer = require('../barometer');
const wind = value => barometer.onDeltasUpdate({updates:[{values:[{path:'environment.wind.directionTrue',value}]}]});
const pressure = value => barometer.onDeltasUpdate({updates:[{values:[{path:'environment.outside.pressure',value}]}]});
function history(value, units) {
 const meta={value:101500,altitude:0,temperature:293.15,twd:value};
 if(units) meta.twdUnits=units;
 return [{datetime:new Date(Date.now()-60000),value:101500,meta}];
}
describe('Wind units and history compatibility',function(){
 beforeEach(()=>barometer.clear());
 it('converts quadrants and wrap-around',function(){
  for(const [rad,deg] of [[0,0],[Math.PI/2,90],[Math.PI,180],[3*Math.PI/2,270],[2*Math.PI,0],[-Math.PI/2,270]]){
   wind(rad);assert(Math.abs(barometer.getLatest().twd.value-deg)<1e-9);assert.strictEqual(barometer.hasTWDWithinOneMinute(),true);
  }
 });
 it('rejects invalid wind and recovers',function(){
  for(const invalid of [null,undefined,NaN,Infinity,-Infinity,'3.14',true]){
   wind(Math.PI);wind(invalid);assert.strictEqual(barometer.getLatest().twd.value,null);assert.strictEqual(barometer.hasTWDWithinOneMinute(),false);
  }
  wind(Math.PI);assert.strictEqual(barometer.getLatest().twd.value,180);
 });
 it('retains the freshness boundary',function(){
  const original=Date.now;let now=original();Date.now=()=>now;
  try{wind(Math.PI);now+=60000;assert.strictEqual(barometer.hasTWDWithinOneMinute(),true);now+=1;assert.strictEqual(barometer.hasTWDWithinOneMinute(),false);}finally{Date.now=original;}
 });
 it('passes degrees to the forecasting library',function(){
  wind(3*Math.PI/2);pressure(101500);const saved=barometer.getAll()[0];
  assert.strictEqual(saved.meta.twd,270);assert.strictEqual(saved.meta.twdUnits,'deg');assert.strictEqual(saved.meta.value,101500);
 });
 it('migrates legacy history without altering pressure or dates',function(){
  const input=history(Math.PI);const snapshot=JSON.stringify(input);barometer.populate(()=>input);const record=barometer.getAll()[0];
  assert.strictEqual(record.meta.twd,180);assert.strictEqual(record.meta.twdUnits,'deg');assert.strictEqual(record.meta.value,101500);assert.strictEqual(record.meta.temperature,293.15);assert.strictEqual(record.datetime.getTime(),input[0].datetime.getTime());assert.strictEqual(JSON.stringify(input),snapshot);
 });
 it('avoids double conversion across restarts',function(){
  barometer.populate(()=>history(Math.PI/180));let saved;barometer.persist(data=>saved=JSON.stringify(data));
  for(let i=0;i<3;i++){barometer.clear();barometer.populate(()=>barometer.JSONParser(saved));assert(Math.abs(barometer.getAll()[0].meta.twd-1)<1e-9);barometer.persist(data=>saved=JSON.stringify(data));}
 });
 it('preserves missing wind',function(){barometer.populate(()=>history(null));assert.strictEqual(barometer.getAll()[0].meta.twd,null);});
 it('keeps all original output paths',function(){
  const expected=['trend.tendency','trend.trend','trend.severity','trend.period','trend.period.from','trend.period.to','prediction.pressureOnly','prediction.quadrant','prediction.season','prediction.beaufort','prediction.beaufort.description','prediction.front.tendency','prediction.front.prognose','prediction.front.wind','system','1hr','3hr','6hr','12hr','24hr','48hr'].map(p=>'environment.outside.pressure.'+p).sort();
  barometer.populate(()=>history(Math.PI));wind(Math.PI);const updates=pressure(101499);assert.deepStrictEqual(updates.map(v=>v.path).sort(),expected);
 });
});
