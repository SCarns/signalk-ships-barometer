'use strict';
const assert=require('assert'),{Assessment,PATHS}=require('../assessment');
const now=Date.UTC(2026,9,2,12);
function put(a,key,value,time=now,source='local'){a.ingest({updates:[{timestamp:new Date(time).toISOString(),$source:source,values:[{path:PATHS[key],value}]}]},now);}
function populated(){const a=new Assessment();for(let i=0;i<=240;i++){const t=now-(240-i)*60000;a.ingest({updates:[{timestamp:new Date(t).toISOString(),$source:'local',values:[{path:PATHS.pressure,value:100000+i*2},{path:PATHS.wind,value:2+i*.02}]}]},t);}return a;}
describe('Optional local assessment',()=>{
 it('requires original timestamps and provenance',()=>{const a=new Assessment();a.ingest({updates:[{values:[{path:PATHS.pressure,value:100000}]}]},now);assert.equal(a.evaluate(now).pressureState,'unknown');put(a,'pressure',100000,now+1);assert(!a.latest.pressure);});
 it('reports continuous measured pressure and wind changes in SI',()=>{const a=populated(),r=a.evaluate(now);assert.equal(r.pressureState,'rising');assert.equal(r.windState,'strengthening_observed');assert(Math.abs(r.measurements.pressureChange3h-360)<1e-8);assert(Math.abs(r.measurements.windChange1h-1.2)<1e-8);assert.equal(r.windOutlook,'uncalibrated');});
 it('does not bridge an outage',()=>{const a=populated();a.history.pressure=a.history.pressure.filter(x=>x.time<now-2*3600000||x.time>now-3600000);assert.equal(a.evaluate(now).pressureState,'unknown');});
 it('expires evidence while the feed is silent',()=>{const a=populated();assert.equal(a.evaluate(now+26*60000).pressureState,'unknown');assert.equal(a.evaluate(now+6*60000).windState,'unknown');});
 it('rejects source mixing and respects configured source',()=>{const a=new Assessment({pressure:'Outside'});put(a,'pressure',100000,now,'other');assert(!a.latest.pressure);put(a,'pressure',100000,now,'Outside');assert.equal(a.latest.pressure.source,'Outside');put(a,'pressure',105000,now+1,'other');assert.equal(a.latest.pressure.value,100000);});
 it('excludes external weather sources',()=>{const a=new Assessment();put(a,'pressure',100000,now,'open-meteo');assert(!a.latest.pressure);});
 it('rejects out-of-order readings and invalid numbers',()=>{const a=new Assessment();put(a,'wind',5);put(a,'wind',10,now-60000);assert.equal(a.latest.wind.value,5);put(a,'wind',NaN,now+60000);assert.equal(a.latest.wind.value,5);a.ingest({updates:[{timestamp:new Date(now+60000).toISOString(),$source:'local',values:[{path:PATHS.wind,value:NaN}]}]},now+60000);assert(!a.latest.wind);});
 it('uses supplied dew point and computes an offline fallback',()=>{const a=new Assessment();put(a,'temperature',288.15);put(a,'humidity',.96);assert.equal(a.evaluate(now).moistureState,'near_saturation');put(a,'dewpoint',287.15);assert.equal(a.evaluate(now).dewpointMethod,'supplied');assert.equal(a.evaluate(now).measurements.dewpointSpread,1);});
 it('round trips saved history without refreshing timestamps',()=>{const a=populated(),b=new Assessment();b.restore(JSON.parse(JSON.stringify(a.save())),now);assert.deepEqual(b.evaluate(now),a.evaluate(now));const c=new Assessment();c.restore(a.save(),now+5*3600000);assert.equal(c.evaluate(now+5*3600000).pressureState,'unknown');});
 it('bounds minute-binned history',()=>{const a=new Assessment();for(let i=0;i<60;i++)put(a,'wind',i,now-59000+i*1000);assert(a.history.wind.length<=2);});
});
