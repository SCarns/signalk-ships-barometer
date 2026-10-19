'use strict';
const el = id => document.getElementById(id);
let hours = 24;
let request = 0;
for (const b of document.querySelectorAll('[data-hours]')) b.onclick = () => {
  hours = Number(b.dataset.hours);
  for (const other of document.querySelectorAll('[data-hours]')) other.setAttribute('aria-pressed', String(other === b));
  refresh();
};
function node(tag, attrs = {}, text) {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key,value] of Object.entries(attrs)) n.setAttribute(key,value);
  if (text !== undefined) n.textContent = text;
  return n;
}
function chart(h, comparison) {
  const svg = el('chart'); svg.replaceChildren();
  const width = Math.max(340, svg.getBoundingClientRect().width);
  svg.setAttribute('viewBox', `0 0 ${width} 320`);
  const right = width - 20;
  const data = h.records.filter(p => p.time >= h.now - hours * 3600000);
  if (!data.length) { svg.append(node('text',{x:70,y:150},'Waiting for pressure observations')); return; }
  const start = h.now - hours * 3600000;
  const past = comparison?.past || [], future = comparison?.future || [];
  const forecast = past.concat(future);
  const pressures = data.concat(forecast).map(p => p.pressure);
  const end = future.length ? Math.max(h.now,...future.map(p=>p.time)) : h.now;
  const lo = Math.min(...pressures)/100 - 1;
  const hi = Math.max(...pressures)/100 + 1;
  const x = t => 70 + (t-start)/(end-start)*(right-70);
  const y = p => 260 - (p/100-lo)/(hi-lo)*235;
  const ticks = width < 600 ? 2 : 4;
  for (let i=0;i<=ticks;i++) {
    const value=lo+(hi-lo)*i/ticks, cy=y(value*100);
    svg.append(node('line',{x1:70,x2:right,y1:cy,y2:cy,class:'grid'}),node('text',{x:4,y:cy+5},value.toFixed(1)));
    const time=start+(end-start)*i/ticks;
    const anchor = i===0?'start':i===ticks?'end':'middle';
    svg.append(node('text',{x:x(time),y:290,'text-anchor':anchor},new Date(time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
    svg.append(node('text',{x:x(time),y:313,'text-anchor':anchor},new Date(time).toLocaleDateString([],{month:'short',day:'numeric'})));
  }
  // Comparison is drawn first, underneath authoritative onboard observations.
  for (const [points, className] of [[past,'forecast-past'],[future,'forecast-future']]) {
    for (const group of pressureSegments(points,3*3600000)) {
      svg.append(node('path',{class:className,d:group.map((p,i)=>`${i?'L':'M'}${x(p.time)},${y(p.pressure)}`).join(' ')}));
      for (const p of group) {
        const dot=node('circle',{cx:x(p.time),cy:y(p.pressure),r:group.length===1?3:2,class:'forecast-point'});
        dot.append(node('title',{},`${p.source} · valid ${new Date(p.time).toLocaleString()} · ${(p.pressure/100).toFixed(1)} hPa · issued ${new Date(p.issuedAt).toLocaleString()} · received ${new Date(p.receivedAt).toLocaleString()}`));svg.append(dot);
      }
    }
  }
  if(forecast.length) {
    svg.append(node('line',{x1:x(h.now),x2:x(h.now),y1:20,y2:260,class:'now-line'}));
    svg.append(node('text',{x:Math.min(right-30,x(h.now)+5),y:18},'Now'));
  }
  for (const group of pressureSegments(data,h.gapMs)) {
    svg.append(node('path',{class:'observed',d:group.map((p,i)=>`${i?'L':'M'}${x(p.time)},${y(p.pressure)}`).join(' ')}));
    for (const p of group) {
      const dot=node('circle',{cx:x(p.time),cy:y(p.pressure),r:group.length===1?3:1.6});
      dot.append(node('title',{},`${new Date(p.time).toLocaleString()}: ${(p.pressure/100).toFixed(1)} hPa`));svg.append(dot);
    }
  }
}
function showComparison(comparison) {
  const enabled=!!comparison?.enabled;
  el('forecast-status').hidden=!enabled;
  const messages={waiting:'Waiting for Weather API forecast data.', 'api-unavailable':'No Weather API available. Install a Signal K Weather API-compatible provider to use forecast comparison.', 'position-unavailable':'Forecast comparison omitted: fresh boat position is unavailable.', 'pressure-unavailable':'No compatible pressure forecast returned. Choose a Signal K Weather API-compatible provider that supplies pressure.', 'issue-time-unavailable':'Forecast comparison omitted: the provider does not supply a verifiable issue time.', stale:'Current forecast omitted: forecast is stale or has no upcoming pressure points.', 'provider-unavailable':'Current forecast omitted: Weather API provider is unavailable.', current:'Forecast comparison only. The boat is the authority.'};
  el('forecast-status').textContent=messages[comparison?.state] || '';
  const points=(comparison?.past || []).concat(comparison?.future || []);
  el('forecast-legend').hidden=!points.length;
  const providers=[...new Set(points.map(p=>p.source))].join(', ');
  const newest=points.length?Math.max(...points.map(p=>p.issuedAt)):null;
  el('forecast-provenance').hidden=!points.length;
  el('forecast-provenance').textContent=points.length?`${providers} · latest displayed issue ${new Date(newest).toLocaleString()}. Historical points keep their original issue times (inspect points). ${comparison.reference} Saved forecasts are comparison only.`:'';
  if(comparison?.storageError)el('forecast-status').textContent+=' Forecast comparison storage needs attention.';
}
function clearReadings() { for (const id of ['pressure','change','tendency']) el(id).textContent='—'; el('assessment').textContent='Waiting for fresh Barometer analysis.';el('local').textContent=''; }
async function refresh() {
  const seq=++request;
  try {
    const response=await fetch(`../plugins/signalk-ships-barometer/history?hours=${hours}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if (!response.ok) throw new Error('History unavailable');
    const data=await response.json();
    if(seq!==request)return;
    if (!data.running || !data.history) throw new Error('Barometer plugin is stopped');
    window.BarometerTheme.update(data.display || {});
    const h=data.history;
    clearReadings();
    el('status').textContent = h.latest ? `${h.fresh?'Live observations':'Stale observations'} · last reading ${new Date(h.latest.time).toLocaleString()}` : 'Waiting for local pressure observations';
    if(h.storageError)el('status').textContent+=' · history storage needs attention';
    el('pressure').textContent=h.fresh?(h.latest.pressure/100).toFixed(1):'—';
    el('change').textContent=h.delta3h===null?'—':`${h.delta3h>0?'+':''}${(h.delta3h/100).toFixed(1)}`;
    const read=path=>{const v=data.analysis[path];return v&&h.fresh&&h.now-v.time<=5*60000?v.value:null;};
    const prefix='environment.outside.pressure.';
    el('tendency').textContent=read(prefix+'trend.tendency') || '—';
    el('assessment').textContent=read(prefix+'prediction.quadrant') || read(prefix+'prediction.pressureOnly') || 'Waiting for existing Barometer analysis.';
    const local=read('environment.outside.weather.assessment');
    if(local&&Array.isArray(local.reasons))el('local').textContent=local.reasons.join(' ');
    el('source').textContent=`Pressure source: ${h.source||'waiting'} · 3-hour change needs an observed sample within one minute of the baseline.`;
    showComparison(data.comparison);
    chart(h,data.comparison);
  } catch(err) { if(seq!==request)return;clearReadings();el('status').textContent=`${err.message} · reconnecting`;el('chart').replaceChildren();el('source').textContent='';showComparison(null); }
}
refresh();setInterval(refresh,30000);
