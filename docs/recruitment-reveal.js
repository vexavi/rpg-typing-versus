/* v86.15 — one full-width scan per rarity, persistent silhouettes. Real results saved before openResults. */
(() => {
 'use strict';
 const tiers = {
  4:{label:'4-STAR',color:'#b896ff',glow:'#6b48b9',panel:'linear-gradient(180deg,#302642,#1a1623 40%,#101116)',reward:'#d2beff'},
  5:{label:'5-STAR',color:'#ffe36f',glow:'#b88f1a',panel:'linear-gradient(180deg,#4b3910,#241f14 40%,#101116)',reward:'#ffeaa8'},
  6:{label:'6-STAR',color:'#ff8d64',glow:'#d34646',panel:'linear-gradient(180deg,#64301e,#28161a 40%,#101116)',reward:'#ffd2c4'}
 };
 const demoRarities=[4,4,5,4,4,4,6,4,5,4];
 const safeArt=p=>typeof p==='string'&&/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(p);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let catalog=[],featuredId='tavi',session=null,root=null,priorFocus=null,timers=[],generation=0;
 function configure(data){if(!Array.isArray(data?.characters))return;catalog=data.characters.filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeArt(c.art));if(/^[a-z][a-z0-9_]{0,39}$/.test(data.featured_character_id))featuredId=data.featured_character_id;}
 function setFeatured(id){if(catalog.some(c=>c.id===id&&c.rarity===6))featuredId=id;}
 function previewOperators(rarities){const index={4:0,5:0,6:0};return rarities.map(r=>{const list=catalog.filter(c=>c.rarity===r);if(!list.length)return {id:'unknown',name:'OPERATOR',rarity:r,art:null,duplicate:false,shards:0};if(r===6){const featured=list.find(c=>c.id===featuredId);if(featured)return {...featured,duplicate:false,shards:0};}return {...list[index[r]++%list.length],duplicate:false,shards:0};});}
 function theme(stars){const t=tiers[stars]||tiers[4];return `--rarity-accent:${t.color};--rarity-glow:${t.glow};--panel-bg:${t.panel};--reward-color:${t.reward}`;}
 function reducedMotion(){return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 function clearTimers(){timers.forEach(window.clearTimeout);timers=[];generation++;}
 function later(fn,ms,gen){const id=window.setTimeout(()=>{if(session&&root&&generation===gen)fn();},ms);timers.push(id);}
 function figure(operator,className){return operator&&safeArt(operator.art)?`<img class="${className}" src="${esc(operator.art)}" alt="" loading="eager">`:`<div class="panel-placeholder ${className}" aria-hidden="true"><span>◇</span></div>`;}
 function reward(operator){if(!session.real)return '<span class="panel-badge panel-badge-preview">PREVIEW</span>';
  if(operator.duplicate)return `<span class="panel-reward-value">+${Math.max(0,operator.shards|0)}</span><span class="panel-reward-label">SHARDS</span>`;
  return '<span class="panel-badge panel-badge-new">NEW</span><span class="panel-reward-label">NEW RECRUIT</span>';
 }
 function panel(operator,index){const rarity=operator.rarity,tag=rarity===6?'scout-six':'';
  return `<article class="panel-recruit-card scout-card ${tag}" data-slot="${index}" data-state="hidden" style="${theme(rarity)}" aria-label="Recruitment slot ${index+1}: concealed">
    <div class="panel-slice-bg"></div><div class="panel-grid-overlay"></div>
    <div class="panel-rarity-label">${'★'.repeat(rarity)}</div>
    <div class="panel-portrait-stage">${figure(operator,'panel-portrait')}</div>
    <div class="panel-floor-glow"></div>
    <div class="panel-silhouette-stage">${figure(operator,'panel-silhouette')}</div>
    <div class="scout-card-scan"></div>
    <div class="panel-bottom-ui">
      <div class="panel-name-block"><strong>${esc(operator.name)}</strong><small>${tiers[rarity].label}</small></div>
      <div class="panel-reward-block">${reward(operator)}</div>
    </div>
   </article>`;
 }
 function render(){
  const n=session.count;
  root.innerHTML=`<div class="reveal-frame scout-frame ${n===1?'scout-single':''}" style="${theme(4)}">
   <header class="reveal-top"><div><strong>RPG TYPING VERSUS</strong><div class="reveal-meta">SCOUTING // ${esc(session.banner)} // ${session.real?'RECRUITMENT':'VISUAL PREVIEW'}</div></div><button type="button" class="reveal-exit" data-reveal="close" ${session.lockUntilResults?'disabled title="View results to finish tutorial"':''}>× CLOSE</button></header>
   <main class="reveal-main scout-main" id="revealContent">
    <div class="scout-heading"><p id="scoutEyebrow">RECRUITMENT SIGNAL</p><h1 id="scoutHeadline">INCOMING OPERATORS</h1><div id="scoutStatus" role="status" aria-live="polite">Establishing signal…</div></div>
    <div class="scout-showcase ${n===1?'scout-showcase-single':'scout-showcase-ten'}" id="scoutShowcase" data-phase="intro" style="--slot-count:${n}">
     <div class="scout-scan-beam" id="scoutBeam" aria-hidden="true"></div>
     ${session.operators.map(panel).join('')}
     <div class="scout-rare-flare" aria-hidden="true"></div>
    </div>
   </main>
   <div class="reveal-demo-stamp">${session.real?'SAVED TO YOUR COLLECTION':'PREVIEW ONLY · NO CURRENCY SPENT'}</div>
   <footer class="reveal-footer"><button type="button" class="reveal-primary" id="scoutAction" data-reveal="skip">SKIP REVEAL</button></footer>
  </div>`;
  root.querySelector('#scoutAction')?.focus({preventScroll:true});
 }
 function setWords(eyebrow,headline,status){if(!root)return;const a=root.querySelector('#scoutEyebrow'),b=root.querySelector('#scoutHeadline'),c=root.querySelector('#scoutStatus');if(a)a.textContent=eyebrow;if(b)b.textContent=headline;if(c)c.textContent=status;}
 function card(i){return root?.querySelector(`.scout-card[data-slot="${i}"]`);}
 function phase(name){const box=root?.querySelector('#scoutShowcase');if(box)box.dataset.phase=name;session.stage=name;}
 function reveal(i){const el=card(i);if(!el)return;el.dataset.state='revealed';el.setAttribute('aria-label',`Recruitment slot ${i+1}: ${session.operators[i].name}, ${session.operators[i].rarity} stars`);el.classList.remove('is-scanning');}
 function trace(i){const beam=root?.querySelector('#scoutBeam');if(!beam)return;beam.classList.remove('is-sweeping');beam.style.removeProperty('--sweep-ms');beam.style.removeProperty('--beam-color');beam.style.left=`${((i+.5)/session.count)*100}%`;beam.classList.add('active');}
/** One continuous screen-wide pass for each rarity. The beam does not hop between slots. */
 function sweep(rarity,duration){
  const stage=root?.querySelector('#scoutShowcase');
  const beam=root?.querySelector('#scoutBeam');
  if(!stage||!beam)return;
  phase('scanning');stage.dataset.scanRarity=String(rarity);
  beam.classList.remove('active','is-sweeping');
  beam.style.setProperty('--sweep-ms',`${duration}ms`);
  beam.style.setProperty('--beam-color',tiers[rarity].color);
  // Force a fresh CSS animation so consecutive rarity passes each cross the whole strip once.
  void beam.offsetWidth;
  beam.classList.add('active','is-sweeping');
  const label=rarity===6?'FINAL SCAN':rarity===5?'SECOND SCAN':'FIRST SCAN';
  setWords(label,`${rarity}★ RECRUITMENT`,rarity===6?'Rare signals detected — revealing last':`Identifying ${rarity}★ operators`);
 }
 function revealInPass(i,rarity){
  const el=card(i);if(!el)return;
  el.classList.add('is-scanning');
  if(rarity===5)el.classList.add('scout-gold-pulse');
  if(rarity===6)el.classList.add('scout-rare-burst');
  reveal(i);
  // Remain in original result slots; the silhouette remains visible underneath the portrait.
  if(rarity===6)setWords('FINAL SCAN', '6★ OPERATOR CONFIRMED',session.operators[i].name.toUpperCase());
 }
 function animate(){
  clearTimers();const gen=generation;
  const fast=reducedMotion(),speed=v=>fast?Math.max(45,Math.round(v*.12)):v;
  let time=0;
  const at=(delay,fn)=>{time+=speed(delay);later(fn,time,gen);};
  const fourStar=session.operators.map((op,i)=>op.rarity===4?i:-1).filter(i=>i>=0);
  const fiveStar=session.operators.map((op,i)=>op.rarity===5?i:-1).filter(i=>i>=0);
  const sixStar=session.operators.map((op,i)=>op.rarity===6?i:-1).filter(i=>i>=0);
  phase('intro');setWords('RECRUITMENT SIGNAL','INCOMING OPERATORS',`Receiving ${session.count} ${session.count===1?'operator':'operators'}…`);
  at(500,()=>{phase('silhouettes');setWords('SIGNAL LOCKED','IDENTITIES CONCEALED',`${session.count} signal${session.count===1?'':'s'} acquired`);});
  at(650,()=>{phase('scanning');setWords('IDENTIFYING OPERATORS','SCANNING…','Standard 4★ signals first');});

  // 4★ — quick purple scan and immediate reveal.
  for(const i of fourStar){
   at(110,()=>{trace(i);const el=card(i);if(el)el.classList.add('is-scanning');});
   at(220,()=>{reveal(i);setWords('4★ SIGNAL','STANDARD RECRUIT IDENTIFIED',`${fourStar.indexOf(i)+1} / ${fourStar.length} standard signal${fourStar.length===1?'':'s'}`);});
  }

  // 5★ — cinematic gold reveal after all 4★ cards, but always before any 6★.
  if(fiveStar.length){
   at(280,()=>{phase('five-wait');root.querySelector('#scoutBeam')?.classList.remove('active');setWords('ENHANCED SIGNAL','5★ IDENTIFICATION PENDING',`${fiveStar.length} advanced ${fiveStar.length===1?'signal remains':'signals remain'}`);});
   fiveStar.forEach((i,number)=>{
    at(260,()=>{phase('five-focus');const el=card(i),box=root.querySelector('#scoutShowcase');box?.querySelectorAll('.scout-card').forEach(c=>c.classList.toggle('scout-focus',c===el));setWords('ENHANCED SIGNAL','GOLD WAVE RISING…',`Priority reveal ${number+1} / ${fiveStar.length}`);});
    at(280,()=>{card(i)?.classList.add('scout-gold-pulse');});
    at(420,()=>{reveal(i);setWords('5★ OPERATOR','RECRUIT CONFIRMED',session.operators[i].name.toUpperCase());});
    at(340,()=>{card(i)?.classList.remove('scout-gold-pulse');});
   });
  }

  // 6★ — hidden until the end, then full cinematic reveal.
  if(sixStar.length){
   at(320,()=>{phase('rare-wait');root.querySelector('#scoutBeam')?.classList.remove('active');setWords('UNKNOWN SIGNAL','IDENTIFICATION PENDING',`${sixStar.length} exceptional ${sixStar.length===1?'signal remains':'signals remain'}`);});
   sixStar.forEach((i,number)=>{
    at(300,()=>{phase('rare-focus');const el=card(i),box=root.querySelector('#scoutShowcase');box?.querySelectorAll('.scout-card').forEach(c=>c.classList.toggle('scout-focus',c===el));setWords('EXCEPTIONAL SIGNAL', 'SIGNAL STRENGTH RISING…',`Final reveal ${number+1} / ${sixStar.length}`);});
    at(650,()=>{const el=card(i);el?.classList.add('scout-rare-burst');reveal(i);setWords('6★ OPERATOR','RECRUIT CONFIRMED',session.operators[i].name.toUpperCase());});
    at(800,()=>{card(i)?.classList.remove('scout-rare-burst');});
   });
  }
  at(350,()=>results());
 }
 function results(){if(!session||!root)return;clearTimers();phase('results');root.querySelector('#scoutBeam')?.classList.remove('active','is-sweeping');root.querySelector('#scoutShowcase')?.removeAttribute('data-scan-rarity');root.querySelectorAll('.scout-card').forEach(c=>{c.classList.remove('scout-focus','scout-rare-burst','scout-gold-pulse','is-scanning');});session.operators.forEach((_,i)=>reveal(i));
  setWords('RECRUITMENT COMPLETE',session.count===1?'SINGLE RECRUIT RESULT':'SCOUTING RESULTS',session.real?'All rewards saved':'Preview — no rewards awarded');
  const button=root.querySelector('#scoutAction');if(button){button.dataset.reveal='close';button.textContent='BACK TO RECRUITMENT';button.focus({preventScroll:true});}
  const exit=root.querySelector('.reveal-exit');if(exit)exit.disabled=false;
 }
 function keyboard(e){if(!root)return;
  if(e.key==='Escape'){e.preventDefault();if(session.lockUntilResults&&session.stage!=='results')results();else close();}
  else if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not([disabled])')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 }
 function bind(){root.addEventListener('click',e=>{const el=e.target.closest('[data-reveal]');if(!el||el.disabled)return;if(el.dataset.reveal==='skip')results();else if(el.dataset.reveal==='close')close();});document.addEventListener('keydown',keyboard);}
 function start(operators,banner,real,options={}){
  close(true);priorFocus=document.activeElement;
  session={count:operators.length,banner:String(banner||'FEATURED').slice(0,60),operators,real,stage:'intro',lockUntilResults:!!options.lockUntilResults,onComplete:typeof options.onComplete==='function'?options.onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',real?'Recruitment results':'Recruitment visual preview');document.body.appendChild(root);
  render();bind();animate();
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
 function close(force=false){if(!session)return;if(session.lockUntilResults&&!force&&session.stage!=='results'){results();return;}
  const callback=session.real&&session.stage==='results'&&!force?session.onComplete:null;
  clearTimers();document.removeEventListener('keydown',keyboard);root?.remove();root=null;session=null;priorFocus?.focus?.({preventScroll:true});priorFocus=null;callback?.();
 }
 window.RPG_RECRUITMENT_REVEAL={open,openResults,close,configure,setFeatured};
})();
