'use strict';
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {ForecastComparison,MAX_AGE,RETENTION,MAX_POINTS}=require('../lib/forecast-comparison');
const HOUR=3600000;
describe('Weather API comparison only',()=>{
 let dir,c,now,rows,app,calls;
 const point=(time,pressure=101000,issuedAt=now-HOUR)=>({date:new Date(time).toISOString(),type:'point',issuedAt:new Date(issuedAt).toISOString(),source:'Test Weather API provider',outside:{pressure}});
 beforeEach(()=>{
  now=Date.parse('2026-10-18T12:00:00Z');dir=fs.mkdtempSync(path.join(os.tmpdir(),'barometer-comparison-'));calls=[];
  rows=[point(now+HOUR),point(now+2*HOUR,101100)];
  app={error(){},getSelfPath:()=>({value:{latitude:42,longitude:-86},timestamp:new Date(now).toISOString()}),weatherApi:{getForecasts:async(...args)=>{calls.push(args);return rows;}}};
  c=new ForecastComparison(app,path.join(dir,'forecast.json'),true,()=>now);
 });
 afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));
 it('uses only the existing default Weather API and never requests weather when disabled',async()=>{
  const off=new ForecastComparison(app,c.file,false,()=>now);await off.refresh();assert.equal(calls.length,0);assert.equal(off.snapshot(24).state,'disabled');off.save();assert(!fs.existsSync(c.file));
  await c.refresh();assert.deepEqual(calls[0],[{latitude:42,longitude:-86},'point',{maxCount:96}]);assert.equal(c.snapshot(24).future.length,2);
 });
 it('does not mistake valid time, receipt time or successful cached retrieval for issue time',async()=>{
  rows=rows.map(({issuedAt,...p})=>p);await c.refresh();assert.equal(c.state,'issue-time-unavailable');assert.equal(c.latest.length,0);
  rows=[point(now+HOUR,101000,now-MAX_AGE-1)];await c.refresh();assert.equal(c.state,'stale');assert.equal(c.snapshot(24).future.length,0);
  rows=[point(now+HOUR,101000,now+1)];await c.refresh();assert.equal(c.state,'issue-time-unavailable');
 });
 it('skips observations, daily summaries, invalid pressure, past points and wrong units',async()=>{
  rows=[{...point(now+HOUR),type:'observation'},{...point(now+HOUR),type:'daily'},point(now+HOUR,1010),point(now+HOUR,NaN),point(now-HOUR),point(now+49*HOUR)];
  await c.refresh();assert.equal(c.snapshot(24).future.length,0);assert.equal(c.archive.length,0);
 });
 it('freezes forecasts actually received before each hour and never revises them retrospectively',async()=>{
  const before=JSON.stringify(rows);await c.refresh();assert.equal(JSON.stringify(rows),before);
  const issued=c.archive[0].issuedAt,received=c.archive[0].receivedAt;
  rows=[point(now+HOUR,100500,now)];await c.refresh();assert.equal(c.latest[0].pressure,100500);assert.equal(c.archive[0].pressure,101000);
  now+=HOUR+1;const result=c.snapshot(24);assert.equal(result.past[0].pressure,101000);assert.equal(result.past[0].issuedAt,issued);assert.equal(result.past[0].receivedAt,received);
  rows=[point(now-HOUR,99900,now-HOUR)];await c.refresh();assert.equal(c.snapshot(24).past[0].pressure,101000);
 });
 it('retains historical comparison but omits the current forecast on provider failure and staleness',async()=>{
  await c.refresh();now+=HOUR+1;app.weatherApi.getForecasts=async()=>{throw Error('Offline');};await c.refresh();
  const result=c.snapshot(24);assert.equal(result.state,'provider-unavailable');assert.equal(result.future.length,0);assert.equal(result.past.length,1);
  app.weatherApi.getForecasts=async()=>rows;await c.refresh();now+=MAX_AGE;assert.equal(c.snapshot(24).future.length,0);
 });
 it('skips missing Weather API, missing pressure and stale position without affecting observations',async()=>{
  const savedApi=app.weatherApi;delete app.weatherApi;await c.refresh();assert.equal(c.state,'api-unavailable');app.weatherApi=savedApi;
  rows=[];await c.refresh();assert.equal(c.state,'pressure-unavailable');
  app.getSelfPath=()=>({value:{latitude:42,longitude:-86},timestamp:new Date(now-6*60000).toISOString()});await c.refresh();assert.equal(c.state,'position-unavailable');assert.equal(calls.length,1);
 });
 it('does not compare a forecast for another location; permits new local forecast history',async()=>{
  await c.refresh();app.getSelfPath=()=>({value:{latitude:30,longitude:-86},timestamp:new Date(now).toISOString()});assert.equal(c.snapshot(24).future.length,0);
  await c.refresh();assert.equal(c.snapshot(24).future.length,2);assert.equal(c.archive.length,4);
 });
 it('bounds forecasts to one point per valid hour, 48 hours forward and 72 hours of comparison',async()=>{
  rows=Array.from({length:512},(_,i)=>point(now+(i+1)*60000));await c.refresh();
  assert(c.latest.length<=10);assert(c.archive.length<=MAX_POINTS);
  now+=RETENTION+48*HOUR;c.save();assert.equal(c.archive.length,0);assert.equal(JSON.parse(fs.readFileSync(c.file)).archive.length,0);
 });
 it('persists original forecasts but requires provider confirmation after restart',async()=>{
  await c.refresh();c.save();now+=HOUR+1;
  const restored=new ForecastComparison(app,c.file,true,()=>now);restored.load();assert.equal(restored.snapshot(24).past.length,1);assert.equal(restored.snapshot(24).future.length,0);
  await restored.refresh();assert.equal(restored.snapshot(24).future.length,1);
 });
 it('handles corrupt storage and retries failed atomic saves',async()=>{
  fs.writeFileSync(c.file,'broken');c.load();assert(c.storageError);await c.refresh();c.save();assert.equal(c.storageError,null);
  c.file=path.join(dir,'missing','forecast.json');c.dirty=true;c.save();assert(c.storageError);assert(c.dirty);
  fs.mkdirSync(path.dirname(c.file));c.save();assert.equal(c.storageError,null);
 });
 it('does not overlap provider requests or accept a late result after stop',async()=>{
  let resolve;app.weatherApi.getForecasts=()=>new Promise(r=>resolve=r);
  const pending=c.refresh();await Promise.resolve();await c.refresh();c.stop();resolve(rows);await pending;assert.equal(c.archive.length,0);
 });
});
