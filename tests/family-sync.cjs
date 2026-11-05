const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('family-sync.js','utf8');
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const context={assert,navigator:{onLine:true},setTimeout:()=>0,clearTimeout:()=>{}};vm.createContext(context);
const definitions=between('function flatten(', 'function saveConfig(')+between('function recordChanges(', 'const basePersist=')+between('async function sync(', 'function backupPersonal(');
const prelude="const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),clone=x=>JSON.parse(JSON.stringify(x)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);let state={checklist:[{id:'default-0',title:'A',status:'todo',owner:'',memo:''}],overrides:{},custom:[],deleted:[],order:[],favs:{},visited:{},plans:{},photos:{}};let lastFlat={},config={token:'test',remote:{},pending:{},conflicts:[]},busy=false,timer,failed='',sentRequest,release;function saveConfig(){}function status(){}function pendingCount(){return Object.keys(config.pending).length}function applyRemote(){}function defaultState(){return {overrides:{},custom:[],deleted:[],order:[],favs:{},visited:{},plans:{},checks:{},checklist:[],photos:{}}}const sanitizeState=s=>s;function request(path,options){sentRequest={path,...options};return new Promise(r=>release=r)}";
vm.runInContext(prelude+definitions,context);
(async()=>{
 await vm.runInContext(`(async()=>{
 lastFlat=clone(flatten(state));config.remote['checklist/default-0/memo']={value:'',version:1};
 state.checklist[0].memo='first';recordChanges();assert.equal(config.pending['checklist/default-0/memo'].baseVersion,1);
 const pending=sync();assert.equal(sentRequest.data.operations[0].value,'first');
 state.checklist[0].memo='newer edit';recordChanges();release({data:{entries:[{key:'checklist/default-0/memo',value:'first',version:2}],conflicts:[]}});await pending;
 assert.equal(config.pending['checklist/default-0/memo'].value,'newer edit');assert.equal(config.pending['checklist/default-0/memo'].baseVersion,2);
 const next=sync();release({data:{entries:[{key:'checklist/default-0/memo',value:'newer edit',version:3}],conflicts:[]}});await next;assert.equal(pendingCount(),0);
 state.checklist[0].memo='overlap';recordChanges();const collision=sync();release({data:{entries:[{key:'checklist/default-0/memo',value:'family edit',version:4}],conflicts:[{key:'checklist/default-0/memo'}]}});await collision;assert(config.conflicts.includes('checklist/default-0/memo'));assert.equal(config.pending['checklist/default-0/memo'].value,'overlap');
 const saved=JSON.parse(JSON.stringify(config));assert.equal(saved.pending['checklist/default-0/memo'].value,'overlap');
 navigator.onLine=false;await sync();assert.equal(pendingCount(),1);assert.equal(failed,'오프라인');
 const shape=inflate({'checklist/default-0/title':{value:'A',version:1},'checklist/default-0/status':{value:'done',version:2},'checklist/default-0/memo':{value:'shared memo',version:3,updatedAt:'2026-11-05T00:00:00Z'},'photos/hotel':{value:[{id:'123',caption:'입구'}],version:1}});assert.equal(shape.checklist[0].memo,'shared memo');assert.equal(shape.checks[0],true);assert.equal(shape.photos.hotel[0].caption,'입구');
 })()`,context);
 console.log('PASS: queued changes, save-in-flight edits, acknowledgment version update, conflict retention, offline retention, shared checklist/photo reconstruction');
})();
