import { env } from 'cloudflare:workers';
export const dynamic='force-dynamic';
const ALLOWED=new Set(['https://seoyoon-qag.github.io','http://terminal.local:4173']);
const MAX_BODY=2_500_000, MAX_ENTRIES=6000;
function headers(req:Request){const h=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'});const origin=req.headers.get('origin');if(origin&&(ALLOWED.has(origin)||origin===new URL(req.url).origin))h.set('Access-Control-Allow-Origin',origin);h.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');h.set('Access-Control-Allow-Headers','Authorization,Content-Type');h.set('Access-Control-Max-Age','600');return h;}
function json(req:Request,data:unknown,status=200){const h=headers(req);h.set('Content-Type','application/json; charset=utf-8');return new Response(JSON.stringify(data),{status,headers:h});}
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(v=>v.toString(16).padStart(2,'0')).join('');}
function db(){if(!env.DB)throw Error('DB unavailable');return env.DB;}
async function body(req:Request){if(!req.headers.get('content-type')?.startsWith('application/json'))throw Error('type');if(Number(req.headers.get('content-length')||0)>MAX_BODY)throw Error('size');const text=await req.text();if(new TextEncoder().encode(text).length>MAX_BODY)throw Error('size');return JSON.parse(text);}
async function limited(req:Request,kind:string,limit:number){const ip=req.headers.get('cf-connecting-ip')||'local';const bucket=new Date().toISOString().slice(0,kind==='create'?10:16);const key=kind+':'+await hash(ip+bucket);const row=await db().prepare('INSERT INTO rate_limits (key,count) VALUES (?,1) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key).first<{count:number}>();return !row||row.count>limit;}
async function family(req:Request){const token=req.headers.get('authorization')?.replace(/^Bearer /,'')||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const id=await hash(token);return await db().prepare('SELECT id FROM families WHERE id=?').bind(id).first()?id:null;}
function validKey(k:unknown):k is string{return typeof k==='string'&&k.length<250&&/^(overrides|custom|deleted|favs|visited|plans|checklist|order|photos|checks|ratings|members|sources|tripDays|tripOrder|tripStart)(\/[^\u0000-\u001f]{1,180})*$/.test(k)&&!k.split('/').some(p=>['__proto__','constructor','prototype'].includes(p));}
function valueString(value:unknown){const encoded=JSON.stringify(value);if(encoded===undefined||encoded.length>30000)throw Error('value');return encoded;}
async function snapshot(id:string){const rows=await db().prepare('SELECT key,value,version,updated_at FROM entries WHERE family=? ORDER BY key').bind(id).all<{key:string,value:string,version:number,updated_at:string}>();return rows.results.map(r=>({key:r.key,value:JSON.parse(r.value),version:r.version,updatedAt:r.updated_at}));}
async function handler(req:Request){
 const origin=req.headers.get('origin');if(origin&&!ALLOWED.has(origin)&&origin!==new URL(req.url).origin)return json(req,{error:'origin'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 const path=new URL(req.url).pathname.replace(/^\/api\/?/,'');
 if(path==='health'&&req.method==='GET')return json(req,{ok:true,version:5});
 if(await limited(req,'request',300))return json(req,{error:'too_many_requests'},429);
 if(path==='families'&&req.method==='POST'){
  if(await limited(req,'create',12))return json(req,{error:'create_limit'},429);
  const data=await body(req);if(!Array.isArray(data.entries)||data.entries.length>MAX_ENTRIES)return json(req,{error:'entries'},400);
  const seen=new Set<string>();const initial=data.entries.map((r:any)=>{if(!validKey(r.key)||seen.has(r.key))throw Error('key');seen.add(r.key);return {key:r.key,value:valueString(r.value)};});
  const token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');const id=await hash(token),now=new Date().toISOString();
  await db().prepare('INSERT INTO families (id,created_at) VALUES (?,?)').bind(id,now).run();
  for(let i=0;i<initial.length;i+=80)await db().batch(initial.slice(i,i+80).map((r:any)=>db().prepare('INSERT INTO entries (family,key,value,version,updated_at) VALUES (?,?,?,1,?)').bind(id,r.key,r.value,now)));
  return json(req,{token,entries:await snapshot(id)},201);
 }
 const id=await family(req);if(!id)return json(req,{error:'family_required'},401);
 if(path==='family'&&req.method==='GET')return json(req,{entries:await snapshot(id)});
 if(path==='sync'&&req.method==='POST'){
  const data=await body(req);if(!Array.isArray(data.operations)||data.operations.length>100)return json(req,{error:'operations'},400);
  const seen=new Set<string>();const ops=data.operations.map((r:any)=>{if(!validKey(r.key)||seen.has(r.key)||!Number.isInteger(r.baseVersion)||r.baseVersion<0)throw Error('operation');seen.add(r.key);return {key:r.key,value:valueString(r.value),base:r.baseVersion};});
  const count=await db().prepare('SELECT COUNT(*) AS n FROM entries WHERE family=?').bind(id).first<{n:number}>();if((count?.n||0)+ops.filter((r:any)=>!r.base).length>MAX_ENTRIES)return json(req,{error:'entry_limit'},413);
  const now=new Date().toISOString();
  if(ops.length)await db().batch(ops.map((o:any)=>o.base===0?db().prepare('INSERT INTO entries (family,key,value,version,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(family,key) DO NOTHING').bind(id,o.key,o.value,now):db().prepare('UPDATE entries SET value=?,version=version+1,updated_at=? WHERE family=? AND key=? AND version=?').bind(o.value,now,id,o.key,o.base)));
  const entries=await snapshot(id),byKey=new Map(entries.map(r=>[r.key,r]));const conflicts=ops.filter((o:any)=>JSON.stringify(byKey.get(o.key)?.value)!==o.value).map((o:any)=>({key:o.key,current:byKey.get(o.key)}));
  return json(req,{entries,conflicts},conflicts.length?409:200);
 }
 if(path==='photos'&&req.method==='POST'){
  if(!env.BUCKET)throw Error('BUCKET unavailable');const type=req.headers.get('content-type')||'';if(!['image/jpeg','image/png','image/webp'].includes(type))return json(req,{error:'image_type'},415);
  if(Number(req.headers.get('content-length')||0)>2_000_000)return json(req,{error:'image_size'},413);
  const bytes=new Uint8Array(await req.arrayBuffer());if(!bytes.length||bytes.length>2_000_000)return json(req,{error:'image_size'},413);
  const valid=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';if(!valid)return json(req,{error:'image_invalid'},415);
  const photoId=crypto.randomUUID();await env.BUCKET.put(id+'/'+photoId,bytes,{httpMetadata:{contentType:type}});return json(req,{id:photoId,type,size:bytes.length},201);
 }
 if(/^photos\/[a-f0-9-]{36}$/.test(path)&&req.method==='GET'){
  if(!env.BUCKET)throw Error('BUCKET unavailable');const obj=await env.BUCKET.get(id+'/'+path.slice(7));if(!obj)return json(req,{error:'not_found'},404);const h=headers(req);h.set('Content-Type',obj.httpMetadata?.contentType||'image/jpeg');return new Response(obj.body,{headers:h});
 }
 return json(req,{error:'not_found'},404);
}
async function safe(req:Request){try{return await handler(req);}catch(e){const message=e instanceof Error?e.message:'';return json(req,{error:['type','size','value','key','operation'].includes(message)?message:'request_failed'},['type','value','key','operation'].includes(message)?400:message==='size'?413:500);}}
export const GET=safe;export const POST=safe;export const OPTIONS=safe;
