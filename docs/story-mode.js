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
let autoTimer=0,conquestOverlayFinish=null;
let retiredTerritoryIds=new Set();
const box=document.createElement('div');box.id='storyRoot';box.hidden=true;document.body.appendChild(box);
const serverOnline=Boolean(identity.online&&/^[A-HJ-NP-Z2-9]{16}$/.test(String(identity.card_code||'')));
function storageGet(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(v)?v.filter(validId):[]}catch{return []}}
function starGet(){try{const v=JSON.parse(localStorage.getItem(STAR_STORAGE)||'{}');if(!v||typeof v!=='object'||Array.isArray(v))return {};const out={};for(const [id,n] of Object.entries(v))if(validId(id)&&Number.isInteger(n)&&n>=0&&n<=4)out[id]=n;return out}catch{return {}}}
function storageSave(){try{localStorage.setItem(STORAGE,JSON.stringify([...completed]));localStorage.setItem(STAR_STORAGE,JSON.stringify(bestStars))}catch{}}
completed=new Set();bestStars={}; // Firebase remains authoritative; saved progress is read-only if disconnected.
async function serverProgress(action='load',territoryId=null,stages=null){
 if(!serverOnline)return null;
 const body={card_code:identity.card_code,action};
 if(action==='save'){body.territory_id=territoryId;body.stages=stages;}
 try{const response=await fetch('/api/story/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)return null;return await response.json()}catch{return null}
}
async function loadProgress(){const remote=await serverProgress();if(!Array.isArray(remote?.completed)){
 if(serverOnline&&navigator.onLine&&!window.RPG_V66_DISCONNECTED)throw Error('Adventure progress unavailable. Check your connection, then reopen Adventure.');
 completed=new Set(storageGet());bestStars=starGet();return; // offline display only
 }if(Array.isArray(remote?.completed)){completed=new Set(remote.completed.filter(validId));bestStars={}}if(remote?.best_stars&&typeof remote.best_stars==='object'){for(const [id,n] of Object.entries(remote.best_stars))if(validId(id)&&Number.isInteger(n)&&n>=0&&n<=4)bestStars[id]=Math.max(bestStars[id]??0,n)}storageSave()}
function acceptTerritorySave(saved,id,required){
 if(!saved?.ok||saved.territory_id!==id||!Array.isArray(saved.completed)||!Array.isArray(saved.first_clears)||!required.every(key=>saved.completed.includes(key)))return false;
 const belongs=key=>validId(key)&&key.split('-')[0]===id;
 completed=new Set([...completed].filter(key=>!belongs(key)));
 for(const key of Object.keys(bestStars))if(belongs(key))delete bestStars[key];
 for(const key of saved.completed)if(belongs(key))completed.add(key);
 for(const [key,n] of Object.entries(saved.best_stars||{}))if(belongs(key)&&completed.has(key)&&Number.isInteger(n)&&n>=0&&n<=4)bestStars[key]=n;
 storageSave();return true;
}
const allStages=()=>(chapters||[]).flatMap(c=>c.stages);
function normalizeManifest(raw){
 if(!raw||!Array.isArray(raw.chapters))throw Error('Invalid story chapters file.');
 const ids=new Set();const chaptersOut=[];
 for(const ch of raw.chapters.slice(0,100)){
   const chapter={id:String(ch.id??''),title:String(ch.title||'Chapter').slice(0,80),subtitle:String(ch.subtitle||'').slice(0,150),stages:[],...(ch.conquest!==undefined&&typeof window!=='undefined'&&window.RPG_CONQUEST?.normalizeConfig?{conquest:window.RPG_CONQUEST.normalizeConfig(ch.conquest,false,String(ch.id))}:{})};
   for(const st of (Array.isArray(ch.stages)?ch.stages:[]).slice(0,100)){
     const id=String(st.id||'');if(!validId(id)||ids.has(id))continue;ids.add(id);
     const cleanScenes=arr=>(Array.isArray(arr)?arr:[]).slice(0,100).map(x=>({image:String(x.image||''),caption:String(x.caption||'').slice(0,300)}));
     chapter.stages.push({id,title:String(st.title||id).slice(0,85),description:String(st.description||'').slice(0,600),type:['story-only','battle-only','story-battle'].includes(st.type)?st.type:'story-battle',intro:cleanScenes(st.intro),outro:cleanScenes(st.outro),stars:{damageMax:Array.isArray(st.stars?.damageMax)&&st.stars.damageMax.length===4?st.stars.damageMax:[0,1,2,3]},unlock:{stageId:String(st.unlock?.stageId||''),minStars:Math.max(0,Math.min(4,Number(st.unlock?.minStars)||0))},battle:{template:Math.max(1,Math.min(5,Number(st.battle?.template)||1)),bossName:String(st.battle?.bossName||'Story Boss').slice(0,40),bossHp:Math.max(1,Math.min(999,Number(st.battle?.bossHp)||20)),bossSprite:safeImage(String(st.battle?.bossSprite||''))||'',battleBackground:safeImage(String(st.battle?.battleBackground||''))||'',bgmFile:safeAudio(st.battle?.bgmFile)?String(st.battle.bgmFile):'',bgmLoop:st.battle?.bgmLoop!==false,
       ...Object.fromEntries(Object.entries({fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],hitDamage:[1,100]}).flatMap(([key,[min,max]])=>typeof st.battle?.[key]==='number'&&Number.isFinite(st.battle[key])&&st.battle[key]>=min&&st.battle[key]<=max?[[key,st.battle[key]]]:[])),
       ...Object.fromEntries(['missDamage','overflowDamage','cometDamage','shootingStarDamage'].flatMap(key=>Number.isInteger(st.battle?.[key])&&st.battle[key]>=1&&st.battle[key]<=10?[[key,st.battle[key]]]:[])),
       cometEnabled:st.battle?.cometEnabled===true,shootingStarEnabled:st.battle?.shootingStarEnabled===true,
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
 const {loadEffectiveStory}=await import('./story-content-cloud.js?v=148.9');
 const {manifest}=await loadEffectiveStory();
 chapters=normalizeManifest(manifest);
 retiredTerritoryIds=new Set((manifest.retiredChapterIds||[]).map(String));
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
 mapOpenRequest++;hide();
 // A map can be opened after the underlying game overlay was hidden by
 // Squad Assembly or a previous story battle. Restore navigation explicitly.
 if(typeof window.RPG_STORY_EXIT_TO_MODES==='function')window.RPG_STORY_EXIT_TO_MODES();
 else document.getElementById('overlay')?.classList.add('show');
}
function errorScreen(msg){show(`<div class="story-modal"><h1>ADVENTURE</h1><p class="story-error">${esc(msg)}</p><button id="st-error-back" type="button">BACK TO MODES</button></div>`);box.querySelector('#st-error-back').onclick=leaveStoryToModes}
const starMarkup=(n=0)=>`<span class="story-stars" aria-label="${n} of 4 stars">${Array.from({length:4},(_,i)=>`<span class="${i<n?'earned':'empty'}" aria-hidden="true">★</span>`).join('')}</span>`;
function openConquestChapter(chIndex,preferred=null,requestedId=null,focus=false,intermission=null){
 const core=window.RPG_CONQUEST,atlas=window.RPG_CONQUEST_MAP;
 const regions=chapters.filter(ch=>core.visibility(ch)!=='hidden');
 const hasBattles=ch=>!!ch?.stages.some(s=>s.type!=='story-only');
 const enabledRegions=regions.filter(ch=>core.visibility(ch)==='enabled'&&hasBattles(ch));
 const cleared=ch=>hasBattles(ch)&&ch.stages.filter(s=>s.type!=='story-only').every(s=>completed.has(s.id));
 // Fixed starter IDs, independent of editor ordering or visibility. All three
 // must have every battle cleared before any later territory can be entered.
 const starterIds=['1','2','3'];
 const starter=ch=>starterIds.includes(String(ch?.id));
 const starterClears=starterIds.filter(id=>cleared(chapters.find(c=>String(c.id)===id))).length;
 const startersComplete=starterClears===starterIds.length;
 const laterRegions=enabledRegions.filter(ch=>!starter(ch));
 const available=(ch,i)=>{
   if(!enabledRegions.includes(ch))return false;
   if(starter(ch))return true;
   if(!startersComplete)return false;
   const at=laterRegions.indexOf(ch);
   return cleared(ch)||at===0||cleared(laterRegions[at-1]);
 };
 const activeRun=intermission&&intermission.run===core.run?intermission.run:null;
 const isActive=id=>!!activeRun&&String(activeRun.chapter.id)===String(id);
 // Uncreated Rift/Valcrest/Vesper are visible as Coming Soon, never playable.
 // All other uncreated or retired stock slots are omitted.
 const choices=[...regions.map(c=>({id:c.id,name:atlas.byId(c.id)?.name||c.title})),...atlas.regions.filter(r=>['1','2','3'].includes(r.id)&&!chapters.some(c=>c.id===r.id)&&!retiredTerritoryIds.has(r.id)).map(r=>({id:r.id,name:r.name}))];
 if(!choices.length){show(`<div class="story-modal"><h1>ADVENTURE</h1><p>No territories available.</p><button id="story-close" type="button">BACK TO MODES</button></div>`);box.querySelector('#story-close').onclick=activeRun?intermission.back:leaveStoryToModes;return;}
 const preferredIndex=preferred?regions.findIndex(ch=>ch.stages.some(s=>s.id===preferred)):-1;
 activeChapter=preferredIndex>=0?preferredIndex:Math.max(0,Math.min(regions.length-1,chIndex));
 if(!available(regions[activeChapter],activeChapter))activeChapter=Math.max(0,regions.findLastIndex(available));
 const requested=String(requestedId??'');
 const selected=choices.some(c=>c.id===requested)?requested:String(regions[activeChapter]?.id??choices[0].id);
 const selectedIndex=regions.findIndex(ch=>ch.id===selected);
 const ch=regions[selectedIndex];
 const battles=isActive(selected)?activeRun.encounters:ch?ch.stages.filter(s=>s.type!=='story-only'):[];
 const allowed=!!ch&&available(ch,selectedIndex);
 const canStart=allowed&&(!activeRun||isActive(selected));
 if(allowed)activeChapter=selectedIndex;
 const state=id=>{const i=regions.findIndex(c=>c.id===id);return i<0?'unpublished':isActive(id)?'inprogress':core.visibility(regions[i])!=='enabled'||!hasBattles(regions[i])?'unpublished':!available(regions[i],i)?'locked':cleared(regions[i])?'captured':'available';};
 const status={inprogress:'IN PROGRESS',unpublished:'COMING SOON',captured:'CAPTURED',available:'AVAILABLE',locked:'LOCKED'};
 const pageSize=4,selectedChoice=Math.max(0,choices.findIndex(c=>c.id===selected)),page=Math.floor(selectedChoice/pageSize),pageCount=Math.ceil(choices.length/pageSize),pageItems=choices.slice(page*pageSize,(page+1)*pageSize);
 const banners=pageItems.map(c=>{const st=state(c.id),data=regions.find(r=>r.id===c.id)||{id:c.id};const active=isActive(c.id),bannerProgress={total:active?activeRun.encounters.length:Math.max(1,(data.stages||[]).filter(s=>s.type!=='story-only').length),cleared:active?activeRun.records.length:0,captured:!active&&st==='captured'};return `<button type="button" class="cq-banner ${st} ${selected===c.id?'selected':''}" data-territory="${esc(c.id)}" aria-pressed="${selected===c.id}" aria-label="${esc(c.name)}, ${status[st]}">${atlas.banner(isActive(c.id)?activeRun.chapter:data,{...bannerProgress,segmented:true})}<span class="cq-banner-name">${esc(c.name)}</span><span class="cq-banner-state">${st==='captured'?'✓ ':st==='locked'?'🔒 ':''}${status[st]}${isActive(c.id)?` · ${activeRun.records.length}/${activeRun.encounters.length}`:''}</span></button>`;}).join('');
 const label=atlas.byId(selected)?.name||ch?.title||'Operation';
 const selectedColor=ch?.conquest?.banner?.color||atlas.byId(selected)?.color||'#d9dfe4';
 // Reveal follows the actual operation order, not historical capture records.
 // A replay begins at stage one; an active operation uses its original encounter list.
 const done=isActive(selected)?Math.min(battles.length,activeRun.records.length):0;
 const nextIndex=allowed&&done<battles.length?done:-1;
 const stageNo=i=>String(i+1).padStart(2,'0');
 const entries=battles.map((stage,i)=>{
   const finished=i<done, current=i===nextIndex, revealed=finished||current;
   const stageState=finished?'cleared':current?'current':'locked';
   return `<div class="conquest-encounter cq-stage-${stageState}" role="listitem" ${current?'aria-current="step"':''}><b>${stageNo(i)}</b><div class="cq-stage-detail"><span class="cq-stage-name">${revealed?esc(stage.battle.bossName||stage.title):'???'}</span><span class="cq-stage-status">${finished?'CLEARED':current?'NEXT BATTLE':'LOCKED'}</span></div><strong>${finished?'✓':current?`${stage.battle.bossHp*10} HP`:'—'}</strong></div>`;
 }).join('');
 const stageProgress=`<div class="cq-stage-progress"><span>STAGES CLEARED</span><strong>${done} / ${battles.length}</strong><div class="cq-stage-meter" role="progressbar" aria-label="Stages cleared" aria-valuemin="0" aria-valuemax="${battles.length}" aria-valuenow="${done}"><i style="width:${battles.length?100*done/battles.length:0}%"></i></div></div>`;
 const lockHint=state(selected)==='locked'&&!starter(ch)&&!startersComplete?`<p class="cq-stage-status">Clear The Rift, Valcrest and Vesper (${starterClears}/3).</p>`:'';
 const actionLabel=activeRun?(isActive(selected)?`CONTINUE · STAGE ${stageNo(done)}`:'OPERATION ACTIVE'):allowed?(cleared(ch)?'REPLAY · STAGE 01':'START · STAGE 01'):(state(selected)==='unpublished'?'COMING SOON':'LOCKED');
 show(`<div class="story-world conquest-world cq-atlas cq-hall"><div class="story-world-top"><button id="story-close" class="story-map-back" type="button" aria-label="${activeRun?'Back to reward':'Back to Mode Select'}">‹ <span>${activeRun?'REWARD':'MODE SELECT'}</span></button><div class="story-map-title">ADVENTURE</div><div class="cq-progress">TERRITORIES <strong>${enabledRegions.filter(cleared).length} / ${enabledRegions.length}</strong></div></div><div class="cq-main"><section class="cq-map-panel cq-banner-panel" aria-label="Hall of Banners"><div class="cq-hall-heading">HALL OF BANNERS <small class="cq-hall-hint">· CHOOSE A TERRITORY</small></div><div class="cq-banner-row ${pageCount===1?'cq-single-page':''}">${pageCount>1?`<button id="cq-prev" type="button" aria-label="Previous banners" ${page===0?'disabled':''}>‹</button>`:''}<div class="cq-banner-grid cq-count-${pageItems.length}">${banners}</div>${pageCount>1?`<button id="cq-next" type="button" aria-label="Next banners" ${page===pageCount-1?'disabled':''}>›</button>`:''}</div><div class="cq-map-footer" ${pageCount===1?'hidden':''}><span class="cq-page">${page+1} / ${pageCount}</span><label class="cq-jump"><span class="cq-jump-label">Territory</span><select id="cq-territory-select" aria-label="Select territory">${choices.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name)} · ${status[state(c.id)]}</option>`).join('')}</select></label></div></section><aside class="cq-side" style="--territory:${selectedColor}" aria-label="Selected territory"><div class="cq-side-head"><span class="cq-side-status">${status[state(selected)]}</span><h2>${esc(label)}</h2></div>${ch&&state(selected)!=='unpublished'?`${stageProgress}<div class="cq-encounters" role="list" aria-label="Stage order"><h3>STAGE ORDER</h3>${entries}</div>`:'<div class="cq-empty">Coming soon.</div>'}<div class="cq-actions">${lockHint}<button id="conquest-start" class="story-start" type="button" ${canStart?'':'disabled'}>${actionLabel} <span>${canStart?'››':''}</span></button></div></aside></div></div>`);
 view='map';
 const list=box.querySelector('.cq-encounters'),currentRow=box.querySelector('.cq-stage-current');
 if(list?.getBoundingClientRect&&currentRow?.getBoundingClientRect){const a=list.getBoundingClientRect(),b=currentRow.getBoundingClientRect();if(b.bottom>a.bottom)list.scrollTop+=b.bottom-a.bottom;}
 box.querySelector('#story-close').onclick=activeRun?intermission.back:leaveStoryToModes;
 box.querySelectorAll('[data-territory]').forEach(el=>{el.onclick=()=>{
   const id=el.dataset.territory,i=regions.findIndex(c=>String(c.id)===id);
   // v148.9: an open banner goes straight to its Stage Select (with the reveal animation).
   if(!activeRun&&i>=0&&available(regions[i],i)){activeChapter=i;openStageSelect(id,{anim:'open'});return;}
   openConquestChapter(activeChapter,null,id,true,intermission);};});
 for(const [selector,offset] of [['#cq-prev',-1],['#cq-next',1]]){const button=box.querySelector(selector);if(button)button.onclick=()=>{const target=choices[(page+offset)*pageSize];if(target)openConquestChapter(activeChapter,null,target.id,true,intermission);};}
 box.querySelector('#cq-territory-select').onchange=e=>{openConquestChapter(activeChapter,null,e.target.value,false,intermission);box.querySelector('#cq-territory-select')?.focus();};
 box.querySelector('#conquest-start').onclick=()=>{if(activeRun){if(canStart)intermission.next();return;}if(!allowed)return;hide();startFn?.(ch);};
 if(focus)Array.from(box.querySelectorAll('[data-territory]')).find(el=>el.dataset.territory===selected)?.focus({preventScroll:true});
}
function openChapter(chIndex,preferred=null,focusTarget=''){
 if(window.RPG_CONQUEST)return openConquestChapter(chIndex,preferred);
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
let mapOpenRequest=0,mapLoading=null;
async function openMap(fn,preferred){
 const request=++mapOpenRequest;if(typeof fn==='function')startFn=fn;
 show('<div class="story-modal"><h1>ADVENTURE</h1><p>LOADING…</p><button id="st-loading-back" type="button">BACK</button></div>');view='map-loading';box.querySelector('#st-loading-back').onclick=leaveStoryToModes;
 if(!mapLoading){const pending=Promise.allSettled([loadManifest(true),loadProgress()]).then(results=>{const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;});mapLoading=pending;pending.then(()=>{if(mapLoading===pending)mapLoading=null;},()=>{if(mapLoading===pending)mapLoading=null;});}
 try{await mapLoading;if(request===mapOpenRequest)openChapter(activeChapter,preferred)}catch(e){if(request===mapOpenRequest)errorScreen(e.message||'Story unavailable')}
}
document.addEventListener('keydown',e=>{
 if(e.key==='Escape' && !box.hidden && view==='stage'){e.preventDefault();box.querySelector('#ss-close')?.click();return;}
 if(e.key==='Escape' && !box.hidden && (view==='map'||view==='map-loading')){
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
 const territory=id.split('-')[0],stars=result?.isBattle?starsForDamage(result.damageTaken,id):null;
 const saved=await serverProgress('save',territory,{[id]:stars??-1});
 if(!acceptTerritorySave(saved,territory,[id]))throw Error('Adventure progress was not saved. Check your connection.');
 return {stars,best:bestStars[id]??null,firstClear:saved.first_clears.includes(id)};
}
async function markConquestCompleted(run){
 const territory=String(run.chapter.id),delta={};
 if(run.unranked||!run.encounters.length||run.records.length!==run.encounters.length)return {ok:false,firstClears:[]};
 for(const stage of run.encounters){
   if(!validId(stage.id)||stage.id.split('-')[0]!==territory)return {ok:false,firstClears:[]};
   const rec=run.records.find(r=>r.stageId===stage.id);
   if(!rec)return {ok:false,firstClears:[]};
   delta[stage.id]=starsForDamage(rec.damage,stage.id);
 }
 const saved=await serverProgress('save',territory,delta);
 if(!acceptTerritorySave(saved,territory,Object.keys(delta)))return {ok:false,firstClears:[]};
 return {ok:true,firstClears:saved.first_clears.filter(key=>Object.hasOwn(delta,key))};
}
// ---- v148.9 Stage Select (after choosing a banner) ----------------------------------
// Left: the territory's stages. Middle: the selected stage's boss (full body). Top: emblem.
// One run clears the stages in order; a knocked-out squad sends the run back to Stage 01.
const EMBLEMS={'1':'assets/emblems/rift.webp','2':'assets/emblems/valcrest.webp','3':'assets/emblems/vesper.webp'};
const BOSS_PLACEHOLDER='story/images/boss-placeholder.svg';
const media=p=>window.RPG_MEDIA?.url?.(p)||p;
const stageNo=i=>String(i+1).padStart(2,'0');
const bossArt=st=>safeImage(st?.battle?.bossSprite)||BOSS_PLACEHOLDER;
let stageSelectTimers=[];
function clearStageTimers(){stageSelectTimers.forEach(clearTimeout);stageSelectTimers=[];}
function later(fn,ms){stageSelectTimers.push(setTimeout(fn,ms));}
function openStageSelect(territoryId,opts={}){
 clearStageTimers();
 const atlas=window.RPG_CONQUEST_MAP,core=window.RPG_CONQUEST;
 const id=String(territoryId),ch=chapters?.find(c=>String(c.id)===id);
 if(!ch){openConquestChapter(activeChapter);return;}
 const mid=opts.intermission||null,run=mid?.run||null;
 const battles=run?run.encounters:ch.stages.filter(s=>s.type!=='story-only');
 const captured=battles.length&&battles.every(s=>completed.has(s.id));
 const doneRun=run?Math.min(battles.length,run.records.length):0;
 const complete=opts.anim==='complete';
 let shownDone=complete?battles.length:opts.anim==='fail'?Math.min(battles.length,opts.failFrom||0):doneRun;
 const startable=complete||opts.anim==='fail'?0:doneRun;   // the only stage that can be played now
 const name=atlas.byId(id)?.name||ch.title,color=ch.conquest?.banner?.color||atlas.byId(id)?.color||'#9fb3c8';
 const art=atlas.artPath(ch),emblem=EMBLEMS[id];
 let selected=Math.min(battles.length-1,opts.select??(complete?battles.length-1:shownDone));
 const status=()=>run?`OPERATION IN PROGRESS · ${doneRun} / ${battles.length}`:complete?'TERRITORY CAPTURED':captured?'CAPTURED · REPLAY FROM STAGE 01':'NOT STARTED';
 // Teacher-named stages show their name; default "Stage 1-1" titles show "Level N".
 const stageLabel=(st,i)=>{const t=String(st.title||'').trim();return !t||/^stage\s*[\d-]+$/i.test(t)?`Level ${i+1}`:esc(t);};
 const card=(st,i)=>{
  const state=i<shownDone?'cleared':i===(opts.anim==='fail'?shownDone:startable)&&!complete?'current':'locked';
  return `<li><button type="button" class="ss-stage is-${state}${i===selected?' is-selected':''}" data-i="${i}" style="--d:${i}" aria-pressed="${i===selected}">
   <span class="ss-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2l3 5 6 1-4 5 1 7-6-3-6 3 1-7-4-5 6-1z"/></svg></span>
   <span class="ss-txt"><small>STAGE ${stageNo(i)}</small><b>${stageLabel(st,i)}</b></span>
   <span class="ss-tag">${state==='cleared'?'✓ CLEARED':state==='current'?'CURRENT GOAL':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'}</span></button></li>`;
 };
 show(`<div class="ss-root ${opts.anim?'ss-anim-'+esc(opts.anim):''}" style="--territory:${esc(color)}">
  <div class="ss-bg" style="${art?`background-image:url('${esc(media(art))}')`:''}"></div>
  <header class="ss-head"><span class="ss-term">// ADVENTURE TERMINAL</span>
   <div class="ss-title">${emblem?`<img class="ss-emblem" src="${esc(media(emblem))}" alt="">`:''}<div><small>CURRENT TERRITORY STATUS</small><h1>${esc(name)}</h1></div></div>
   <span class="ss-status" id="ss-status">${esc(status())}</span>
   <button type="button" class="ss-close" id="ss-close" aria-label="${run?'Retreat from the operation':'Back to Hall of Banners'}">✕</button></header>
  <aside class="ss-left"><div class="ss-left-head"><span>STAGES</span><b id="ss-count">${shownDone} / ${battles.length}</b></div>
   <ol class="ss-list" id="ss-list">${battles.map(card).join('')}</ol>
   <div class="ss-info">${run?`<b>SQUAD HP</b> ${esc(core.displayed(run.hp??0))} · <b>ENHANCEMENTS</b> ${run.rewards.length}`:'Clear every stage in one run. If your whole squad is knocked out, the run restarts from Stage 01.'}</div></aside>
  <main class="ss-mid"><div class="ss-boss-wrap"><img class="ss-boss" id="ss-boss" alt="" decoding="async"></div>
   <div class="ss-boss-meta"><small id="ss-boss-stage">STAGE 01</small><h2 id="ss-boss-name">—</h2><span id="ss-boss-hp"></span></div>
   <button type="button" class="ss-go" id="ss-go"><span>GO TO BATTLE</span><i>››</i></button></main>
  <div class="ss-flash" aria-hidden="true"></div><div class="ss-banner" id="ss-banner" hidden></div></div>`);
 view='stage';
 const root=box.querySelector('.ss-root');
 function paintMiddle(){
  const st=battles[selected];if(!st)return;
  const el=box.querySelector(`.ss-stage[data-i="${selected}"]`),locked=el?.classList.contains('is-locked');
  const img=box.querySelector('#ss-boss');img.classList.toggle('is-locked',!!locked);
  img.onerror=()=>{img.onerror=null;img.src=BOSS_PLACEHOLDER;};
  img.src=media(bossArt(st));img.classList.remove('is-in');void img.offsetWidth;img.classList.add('is-in');
  box.querySelector('#ss-boss-stage').textContent=`STAGE ${stageNo(selected)}`;
  box.querySelector('#ss-boss-name').textContent=locked?'???':(st.battle.bossName||st.title);
  box.querySelector('#ss-boss-hp').textContent=locked?'LOCKED':`BOSS HP ${st.battle.bossHp*10}`;
  const go=box.querySelector('#ss-go'),can=el?.classList.contains('is-current');
  go.disabled=!can;
  go.querySelector('span').textContent=can?(run?`GO TO BATTLE · STAGE ${stageNo(selected)}`:'GO TO BATTLE'):el?.classList.contains('is-cleared')?'CLEARED':'LOCKED';
 }
 function select(i){selected=i;box.querySelectorAll('.ss-stage').forEach(b=>{const on=Number(b.dataset.i)===i;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on));});paintMiddle();}
 box.querySelectorAll('.ss-stage').forEach(b=>b.onclick=()=>select(Number(b.dataset.i)));
 box.querySelector('#ss-go').onclick=()=>{
  if(box.querySelector('#ss-go').disabled)return;
  clearStageTimers();
  if(mid){mid.go();return;}
  hide();startFn?.(ch);           // new run: Squad Assembly → Stage 01
 };
 box.querySelector('#ss-close').onclick=()=>{
  if(mid){if(window.confirm('Retreat from this operation? Your progress in this run will be lost.'))mid.retreat();return;}
  clearStageTimers();openConquestChapter(activeChapter,null,id,true);
 };
 paintMiddle();
 const setCard=(i,state)=>{const b=box.querySelector(`.ss-stage[data-i="${i}"]`);if(!b)return;b.classList.remove('is-cleared','is-current','is-locked');b.classList.add('is-'+state);
  b.querySelector('.ss-tag').innerHTML=state==='cleared'?'✓ CLEARED':state==='current'?'CURRENT GOAL':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';};
 const banner=(text,kind)=>{const b=box.querySelector('#ss-banner');b.textContent=text;b.className='ss-banner is-'+kind;b.hidden=false;};
 if(opts.anim==='unlock'&&doneRun>0&&doneRun<battles.length){
  // The just-cleared stage stamps ✓, then the next stage unlocks with a light sweep.
  setCard(doneRun,'locked');select(doneRun-1);
  const prev=box.querySelector(`.ss-stage[data-i="${doneRun-1}"]`);prev?.classList.add('ss-stamp');
  banner(`STAGE ${stageNo(doneRun-1)} CLEARED`,'ok');
  later(()=>{setCard(doneRun,'current');const nx=box.querySelector(`.ss-stage[data-i="${doneRun}"]`);nx?.classList.add('ss-unlock');select(doneRun);
   banner(`STAGE ${stageNo(doneRun)} UNLOCKED`,'ok');},900);
  later(()=>{box.querySelector('#ss-banner')&&(box.querySelector('#ss-banner').hidden=true);},2600);
 }
 if(opts.anim==='fail'){
  // Squad knocked out: every stage except the first slowly greys out again.
  root.classList.add('is-failed');banner('SQUAD KNOCKED OUT · OPERATION RESET','bad');
  box.querySelector('#ss-go').disabled=true;
  const n=shownDone,step=520;
  for(let k=n;k>=1;k--){const i=k;later(()=>{setCard(i,'locked');box.querySelector(`.ss-stage[data-i="${i}"]`)?.classList.add('ss-grey');
   box.querySelector('#ss-count').textContent=`${Math.max(0,i-1)} / ${battles.length}`;},700+(n-k)*step);}
  later(()=>{setCard(0,'current');box.querySelector('.ss-stage[data-i="0"]')?.classList.add('ss-unlock');shownDone=0;
   box.querySelector('#ss-count').textContent=`0 / ${battles.length}`;root.classList.remove('is-failed');select(0);
   box.querySelector('#ss-status').textContent=captured?'CAPTURED · REPLAY FROM STAGE 01':'NOT STARTED';},700+n*step+200);
  later(()=>{const b=box.querySelector('#ss-banner');if(b)b.hidden=true;},700+n*step+2200);
 }
 if(complete){banner('ALL STAGES CLEARED','gold');later(()=>{const b=box.querySelector('#ss-banner');if(b)b.hidden=true;},2600);
  box.querySelectorAll('.ss-stage').forEach((b,i)=>{b.style.setProperty('--d',i);b.classList.add('ss-stamp');});
  // After the celebration the territory can be replayed from Stage 01.
  later(()=>{battles.forEach((_,i)=>setCard(i,i===0?'current':'cleared'));select(0);
   box.querySelector('#ss-go span').textContent='REPLAY · STAGE 01';},2400);}
 box.querySelector('.ss-stage.is-selected')?.focus({preventScroll:true});
}
// Clearing a stage mid-run: a result window, then back to Stage Select where the next
// stage unlocks. Resolves 'next' (GO TO BATTLE) or 'retreat'.
// v148.9 stage complete screen: "Level X / Completed", the three squad portraits with
// their HP (knocked-out operators greyed out), and a STAGE SELECT button.
function squadStatus(run){
 const core=window.RPG_CONQUEST,rules=window.RPG_OPERATOR_PASSIVES?.RULES||{};
 return run.ids.map((id,i)=>{
  const max=core.stats(id,rules[id]?.maxHpBonus||0,run.bonuses||{},run.config).hp;
  const ko=run.knockedOut.includes(i);
  const benched=run.kurone?.bench?.[i];
  const hp=ko?0:i===run.index?Math.max(0,Math.min(max,run.hp??max)):Number.isFinite(benched)?Math.max(0,Math.min(max,benched)):max;
  return {id,i,ko,hp,max,active:i===run.index&&!ko,name:id==='mc'?String(identity.name||'Operator'):String(rules[id]?.name||id.replace(/_/g,' '))};
 });
}
function endScreenHtml(run,level,note=''){
 const core=window.RPG_CONQUEST,total=run.encounters.length,done=run.records.length;
 const ops=squadStatus(run).map(o=>{
  const art=o.id==='mc'?'assets/characters/mc.webp':`assets/deployment/${o.id}.webp`;
  return `<div class="ae-op${o.ko?' is-ko':''}" style="--i:${o.i}"><div class="ae-face"><img src="${esc(media(art))}" alt="" onerror="this.onerror=null;this.src='assets/profile-icons/${esc(o.id)}.webp'">${o.ko?'<i>K.O.</i>':o.active?'<i>ACTIVE</i>':''}<b>${esc(o.name)}</b></div>
   <div class="ae-hp"><span><em data-w="${o.max?Math.round(100*o.hp/o.max):0}"></em></span>${esc(core.displayed(o.hp))}</div></div>`;}).join('');
 return `<div class="ae-end" role="dialog" aria-label="Level ${level} completed">
  <div class="ae-head"><i class="ae-hatch"></i><div class="ae-plate"><small>Level ${level}</small><h2>Completed</h2></div><i class="ae-hatch"></i><div class="ae-rule"></div></div>
  <div class="ae-label">Squad Status</div>
  <div class="ae-squad">${ops}</div>
  ${note?`<p class="ae-note">${note}</p>`:''}
  <div class="ae-progress" aria-label="Stages cleared"><i style="width:${total?100*done/total:0}%"></i></div>
  <button type="button" class="ae-ok" id="ae-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M14 8l-4 4 4 4"/></svg><span>Stage Select</span></button></div>`;
}
function fillHpBars(){setTimeout(()=>box.querySelectorAll('.ae-hp em').forEach(e=>{e.style.width=(e.dataset.w||0)+'%';}),650);}
// Clearing a stage mid-run → the complete screen → Stage Select (next stage unlocks).
// Resolves 'next' (GO TO BATTLE) or 'retreat'.
function showConquestReward(run,step){
 return new Promise(resolve=>{
   const done=run.records.length;
   const finish=v=>{if(conquestOverlayFinish!==cancel)return;conquestOverlayFinish=null;clearStageTimers();hide();resolve(v);};
   const cancel=()=>finish('next');conquestOverlayFinish=cancel;
   show(endScreenHtml(run,done));fillHpBars();
   box.querySelector('#ae-ok').onclick=()=>openStageSelect(String(run.chapter.id),{anim:'unlock',intermission:{run,go:()=>finish('next'),retreat:()=>finish('retreat')}});
   box.querySelector('#ae-ok').focus();
 });
}
function cancelConquestOverlay(){if(conquestOverlayFinish)conquestOverlayFinish();}
function conquestBannerResult(run,done,captured,animate){
 const atlas=window.RPG_CONQUEST_MAP;
 return `<div class="cq-result-banner">${atlas.banner(run.chapter,{total:run.encounters.length,cleared:done,segmented:true,captured,animate})}</div>`;
}
function showConquestResult(run,result){
 return new Promise(resolve=>{
   const total=run.encounters.length;
   const note=[result.saved?'TERRITORY CAPTURED':'UNRANKED · NOT SAVED',result.coins?`+${result.coins} GUILD COINS`:''].filter(Boolean).join(' · ');
   show(endScreenHtml(run,total,esc(note)));fillHpBars();
   const finish=()=>{if(conquestOverlayFinish!==finish)return;conquestOverlayFinish=null;hide();resolve();};conquestOverlayFinish=finish;
   box.querySelector('#ae-ok').onclick=finish;box.querySelector('#ae-ok').focus();
 });
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
window.RPG_STORY={normalizeManifest,openMap,openStageSelect,showSlides,markCompleted,showResult,markConquestCompleted,showConquestReward,showConquestResult,cancelConquestOverlay,loadManifest,getCompleted:()=>[...completed],getBestStars:()=>({...bestStars}),isUnlocked,starsForDamage};
})();
