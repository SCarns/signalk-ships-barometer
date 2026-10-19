'use strict';
const fs = require('fs');
const MINUTE = 60000;
const RETENTION = 72 * 60 * MINUTE;
const MAX_RECORDS = 4320;
const PRESSURE = 'environment.outside.pressure';

// Observations only: no synthetic timer samples, interpolation or forecast inputs.
class History {
  constructor(file, selfId, report = () => {}, source = '') {
    this.file = file;
    this.context = `vessels.${selfId}`;
    this.report = report;
    this.source = source;
    this.records = [];
    this.dirty = false;
    this.error = null;
  }
  prune(now = Date.now()) {
    const kept = this.records.filter(p => p.time > now - RETENTION && p.time <= now).slice(-MAX_RECORDS);
    if (kept.length !== this.records.length) this.dirty = true;
    this.records = kept;
  }
  add(time, pressure, source, now = Date.now()) {
    if (typeof source !== 'string' || !source || /open-meteo|noaa|weatherapi/i.test(source)) return false;
    if (!Number.isFinite(time) || !Number.isFinite(pressure) || pressure <= 0 || time > now || time <= now - RETENTION) return false;
    if (this.source && source !== this.source) return false;
    const last = this.records[this.records.length - 1];
    if (last && time < last.time + MINUTE) return false;
    if (!this.source) this.source = source;
    this.records.push({ time, pressure, source });
    this.dirty = true;
    this.prune(now);
    return true;
  }
  ingest(delta, now = Date.now()) {
    if (!delta || ![this.context, 'vessels.self'].includes(delta.context)) return;
    for (const u of delta.updates || []) {
      // Require a timestamp: receipt time must never make a cached reading look fresh.
      const time = typeof u.timestamp === 'string' ? Date.parse(u.timestamp) : NaN;
      const source = u.$source || (u.source && (u.source.label || u.source.src));
      for (const v of u.values || []) if (v.path === PRESSURE) this.add(time, v.value, source, now);
    }
  }
  load(now = Date.now()) {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_RECORDS) throw new Error('Invalid history file');
      this.dirty = true; // Rewrite after filtering even when every saved record expired.
      const configured = this.source;
      if (!configured && typeof data.source === 'string') this.source = data.source;
      for (const p of data.records) this.add(p.time, p.pressure, p.source, now);
      this.prune(now);
    } catch (err) {
      if (err.code !== 'ENOENT') { this.error = err.message; this.report(`Pressure history could not be loaded: ${err.message}`); }
    }
  }
  save(now = Date.now()) {
    this.prune(now);
    if (!this.dirty) return;
    try {
      fs.writeFileSync(this.file + '.tmp', JSON.stringify({ version: 1, source: this.source, records: this.records }));
      fs.renameSync(this.file + '.tmp', this.file);
      this.dirty = false;
      this.error = null;
    } catch (err) { this.error = err.message; this.report(`Pressure history could not be saved: ${err.message}`); }
  }
  snapshot(hours = 24, now = Date.now()) {
    this.prune(now);
    const latest = this.records.at(-1) || null;
    const fresh = !!latest && now - latest.time <= 5 * MINUTE;
    // An actual sample near three hours ago, never an interpolated baseline.
    const baseline = latest && this.records.find(p => Math.abs(p.time - (latest.time - 3 * 60 * MINUTE)) <= MINUTE);
    return { now, source: this.source || null, storageError: this.error, latest, fresh,
      delta3h: fresh && baseline ? latest.pressure - baseline.pressure : null,
      gapMs: 1.5 * MINUTE, records: this.records.filter(p => p.time >= now - hours * 60 * MINUTE) };
  }
}
module.exports = { History, RETENTION, MINUTE, MAX_RECORDS };
