/* RPG Typing Versus — progressive Story Map & damage-based stars.
   Published chapters load from Firestore; static JSON is the initial fallback. Ratings are never currency/rewards. */
(function(){
'use strict';
const identity=window.ADVENTURE_PLAYER||{};
const scope=String(identity.public_id||'guest').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32);
const STORAGE='rpg_story_completed_v1__'+scope;
const STAR_STORAGE='rpg_story_best_stars_v1__'+scope;
const validId=id=>/^[1-9]\d{0,3}-[1-9]\d{0,3}$/.test(String(id||''));
const safeAudio=s=>/^story\/audio\/[a-zA-Z0-9][\w.-]*\.(?:mp3|m4a|webm|opus|ogg|wav)$/i.test(String(s||''));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clampStars=n=>Math.max(0,Math.min(4,Math.trunc(Number(n)||0)));
const starsForDamage=(damage,stageId=null)=>{
 const st=chapters?.flatMap(ch=>ch.stages).find(s=>s.id===stageId);
 const limits=st?.stars?.damageMax||[0,1,2,3];
 const n=Math.max(0,Math.floor(Number(damage)||0));
 for(let i=0;i<4;i++)if(n<=limits[i])return 4-i;
 return 0;
};
let chapters=null,completed=new Set(),bestStars={},startFn=null,view='closed',activeChapter=0,selectedId=null;
let autoTimer=0;
const box=document.createElement('div');box.id='storyRoot';box.hidden=true;document.body.appendChild(box);
const serverOnline=Boolean(identity.online&&/^[A-HJ-NP-Z2-9]{16}$/.test(String(identity.card_code||'')));
function storageGet(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(v)?v.filter(validId):[]}catch{return []}}
function starGet(){try{const v=JSON.parse(localStorage.getItem(STAR_STORAGE)||'{}');if(!v||typeof v!=='object'||Array.isArray(v))return {};const out={};for(const [id,n] of Object.entries(v))if(validId(id)&&Number.isInteger(n)&&n>=0&&n<=4)out[id]=n;return out}catch{return {}}}
function storageSave(){try{localStorage.setItem(STORAGE,JSON.stringify([...completed]));localStorage.setItem(STAR_STORAGE,JSON.stringify(bestStars))}catch{}}
completed=new Set();bestStars={}; // Firebase remains authoritative; saved progress is read-only if disconnected.
async function serverProgress(action='load'){
 if(!serverOnline)return null;
 try{const response=await fetch('/api/story/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card_code:identity.card_code,action,completed:[...completed],best_stars:bestStars})});if(!response.ok)return null;return await response.json()}catch{return null}
}
async function loadProgress(){const remote=await serverProgress();if(!Array.isArray(remote?.completed)){
 completed=new Set(storageGet());bestStars=starGet();return; // read-only display; cannot unlock stages offline
 }if(Array.isArray(remote?.completed)){for(const id of remote.completed)if(validId(id))completed.add(id)}if(remote?.best_stars&&typeof remote.best_stars==='object'){for(const [id,n] of Object.entries(remote.best_stars))if(validId(id)&&Number.isInteger(n)&&n>=0&&n<=4)bestStars[id]=Math.max(bestStars[id]??0,n)}storageSave()}
const allStages=()=>chapters.flatMap(c=>c.stages);
function normalizeManifest(raw){
 if(!raw||!Array.isArray(raw.chapters))throw Error('Invalid story chapters file.');
 const ids=new Set();const chaptersOut=[];
 for(const ch of raw.chapters.slice(0,100)){
   const chapter={id:String(ch.id??''),title:String(ch.title||'Chapter').slice(0,80),subtitle:String(ch.subtitle||'').slice(0,150),stages:[]};
   for(const st of (Array.isArray(ch.stages)?ch.stages:[]).slice(0,100)){
     const id=String(st.id||'');if(!validId(id)||ids.has(id))continue;ids.add(id);
     const cleanScenes=arr=>(Array.isArray(arr)?arr:[]).slice(0,100).map(x=>({image:String(x.image||''),caption:String(x.caption||'').slice(0,300)}));
     chapter.stages.push({id,title:String(st.title||id).slice(0,85),description:String(st.description||'').slice(0,600),type:['story-only','battle-only','story-battle'].includes(st.type)?st.type:'story-battle',intro:cleanScenes(st.intro),outro:cleanScenes(st.outro),stars:{damageMax:Array.isArray(st.stars?.damageMax)&&st.stars.damageMax.length===4?st.stars.damageMax:[0,1,2,3]},unlock:{stageId:String(st.unlock?.stageId||''),minStars:Math.max(0,Math.min(4,Number(st.unlock?.minStars)||0))},battle:{template:Math.max(1,Math.min(5,Number(st.battle?.template)||1)),bossName:String(st.battle?.bossName||'Story Boss').slice(0,40),bossHp:Math.max(1,Math.min(999,Number(st.battle?.bossHp)||20)),bossSprite:safeImage(String(st.battle?.bossSprite||''))||'',battleBackground:safeImage(String(st.battle?.battleBackground||''))||'',bgmFile:safeAudio(st.battle?.bgmFile)?String(st.battle.bgmFile):'',bgmLoop:st.battle?.bgmLoop!==false,
       ...Object.fromEntries(Object.entries({fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],hitDamage:[1,100]}).flatMap(([key,[min,max]])=>typeof st.battle?.[key]==='number'&&Number.isFinite(st.battle[key])&&st.battle[key]>=min&&st.battle[key]<=max?[[key,st.battle[key]]]:[])),
       mechanics:Object.fromEntries(Object.entries(st.battle?.mechanics&&typeof st.battle.mechanics==='object'&&!Array.isArray(st.battle.mechanics)?st.battle.mechanics:{}).filter(([id,settings])=>/^[a-z][a-z0-9_]{0,47}$/.test(id)&&settings&&typeof settings==='object'&&!Array.isArray(settings)).map(([id,settings])=>[id,Object.fromEntries(Object.entries(settings).filter(([key,value])=>/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(key)&&(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&value>=-100000&&value<=100000)))]))}});
   }
   if(chapter.stages.length)chaptersOut.push(chapter);
 }
 if(!chaptersOut.length)throw Error('No story stages available.');
 return chaptersOut;
}
async function loadManifest(refresh=false){
 if(chapters&&!refresh)return chapters;
 // Do not silently revert to stale static chapters if a Firestore read fails.
 const {loadEffectiveStory}=await import('./story-content-cloud.js?v=87.0');
 const {manifest}=await loadEffectiveStory();
 chapters=normalizeManifest(manifest);
 return chapters;
}
function isUnlocked(id){
 const items=allStages(),at=items.findIndex(x=>x.id===id);
 if(at===0)return true;if(at<0)return false;
 const stage=items[at],required=stage.unlock?.stageId||items[at-1].id;
 if(!completed.has(required))return false;
 return (bestStars[required]??0)>=(stage.unlock?.minStars||0);
}
function show(html){box.hidden=false;view='active';box.innerHTML=`<div class="story-screen">${html}</div>`;}
function hide(){clearTimeout(autoTimer);autoTimer=0;box.hidden=true;box.innerHTML='';view='closed'}
function leaveStoryToModes(){
 hide();
 // A map can be opened after the underlying game overlay was hidden by
 // Squad Assembly or a previous story battle. Restore navigation explicitly.
 if(typeof window.RPG_STORY_EXIT_TO_MODES==='function')window.RPG_STORY_EXIT_TO_MODES();
 else document.getElementById('overlay')?.classList.add('show');
}
function errorScreen(msg){show(`<div class="story-modal"><h1>STORY MODE</h1><p class="story-error">${esc(msg)}</p><button id="st-error-back" type="button">BACK TO MODES</button></div>`);box.querySelector('#st-error-back').onclick=leaveStoryToModes}
const starMarkup=(n=0)=>`<span class="story-stars" aria-label="${n} of 4 stars">${Array.from({length:4},(_,i)=>`<span class="${i<n?'earned':'empty'}" aria-hidden="true">★</span>`).join('')}</span>`;
function openChapter(chIndex,preferred=null,focusTarget=''){
 const eligible=chapters.map((ch,i)=>({ch,i})).filter(x=>isUnlocked(x.ch.stages[0].id));
 activeChapter=eligible.some(x=>x.i===chIndex)?chIndex:(eligible.at(-1)?.i??0);
 const ch=chapters[activeChapter];const visible=ch.stages.filter(s=>isUnlocked(s.id));
 if(preferred&&visible.some(s=>s.id===preferred))selectedId=preferred;
 if(!visible.some(s=>s.id===selectedId))selectedId=visible.at(-1)?.id;
 const st=visible.find(s=>s.id===selectedId)||visible[0];
 // Path nodes are only created for revealed stages. Future nodes are not in the DOM.
 const mobile=window.innerWidth<=700;
 const positions=visible.map((_,i)=>({x:150+214*i,y:(mobile?[170,122,192,132,178,145]:[300,224,306,194,286,228])[i%6]}));
 const w=Math.max(780,positions.at(-1).x+175);
 const mapHeight=mobile?310:520;
 const lines=positions.slice(1).map((p,i)=>{const a=positions[i];return `<path d="M ${a.x} ${a.y} L ${p.x} ${p.y}" class="story-route"/>`}).join('');
 const nodes=visible.map((s,i)=>{
   const done=completed.has(s.id),selected=st.id===s.id,p=positions[i],star=bestStars[s.id];
   return `<button type="button" class="story-map-node ${done?'done':''} ${selected?'selected':''}" data-stage="${esc(s.id)}" style="left:${p.x}px;top:${p.y}px" aria-pressed="${selected}" aria-label="Stage ${esc(s.id)}${done?', completed':''}"><span class="story-node-emblem">${done?'✓':'◆'}</span><span class="story-node-id">${esc(s.id)}</span>${done&&s.type!=='story-only'?`<span class="story-node-rating">${starMarkup(star??0)}</span>`:''}</button>`;
 }).join('');
 const done=completed.has(st.id),rating=bestStars[st.id];
 const stats=st.type==='story-only'?'<span class="story-status-tag">STORY</span>':(done?`<div class="story-panel-stars">${starMarkup(rating??0)}</div>`:`<div class="story-panel-stars">${starMarkup(0)}</div>`);
 const stageDesc=esc(st.description||'');
 const allowedCh=eligible.map(x=>`<button type="button" data-chapter="${x.i}" class="story-chapter-tab ${x.i===activeChapter?'active':''}" aria-pressed="${x.i===activeChapter}" aria-label="${esc(x.ch.title)} chapter">${esc(x.ch.title)}</button>`).join('');
 show(`<div class="story-world"><div class="story-world-top"><button id="story-close" type="button" class="story-map-back" aria-label="Back to Mode Select">‹ <span>MODE SELECT</span></button><div class="story-map-title">STORY MODE</div><nav class="story-chapter-tabs" aria-label="Chapters">${allowedCh}</nav></div><div class="story-world-main"><section class="story-landscape" aria-label="Story stages"><div class="story-map-scroll" id="story-map-scroll"><div class="story-map-canvas" style="width:${w}px"><svg class="story-lines" viewBox="0 0 ${w} ${mapHeight}" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${nodes}</div></div><div class="story-map-corner">CHAPTER ${esc(ch.id)} <strong>${visible.length} / ${ch.stages.length}</strong></div></section><aside class="story-side" aria-label="Selected stage"><div class="story-side-eyebrow">CHAPTER ${esc(ch.id)}</div><h2>${esc(ch.title)}</h2>${ch.subtitle?`<div class="story-side-subtitle">${esc(ch.subtitle)}</div>`:''}<div class="story-side-rule"></div><span class="story-selected-id">OPERATION ${esc(st.id)}</span><h3>${esc(st.title)}</h3><div class="story-stage-kind">${st.type==='story-only'?'STORY':st.type==='battle-only'?'BATTLE':'STORY / BATTLE'}</div><div class="story-side-stars">${stats}</div><div class="story-stars-note">${st.type==='story-only'?'No combat rating':done?'BEST RESULT':'CLEAR RATING'}</div>${stageDesc?`<p class="story-stage-description">${stageDesc}</p>`:''}<div class="story-side-spacer"></div><button type="button" id="story-start" class="story-start">${done?'REPLAY':'START'} <span>▶</span></button></aside></div></div>`);
 view='map';
 box.querySelector('#story-close').onclick=leaveStoryToModes;
 box.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>openChapter(Number(b.dataset.chapter),null,'chapter'));
 box.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{selectedId=b.dataset.stage;openChapter(activeChapter,selectedId,'stage')});
 box.querySelector('#story-start').onclick=()=>{if(!isUnlocked(st.id))return;hide();startFn?.(st)};
 const scroller=box.querySelector('#story-map-scroll');const target=box.querySelector('.story-map-node.selected');if(scroller&&target){const x=target.offsetLeft-scroller.clientWidth/2+target.offsetWidth/2;scroller.scrollLeft=Math.max(0,x)}
 if(focusTarget==='stage')target?.focus({preventScroll:true});
 else if(focusTarget==='chapter')box.querySelector('.story-chapter-tab.active')?.focus({preventScroll:true});
}
async function openMap(fn,preferred){if(typeof fn==='function')startFn=fn;try{await loadManifest(true);await loadProgress();openChapter(activeChapter,preferred)}catch(e){errorScreen(e.message||'Story unavailable')}}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape' && !box.hidden && view==='map'){
  e.preventDefault();leaveStoryToModes();
 }
});
function safeImage(src){return /^story\/images\/[\w.-]+\.(png|webp|jpg|jpeg|svg)$/i.test(src||'')?src:null}
function showSlides(scenes,stageId,phase){
 clearTimeout(autoTimer);autoTimer=0;
 const list=Array.isArray(scenes)?scenes:[];
 if(!list.length)return Promise.resolve(true);
 return new Promise(resolve=>{
  let idx=0,auto=false,finished=false;
  function done(ok){if(finished)return;finished=true;clearTimeout(autoTimer);autoTimer=0;box.removeEventListener('keydown',onKey);hide();resolve(ok)}
  function advance(delta=1){idx+=delta;if(idx>=list.length){done(true);return}idx=Math.max(0,idx);draw()}
  function schedule(){clearTimeout(autoTimer);if(auto)autoTimer=setTimeout(()=>advance(),6500)}
  function onKey(e){if(!box.hidden){if(e.key==='Escape'){e.preventDefault();done(false)}else if(['Enter','ArrowRight',' '].includes(e.key)){e.preventDefault();advance()}else if(e.key==='ArrowLeft'){e.preventDefault();advance(-1)}}}
  function draw(){
   const scene=list[idx]||{},src=safeImage(scene.image),label=esc(stageId),pre=phase==='outro'?'AFTER BATTLE':'BEFORE BATTLE';
   show(`<div class="story-reader"><div class="story-reader-top"><span>${label} · ${pre}</span><span>${idx+1} / ${list.length}</span></div><div class="story-visual" id="story-visual" role="img" aria-label="Story scene ${idx+1}">${src?`<img src="${esc(src)}" alt="Story illustration ${idx+1}" loading="eager">`:`<div class="story-placeholder"><span>◇</span></div>`}</div><div class="story-caption">${esc(scene.caption||'')}</div><div class="story-reader-controls"><button id="story-back" class="story-secondary" ${idx===0?'disabled':''}>BACK</button><button id="story-auto" class="story-secondary" aria-pressed="${auto}">${auto?'AUTO ON':'AUTO OFF'}</button><button id="story-skip" class="story-secondary">SKIP</button><button id="story-next">${idx===list.length-1?'CONTINUE':'NEXT'} ▶</button></div></div>`);
   box.querySelector('#story-back').onclick=()=>advance(-1);
   box.querySelector('#story-next').onclick=()=>advance();
   box.querySelector('#story-skip').onclick=()=>done(true);
   box.querySelector('#story-auto').onclick=()=>{auto=!auto;draw()};
   box.querySelector('#story-visual').onclick=()=>advance();
   const img=box.querySelector('.story-visual img');if(img)img.onerror=()=>{img.remove();const label=document.createElement('div');label.className='story-placeholder';label.textContent='IMAGE UNAVAILABLE';box.querySelector('.story-visual').append(label)};
   schedule();
  }
  box.addEventListener('keydown',onKey);draw();
  box.querySelector('#story-next')?.focus();
 });
}

