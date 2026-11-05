/* Relative travel days, individual family ratings and saved links. */
'use strict';
var savedSourceDraft=[];
const DEFAULT_TRIP_IDS=['11-06','11-07','11-08','11-09'];
const DEFAULT_MEMBERS={seoyoon:{name:'서윤'},brother:{name:'동생'},mother:{name:'박은희 여사'}};
const PROFILE_KEY='shanghai-rating-member-v1';
let ratingMember='';try{ratingMember=localStorage.getItem(PROFILE_KEY)||'';}catch{}
const safeID=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
function isTripDate(s){if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;}
function normalizeTrip(s){
 if(!s.tripDays||typeof s.tripDays!=='object'||Array.isArray(s.tripDays))s.tripDays={};
 for(const id of DEFAULT_TRIP_IDS)if(!Object.prototype.hasOwnProperty.call(s.tripDays,id))s.tripDays[id]={title:'',deleted:false};
 const live=Object.keys(s.tripDays).filter(id=>safeID(id)&&s.tripDays[id]&&typeof s.tripDays[id]==='object'&&!s.tripDays[id].deleted);
 const order=Array.isArray(s.tripOrder)?s.tripOrder:[];
 s.tripOrder=[...new Set([...order.filter(id=>live.includes(id)),...live])].slice(0,30);
 if(s.tripStart===undefined)s.tripStart='2026-11-06';else if(s.tripStart!==''&&!isTripDate(s.tripStart))s.tripStart='';
 return s;
}
function cleanExtendedState(s,o){
 o.tripDays={};for(const [id,d]of Object.entries(s.tripDays||{}).slice(0,200))if(safeID(id)&&d&&typeof d==='object')o.tripDays[id]={title:String(d.title||'').slice(0,80),deleted:!!d.deleted};
 o.tripOrder=Array.isArray(s.tripOrder)?s.tripOrder.filter(safeID).slice(0,30):[];
 o.tripStart=s.tripStart===undefined?'2026-11-06':isTripDate(s.tripStart)?s.tripStart:'';
 o.members={};for(const [id,p]of Object.entries(s.members||{}).slice(0,20))if(safeID(id)&&p&&typeof p.name==='string'&&p.name.trim())o.members[id]={name:p.name.trim().slice(0,40)};
 o.ratings={};for(const [placeId,members]of Object.entries(s.ratings||{}).slice(0,1000))if(safeID(placeId)&&members&&typeof members==='object'){
  const scores={};for(const [memberId,n]of Object.entries(members))if(safeID(memberId)&&Number.isInteger(n)&&n>=1&&n<=5)scores[memberId]=n;
  if(Object.keys(scores).length)o.ratings[placeId]=scores;
 }
 o.sources={};for(const [id,links]of Object.entries(s.sources||{}).slice(0,1000))if(safeID(id)&&Array.isArray(links))o.sources[id]=cleanSources(links);
 return normalizeTrip(o);
}
function cleanSources(links){const seen=new Set();return links.filter(p=>p&&typeof p.url==='string').map(p=>({id:safeID(p.id)?p.id:'source-'+Math.random().toString(36).slice(2,10),label:String(p.label||'').trim().slice(0,80),url:safeURL(p.url)})).filter(p=>{if(!p.url||p.url.length>2000||seen.has(p.url))return false;seen.add(p.url);return true;}).slice(0,8);}
function tripDayList(){normalizeTrip(state);return state.tripOrder.map((id,index)=>({id,index,title:state.tripDays[id].title||'',date:dateForDay(index,state.tripStart)}));}
function dateForDay(index,start){if(!isTripDate(start))return '';const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+index);return d.toISOString().slice(0,10);}
function dateLabel(value){if(!isTripDate(value))return '';return new Intl.DateTimeFormat('ko-KR',{timeZone:'UTC',month:'numeric',day:'numeric',weekday:'short'}).format(new Date(value+'T00:00:00Z'));}
function dayLabel(d){return (d.index+1)+'D'+(d.date?' · '+dateLabel(d.date):'')+(d.title?' · '+d.title:'');}
function plannedDay(id){const day=state.plans[id]?.day||'';return tripDayList().some(d=>d.id===day)?day:'';}
function dayName(id){return tripDayList().find(d=>d.id===id)?dayLabel(tripDayList().find(d=>d.id===id)):'미배정';}
function tripOptions(selected='',includeNone=true){const days=tripDayList(),valid=days.some(d=>d.id===selected);return (includeNone?`<option value="" ${!valid?'selected':''}>미배정</option>`:'')+days.map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(dayLabel(d))}</option>`).join('');}
function renderDayChooser(){
 const days=tripDayList();if(view.day&&!days.some(d=>d.id===view.day))view.day=days[0]?.id||'';
 $('#dayChooser').innerHTML=days.map(d=>`<button data-day="${esc(d.id)}" class="${view.day===d.id?'active':''}">${esc(dayLabel(d))}</button>`).join('')+`<button data-day="" class="${view.day===''?'active':''}">미배정</button>`;
 const range=state.tripStart&&days.length?dateLabel(days[0].date)+' — '+dateLabel(days.at(-1).date):'날짜 미정';
 $('#tripRange').textContent=range+' · '+days.length+'일';$('#tripStampRange').textContent=state.tripStart&&days.length?range:days.length+' DAYS';
 const count=allPlaces().filter(p=>plannedDay(p.id)===view.day).length;$('#bulkMoveOpen').textContent='이 일차 '+count+'곳 옮기기';
}
function allMembers(){return {...DEFAULT_MEMBERS,...(state.members||{})};}
function renderMemberSelector(){const members=allMembers();if(ratingMember&&!members[ratingMember])ratingMember='';$('#ratingMember').innerHTML='<option value="">별점 남길 이름 선택</option>'+Object.entries(members).map(([id,p])=>`<option value="${esc(id)}" ${id===ratingMember?'selected':''}>${esc(p.name)}</option>`).join('');}
function sourceProvider(url){try{const host=new URL(url).hostname.toLowerCase();if(host==='youtu.be'||(host==='youtube.com'||host.endsWith('.youtube.com')))return '유튜브';if(host==='instagram.com'||host.endsWith('.instagram.com'))return '인스타그램';if(host.endsWith('xiaohongshu.com')||host==='xhslink.com')return '샤오홍슈';if(host.endsWith('douyin.com'))return '더우인';if(host.endsWith('tiktok.com'))return '틱톡';if(host.endsWith('bilibili.com')||host==='b23.tv')return '빌리빌리';if(host.endsWith('naver.com'))return '네이버';return '웹·SNS';}catch{return '출처';}}
function placeLinks(p){const links=cleanSources(state.sources?.[p.id]||[]),original=safeURL(p.source);return original?[{id:'original',label:'기본 정보 출처',url:original},...links.filter(p=>p.url!==original)]:links;}
function renderPlaceExtras(){
 renderMemberSelector();const members=allMembers();
 for(const card of $$('#cards .card')){
  card.querySelector('.place-extras')?.remove();const p=getPlace(card.dataset.id);if(!p)continue;
  const ratings=state.ratings?.[p.id]||{},scores=Object.values(ratings).filter(n=>Number.isInteger(n)&&n>=1&&n<=5),mine=ratings[ratingMember]||0;
  const links=placeLinks(p),el=document.createElement('div');el.className='place-extras';
  el.innerHTML=`<div class="rating-heading"><b>각자의 별점</b><span>${scores.length?'평균 '+(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)+' · '+scores.length+'명':'아직 별점이 없어요'}</span></div><div class="rating-people">${Object.entries(ratings).map(([id,n])=>`<span>${esc(members[id]?.name||'가족')} <b>${'★'.repeat(n)}${'☆'.repeat(5-n)}</b></span>`).join('')}</div><div class="my-rating"><span>${ratingMember?esc(members[ratingMember].name)+'의 별점':'위에서 내 이름을 골라 주세요'}</span><div class="rating-stars" role="group" aria-label="${esc(p.ko)} 내 별점">${[1,2,3,4,5].map(n=>`<button type="button" data-rate="${n}" data-place="${esc(p.id)}" class="${n<=mine?'filled':''}" aria-label="${esc(p.ko)} ${n}점" aria-pressed="${n===mine}" ${ratingMember?'':'disabled'}>${n<=mine?'★':'☆'}</button>`).join('')}${mine?`<button type="button" class="clear-rating" data-rate="0" data-place="${esc(p.id)}" aria-label="${esc(p.ko)} 내 별점 취소">취소</button>`:''}</div></div><div class="saved-sources"><b>저장한 출처</b><div>${links.length?links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">${esc(l.label||sourceProvider(l.url))} ↗</a>`).join(''):'<span class="muted">편집에서 유튜브·인스타·SNS 링크를 추가해 주세요.</span>'}</div></div>`;
  card.querySelector('.details').before(el);
 }
}
function renderSourcesEditor(){
 $('#savedSourceRows').innerHTML=savedSourceDraft.map((p,i)=>`<div class="saved-source-row"><label>출처 이름<input data-source-label="${i}" maxlength="80" value="${esc(p.label)}" placeholder="예: 유튜브 맛집 영상"></label><label>출처 URL<input type="url" data-source-url="${i}" maxlength="2000" value="${esc(p.url)}" placeholder="https://youtu.be/…"></label><button type="button" class="small quiet danger" data-remove-source="${i}">삭제</button></div>`).join('');$('#addSavedSource').disabled=savedSourceDraft.length>=8;
}
function readSavedSources(){if(savedSourceDraft.some(p=>p.label.trim()&&!p.url.trim())){toast('출처 이름을 적었다면 URL도 넣어 주세요.');return null;}if(savedSourceDraft.some(p=>p.url.trim()&&!safeURL(p.url.trim()))){toast('출처는 http 또는 https 주소로 입력해 주세요.');return null;}return cleanSources(savedSourceDraft.filter(p=>p.url.trim()).map(p=>({...p,url:p.url.trim()})));}
function moveTripDay(id,delta){const order=tripDayList().map(d=>d.id),i=order.indexOf(id),j=i+delta;if(i<0||j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];state.tripOrder=order;persist();renderTripManager();renderCards();renderMap();}
function moveTripBefore(id,target){const order=tripDayList().map(d=>d.id),a=order.indexOf(id),b=order.indexOf(target);if(a<0||b<0||a===b)return;order.splice(a,1);order.splice(b,0,id);state.tripOrder=order;persist();renderTripManager();renderCards();renderMap();}
function addTripDay(){const days=tripDayList();if(days.length>=30){toast('최대 30일차까지 추가할 수 있어요.');return;}const id='day-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);state.tripDays[id]={title:'',deleted:false};state.tripOrder.push(id);view.day=id;persist();renderTripManager();renderCards();renderMap();toast('새 일차를 추가했어요.');}
function renderTripManager(){
 const days=tripDayList();$('#tripStartDate').value=state.tripStart||'';
 $('#tripDayRows').innerHTML=days.map((d,i)=>`<article class="trip-day-row" data-triprow="${esc(d.id)}"><div class="trip-day-label"><button type="button" class="quiet small trip-drag" draggable="true" data-tripdrag="${esc(d.id)}" aria-label="${i+1}D 끌어서 이동">≡</button><b>${i+1}D</b><span>${esc(d.date?dateLabel(d.date):'날짜 미정')}</span></div><label>일차 메모<input data-trip-title="${esc(d.id)}" maxlength="80" value="${esc(d.title)}" placeholder="예: 예원·와이탄"></label><div class="trip-move-actions"><button type="button" class="small" data-tripmove="up" data-id="${esc(d.id)}" aria-label="${i+1}D 위로" ${i===0?'disabled':''}>↑</button><button type="button" class="small" data-tripmove="down" data-id="${esc(d.id)}" aria-label="${i+1}D 아래로" ${i===days.length-1?'disabled':''}>↓</button><button type="button" class="small quiet danger" data-tripdelete="${esc(d.id)}">일차 삭제</button></div></article>`).join('');
 $('#bulkFrom').innerHTML=tripOptions(view.day);$('#bulkTo').innerHTML=tripOptions('');updateBulkCount();
}
function updateBulkCount(){const n=allPlaces().filter(p=>plannedDay(p.id)===$('#bulkFrom').value).length;$('#bulkCount').textContent=n+'곳의 방문 일차를 함께 바꿉니다. 시간·장소 메모는 유지돼요.';}
function initTripFeatures(){
 const baseCards=renderCards;renderCards=function(){renderDayChooser();baseCards();renderPlaceExtras();};
 const baseEdit=editPlace;editPlace=function(p){savedSourceDraft=structuredClone(state.sources?.[p?.id]||[]);if(!savedSourceDraft.length)savedSourceDraft.push({id:'source-'+Date.now().toString(36),label:'',url:''});baseEdit(p);renderSourcesEditor();};
 $('#ratingMember').onchange=e=>{ratingMember=e.target.value;try{localStorage.setItem(PROFILE_KEY,ratingMember);}catch{}renderPlaceExtras();};
 $('#addRatingMember').onclick=()=>{$('#memberName').value='';openDialog('memberDialog');};
 $('#memberForm').onsubmit=e=>{e.preventDefault();const name=$('#memberName').value.trim();if(!name)return;const existing=Object.entries(allMembers()).find(([,p])=>p.name===name);if(existing)ratingMember=existing[0];else{if(Object.keys(allMembers()).length>=20){toast('이름은 최대 20명까지 등록할 수 있어요.');return;}ratingMember='member-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);state.members[ratingMember]={name:name.slice(0,40)};persist();}try{localStorage.setItem(PROFILE_KEY,ratingMember);}catch{}closeDialog('memberDialog');renderPlaceExtras();};
 $('#cards').addEventListener('click',e=>{const b=e.target.closest('[data-rate]');if(!b)return;if(!ratingMember){toast('별점을 남길 이름을 먼저 골라 주세요.');return;}const id=b.dataset.place,n=Number(b.dataset.rate);if(!getPlace(id))return;state.ratings[id]??={};if(n===0)delete state.ratings[id][ratingMember];else if(Number.isInteger(n)&&n>=1&&n<=5)state.ratings[id][ratingMember]=n;else return;persist();renderPlaceExtras();});
 $('#addSavedSource').onclick=()=>{if(savedSourceDraft.length>=8)return;savedSourceDraft.push({id:'source-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),label:'',url:''});renderSourcesEditor();};
 $('#savedSourceRows').oninput=e=>{if(e.target.dataset.sourceLabel!==undefined)savedSourceDraft[Number(e.target.dataset.sourceLabel)].label=e.target.value;if(e.target.dataset.sourceUrl!==undefined)savedSourceDraft[Number(e.target.dataset.sourceUrl)].url=e.target.value;};
 $('#savedSourceRows').onclick=e=>{const b=e.target.closest('[data-remove-source]');if(b){savedSourceDraft.splice(Number(b.dataset.removeSource),1);renderSourcesEditor();}};
 $('#manageTrip').onclick=()=>{renderTripManager();openDialog('tripDialog');};$('#bulkMoveOpen').onclick=$('#manageTrip').onclick;
 $('#addTripDay').onclick=addTripDay;$('#addTripDayInside').onclick=addTripDay;
 $('#applyTripDates').onclick=()=>{const value=$('#tripStartDate').value;if(value&&!isTripDate(value)){toast('여행 시작일을 확인해 주세요.');return;}state.tripStart=value;persist();renderTripManager();renderCards();toast(value?'전체 일차의 날짜를 바꿨어요.':'날짜 없이 1D·2D로 표시해요.');};
 $('#clearTripDates').onclick=()=>{state.tripStart='';persist();renderTripManager();renderCards();toast('날짜 없이 1D·2D로 표시해요.');};
 $('#tripDayRows').onchange=e=>{const id=e.target.dataset.tripTitle;if(id&&state.tripDays[id]){state.tripDays[id].title=e.target.value.slice(0,80);persist();renderDayChooser();renderCards();}};
 $('#tripDayRows').onclick=e=>{const move=e.target.closest('[data-tripmove]');if(move){moveTripDay(move.dataset.id,move.dataset.tripmove==='up'?-1:1);return;}const del=e.target.closest('[data-tripdelete]');if(del&&confirm('이 일차를 삭제할까요? 여기에 배정한 장소는 ‘미배정’에서 볼 수 있고 장소 정보는 남습니다.')){state.tripDays[del.dataset.tripdelete].deleted=true;state.tripOrder=state.tripOrder.filter(id=>id!==del.dataset.tripdelete);persist();renderTripManager();renderCards();renderMap();}};
 let draggingDay='';$('#tripDayRows').ondragstart=e=>{const b=e.target.closest('[data-tripdrag]');if(!b){e.preventDefault();return;}draggingDay=b.dataset.tripdrag;e.dataTransfer.setData('text/plain',draggingDay);};$('#tripDayRows').ondragover=e=>{if(draggingDay&&e.target.closest('[data-triprow]'))e.preventDefault();};$('#tripDayRows').ondrop=e=>{const row=e.target.closest('[data-triprow]');if(row&&draggingDay){e.preventDefault();moveTripBefore(draggingDay,row.dataset.triprow);}draggingDay='';};$('#tripDayRows').ondragend=()=>draggingDay='';
 $('#bulkFrom').onchange=updateBulkCount;$('#applyBulkMove').onclick=()=>{const from=$('#bulkFrom').value,to=$('#bulkTo').value;if(from===to){toast('옮길 일차를 다르게 선택해 주세요.');return;}const places=allPlaces().filter(p=>plannedDay(p.id)===from);if(!places.length){toast('옮길 장소가 없어요.');return;}if(!confirm(dayName(from)+'의 '+places.length+'곳을 '+dayName(to)+'로 함께 옮길까요?'))return;for(const p of places)state.plans[p.id]={...state.plans[p.id],day:to};persist();view.day=to;renderTripManager();renderCards();renderMap();toast(places.length+'곳의 일차를 변경했어요.');};
 renderCards();
}
