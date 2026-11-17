/* v86.13: Endfield-inspired scouting results flow with tall panel results. */
(() => {
 'use strict';
 const tiers={
 4:{label:'4-STAR',color:'#b896ff',glow:'#6b48b9',panel:'linear-gradient(180deg,#302642 0%,#1a1623 38%,#0f1016 100%)',reward:'#d2beff'},
 5:{label:'5-STAR',color:'#ffe36f',glow:'#b88f1a',panel:'linear-gradient(180deg,#4b3910 0%,#241f14 38%,#101116 100%)',reward:'#ffeaa8'},
 6:{label:'6-STAR',color:'#ff8d64',glow:'#d34646',panel:'linear-gradient(180deg,#64301e 0%,#28161a 40%,#101116 100%)',reward:'#ffd2c4'}
 };
 const exampleRarities=[4,4,5,4,4,4,6,4,5,4];
 const $=id=>document.getElementById(id);
 let root=null,timer=0,session=null,priorFocus=null,frameVersion=0,catalog=[],featuredId='tavi';
 const safeArt=p=>typeof p==='string'&&/^assets\/[a-z0-9_\/-]+\.(webp|png|jpg|jpeg)$/i.test(p);
 function configure(data){if(!Array.isArray(data?.characters))return;catalog=data.characters.filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeArt(c.art));if(/^[a-z][a-z0-9_]{0,39}$/.test(data.featured_character_id))featuredId=data.featured_character_id;}
 function setFeatured(id){if(catalog.some(c=>c.id===id&&c.rarity===6))featuredId=id;}
 function previewOperators(rarities){const idx={4:0,5:0,6:0};return rarities.map(r=>{const available=catalog.filter(c=>c.rarity===r);if(!available.length)return null;if(r===6){const chosen=available.find(c=>c.id===featuredId);if(chosen)return chosen;}return available[idx[r]++%available.length];});}
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function themeVars(stars){const t=tiers[stars]||tiers[4];return `--rarity-accent:${t.color};--rarity-glow:${t.glow};--panel-bg:${t.panel};--reward-color:${t.reward};`;}
 function shell(inner,mainButton='',secondaryButton='',frameClass=''){
  root.innerHTML=`<div class="reveal-frame ${frameClass}" style="${themeVars(session?.rarities?.[session.index]||4)}">
    <header class="reveal-top"><div><strong>RPG TYPING VERSUS</strong><div class="reveal-meta">SCOUTING // ${esc(session.banner)} // ${session.real?'NEW RECRUITS':'VISUAL PREVIEW'}</div></div><button class="reveal-exit" data-reveal="close" aria-label="Close reveal" ${session.lockUntilResults&&session.stage!=='results'?'disabled title="View all results first"':''}>× CLOSE</button></header>
    <main class="reveal-main" id="revealContent" aria-live="polite">${inner}</main>
    <div class="reveal-demo-stamp">${session.real?'SAVED TO YOUR COLLECTION':'NO CURRENCY SPENT · NO CHARACTERS AWARDED'}</div>
    <footer class="reveal-footer">${secondaryButton?`<button class="reveal-secondary" data-reveal="${secondaryButton[0]}">${secondaryButton[1]}</button>`:''}${mainButton?`<button class="reveal-primary" data-reveal="${mainButton[0]}">${mainButton[1]}</button>`:''}</footer>
   </div>`;
  const btn=root.querySelector('.reveal-primary')||root.querySelector('.reveal-exit');btn?.focus({preventScroll:true});
 }
 function open(count=1,banner='FEATURED'){
  close(true);const n=count===10?10:1;priorFocus=document.activeElement;
  const rarities=n===10?exampleRarities:[5];session={count:n,banner:String(banner||'FEATURED').slice(0,60),index:0,rarities,operators:previewOperators(rarities),stage:'stars',real:false,lockUntilResults:false,onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Recruitment visual preview');document.body.appendChild(root);
  bind(); stars();
 }
 function openResults(rows,banner='FEATURED',options={}){
  if(!Array.isArray(rows)||![1,10].includes(rows.length))throw Error('Expected one or ten recruitment results.');
  close(true);priorFocus=document.activeElement;
  const operators=rows.map((item,i)=>{const meta=catalog.find(c=>c.id===item.id);if(![4,5,6].includes(item.rarity)||typeof item.id!=='string'||!/^[a-z][a-z0-9_]{0,39}$/.test(item.id))throw Error('Invalid saved recruitment result.');const display=meta&&meta.rarity===item.rarity?meta:{id:item.id,name:item.id.replace(/_/g,' ').toUpperCase(),art:null,rarity:item.rarity};return {...display,duplicate:!!item.duplicate,shards:Number(item.shards)||0,index:i};});
  session={count:rows.length,banner:String(banner||'FEATURED').slice(0,60),index:0,rarities:rows.map(x=>x.rarity),operators,stage:'stars',real:true,lockUntilResults:!!options.lockUntilResults,onComplete:typeof options.onComplete==='function'?options.onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Recruitment results');document.body.appendChild(root);
  bind(); stars();
 }
 function bind(){
  root.addEventListener('click',event=>{const el=event.target.closest('[data-reveal]');if(!el||el.disabled)return;const action=el.dataset.reveal;if(action==='close')close();else if(action==='next')next();else if(action==='results')results();else if(action==='character')character();});
  document.addEventListener('keydown',keyboard);
 }
 function keyboard(e){if(!root)return;if(e.key==='Escape'){e.preventDefault();if(!(session?.lockUntilResults&&session?.stage!=='results'))close();}else if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not([disabled])')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 function stars(){if(!session)return;session.stage='stars';const id=++frameVersion;const rarity=session.rarities[session.index];const t=tiers[rarity],stars=Array.from({length:rarity},(_,i)=>`<span class="reveal-star" style="--i:${i}" aria-hidden="true">★</span>`).join('');
  shell(`<div class="reveal-stars-shell"><p class="reveal-kicker">RARITY CONFIRMED</p><div class="reveal-stars" role="img" aria-label="${rarity} stars">${stars}</div><h1 class="reveal-tier">${t.label}</h1><p class="reveal-message">OPERATOR SIGNAL DETECTED</p><p class="reveal-number">${session.index+1} / ${session.count}</p></div>`,['character','REVEAL CHARACTER'],session.count===10?['results','SHOW ALL RESULTS']:null,'reveal-stage-stars');
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;timer=window.setTimeout(()=>{if(session&&frameVersion===id&&session.stage==='stars')character()},reduced?650:1200);
 }
 function buildFigure(operator, cls=''){return operator&&safeArt(operator.art)?`<img class="${cls}" src="${esc(operator.art)}" alt="${esc(operator.name)}">`:`<div class="panel-placeholder ${cls}"><span>◇</span></div>`;}
 function buildReward(operator){if(!session.real)return '<span class="panel-badge panel-badge-preview">PREVIEW</span>';
  if(operator.duplicate)return `<span class="panel-reward-value">+${operator.shards}</span><span class="panel-reward-label">SHARDS</span>`;
  return `<span class="panel-badge panel-badge-new">NEW</span><span class="panel-reward-label">NEW RECRUIT</span>`;
 }
 function buildPanel(operator, index, opts={}){
  const rarity=operator?.rarity||session.rarities[index]||4; const theme=tiers[rarity]||tiers[4];
  const badge=session.real?(operator.duplicate?'' : '<span class="panel-new-flag">NEW</span>'):'<span class="panel-preview-flag">PREVIEW</span>';
  const name=esc(operator?.name||`OPERATOR ${String(index+1).padStart(2,'0')}`);
  return `<article class="panel-recruit-card ${opts.hero?'hero':''}" style="${themeVars(rarity)}">
    <div class="panel-slice-bg"></div>
    <div class="panel-grid-overlay"></div>
    <div class="panel-rarity-label">${'★'.repeat(rarity)}</div>
    ${badge}
    <div class="panel-portrait-stage">${buildFigure(operator,'panel-portrait')}</div>
    <div class="panel-floor-glow"></div>
    <div class="panel-silhouette-stage">${buildFigure(operator,'panel-silhouette')}</div>
    <div class="panel-bottom-ui">
      <div class="panel-name-block"><strong>${name}</strong><small>${theme.label}</small></div>
      <div class="panel-reward-block">${buildReward(operator)}</div>
    </div>
  </article>`;
 }
 function character(){if(!session)return;clearTimeout(timer);frameVersion++;session.stage='character';
  const rarity=session.rarities[session.index]; const operator=session.operators[session.index]; const tier=tiers[rarity];
  const copy=session.real?(operator.duplicate?`DUPLICATE · +${operator.shards} CHARACTER SHARDS`:'NEW CHARACTER UNLOCKED'):'Demonstration preview only. No real rewards are being granted.';
  const panel=buildPanel(operator,session.index,{hero:true});
  shell(`<section class="panel-character-flow"><div class="panel-character-hero">${panel}</div><div class="panel-character-copy"><p class="reveal-kicker">OPERATOR REVEALED · ${session.index+1} / ${session.count}</p><h2>${esc(operator?.name||`OPERATOR ${String(session.index+1).padStart(2,'0')}`)}</h2><div class="panel-copy-tier">${tier.label}</div><p>${copy}</p></div></section>`,session.index===session.count-1?['results',session.count===1?'VIEW RESULT':'VIEW RESULTS']:['next','NEXT OPERATOR'],session.count===10?['results','SHOW ALL RESULTS']:null,'reveal-stage-character');
 }
 function next(){if(!session)return;clearTimeout(timer);if(session.index<session.count-1){session.index++;stars();}else results();}
 function results(){if(!session)return;clearTimeout(timer);frameVersion++;session.stage='results';
  const cards=session.operators.map((operator,i)=>buildPanel(operator,i)).join('');
  const inner=session.count===10
   ? `<section class="panel-results-shell ten"><div class="panel-results-head"><p class="reveal-kicker">RECRUITMENT COMPLETE</p><h1>SCOUTING RESULTS</h1><p>${session.real?'New operators are marked NEW. Duplicates grant shards.':'Visual preview of a ten-pull result layout.'}</p></div><div class="panel-results-strip ten">${cards}</div></section>`
   : `<section class="panel-results-shell single"><div class="panel-results-head"><p class="reveal-kicker">RECRUITMENT COMPLETE</p><h1>SINGLE RECRUIT RESULT</h1><p>${session.real?'A single operator has joined your roster.':'Visual preview of a single-pull result layout.'}</p></div><div class="panel-results-strip single">${cards}</div></section>`;
  shell(inner,['close','BACK TO RECRUITMENT'],'','reveal-stage-results');
 }
 function close(force=false){if(session?.lockUntilResults&&!force&&session.stage!=='results')return;const callback=session?.real&&session.stage==='results'?session.onComplete:null;clearTimeout(timer);frameVersion++;document.removeEventListener('keydown',keyboard);if(root){root.remove();root=null;}session=null;priorFocus?.focus?.({preventScroll:true});priorFocus=null;callback?.();}
 window.RPG_RECRUITMENT_REVEAL={open,openResults,close,configure,setFeatured};
})();
