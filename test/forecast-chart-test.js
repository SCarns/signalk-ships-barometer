'use strict';
const assert=require('assert'),vm=require('vm'),fs=require('fs');
describe('Comparison graph presentation',()=>{
 it('draws solid past and dotted future below unchanged onboard observations and marks now',()=>{
  const nodes=[];const chart={replaceChildren(){nodes.length=0;},getBoundingClientRect:()=>({width:900}),setAttribute(){},append(...n){nodes.push(...n);}};
  const context=vm.createContext({document:{getElementById:()=>chart,querySelectorAll:()=>[],createElementNS:(_ns,tag)=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v;},append(){}})},window:{},pressureSegments:require('../public/chart').segments,AbortSignal,setInterval(){},fetch:()=>new Promise(()=>{})});
  vm.runInContext(fs.readFileSync(require.resolve('../public/app.js'),'utf8'),context);
  const now=Date.parse('2026-10-18T12:00:00Z'),h={now,gapMs:90000,records:[{time:now-60000,pressure:101000},{time:now,pressure:101010}]};
  const p=time=>({time,pressure:101200,issuedAt:now-7200000,receivedAt:now-3600000,source:'Test provider'});
  const original=JSON.stringify(h);context.input=h;context.forecast={past:[p(now-3600000),p(now-1800000)],future:[p(now+3600000),p(now+7200000)]};vm.runInContext('chart(input,forecast)',context);
  assert.equal(JSON.stringify(h),original);
  const paths=nodes.filter(n=>n.tag==='path').map(n=>n.attrs.class);assert.deepEqual(paths,['forecast-past','forecast-future','observed']);
  assert(nodes.some(n=>n.attrs.class==='now-line'));assert(nodes.some(n=>n.textContent==='Now'));
 });
});
