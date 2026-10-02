// Ship's Barometer modifications by SCarns, 2026. Derived from oyve/signalk-barometer-trend v2.3.4; see NOTICE and CHANGELOG.md.
'use strict';
const PATHS={pressure:'environment.outside.pressure',wind:'environment.wind.speedTrue',temperature:'environment.outside.temperature',humidity:'environment.outside.humidity',dewpoint:'environment.outside.dewPointTemperature',water:'environment.water.temperature'};
const MAX_AGE={pressure:25*60000,wind:5*60000,temperature:10*60000,humidity:10*60000,dewpoint:10*60000,water:30*60000};
const median=a=>{a=a.slice().sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
class Assessment {
 constructor(preferred={}, waterDepthM=null){this.history={};this.sources={};this.latest={};this.preferred=preferred;this.waterDepthM=waterDepthM;}
 ingest(delta,now=Date.now()){
  if(delta.context && delta.context!=='vessels.self' && delta.context!==this.context)return;
  for(const u of delta.updates||[]){
   // Original timestamps are mandatory; receipt time must not refresh stale data.
   const time=Date.parse(u.timestamp),source=u.$source || (u.source && (u.source.label || u.source.src));
   if(!Number.isFinite(time)||time>now||now-time>25*60000||typeof source!=='string'||!source)continue;
   for(const item of u.values||[]){
    const key=Object.keys(PATHS).find(k=>PATHS[k]===item.path || (k==='humidity'&&item.path==='environment.outside.relativeHumidity'));if(!key)continue;
    if(this.preferred[key] && source!==this.preferred[key])continue;
    if(/open-meteo|noaa|weatherapi/i.test(source))continue;
    if(this.sources[key] && this.sources[key]!==source)continue;
    const v=item.value;
    if(this.latest[key] && time<=this.latest[key].time)continue;
    if(!Number.isFinite(v)|| (key==='pressure'&&(v<80000||v>110000)) || (key==='wind'&&(v<0||v>100)) || ((key==='temperature'||key==='dewpoint')&&(v<193.15||v>333.15)) || (key==='humidity'&&(v<=0||v>1)) || (key==='water'&&(v<270.15||v>323.15))){delete this.latest[key];continue;}
    this.sources[key]=source;this.latest[key]={time,value:v,source};
    if(key==='pressure'||key==='wind'){
     const h=this.history[key]||(this.history[key]=[]),record={time,value:v,source};
     if(h.length && Math.floor(h[h.length-1].time/60000)===Math.floor(time/60000))h[h.length-1]=record;else h.push(record);
     this.history[key]=h.filter(x=>x.time>=now-4*3600000);
    }
   }
  }
 }
 fresh(key,now){const v=this.latest[key];return v&&now>=v.time&&now-v.time<=MAX_AGE[key]?v:null;}
 window(key,end){
  const h=(this.history[key]||[]).filter(x=>x.time<=end&&x.time>=end-30*60000);
  if(h.length<3 || h[0].time>end-20*60000 || h[h.length-1].time<end-5*60000)return null;
  for(let i=1;i<h.length;i++)if(h[i].time-h[i-1].time>10*60000)return null;
  return median(h.map(x=>x.value));
 }
 evaluate(now=Date.now()){
  const inputs={},missing=[];
  for(const k of Object.keys(PATHS)){const v=this.fresh(k,now);if(v)inputs[k]=v;else missing.push(k);}
  const pressureNow=inputs.pressure?this.window('pressure',now):null;
  const pressurePast=inputs.pressure?this.window('pressure',now-3*3600000):null;
  const windNow=inputs.wind?this.window('wind',now):null;
  const windPast=inputs.wind?this.window('wind',now-3600000):null;
  // Full pressure/wind baseline intervals must be continuous, not just their endpoints.
  const continuous=(key,hours)=>{const h=(this.history[key]||[]).filter(x=>x.time>=now-(hours+.5)*3600000&&x.time<=now);return h.every((x,i)=>i===0||x.time-h[i-1].time<=10*60000);};
  const dp=pressureNow!==null&&pressurePast!==null&&continuous('pressure',3)?pressureNow-pressurePast:null;
  const dw=windNow!==null&&windPast!==null&&continuous('wind',1)?windNow-windPast:null;
  let dewpoint=null,dewpointMethod=null;
  const qualityFlags=[];
  const coherent=keys=>{
   const times=keys.filter(k=>inputs[k]).map(k=>inputs[k].time);
   return times.length>0 && Math.max(...times)-Math.min(...times)<=2*60000;
  };
  let calculated=null;
  if(inputs.temperature&&inputs.humidity){
   if(coherent(['temperature','humidity'])){
    const t=inputs.temperature.value-273.15,g=Math.log(inputs.humidity.value)+17.625*t/(243.04+t);
    calculated=243.04*g/(17.625-g)+273.15;
   } else qualityFlags.push('temperature_humidity_time_mismatch');
  }
  if(inputs.temperature&&inputs.dewpoint){
   if(!coherent(['temperature','dewpoint']))qualityFlags.push('temperature_dewpoint_time_mismatch');
   else if(inputs.dewpoint.value>inputs.temperature.value+.5)qualityFlags.push('dewpoint_above_air_temperature');
   else if(calculated!==null && coherent(['temperature','humidity','dewpoint']) && Math.abs(calculated-inputs.dewpoint.value)>2)qualityFlags.push('dewpoint_humidity_disagreement');
   else {dewpoint=inputs.dewpoint.value;dewpointMethod='supplied';}
  } else if(calculated!==null){dewpoint=calculated;dewpointMethod='local_temperature_humidity';}
  // Contradictory supplied moisture evidence is not silently replaced by a calculation.
  if(qualityFlags.length){dewpoint=null;dewpointMethod=null;}
  const spread=dewpoint!==null?inputs.temperature.value-dewpoint:null;
  const airWater=inputs.water&&inputs.temperature?inputs.temperature.value-inputs.water.value:null;
  const dewWater=inputs.water&&dewpoint!==null?dewpoint-inputs.water.value:null;
  const waterContext=airWater===null?'unknown':airWater>0.5?'air_warmer_than_water':airWater<-.5?'water_warmer_than_air':'similar_temperatures';
  const fogContext=dewWater===null||airWater===null?'unknown':airWater>0 && dewWater>=0?'cooling_to_saturation_possible':'cooling_to_saturation_not_indicated';
  const reasons=[];
  if(dp!==null)reasons.push(`Pressure ${dp>=0?'rose':'fell'} ${(Math.abs(dp)/100).toFixed(2)} hPa over three hours.`);
  if(dw!==null)reasons.push(`Measured wind ${dw>=0?'increased':'decreased'} ${(Math.abs(dw)*1.943844).toFixed(1)} knots over one hour.`);
  if(spread!==null)reasons.push(`Air temperature is ${spread.toFixed(1)} °C above dew point.`);
  if(dp===null)missing.push('pressureHistory3h');if(dw===null)missing.push('windHistory1h');
  if(airWater!==null)reasons.push(`Air is ${Math.abs(airWater).toFixed(1)} °C ${airWater>=0?'warmer':'cooler'} than the water measured at transducer depth.`);
  if(fogContext==='cooling_to_saturation_possible')reasons.push('Water at transducer depth is at or below the air dew point; cooling toward saturation is possible if the surface is similar. Fog is not confirmed.');
  if(qualityFlags.length)reasons.push('Moisture inputs disagree or differ in observation time; moisture and fog context are unknown.');
  return {issuedAt:new Date(now).toISOString(),model:'local-assessment-2',mode:'local_observations',pressureState:dp===null?'unknown':dp<=-100?'falling':dp>=100?'rising':'small_change',windState:dw===null?'unknown':dw>=2/1.943844?'strengthening_observed':dw<=-2/1.943844?'easing_observed':'small_change',moistureState:spread===null?'unknown':spread<=2?'near_saturation':'larger_dewpoint_gap',windOutlook:'uncalibrated',waterContext,fogContext,qualityFlags,waterMeasurement:{depthM:this.waterDepthM,location:'water temperature sensor',surfaceTemperatureMeasured:false},measurements:{pressureChange3h:dp,windMedian30m:windNow,windChange1h:dw,dewpoint,dewpointSpread:spread,airWaterTemperatureDifference:airWater,dewpointWaterTemperatureDifference:dewWater},units:{pressureChange3h:'Pa',windMedian30m:'m/s',windChange1h:'m/s',dewpoint:'K',dewpointSpread:'K',airWaterTemperatureDifference:'K',dewpointWaterTemperatureDifference:'K'},dewpointMethod,inputs,missing,reasons};
 }
 save(){return {version:1,history:this.history,sources:this.sources,latest:this.latest};}
 restore(data,now=Date.now()){
  if(!data||data.version!==1)return;
  // Replay persisted data through the same validation without inventing timestamps.
  for(const key of Object.keys(PATHS)){
   const h=(data.history&&data.history[key])||[];
   const recent=data.latest&&data.latest[key];
   for(const x of [...h,...(recent?[recent]:[])].sort((a,b)=>a.time-b.time)){
    if(!Number.isFinite(x.time)||x.time>now||now-x.time>4*3600000)continue;
    this.ingest({updates:[{timestamp:new Date(x.time).toISOString(),$source:x.source,values:[{path:PATHS[key],value:x.value}]}]},x.time);
   }
  }
 }
}
module.exports={Assessment,PATHS};
