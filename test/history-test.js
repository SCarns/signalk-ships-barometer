'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { History, MINUTE, RETENTION, MAX_RECORDS } = require('../lib/history');
const { segments } = require('../public/chart');
describe('Independent bounded pressure history', () => {
  let dir, h;
  const now = Date.parse('2026-10-17T12:00:00Z');
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barometer-history-')); h = new History(path.join(dir,'pressure.json'),'boat'); });
  afterEach(() => fs.rmSync(dir,{recursive:true,force:true}));
  const delta = (time, value = 101000, source = 'sensor', context = 'vessels.boat') => ({context, updates:[{timestamp: new Date(time).toISOString(), $source:source, values:[{path:'environment.outside.pressure',value}]}]});
  it('accepts at most one observation per minute and rejects invalid, old, future and other-vessel data', () => {
    h.ingest(delta(now,101000,'sensor','vessels.other'),now);
    for (const value of [NaN,null,0,-1,'101000']) h.ingest(delta(now,value),now);
    h.ingest(delta(now+1),now);h.ingest(delta(now-RETENTION),now);
    h.ingest({context:'vessels.boat',updates:[{values:[{path:'environment.outside.pressure',value:101000}]}]},now);
    assert.equal(h.records.length,0);
    h.ingest(delta(now-MINUTE),now);h.ingest(delta(now-MINUTE+1),now);h.ingest(delta(now),now);
    assert.equal(h.records.length,2);
  });
  it('enforces the 72-hour / 4320-record bound and expires without new data', () => {
    for (let i=0;i<5000;i++) h.add(now-(4999-i)*MINUTE,101000,'sensor',now);
    assert.equal(h.records.length,MAX_RECORDS);
    assert(h.records[0].time>now-RETENTION);
    assert.equal(h.snapshot(48,now+RETENTION).records.length,0);
  });
  it('persists original timestamps and source across restarts and prunes expired records on load', () => {
    h.add(now-RETENTION+MINUTE,101000,'sensor',now);h.add(now,100900,'sensor',now);h.save(now);
    const again=new History(h.file,'boat');again.load(now+2*MINUTE);
    assert.deepEqual(again.records,[{time:now,pressure:100900,source:'sensor'}]);
    assert.equal(again.source,'sensor');assert(!again.snapshot(24,now+6*MINUTE).fresh);
    again.save(now+RETENTION);assert.equal(JSON.parse(fs.readFileSync(h.file)).records.length,0);
  });
  it('does not rewrite clean data and retries failed writes', () => {
    h.add(now,101000,'sensor',now);h.save(now);assert.equal(h.dirty,false);
    h.file=path.join(dir,'missing','pressure.json');h.save(now);assert.equal(h.error,null);
    h.add(now+MINUTE,101100,'sensor',now+MINUTE);h.save(now+MINUTE);assert(h.error);assert(h.dirty);
    fs.mkdirSync(path.dirname(h.file));h.save(now+MINUTE);assert.equal(h.error,null);assert.equal(h.dirty,false);
  });
  it('handles corrupt persistence without stopping the plugin', () => {
    fs.writeFileSync(h.file,'broken');h.load(now);assert(h.error);assert.equal(h.records.length,0);
  });
  it('locks source and rejects weather services, missing sources, and out-of-order readings', () => {
    h.ingest(delta(now-2*MINUTE,101000,'open-meteo'),now);assert.equal(h.records.length,0);
    h.add(now-2*MINUTE,101000,undefined,now);assert.equal(h.records.length,0);
    h.add(now-MINUTE,101000,'sensor',now);h.add(now,101100,'other',now);h.add(now-2*MINUTE,101000,'sensor',now);
    assert.equal(h.records.length,1);
    const configured=new History(h.file,'boat',()=>{},'chosen');configured.ingest(delta(now),now);assert.equal(configured.records.length,0);
  });
  it('computes a three-hour change only from a real baseline with fresh current data', () => {
    h.add(now-3*3600000,101000,'sensor',now);h.add(now,100700,'sensor',now);
    assert.equal(h.snapshot(6,now).delta3h,-300);assert.equal(h.snapshot(6,now+6*MINUTE).delta3h,null);
    h.records.shift();assert.equal(h.snapshot(6,now).delta3h,null);
  });
  it('splits chart lines at outages and source changes, preserving isolated points', () => {
    const records=[{time:0,source:'a'},{time:MINUTE,source:'a'},{time:4*MINUTE,source:'a'},{time:5*MINUTE,source:'b'}];
    assert.deepEqual(segments(records,2*MINUTE).map(s=>s.length),[2,1,1]);
  });
});
