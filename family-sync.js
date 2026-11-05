/* Shanghai Pocket family sync v5. No access credentials are embedded in this source. */
'use strict';
var familyPhotoDraft=[];
(()=>{
const API='https://shanghai-pocket-family-sync.seoyoon-gravity.chatgpt.site/api/',CONFIG_KEY='shanghai-family-v4',BACKUP_KEY='shanghai-before-family-v4';
let config={token:'',remote:{},pending:{},conflicts:[]},lastFlat={},busy=false,timer,failed='',deferred=false;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),clone=x=>JSON.parse(JSON.stringify(x)),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function flatten(s){
 const out={};for(const name of ['overrides','favs','visited','plans','photos','sources','members','tripDays'])for(const [id,value]of Object.entries(s[name]||{}))out[name+'/'+id]=value;
 for(const p of s.custom||[])out['custom/'+p.id]=p;
 for(const id of s.deleted||[])out['deleted/'+id]=true;
 if(s.order?.length)out.order=s.order;if(s.tripOrder)out.tripOrder=s.tripOrder;if(s.tripStart!==undefined)out.tripStart=s.tripStart;for(const [placeId,ratings]of Object.entries(s.ratings||{}))for(const [memberId,n]of Object.entries(ratings||{}))out['ratings/'+placeId+'/'+memberId]=n;
 for(const p of s.checklist||[])for(const field of ['title','status','owner','memo'])out['checklist/'+p.id+'/'+field]=p[field]||'';
 return out;
}
function inflate(records){
 const s=defaultState(),checks={};s.photos={};s.checklist=[];
 for(const [key,r]of Object.entries(records)){
  if(r.value===null)continue;const [name,id,field]=key.split('/');
  if(name==='tripOrder'&&Array.isArray(r.value))s.tripOrder=r.value.filter(x=>typeof x==='string');else if(name==='tripStart'&&typeof r.value==='string')s.tripStart=r.value;else if(name==='ratings'&&id&&field){s.ratings??={};s.ratings[id]??={};s.ratings[id][field]=r.value;}else if(name==='order'&&Array.isArray(r.value))s.order=r.value.filter(x=>typeof x==='string');
  else if(name==='custom'&&id)s.custom.push(r.value);
  else if(name==='deleted'&&id&&r.value)s.deleted.push(id);
  else if(['overrides','favs','visited','plans','photos','sources','members','tripDays'].includes(name)&&id)s[name][id]=r.value;
  else if(name==='checklist'&&id&&['title','status','owner','memo'].includes(field)){
   const p=checks[id]||(checks[id]={id,title:'',status:'todo',owner:'',memo:'',updatedAt:''});p[field]=r.value;
   if(r.updatedAt&&r.updatedAt>p.updatedAt)p.updatedAt=r.updatedAt;
  }
 }
 s.checklist=Object.values(checks).filter(p=>typeof p.title==='string'&&p.title.trim()).sort((a,b)=>a.id.startsWith('default-')&&b.id.startsWith('default-')?Number(a.id.slice(8))-Number(b.id.slice(8)):a.id.startsWith('default-')?-1:b.id.startsWith('default-')?1:a.id.localeCompare(b.id));
 for(const p of s.checklist)if(p.id.startsWith('default-'))s.checks[p.id.slice(8)]=p.status==='done';
 return sanitizeState(s);
}
function saveConfig(){try{localStorage.setItem(CONFIG_KEY,JSON.stringify(config));return true;}catch{failed='기기 저장 공간 부족 · 창을 닫기 전에 내용을 백업해 주세요.';status();return false;}}
function pendingCount(){return Object.keys(config.pending).length;}
function status(){
 const connected=!!config.token,count=pendingCount();let text=!connected?'내 기기에 저장 · 가족 연결 필요':config.conflicts.length?'동시 수정 '+config.conflicts.length+'건 · 가족 연결에서 확인':failed?'전송 대기 '+count+'건 · '+failed:busy?'가족 수첩과 동기화 중…':count?'전송 대기 '+count+'건 · 연결되면 자동 전송':'가족 수첩에 저장됨 · 5초마다 새 내용 확인';
 for(const id of ['familyStatus','familyDialogStatus','checklistStatus','storageStatus']){const el=$('#'+id);if(el)el.textContent=text;}
 $('#familyConnect').textContent=connected?'가족 연결 ✓':'가족 연결';$('#familyCreate').classList.toggle('hidden',connected);$('#familyConnected').classList.toggle('hidden',!connected);$('#familyIntro').classList.toggle('hidden',connected);
 if(connected)$('#familyLink').value=inviteURL();
 const conflicts=$('#familyConflicts');conflicts.classList.toggle('hidden',!config.conflicts.length);
 conflicts.innerHTML=config.conflicts.length?'<h3>같은 내용을 함께 수정했어요</h3><p class="muted">겹치지 않은 수정은 이미 반영됐어요. 아래 항목만 어떤 내용을 쓸지 골라 주세요.</p>'+config.conflicts.map(key=>{const q=config.pending[key],r=config.remote[key];if(!q)return '';const [name,id,field]=key.split('/'),p=state.checklist?.find(x=>x.id===id);const title=name==='checklist'?(p?.title||id)+' · '+({title:'이름',status:'상태',owner:'담당자',memo:'처리 메모'}[field]||field):name==='ratings'?(getPlace(id)?.ko||id)+' · '+(allMembers()[field]?.name||'가족')+' 별점':name==='tripOrder'?'일차 순서':name==='tripStart'?'여행 시작일':name==='sources'?(getPlace(id)?.ko||id)+' · 저장한 출처':key;const show=v=>typeof v==='string'?v:JSON.stringify(v);return `<div class="family-conflict"><b>${esc(title)}</b><p>내 변경: ${esc(show(q.value).slice(0,180))}</p><p>가족 변경: ${esc(show(r?.value??null).slice(0,180))}</p><button class="small" data-resolve="mine" data-key="${esc(key)}">내 변경 반영</button> <button class="small quiet" data-resolve="family" data-key="${esc(key)}">가족 변경 사용</button></div>`;}).join(''):'';
}
function inviteURL(){return 'https://seoyoon-qag.github.io/shanghai-pocket/#family='+config.token;}
function recordChanges(){
 const flat=flatten(state);if(config.token)for(const key of new Set([...Object.keys(lastFlat),...Object.keys(flat)])){
  const value=own(flat,key)?flat[key]:null,old=own(lastFlat,key)?lastFlat[key]:null;
  if(!eq(value,old)){const prior=config.pending[key];config.pending[key]={value,baseVersion:prior?prior.baseVersion:(config.remote[key]?.version||0)};}
 }
 lastFlat=clone(flat);if(config.token){saveConfig();clearTimeout(timer);timer=setTimeout(sync,650);}status();
}
const basePersist=persist;persist=function(){recordChanges();basePersist();status();};
checkSaveStatus=status;
function editing(){return document.querySelector('dialog[open]:not(#familyDialog):not(#copyDialog)')||document.activeElement?.matches('#checks input,#checks textarea,#checks select,#newCheckTitle');}
function applyRemote(){
 if(!config.token)return;if(editing()){deferred=true;return;}deferred=false;
 const records=clone(config.remote);for(const [key,p]of Object.entries(config.pending))records[key]={value:p.value,version:config.remote[key]?.version||0,updatedAt:new Date().toISOString()};
 try{state=inflate(records);lastFlat=clone(flatten(state));basePersist();render();renderChecks();renderPhotos();}catch{failed='수첩 데이터를 읽지 못했어요. 백업은 유지됩니다.';}status();
}
async function request(path,{method='GET',data,body,type,token=config.token}={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{
  const h={};if(token)h.Authorization='Bearer '+token;if(data!==undefined)h['Content-Type']='application/json';if(type)h['Content-Type']=type;
  const r=await fetch(API+path,{method,headers:h,body:data!==undefined?JSON.stringify(data):body,cache:'no-store',signal:controller.signal});
  const json=r.headers.get('Content-Type')?.includes('application/json')?await r.json():null;
  if(!r.ok&&r.status!==409)throw Error(r.status===401?'초대 링크를 다시 확인해 주세요.':r.status===429?'잠시 후 다시 연결합니다.':r.status===413?'첨부 크기나 수첩 저장 한도를 확인해 주세요.':'서버 연결을 확인해 주세요.');
  return {r,data:json};
 }finally{clearTimeout(timeout);}
}
async function sync(){
 if(!config.token||busy)return;if(!navigator.onLine){failed='오프라인';status();return;}busy=true;status();
 const token=config.token,sent=Object.entries(config.pending).filter(([k])=>!config.conflicts.includes(k)).slice(0,100).map(([key,p])=>({key,...clone(p)}));
 try{
  const {data}=await request(sent.length?'sync':'family',{method:sent.length?'POST':'GET',...(sent.length?{data:{operations:sent}}:{})});if(token!==config.token)return;
  const remote=Object.fromEntries(data.entries.map(r=>[r.key,r]));
  for(const op of sent){const p=config.pending[op.key],r=remote[op.key];if(!p)continue;
   if(eq(r?.value,op.value)){if(eq(p.value,op.value))delete config.pending[op.key];else p.baseVersion=r.version;config.conflicts=config.conflicts.filter(k=>k!==op.key);}
   else if(!config.conflicts.includes(op.key))config.conflicts.push(op.key);
  }
  const changed=!eq(config.remote,remote);config.remote=remote;config.conflicts=config.conflicts.filter(k=>config.pending[k]);failed='';saveConfig();if(changed||sent.length)applyRemote();
 }catch(e){failed=navigator.onLine?(e.name==='AbortError'?'응답을 기다리는 중':e.message):'오프라인';}
 finally{busy=false;status();if(pendingCount()>sent.length&&!config.conflicts.length&&!failed)timer=setTimeout(sync,100);}
}
function backupPersonal(){try{if(!config.token)localStorage.setItem(BACKUP_KEY,JSON.stringify(state));}catch{throw Error('기기 저장 공간이 부족해요. JSON 백업 후 다시 시도해 주세요.');}}
function readToken(value){try{const v=value.trim();return /^[A-Za-z0-9_-]{43}$/.test(v)?v:new URLSearchParams(new URL(v).hash.slice(1)).get('family')||'';}catch{return '';}}
async function join(value){
 const token=readToken(value);if(!/^[A-Za-z0-9_-]{43}$/.test(token)){toast('전달받은 가족 초대 링크를 입력해 주세요.');return;}
 if(token===config.token){await sync();return;}
 if(pendingCount()){toast('먼저 현재 수첩의 전송 대기를 처리해 주세요.');return;}
 $('#familyJoin').disabled=true;
 try{const {data}=await request('family',{token});backupPersonal();config={token,remote:Object.fromEntries(data.entries.map(r=>[r.key,r])),pending:{},conflicts:[]};failed='';saveConfig();applyRemote();toast('가족 수첩에 참여했어요.');}
 catch(e){toast(e.message);}finally{$('#familyJoin').disabled=false;status();}
}
$('#familyCreate').onclick=async()=>{
 if(busy||config.token)return;busy=true;$('#familyCreate').disabled=true;status();
 try{backupPersonal();checklistItems();const entries=Object.entries(flatten(state)).map(([key,value])=>({key,value}));const {data}=await request('families',{method:'POST',token:'',data:{entries}});backupPersonal();config={token:data.token,remote:Object.fromEntries(data.entries.map(r=>[r.key,r])),pending:{},conflicts:[]};lastFlat=clone(flatten(state));failed='';saveConfig();applyRemote();toast('가족 수첩을 만들었어요. 초대 링크를 가족에게 보내 주세요.');}
 catch(e){toast(e.message);}finally{busy=false;$('#familyCreate').disabled=false;status();}
};
$('#familyJoin').onclick=()=>join($('#familyJoinLink').value);
$('#familyConnect').onclick=()=>{status();openDialog('familyDialog');};
$('#familyRefresh').onclick=()=>sync();
$('#familyCopyLink').onclick=()=>copy(inviteURL(),'가족 초대 링크를 복사했어요. 가족에게만 전달해 주세요.');
$('#familyShareLink').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'우리 가족 상하이 수첩',url:inviteURL()});else await copy(inviteURL(),'가족 초대 링크를 복사했어요.');}catch(e){if(e.name!=='AbortError')await copy(inviteURL(),'가족 초대 링크를 복사했어요.');}};
$('#familyLeave').onclick=()=>{if(pendingCount()){toast('전송 대기가 있어요. 먼저 동기화하거나 충돌을 처리해 주세요.');return;}if(!confirm('이 기기의 가족 연결을 해제할까요? 가족 공용 내용은 그대로 남고, 연결 전 이 기기 목록으로 돌아갑니다.'))return;const backup=localStorage.getItem(BACKUP_KEY);config={token:'',remote:{},pending:{},conflicts:[]};saveConfig();if(backup){try{state=sanitizeState(JSON.parse(backup));}catch{}}lastFlat=clone(flatten(state));basePersist();render();renderChecks();status();};
$('#familyConflicts').onclick=e=>{const b=e.target.closest('[data-resolve]');if(!b)return;const key=b.dataset.key,p=config.pending[key];if(!p)return;if(b.dataset.resolve==='mine')p.baseVersion=config.remote[key]?.version||0;else delete config.pending[key];config.conflicts=config.conflicts.filter(k=>k!==key);saveConfig();applyRemote();sync();};
const oldShare=$('#shareURL').onclick;$('#shareURL').onclick=()=>config.token?$('#familyShareLink').onclick():oldShare();
const oldImport=$('#importFile').onchange;$('#importFile').onchange=e=>{if(config.token){e.target.value='';toast('가족 연결 중에는 백업으로 공용 내용을 덮어쓸 수 없어요. 가족 연결을 해제한 뒤 가져와 주세요.');return;}return oldImport(e);};
const oldReset=$('#resetLocal').onclick;$('#resetLocal').onclick=()=>config.token?toast('가족 연결에서 연결 해제를 사용해 주세요.'):oldReset();
window.addEventListener('online',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});document.addEventListener('focusout',()=>{if(deferred)setTimeout(applyRemote,100);});setInterval(()=>{if(!document.hidden)sync();},5000);
// Photos use authenticated requests; family access keys never enter image URLs.
const photoCache=new Map();let photoRoom='';
async function photoURL(id){if(photoRoom!==config.token){for(const v of photoCache.values())URL.revokeObjectURL(v);photoCache.clear();photoRoom=config.token;}if(photoCache.has(id))return photoCache.get(id);const {r}=await request('photos/'+id);const url=URL.createObjectURL(await r.blob());photoCache.set(id,url);return url;}
async function loadPhotos(scope=document){if(!config.token)return;for(const img of scope.querySelectorAll('img[data-family-photo]'))try{img.src=await photoURL(img.dataset.familyPhoto);img.classList.remove('hidden');}catch{img.alt='사진을 불러오려면 인터넷 연결을 확인해 주세요.';}}
function renderPhotos(){for(const card of $$('#cards .card')){card.querySelector('.family-photos')?.remove();const ps=state.photos?.[card.dataset.id]||[];if(!ps.length)continue;const div=document.createElement('div');div.className='family-photos';div.innerHTML=ps.map(p=>`<button class="family-photo-thumb" type="button" data-showphoto="${esc(p.id)}" data-caption="${esc(p.caption||'장소 사진')}"><img data-family-photo="${esc(p.id)}" alt="${esc(p.caption||'장소 사진')}" loading="lazy"><span>${esc(p.caption||'사진 보기')}</span></button>`).join('');card.querySelector('.details').before(div);}loadPhotos($('#cards'));}
const baseRenderCards=renderCards;renderCards=function(){baseRenderCards();renderPhotos();};
const baseEditPlace=editPlace;editPlace=function(p){familyPhotoDraft=clone(state.photos?.[p?.id]||[]);baseEditPlace(p);renderPhotoEditor();};
let photoUploading=false;
function renderPhotoEditor(){const connected=!!config.token;$('#photoFiles').disabled=!connected||photoUploading;$('#photoHint').textContent=connected?'간판·메뉴·입구 사진을 최대 6장 첨부해요. 사진 첨부 후 아래 장소 저장을 눌러 주세요.':'사진을 함께 보려면 먼저 가족 연결에서 수첩을 만들거나 참여해 주세요.';$('#photoDraft').innerHTML=familyPhotoDraft.map((p,i)=>`<div class="photo-draft"><img data-family-photo="${esc(p.id)}" alt="첨부 사진"><label>사진 설명<input data-photo-caption="${i}" maxlength="180" value="${esc(p.caption||'')}" placeholder="예: 입구는 건물 오른쪽"></label><button type="button" class="small quiet danger" data-removephoto="${i}">첨부 취소</button></div>`).join('');loadPhotos($('#photoDraft'));}
$('#photoDraft').oninput=e=>{if(e.target.dataset.photoCaption!==undefined)familyPhotoDraft[Number(e.target.dataset.photoCaption)].caption=e.target.value.slice(0,180);};$('#photoDraft').onclick=e=>{const b=e.target.closest('[data-removephoto]');if(b){familyPhotoDraft.splice(Number(b.dataset.removephoto),1);renderPhotoEditor();}};
async function compressed(file){if(!file.type.startsWith('image/'))throw Error('사진 파일을 선택해 주세요.');if(file.size>25_000_000)throw Error('25MB 이하 사진을 선택해 주세요.');let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('이 사진 형식을 읽지 못했어요. JPG·PNG·WebP로 선택해 주세요.');}const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));if(!blob||blob.size>2_000_000)throw Error('더 작은 사진을 선택해 주세요.');return blob;}
$('#photoFiles').onchange=async e=>{if(!config.token)return;const files=Array.from(e.target.files);photoUploading=true;e.target.disabled=true;$('#editForm button[type=submit]').disabled=true;try{for(const file of files){if(familyPhotoDraft.length>=6){toast('사진은 장소마다 최대 6장이에요.');break;}if(!navigator.onLine)throw Error('사진은 인터넷 연결 후 첨부해 주세요.');$('#photoHint').textContent='사진을 줄여서 올리는 중…';const blob=await compressed(file),{data}=await request('photos',{method:'POST',body:blob,type:'image/jpeg'});familyPhotoDraft.push({id:data.id,caption:''});}}catch(error){toast(error.message);}finally{photoUploading=false;e.target.value='';$('#editForm button[type=submit]').disabled=false;renderPhotoEditor();}};
$('#cards').addEventListener('click',async e=>{const b=e.target.closest('[data-showphoto]');if(!b)return;$('#photoViewCaption').textContent=b.dataset.caption;$('#photoViewImage').removeAttribute('src');openDialog('photoViewDialog');try{$('#photoViewImage').src=await photoURL(b.dataset.showphoto);}catch{toast('사진 연결을 확인해 주세요.');}});
checklistItems();lastFlat=clone(flatten(state));
try{const saved=JSON.parse(localStorage.getItem(CONFIG_KEY)||'null');if(saved&&/^[A-Za-z0-9_-]{43}$/.test(saved.token)){config={token:saved.token,remote:saved.remote||{},pending:saved.pending||{},conflicts:Array.isArray(saved.conflicts)?saved.conflicts:[]};}}catch{}
const params=new URLSearchParams(location.hash.slice(1)),incoming=params.get('family');if(incoming)history.replaceState(null,'',location.pathname+location.search);
status();renderPhotos();if(incoming&&incoming!==config.token){openDialog('familyDialog');$('#familyJoinLink').value=inviteURL().split('#')[0]+'#family='+incoming;join(incoming);}else if(config.token){applyRemote();sync();}
})();
