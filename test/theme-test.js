'use strict';
const assert=require('assert');
const {resolve,normalize,next}=require('../public/theme');
const makePlugin=require('../index');
describe('Display themes consistent with Endurance',()=>{
 it('follows vessel day/night and uses red for night sailing or motoring',()=>{
  for(const state of ['sailing','motoring','anchored','moored',null])assert.equal(resolve('auto','day',state),'day');
  for(const state of ['sailing','motoring'])assert.equal(resolve('auto','night',state),'red');
  for(const state of ['anchored','moored',null])assert.equal(resolve('auto','night',state),'night');
 });
 it('uses Night if vessel mode is unavailable and respects manual selection',()=>{
  assert.equal(resolve('auto',null,'sailing'),'night');assert.equal(resolve('auto','unknown','sailing'),'night');
  assert.equal(resolve('day','night','sailing'),'day');assert.equal(resolve('red','day','moored'),'red');
  assert.equal(resolve('night','day','sailing'),'night');assert.equal(normalize('invalid'),'auto');assert.equal(next('day'),'night');
 });
 it('returns only the two vessel values required by Auto',()=>{
  let route;const p=makePlugin({getSelfPath:path=>path==='environment.mode'?{value:'night'}:path==='navigation.state'?{value:'sailing'}:undefined});
  p.registerWithRouter({get:(_path,fn)=>route=fn});
  route({query:{hours:24}},{set:()=>{},json:r=>assert.deepEqual(r.display,{environmentMode:'night',navigationState:'sailing'})});
 });
});
