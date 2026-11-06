const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8'),app=html.match(/<script id="app-script">([\s\S]*?)<\/script>/)[1];
const code=app.slice(app.indexOf('function getDayRoute('),app.indexOf('function currentDayRoute('));const context={};vm.createContext(context);vm.runInContext('function validCoord(p){return Number.isFinite(p.lat)&&Number.isFinite(p.lng);} function distance(a,b){return Math.abs(a.lng-b.lng)*100;}'+code,context);
const places=[{id:'a',lat:31,lng:121},{id:'missing',lat:null,lng:null},{id:'b',lat:31,lng:122},{id:'c',lat:31,lng:123}],plans={a:{day:'d1'},missing:{day:'d1'},b:{day:'d1'},c:{day:'d2'}};
let r=context.getDayRoute(places,['b','missing','a','c'],plans,'d1');assert.equal(r.stops.map(p=>p.id).join(','),'b,missing,a');assert.equal(r.legs.length,0);assert.equal(r.missing.length,1);
r=context.getDayRoute(places,['a','b','missing'],plans,'d1');assert.equal(r.legs.length,1);assert.equal(r.meters,100);assert.equal(r.legs[0].toIndex,2);
places[1].lat=31;places[1].lng=124;r=context.getDayRoute(places,['a','b','missing'],plans,'d1');assert.equal(r.legs.length,2);assert.equal(r.missing.length,0);assert.equal(r.meters,300);
assert.equal(context.getDayRoute(places,[],plans,'d2').stops[0].id,'c');assert.equal(context.getDayRoute(places,[],plans,'empty').stops.length,0);assert.equal(places[0].id,'a');assert.equal(plans.a.day,'d1');
console.log('PASS: ordered day stops, isolated days, missing-coordinate gaps, coordinate refresh, no stored-state mutation');
