'use strict';
const fs = require('fs');
const HOUR = 3600000;
const RETENTION = 72 * HOUR;
const MAX_AGE = 6 * HOUR;
const MAX_POINTS = 120; // One actual forecast per valid hour, 72 past + 48 future.
const DEFAULT_PROVIDER = 'Signal K default Weather API provider';
const validPosition = p => p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
function distance(a, b) {
  const r = Math.PI / 180;
  const v = Math.sin((b.latitude-a.latitude)*r/2)**2 + Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((b.longitude-a.longitude)*r/2)**2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(v)));
}
function positionAt(app, now) {
  const leaf = app.getSelfPath && app.getSelfPath('navigation.position');
  const time = leaf && typeof leaf.timestamp === 'string' ? Date.parse(leaf.timestamp) : NaN;
  return leaf && validPosition(leaf.value) && Number.isFinite(time) && time <= now && now-time <= 5*60000 ? {latitude:leaf.value.latitude,longitude:leaf.value.longitude} : null;
}
function issueTime(value) { return typeof value === 'string' && /(Z|[+-]\d{2}:\d{2})$/i.test(value) ? Date.parse(value) : NaN; }
function validPoint(p) {
  return p && Number.isFinite(p.time) && Number.isFinite(p.pressure) && p.pressure >= 80000 && p.pressure <= 110000 && Number.isFinite(p.issuedAt) && p.issuedAt <= p.receivedAt && p.receivedAt < p.time && validPosition(p.position) && typeof p.source === 'string';
}
class ForecastComparison {
  constructor(app, file, enabled = false, clock = Date.now) {
    this.clock = clock; this.app = app; this.file = file; this.enabled = enabled;
    this.archive = []; this.latest = []; this.state = enabled ? 'waiting' : 'disabled';
    this.dirty = false; this.closed = false; this.pending = null; this.storageError = null;
  }
  prune(now) {
    const keep = points => points.filter(p => validPoint(p) && p.receivedAt <= now && p.issuedAt <= now && p.time > now-RETENTION && p.time <= now+48*HOUR).sort((a,b)=>a.time-b.time).slice(-MAX_POINTS);
    const previous = this.archive.length; this.archive = keep(this.archive); this.latest = keep(this.latest);
    if(previous !== this.archive.length)this.dirty = true;
  }
  load(now = this.clock()) {
    if(!this.enabled)return;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if(data.version !== 1 || !Array.isArray(data.archive) || !Array.isArray(data.latest) || data.archive.length > MAX_POINTS || data.latest.length > MAX_POINTS)throw Error('Invalid comparison history');
      this.archive = data.archive; this.latest = data.latest; this.prune(now); this.dirty = true;
      // A saved forecast is not evidence of current provider availability after restart.
    } catch(err) { if(err.code !== 'ENOENT'){this.storageError=err.message;this.app.error('Forecast comparison history could not be loaded: '+err.message);} }
  }
  save(now = this.clock()) {
    if(!this.enabled)return;
    this.prune(now);if(!this.dirty)return;
    try {
      fs.writeFileSync(this.file+'.tmp',JSON.stringify({version:1,archive:this.archive,latest:this.latest}));
      fs.renameSync(this.file+'.tmp',this.file);this.dirty=false;this.storageError=null;
    } catch(err){this.storageError=err.message;this.app.error('Forecast comparison history could not be saved: '+err.message);}
  }
  async refresh(now = this.clock()) {
    if(!this.enabled || this.closed || this.pending)return;
    const position=positionAt(this.app,now);
    if(!position){this.state='position-unavailable';return;}
    if(typeof this.app.weatherApi?.getForecasts !== 'function'){this.state='api-unavailable';return;}
    // Only the server's existing default provider. No weather URL, account or provider registration.
    let timeout;
    this.pending = Promise.race([
      Promise.resolve().then(()=>this.app.weatherApi.getForecasts(position,'point',{maxCount:96})),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Weather API timeout')),10000);})
    ]);
    try {
      const data=await this.pending;
      if(this.closed)return;
      now=this.clock(); // Receipt time, not the start of an asynchronous request.
      const current=positionAt(this.app,this.clock());
      if(!current || distance(position,current)>20000){this.state='position-unavailable';return;}
      if(!Array.isArray(data)){this.state='pressure-unavailable';return;}
      const pressure=data.slice(0,512).filter(p=>p?.type==='point' && Number.isFinite(p.outside?.pressure) && p.outside.pressure>=80000 && p.outside.pressure<=110000);
      if(!pressure.length){this.state='pressure-unavailable';return;}
      // date is VALID time, never issue time. issuedAt is optional provider metadata,
      // not a guaranteed Weather API field. Missing metadata means skip, not guess.
      const dated=pressure.filter(p=>Number.isFinite(issueTime(p.issuedAt)) && issueTime(p.issuedAt)<=now);
      if(!dated.length){this.state='issue-time-unavailable';return;}
      const newest=Math.max(...dated.map(p=>issueTime(p.issuedAt)));
      if(now-newest>MAX_AGE){this.state='stale';return;}
      const seen=new Set();
      const points=dated.filter(p=>issueTime(p.issuedAt)===newest).map(p=>({
        time:issueTime(p.date),pressure:p.outside.pressure,issuedAt:newest,receivedAt:now,position,
        source:typeof p.source==='string'&&p.source.trim()?p.source.slice(0,120):DEFAULT_PROVIDER
      })).filter(p=>validPoint(p)&&p.time<=now+48*HOUR).sort((a,b)=>a.time-b.time).filter(p=>{
        const bin=Math.floor(p.time/HOUR);if(seen.has(bin))return false;seen.add(bin);return true;
      });
      if(!points.length){this.state='pressure-unavailable';return;}
      this.latest=points;
      // Freeze the first forecast received BEFORE each valid hour. Never backfill
      // history with observations, a hindcast or a later revised forecast.
      for(const p of points){const exists=this.archive.some(q=>Math.floor(q.time/HOUR)===Math.floor(p.time/HOUR) && q.source===p.source && distance(q.position,p.position)<=20000);if(!exists)this.archive.push(p);}
      this.state='current';this.dirty=true;this.prune(now);
    } catch(_err) {if(!this.closed)this.state='provider-unavailable';}
    finally {clearTimeout(timeout);this.pending=null;}
  }
  snapshot(hours, now = this.clock()) {
    if(!this.enabled)return {enabled:false,state:'disabled',past:[],future:[]};
    this.prune(now);
    const position=positionAt(this.app,now);
    const nearby=p=>position && distance(p.position,position)<=20000;
    const past=this.archive.filter(p=>p.time>=now-hours*HOUR && p.time<=now && nearby(p));
    const future=this.state==='current'?this.latest.filter(p=>p.time>now && p.time<=now+Math.min(hours,24)*HOUR && now-p.issuedAt<=MAX_AGE && nearby(p)):[];
    const state=!position?'position-unavailable':this.state==='current'&&!future.length?'stale':this.state;
    return {enabled:true,state,past,future,storageError:this.storageError,
      reference:'Weather API pressure reference is not specified; sensor pressure is unchanged.',
      historyPolicy:'First forecast received before each valid hour; historical forecasts are not revised.'};
  }
  stop() {this.closed=true;this.save();}
}
module.exports={ForecastComparison,positionAt,MAX_AGE,RETENTION,MAX_POINTS};
