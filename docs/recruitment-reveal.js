/* v83: star-first reveal presentation. The caller must save real pulls to Firebase BEFORE calling openResults. */
(() => {
 'use strict';
 const tiers={4:{label:'4-STAR',color:'#c5a6ff',glow:'#714baa'},5:{label:'5-STAR',color:'#ffdf84',glow:'#986b22'},6:{label:'6-STAR',color:'#ff9c88',glow:'#b83d51'}};
 // Deterministic preview examples only; no drop rates or actual character roster are implied.
 const exampleRarities=[4,4,5,4,4,4,6,4,5,4];
 const $=id=>document.getElementById(id);
 let root=null,timer=0,session=null,priorFocus=null,frameVersion=0,catalog=[],featuredId='tavi';
 const safeArt=p=>typeof p==='string'&&/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(p);
 function configure(data){if(!Array.isArray(data?.characters))return;catalog=data.characters.filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeArt(c.art));if(/^[a-z][a-z0-9_]{0,39}$/.test(data.featured_character_id))featuredId=data.featured_character_id;}
 function setFeatured(id){if(catalog.some(c=>c.id===id&&c.rarity===6))featuredId=id;}
 function previewOperators(rarities){const idx={4:0,5:0,6:0};return rarities.map(r=>{const available=catalog.filter(c=>c.rarity===r);if(!available.length)return null;if(r===6){const chosen=available.find(c=>c.id===featuredId);if(chosen)return chosen;}return available[idx[r]++%available.length];});}

 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 function colors(stars){const t=tiers[stars]||tiers[4];return `--rarity-accent:${t.color};--rarity-glow:${t.glow}8c;`;}
 function shell(inner,mainButton='',secondaryButton=''){
  root.innerHTML=`<div class="reveal-frame" style="${colors(session?.rarities?.[session.index]||4)}">
    <header class="reveal-top"><div><strong>RPG TYPING VERSUS</strong><div class="reveal-meta">SCOUTING // ${esc(session.banner)} // ${session.real?"NEW RECRUITS":"VISUAL PREVIEW"}</div></div><button class="reveal-exit" data-reveal="close" aria-label="Close reveal" ${session.lockUntilResults&&session.stage!=="results"?"disabled title=\"View all results first\"":""}>× CLOSE</button></header>
    <main class="reveal-main" id="revealContent" aria-live="polite">${inner}</main>
    <div class="reveal-demo-stamp">${session.real?"SAVED TO YOUR COLLECTION":"NO CURRENCY SPENT · NO CHARACTERS AWARDED"}</div>
    <footer class="reveal-footer">${secondaryButton?`<button class="reveal-secondary" data-reveal="${secondaryButton[0]}">${secondaryButton[1]}</button>`:''}${mainButton?`<button class="reveal-primary" data-reveal="${mainButton[0]}">${mainButton[1]}</button>`:''}</footer>
   </div>`;
  const btn=root.querySelector('.reveal-primary')||root.querySelector('.reveal-exit');btn?.focus({preventScroll:true});
 }
 function open(count=1,banner='FEATURED'){
  close(true);const n=count===10?10:1;priorFocus=document.activeElement;
  const rarities=n===10?exampleRarities:[5];session={count:n,banner:String(banner||'FEATURED').slice(0,60),index:0,rarities,operators:previewOperators(rarities),stage:'stars',real:false,lockUntilResults:false,onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Recruitment visual preview');document.body.appendChild(root);
  root.addEventListener('click',event=>{const el=event.target.closest('[data-reveal]');if(!el)return;const action=el.dataset.reveal;if(action==='close')close();else if(action==='next')next();else if(action==='results')results();else if(action==='character')character();});
  document.addEventListener('keydown',keyboard);stars();
 }
 function openResults(rows,banner='FEATURED',options={}){
  if(!Array.isArray(rows)||![1,10].includes(rows.length))throw Error('Expected one or ten recruitment results.');
  close(true);priorFocus=document.activeElement;
  const operators=rows.map(item=>{
   const meta=catalog.find(c=>c.id===item.id);
   if(!meta||meta.rarity!==item.rarity)throw Error('Unknown recruited character.');
   return {...meta,duplicate:!!item.duplicate,shards:Number(item.shards)||0};
  });
  session={count:rows.length,banner:String(banner||'FEATURED').slice(0,60),index:0,
   rarities:rows.map(x=>x.rarity),operators,stage:'stars',real:true,
   lockUntilResults:!!options.lockUntilResults,onComplete:typeof options.onComplete==='function'?options.onComplete:null};
  root=document.createElement('section');root.id='revealRoot';root.className='reveal-overlay';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Recruitment results');document.body.appendChild(root);
  root.addEventListener('click',event=>{const el=event.target.closest('[data-reveal]');if(!el||el.disabled)return;const action=el.dataset.reveal;if(action==='close')close();else if(action==='next')next();else if(action==='results')results();else if(action==='character')character();});
  document.addEventListener('keydown',keyboard);stars();
 }
 function keyboard(e){if(!root)return;if(e.key==='Escape'){e.preventDefault();if(!(session?.lockUntilResults&&session?.stage!=='results'))close();}else if(e.key==='Tab'){const nodes=[...root.querySelectorAll('button:not([disabled])')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
 function stars(){if(!session)return;session.stage='stars';const id=++frameVersion;const rarity=session.rarities[session.index];const t=tiers[rarity],stars=Array.from({length:rarity},(_,i)=>`<span class="reveal-star" style="--i:${i}" aria-hidden="true">★</span>`).join('');
  shell(`<p class="reveal-kicker">RARITY CONFIRMED</p><div class="reveal-stars" role="img" aria-label="${rarity} stars">${stars}</div><h1 class="reveal-tier">${t.label}</h1><p class="reveal-message">OPERATOR SIGNAL DETECTED</p><p class="reveal-number">${session.index+1} / ${session.count}</p>`,['character','REVEAL CHARACTER'],session.count===10?['results','SHOW ALL RESULTS']:null);
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;timer=window.setTimeout(()=>{if(session&&frameVersion===id&&session.stage==='stars')character()},reduced?650:1250);
 }
 function character(){if(!session)return;clearTimeout(timer);frameVersion++;session.stage='character';const rarity=session.rarities[session.index];const count=session.index+1;const tier=tiers[rarity];
  const operator=session.operators[session.index],art=operator&&safeArt(operator.art)?`<img class="reveal-operator-illustration" src="${esc(operator.art)}" alt="${esc(operator.name)}">`:`<div class="reveal-art-slot"><div class="slot-crest" aria-hidden="true">◇</div><span>CHARACTER ART UNAVAILABLE</span></div>`;
  shell(`<div class="reveal-character-layout"><div class="reveal-character-art">${art}</div><div class="reveal-character-copy"><p class="reveal-kicker">OPERATOR REVEALED · ${count} / ${session.count}</p><div class="reveal-mini-stars" aria-label="${rarity} star rarity">${'★'.repeat(rarity)}</div><h2>${esc(operator?.name||`OPERATOR ${String(count).padStart(2,'0')}`)}</h2><div class="reveal-tier">${tier.label}</div><p>${session.real?(operator.duplicate?`DUPLICATE · +${operator.shards} CHARACTER SHARDS`:`NEW CHARACTER UNLOCKED`):"Character artwork preview. This is a fixed demonstration, not a real recruitment reward."}</p></div></div>`,session.index===session.count-1?['results',session.count===1?'FINISH REVEAL':'VIEW RESULTS']:['next','NEXT OPERATOR'],session.count===10?['results','SHOW ALL RESULTS']:null);
 }
 function next(){if(!session)return;clearTimeout(timer);if(session.index<session.count-1){session.index++;stars();}else results();}
 function results(){if(!session)return;clearTimeout(timer);frameVersion++;session.stage='results';const all=session.rarities.map((rarity,i)=>{const operator=session.operators[i];const figure=operator&&safeArt(operator.art)?`<img src="${esc(operator.art)}" alt="" loading="lazy">`:'◇';return `<div class="reveal-result-card" style="${colors(rarity)}"><small>NO. ${String(i+1).padStart(2,'0')}</small><div class="reveal-result-figure">${figure}</div><div><div class="small-stars" aria-label="${rarity} stars">${'★'.repeat(rarity)}</div><strong>${esc(operator?.name||`OPERATOR ${String(i+1).padStart(2,'0')}`)}</strong></div></div>`;}).join('');
  shell(`<h1 class="reveal-results-title">SCOUTING RESULTS</h1><p class="reveal-results-desc">${session.count} ${session.count===1?'OPERATOR':'OPERATORS'} · ${session.real?"RECRUITMENT COMPLETE":"VISUAL PREVIEW"}</p><div class="reveal-results-grid">${all}</div>`,['close','BACK TO RECRUITMENT']);
 }
 function close(force=false){if(session?.lockUntilResults&&!force&&session.stage!=='results')return;const callback=session?.real&&session.stage==='results'?session.onComplete:null;clearTimeout(timer);frameVersion++;document.removeEventListener('keydown',keyboard);if(root){root.remove();root=null;}session=null;priorFocus?.focus?.({preventScroll:true});priorFocus=null;callback?.();}
 window.RPG_RECRUITMENT_REVEAL={open,openResults,close,configure,setFeatured};
})();
