/* v149 — Recruitment reveal.
 * 1) Shutter wipe in, 2) signal pre-roll tinted by the best rarity in the pull,
 * 3) Arknights-style one-by-one operator reveals (tap / Enter / Space to continue),
 * 4) light Endfield-style lineup of slanted cards (tap a card to replay its reveal).
 * Public API is unchanged: open, openResults, close, configure, setFeatured.
 */
(() => {
 'use strict';
 const tiers = {
  4:{label:'4★ OPERATOR',signal:'STANDARD SIGNAL',color:'#a57bff',deep:'#2a1858',soft:'#ece4ff'},
  5:{label:'5★ OPERATOR',signal:'ENHANCED SIGNAL',color:'#ffc21a',deep:'#5a3c00',soft:'#fff2c4'},
  6:{label:'6★ OPERATOR',signal:'EXCEPTIONAL SIGNAL',color:'#ff6a2a',deep:'#6a1800',soft:'#ffe2d4'}
 };
 // Total length of each rarity's entrance; a tap before this completes the animation instantly.
 const revealMs={4:1050,5:1500,6:2500};
 const demoRarities=[4,4,5,4,4,4,6,4,5,4];
 // Lineup cards use the portrait full-body art (assets/deployment, 480×900). Face centres
 // [x%, y%] were measured by matching each profile-icon portrait against that art, so the
 // crop can always keep the face in view. Characters not listed fall back to [50, 14].
 const FACE={alden:[45.2,10.7],anodyne:[46.7,9.0],aveline:[59.8,10.2],cassian:[59.4,19.9],crossbow:[51.2,10.7],elise:[48.5,12.2],hexaxe:[51.7,10.0],hound:[65.2,33.7],isolde:[50.6,14.3],kade:[49.4,10.0],livia:[44.2,14.7],lupa:[79.2,20.0],mira:[51.7,10.2],nitrate:[40.8,19.7],nora:[48.1,12.4],seraphine:[57.3,9.9],shield:[38.5,12.2],tavi:[52.5,21.3],vern:[39.8,15.9],vex:[56.2,9.7]};
 const faceOf=id=>FACE[id]||[50,14];
 const deployArt=id=>/^[a-z][a-z0-9_]{0,39}$/.test(id)&&id!=='unknown'?`assets/deployment/${id}.webp`:null;
 const safeArt=p=>typeof p==='string'&&/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(p);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pad=n=>String(n).padStart(2,'0');
 let catalog=[],featuredId='tavi',session=null,root=null,priorFocus=null,timers=[],generation=0;

 function configure(data){if(!Array.isArray(data?.characters))return;catalog=data.characters.filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeArt(c.art));if(/^[a-z][a-z0-9_]{0,39}$/.test(data.featured_character_id))featuredId=data.featured_character_id;}
 function setFeatured(id){if(catalog.some(c=>c.id===id&&c.rarity===6))featuredId=id;}
 function previewOperators(rarities){const index={4:0,5:0,6:0};return rarities.map(r=>{const list=catalog.filter(c=>c.rarity===r);if(!list.length)return {id:'unknown',name:'OPERATOR',rarity:r,art:null,duplicate:false,shards:0};if(r===6){const featured=list.find(c=>c.id===featuredId);if(featured)return {...featured,duplicate:false,shards:0};}return {...list[index[r]++%list.length],duplicate:false,shards:0};});}
 function vars(r){const t=tiers[r]||tiers[4];return `--rc:${t.color};--rd:${t.deep};--rs:${t.soft}`;}
 function reducedMotion(){return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 function clearTimers(){timers.forEach(window.clearTimeout);timers=[];generation++;}
 function later(fn,ms){const gen=generation;const id=window.setTimeout(()=>{if(session&&root&&generation===gen)fn();},reducedMotion()?0:ms);timers.push(id);return id;}
 function img(op,cls){return op&&safeArt(op.art)?`<img class="${cls}" src="${esc(op.art)}" alt="" decoding="async" draggable="false">`:`<span class="${cls} rv-noart" aria-hidden="true">◇</span>`;}
 // Full-body art positioned around the face; falls back to the banner art if missing.
 function lineupArt(op){
  const src=deployArt(op.id);
  if(!src)return img(op,'rv-lu-img rv-lu-banner-art');
  const [fx,fy]=faceOf(op.id);
  const fallback=safeArt(op.art)?` data-fallback="${esc(op.art)}"`:'';
  return `<img class="rv-lu-img rv-lu-body" style="--fx:${fx};--fy:${fy}" src="${esc(src)}"${fallback} alt="" decoding="async" draggable="false">`;
 }
 function stars(r){return Array.from({length:r},(_,i)=>`<i style="--s:${i}">★</i>`).join('');}
 function rewardTag(op){
  if(!session.real)return '<span class="rv-tag rv-tag-preview">PREVIEW</span>';
  return op.duplicate?`<span class="rv-tag rv-tag-dup">+${Math.max(0,op.shards|0)} SHARDS</span>`:'<span class="rv-tag rv-tag-new">NEW</span>';
 }

 // ---- Frame ---------------------------------------------------------------
 function render(){
  root.innerHTML=`
   <div class="rv-view" id="rvView"></div>
   <header class="rv-top">
    <div class="rv-brand"><strong>RPG TYPING VERSUS</strong><span>RECRUITMENT // ${esc(session.banner)}${session.real?'':' // PREVIEW'}</span></div>
    <div class="rv-top-actions">
     <button type="button" class="rv-btn rv-btn-ghost" id="rvSkip" data-reveal="skip">SKIP <span aria-hidden="true">▸▸</span></button>
     <button type="button" class="rv-btn rv-btn-ghost rv-close" id="rvClose" data-reveal="close" ${session.lockUntilResults?'disabled title="View all results to finish the tutorial"':''}>× CLOSE</button>
    </div>
   </header>
   <p class="rv-sr" id="rvLive" role="status" aria-live="polite"></p>
   <div class="rv-wipe" aria-hidden="true"><i class="rv-wipe-a"></i><i class="rv-wipe-b"></i><b>RECRUITMENT<small>SIGNAL LINK ESTABLISHED</small></b></div>`;
 }
 function view(){return root?.querySelector('#rvView');}
 function live(text){const el=root?.querySelector('#rvLive');if(el)el.textContent=text;}
 function setStage(name){session.stage=name;if(root)root.dataset.stage=name;const skip=root?.querySelector('#rvSkip');if(skip)skip.hidden=(name==='lineup');const close=root?.querySelector('#rvClose');if(close&&name==='lineup')close.disabled=false;}
 function wipe(kind,label,sub){
  const w=root?.querySelector('.rv-wipe');if(!w||reducedMotion())return;
  w.className=`rv-wipe rv-wipe-${kind}`;w.querySelector('b').innerHTML=`${esc(label)}<small>${esc(sub||'')}</small>`;
  void w.offsetWidth;w.classList.add('is-on');
 }

 // ---- 1+2: wipe in, then signal pre-roll -------------------------------------
 function preload(){
  const urls=[...new Set([...session.operators.map(o=>o.art).filter(safeArt),...session.operators.map(o=>deployArt(o.id)).filter(Boolean)])];
  const loads=urls.map(u=>new Promise(res=>{const i=new Image();i.onload=i.onerror=()=>res();i.src=u;if(i.decode)i.decode().then(res,res);}));
  return Promise.race([Promise.all(loads),new Promise(res=>setTimeout(res,2500))]);
 }
 function intro(){
  clearTimers();setStage('intro');
  const best=Math.max(...session.operators.map(o=>o.rarity));
  view().innerHTML=`
   <section class="rv-intro r${best}" style="${vars(best)}">
    <div class="rv-intro-grid"></div>
    <div class="rv-beacon"><i></i><i></i><i></i><span></span></div>
    <div class="rv-intro-copy"><small>RECRUITMENT SIGNAL</small><strong>RECEIVING ${session.count} OPERATOR${session.count===1?'':'S'}</strong><em>TAP TO BEGIN</em></div>
   </section>`;
  live(`Receiving ${session.count} operator${session.count===1?'':'s'}.`);
  wipe('dark','RECRUITMENT','SIGNAL LINK ESTABLISHED');
  const ready=preload();let minDone=false,loaded=false;
  const go=()=>{if(minDone&&loaded&&session?.stage==='intro')showOperator(0);};
  later(()=>{minDone=true;go();},1500);
  ready.then(()=>{loaded=true;go();});
 }

 // ---- 3: one-by-one reveal -------------------------------------------------------
 function showOperator(i,{replay=false}={}){
  clearTimers();
  const op=session.operators[i];if(!op){lineup();return;}
  session.index=i;session.replay=replay;session.stepDone=false;setStage(replay?'replay':'reveal');
  const r=op.rarity,t=tiers[r]||tiers[4];
  const pips=session.count>1&&!replay?`<div class="rv-pips">${session.operators.map((o,k)=>`<i class="${k<i?'done':''} ${k===i?'now':''} r${o.rarity}"></i>`).join('')}</div>`:'';
  view().innerHTML=`
   <section class="rv-reveal r${r} ${op.duplicate&&session.real?'is-dup':'is-new'}" style="${vars(r)}">
    <div class="rv-bg"><i class="rv-shaft a"></i><i class="rv-shaft b"></i><i class="rv-shaft c"></i><div class="rv-dust"></div><div class="rv-bignum">${pad(i+1)}</div></div>
    ${r===6?`<div class="rv-build"><i></i><i></i><i></i><i></i><span>${t.signal}</span></div>`:''}
    <div class="rv-flash"></div>
    <div class="rv-art">${img(op,'rv-sil')}${img(op,'rv-img')}</div>
    <div class="rv-info">
     <div class="rv-rarity">${t.label}</div>
     <div class="rv-stars" aria-label="${r} stars">${stars(r)}</div>
     <h2 class="rv-name">${esc(op.name)}</h2>
     <div class="rv-reward">${rewardTag(op)}</div>
    </div>
    <div class="rv-count">${pad(i+1)}<small>/ ${pad(session.count)}</small></div>
    <div class="rv-hint">${replay?'TAP TO RETURN':'TAP TO CONTINUE'} <span aria-hidden="true">▸</span></div>
    ${pips}
   </section>`;
  live(`${op.name}, ${r} stars${session.real?(op.duplicate?`, duplicate, +${op.shards} shards`:', new recruit'):''}.`);
  later(()=>{session.stepDone=true;view()?.querySelector('.rv-reveal')?.classList.add('is-done');},revealMs[r]||1000);
 }
 function advance(){
  if(!session)return;
  if(session.stage==='intro'){showOperator(0);return;}
  if(session.stage!=='reveal'&&session.stage!=='replay')return;
  const el=view()?.querySelector('.rv-reveal');
  if(!session.stepDone){session.stepDone=true;el?.classList.add('is-instant','is-done');return;}
  if(session.stage==='replay'){lineup({fromReplay:true});return;}
  if(session.index<session.count-1)showOperator(session.index+1);else lineup();
 }

 // ---- 4: Endfield-style lineup -----------------------------------------------------
 function summary(){
  const c={4:0,5:0,6:0};let fresh=0;for(const o of session.operators){c[o.rarity]++;if(!o.duplicate)fresh++;}
  return [6,5,4].filter(r=>c[r]).map(r=>`<span class="r${r}" style="${vars(r)}">★${r} ×${c[r]}</span>`).join('')+(session.real?`<span class="rv-sum-new">NEW ×${fresh}</span>`:'');
 }
 function lineup({fromReplay=false}={}){
  if(!session||!root)return;
  clearTimers();setStage('lineup');
  const n=session.count;
  view().innerHTML=`
   <section class="rv-lineup ${n===1?'is-single':'is-multi'} ${fromReplay?'from-replay':''}">
    <header class="rv-lu-head">
     <div class="rv-lu-code">RTV-RCT // RESULT REPORT // ${pad(n)}</div>
     <h2>${n===1?'RECRUIT RESULT':'SCOUTING RESULTS'}</h2>
     <div class="rv-lu-meta"><span class="rv-lu-banner">${esc(session.banner)}</span><span class="rv-lu-saved">${session.real?'SAVED TO YOUR COLLECTION':'PREVIEW ONLY · NO REWARDS'}</span></div>
     <div class="rv-lu-sum">${summary()}</div>
    </header>
    <div class="rv-lu-row" style="--n:${n}">
     ${session.operators.map((op,i)=>`
      <button type="button" class="rv-lu-card r${op.rarity} ${op.duplicate&&session.real?'is-dup':'is-new'}" style="${vars(op.rarity)};--i:${i}" data-reveal="view" data-index="${i}" aria-label="${esc(op.name)}, ${op.rarity} stars${session.real?(op.duplicate?`, +${op.shards} shards`:', new'):''}. Replay reveal.">
       <span class="rv-lu-skew">
        <span class="rv-lu-art">${lineupArt(op)}</span>
        <span class="rv-lu-top"></span>
        <span class="rv-lu-info"><span class="rv-lu-no">${pad(i+1)}</span><span class="rv-lu-stars">${'★'.repeat(op.rarity)}</span><b>${esc(op.name)}</b>${rewardTag(op)}</span>
       </span>
      </button>`).join('')}
    </div>
    <footer class="rv-lu-foot">
     <span class="rv-lu-tip">TAP AN OPERATOR TO REPLAY THEIR REVEAL</span>
     <button type="button" class="rv-btn rv-btn-solid" data-reveal="close">BACK TO RECRUITMENT <span aria-hidden="true">▸</span></button>
    </footer>
   </section>`;
  view().querySelectorAll('img.rv-lu-body[data-fallback]').forEach(el=>el.addEventListener('error',()=>{el.src=el.dataset.fallback;el.classList.replace('rv-lu-body','rv-lu-banner-art');},{once:true}));
  live(`Results: ${session.operators.map(o=>`${o.name} ${o.rarity} stars`).join(', ')}.`);
  if(!fromReplay)wipe('light','SCOUTING REPORT','RESULTS COMPILED');
  root.querySelector('.rv-lu-foot [data-reveal="close"]')?.focus({preventScroll:true});
 }

 // ---- Input ------------------------------------------------------------------------
 function keyboard(e){
  if(!root||!session)return;
  if(e.key==='Escape'){e.preventDefault();if(session.stage==='lineup')close();else if(session.stage==='replay')lineup({fromReplay:true});else lineup();return;}
  if((e.key==='Enter'||e.key===' '||e.key==='ArrowRight')&&['intro','reveal','replay'].includes(session.stage)){
   if(document.activeElement?.closest?.('.rv-top'))return; // let the focused header button act
   e.preventDefault();advance();return;
  }
  if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not([disabled]):not([hidden])')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }
 function bind(){
  root.addEventListener('click',e=>{
   const el=e.target.closest('[data-reveal]');
   if(el){if(el.disabled)return;const a=el.dataset.reveal;
    if(a==='skip')lineup();else if(a==='close')close();
    else if(a==='view')showOperator(Number(el.dataset.index)||0,{replay:true});
    return;}
   if(e.target.closest('.rv-intro,.rv-reveal'))advance();
  });
  document.addEventListener('keydown',keyboard);
 }

 // ---- Lifecycle -----------------------------------------------------------------------
 function start(operators,banner,real,options={}){
  close(true);priorFocus=document.activeElement;
  session={count:operators.length,banner:String(banner||'FEATURED').slice(0,60),operators,real,stage:'intro',index:0,stepDone:false,replay:false,lockUntilResults:!!options.lockUntilResults,onComplete:typeof options.onComplete==='function'?options.onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay rv';
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',real?'Recruitment results':'Recruitment visual preview');
  document.body.appendChild(root);document.documentElement.classList.add('rv-open');
  render();bind();intro();
  // Focus the stage, not SKIP: Enter / Space should advance the reveal, not skip it.
  root.tabIndex=-1;root.focus({preventScroll:true});
 }
 function open(count=1,banner='FEATURED'){const rarities=count===10?demoRarities:[5];start(previewOperators(rarities),banner,false);}
 function openResults(rows,banner='FEATURED',options={}){
  if(!Array.isArray(rows)||![1,10].includes(rows.length))throw Error('Expected one or ten recruitment results.');
  const ops=rows.map(item=>{
   if(![4,5,6].includes(item.rarity)||typeof item.id!=='string'||!/^[a-z][a-z0-9_]{0,39}$/.test(item.id))throw Error('Invalid saved recruitment result.');
   const meta=catalog.find(c=>c.id===item.id&&c.rarity===item.rarity);
   return {id:item.id,rarity:item.rarity,name:meta?.name||item.id.replace(/_/g,' ').toUpperCase(),art:meta?.art||null,duplicate:!!item.duplicate,shards:Number(item.shards)||0};
  });
  start(ops,banner,true,options);
 }
 // Closing plays a short exit wipe over the page; force=true removes immediately.
 function close(force=false){
  if(!session)return;
  if(session.lockUntilResults&&!force&&session.stage!=='lineup'){lineup();return;}
  const callback=session.real&&session.stage==='lineup'&&!force?session.onComplete:null;
  clearTimers();document.removeEventListener('keydown',keyboard);
  const old=root;root=null;session=null;document.documentElement.classList.remove('rv-open');
  if(old){
   if(force||reducedMotion())old.remove();
   else{old.classList.add('is-leaving');old.inert=true;setTimeout(()=>old.remove(),520);}
  }
  priorFocus?.focus?.({preventScroll:true});priorFocus=null;callback?.();
 }
 window.RPG_RECRUITMENT_REVEAL={open,openResults,close,configure,setFeatured};
})();