async function markCompleted(id,result={}){
 if(!validId(id))return null;
 const firstClear=!completed.has(id);
 const previousStars={...bestStars};
 completed.add(id);
 const battle=Boolean(result&&result.isBattle);
 let stars=null;
 if(battle){
   const damage=Math.max(0,Math.floor(Number(result.damageTaken)||0));
   stars=starsForDamage(damage,id);
   bestStars[id]=Math.max(bestStars[id]??0,stars);
 }
 const saved=await serverProgress('save');
 if(!saved?.ok){if(firstClear)completed.delete(id);bestStars=previousStars;throw Error('Story progress was not saved to Firebase.');}
 storageSave();
 return {stars,best:bestStars[id]??null,firstClear};
}
function showResult(stageId,rating,damage){
 return new Promise(resolve=>{
  const st=allStages().find(s=>s.id===stageId);const isBattle=rating&&rating.stars!==null;
  const value=isBattle?rating.stars:0;
  show(`<div class="story-result" role="dialog" aria-label="Stage clear"><div class="story-result-label">STAGE COMPLETE</div><h2>${esc(stageId)}${st&&st.title!==stageId?` · ${esc(st.title)}`:''}</h2>${isBattle?`${starMarkup(value)}<p>${value} / 4 STARS · ${damage} DAMAGE</p>${rating.best>value?`<small>BEST ${rating.best} / 4</small>`:''}`:'<p>STORY COMPLETE</p>'}${rating?.offline?'<p class="story-guild-reward">UNRANKED · NOT SAVED</p>':''}${rating?.guildCoins?`<p class="story-guild-reward">+${rating.guildCoins} GUILD COINS</p>`:rating?.guildDuplicate?'<p class="story-guild-reward">ALREADY CLAIMED</p>':rating?.guildError?`<p class="story-guild-reward">${esc(rating.guildError)}</p>`:''}<button type="button" id="story-result-continue">CONTINUE ▶</button></div>`);
  const finish=()=>{box.removeEventListener('keydown',onKey);hide();resolve()};
  const onKey=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();finish()}};
  box.addEventListener('keydown',onKey);box.querySelector('#story-result-continue').onclick=finish;box.querySelector('#story-result-continue').focus();
 });
}
window.RPG_STORY={openMap,showSlides,markCompleted,showResult,loadManifest,getCompleted:()=>[...completed],getBestStars:()=>({...bestStars}),isUnlocked,starsForDamage};
})();
