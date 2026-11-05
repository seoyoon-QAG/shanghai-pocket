const fs=require('fs'),vm=require('vm'),assert=require('assert'),{DatabaseSync}=require('node:sqlite');
const ts=require('typescript'),sql=new DatabaseSync(':memory:');
sql.exec(fs.readFileSync('drizzle/0000_glamorous_inhumans.sql','utf8').replaceAll('--> statement-breakpoint',''));
function statement(text,args=[]){return {bind(...values){return statement(text,values)},async first(){return sql.prepare(text).get(...args)||null},async all(){return {results:sql.prepare(text).all(...args)}},async run(){return {meta:sql.prepare(text).run(...args)}}};}
const DB={prepare:statement,async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.all());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}},media=new Map();
const BUCKET={async put(key,bytes,options){media.set(key,{bytes,httpMetadata:options.httpMetadata})},async get(key){const v=media.get(key);return v?{body:v.bytes,httpMetadata:v.httpMetadata}:null}};
const moduleObject={exports:{}};
const code=ts.transpileModule(fs.readFileSync('app/api/[...path]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:moduleObject.exports,module:moduleObject,require(name){if(name==='cloudflare:workers')return {env:{DB,BUCKET}};throw Error(name)},Request,Response,Headers,URL,TextEncoder,Uint8Array,crypto:require('crypto').webcrypto,btoa,console};
vm.runInNewContext(code,sandbox);
async function req(path,method='GET',data,token,raw,type,origin='https://seoyoon-qag.github.io'){
 const headers={origin};if(token)headers.authorization='Bearer '+token;if(data!==undefined){headers['content-type']='application/json';raw=JSON.stringify(data)}if(type)headers['content-type']=type;
 const r=await moduleObject.exports[method](new Request('https://service.example/api/'+path,{method,headers,body:raw}));return {status:r.status,data:r.headers.get('content-type')?.includes('application/json')?await r.json():new Uint8Array(await r.arrayBuffer()),headers:r.headers};
}
(async()=>{
 assert.equal((await req('health')).status,200);assert.equal((await req('family')).status,401);
 assert.equal((await req('health','GET',undefined,undefined,undefined,undefined,'https://evil.example')).status,403);
 const first=await req('families','POST',{entries:[{key:'checklist/default-0/title',value:'픽업'},{key:'checklist/default-0/memo',value:''},{key:'checklist/default-0/status',value:'todo'}]});assert.equal(first.status,201);const token=first.data.token;
 assert.equal(token.length,43);assert.equal(first.data.entries[0].version,1);assert(first.data.entries[0].updatedAt);
 const other=(await req('families','POST',{entries:[]})).data.token;
 assert.deepEqual((await req('family','GET',undefined,other)).data.entries,[]);
 async function patch(key,value,baseVersion){return req('sync','POST',{operations:[{key,value,baseVersion}]},token)}
 assert.equal((await patch('checklist/default-0/memo','예약 완료',1)).status,200);
 assert.equal((await patch('checklist/default-0/status','done',1)).status,200);
 assert.equal((await patch('checklist/default-0/memo','다른 메모',1)).status,409);
 assert.equal((await patch('checklist/default-0/memo','예약 완료',1)).status,200);
 assert.equal((await patch('favs/__proto__',{},0)).status,400);
 const entries=(await req('family','GET',undefined,token)).data.entries;assert.equal(entries.find(r=>r.key.endsWith('/memo')).value,'예약 완료');assert.equal(entries.find(r=>r.key.endsWith('/status')).value,'done');
 const bytes=new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aLasAAAAASUVORK5CYII=','base64'));
 const image=await req('photos','POST',undefined,token,bytes,'image/png');assert.equal(image.status,201);
 assert.deepEqual(Buffer.from((await req('photos/'+image.data.id,'GET',undefined,token)).data),Buffer.from(bytes));assert.equal((await req('photos/'+image.data.id,'GET',undefined,other)).status,404);
 assert.equal((await req('photos','POST',undefined,token,'bad image','image/png')).status,415);
 console.log('PASS: real SQLite migration, family isolation, authenticated images, CORS, field merge, conflict protection, idempotent retry, invalid inputs');
})();
