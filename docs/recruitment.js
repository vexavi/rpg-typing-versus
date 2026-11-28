(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const validArt=p=>typeof p==='string' && /^assets\/recruitment\/[\w-]+\.(?:webp|png|jpe?g|avif)$/.test(p);
 const fallback=[{id:'featured',tab:'FEATURED',title:'CRIMSON SIGNAL',kicker:'SPECIAL RECRUITMENT',subtitle:'FEATURED 6★ OPERATOR',description:'Duplicates become shards you can spend on aura upgrades.',featured_character_id:'tavi',art:null}];
 let banners=fallback,displayName='',catalog=[],playerState=null,playerCode='',pullBusy=false;
 const tutorialParam=new URLSearchParams(location.search).get('tutorial');
 const previewPage=/recruitment-preview-v84\.html$/.test(location.pathname);
 const guided=tutorialParam==='1'||tutorialParam==='demo'||previewPage;
 const tutorialDemo=tutorialParam==='demo'||previewPage;
 // Lock secondary links before asynchronous Firebase initialization, avoiding a brief bypass.
 if(guided)document.body.classList.add('tutorial-recruitment');
 // In v86.6 the coach could end up below the page if external tutorial CSS
 // was missing or cached. Position it independently in script as a failsafe.
 if(guided){
  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';
  document.body.style.height='100dvh';
  const main=document.getElementById('recruitmentApp');
  if(main){main.style.height='100dvh';main.style.minHeight='0';main.style.overflowY='auto';main.style.overflowX='hidden';}
 }
 let tutorialState=null;

 // The main Recruitment artwork stays visible but subdued; the free 10-pull
 // and coach are cut out of a dark canvas veil. This does NOT change page
 // geometry or intercept any clicks, including clicks on the free pull.
 const spotlight=$('recruitmentTutorialSpotlight');
 const spotlightCtx=spotlight?.getContext('2d');
 let spotFrame=null,spotLast=0;
 function drawRecruitmentSpotlight(timestamp=0){
  if(!guided || !spotlightCtx){return;}
  if(timestamp-spotLast<130){spotFrame=requestAnimationFrame(drawRecruitmentSpotlight);return;}
  spotLast=timestamp;
  const vw=innerWidth,vh=innerHeight;
  if(spotlight.width!==vw || spotlight.height!==vh){spotlight.width=vw;spotlight.height=vh;}
  spotlightCtx.clearRect(0,0,vw,vh);
  // Results and dialogs have their own modal treatment. Do not darken them.
  const resultOpen=!!document.querySelector('.reveal-overlay:not([hidden])');
  const dialogOpen=!!document.querySelector('#modalRoot .dialog-back');
  if(!resultOpen && !dialogOpen){
   spotlightCtx.fillStyle='rgba(4, 6, 12, .76)';
   spotlightCtx.fillRect(0,0,vw,vh);
   const cutouts=[];
   for(const [selector,pad] of [['[data-pull="10"]',7],['#recruitmentTutorialGuide',7]]){
    const el=document.querySelector(selector);
    if(!el||!el.getClientRects().length)continue;
    const r=el.getBoundingClientRect();
    const x=Math.max(0,r.left-pad),y=Math.max(0,r.top-pad);
    const right=Math.min(vw,r.right+pad),bottom=Math.min(vh,r.bottom+pad);
    if(right>x && bottom>y)cutouts.push({x,y,w:right-x,h:bottom-y,action:selector.includes('data-pull')});
   }
   for(const r of cutouts)spotlightCtx.clearRect(r.x,r.y,r.w,r.h);
   spotlightCtx.strokeStyle='#fff200';spotlightCtx.lineWidth=4;
   for(const r of cutouts)if(r.action)spotlightCtx.strokeRect(r.x+2,r.y+2,r.w-4,r.h-4);
  }
  spotFrame=requestAnimationFrame(drawRecruitmentSpotlight);
 }
 function startRecruitmentSpotlight(){
  if(!guided||!spotlightCtx||window.RPG_TUTORIAL_GUIDE)return; // v148.9: tutorial-guide.js replaces this veil
  // The HTML canvas is outside main: explicit fixed styles prevent an extra page.
  Object.assign(spotlight.style,{position:'fixed',top:'0',left:'0',right:'0',bottom:'0',width:'100vw',height:'100dvh',display:'block',zIndex:'7000',pointerEvents:'none'});
  spotlight.hidden=false;
  if(spotFrame===null)spotFrame=requestAnimationFrame(drawRecruitmentSpotlight);
 }
 const safeRosterArt=p=>typeof p==='string' && /^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(p);
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 function paint(){
  const b=banners[0];if(!b)return;
  $('bannerTitle').textContent=b.title;$('bannerKicker').textContent=b.kicker;$('bannerSubline').textContent=b.subtitle;$('bannerDesc').textContent=b.description;
  const art=$('bannerArt');art.style.backgroundImage=validArt(b.art)?`url("${b.art}")`:'';
  const featured=catalog.find(x=>x.id===b.featured_character_id&&x.rarity===6);
  const portrait=$('featuredOperatorArt');portrait.hidden=!featured;portrait.src=featured&&safeRosterArt(featured.art)?featured.art:'';
  $('featuredOperatorName').textContent=featured?`6★ FEATURED · ${featured.name.toUpperCase()}`:'6★ FEATURED OPERATOR';
  art.querySelector('.art-guide').hidden=!!validArt(b.art)||!!featured;
  // Single Featured banner: display its label without a selectable tab.
  $('bannerNav').innerHTML=`<div class="banner-tab selected single-banner" aria-label="Featured recruitment"><strong>${esc(b.tab)}</strong><small>FEATURED / RECRUITMENT</small><span class="corner">◆</span></div>`;
 }
 function modal({eyebrow,title,body}){
  $('modalRoot').innerHTML=`<div class="dialog-back" id="dialogBack"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialogTitle"><button class="dialog-close" type="button" id="dialogX" aria-label="Close dialog">×</button><p class="eyebrow">${esc(eyebrow)}</p><h2 id="dialogTitle">${esc(title)}</h2>${body}<div class="dialog-foot"><button id="dialogClose" type="button">CLOSE</button></div></section></div>`;
  $('dialogClose').focus();
 }
 function dismiss(){$('modalRoot').innerHTML='';}
 function showDetails(){const b=banners[0],featured=catalog.find(x=>x.id===b.featured_character_id&&x.rarity===6);modal({eyebrow:'RECRUITMENT DETAILS',title:b.title,body:`<p>${esc(b.description)}</p><p><strong>Featured 6★:</strong> ${esc(featured?.name||'Not selected')}</p><p><strong>Operators in current roster:</strong> ${catalog.length}</p><div class="dialog-notice">Recruitment results are saved to the player's collection.</div>`});}
 function showRates(){modal({eyebrow:'PROBABILITY INFORMATION',title:'RECRUITMENT RATES',body:`<p>4★ <strong>91.2%</strong> · 5★ <strong>8%</strong> · 6★ <strong>0.8%</strong> before pity.</p><p>Guaranteed 5★ or higher every 10 pulls. 6★ probability starts increasing on pull 66 (+5 percentage points each pull), with a guaranteed 6★ by pull 80.</p><p>When a 6★ appears: featured 6★ 50% / other 6★ 50%. Losing that 50/50 guarantees featured on the next 6★. Single and ten-pulls share all counters.</p><p>Each duplicate gives 1 shard of its own rarity (4★, 5★ or 6★). Shards only unlock Auras for operators of the same rarity; rarer auras cost fewer shards.</p><div class="dialog-notice">Classroom-grade implementation: outcomes are generated in the browser and are not cheat-proof.</div>`});}
 function updateWallet(){
  if(!playerState)return;
  $('walletPermits').textContent='—';$('walletCoins').textContent=Number(playerState.coins||0).toLocaleString();$('walletPity').textContent=Number(playerState.pity_six||0);
  const free=playerState.dailyEligible&&!playerState.dailyClaimed;
  const ten=document.querySelector('[data-pull="10"]');
  if(ten)ten.querySelector('span:last-child').textContent=free?'FREE DAILY ×10':'1,000 COINS';
  const note=document.querySelector('.pity-note');if(note)note.textContent=guided?'YOUR FIRST RECRUITMENT · FREE ×10':free?'FREE DAILY 10-PULL AVAILABLE':playerState.dailyClaimed?'DAILY FREE 10-PULL CLAIMED':'COMPLETE A RUN TODAY TO UNLOCK FREE ×10';
  if(guided&&ten)ten.querySelector('span:last-child').textContent='FREE ×10';
 }
 async function showPull(n){
  if(pullBusy)return;
  if(guided){
   if(n!==10)return;
   if(tutorialDemo){
    window.RPG_RECRUITMENT_REVEAL.open(10,banners[0]?.title||'FEATURED');
    tutorialGuide('PREVIEW ONLY · No characters are awarded.','FINISH DEMO',()=>location.assign('tutorial.html?complete=1&demo=1'));
    return;
   }
   if(!tutorialState||Number(tutorialState.step)!==4){tutorialGuide('Finish Lessons 1–3 first.');return;}
   if(tutorialState.tutorialClaimed){await showSavedTutorialDraw();return;}
   pullBusy=true;
   try{
    if(!G())tutorialGuide('Recruiting ten characters…');
    const result=await window.RPG_V66.call('/api/recruitment/pull',{card_code:playerCode,mode:'tutorial',count:10});
    tutorialState={...tutorialState,tutorialClaimed:true,lastDraw:result.results};
    // The draw has already been committed. A follow-up balance read must never
    // prevent the saved characters from being revealed or trigger another draw.
    try{playerState=await window.RPG_V66.call('/api/recruitment/state',{card_code:playerCode});updateWallet();}catch(e){console.warn('Wallet refresh after saved tutorial draw:',e);}
    await showSavedTutorialDraw(result.results);
   }catch(e){
    // A timeout could happen AFTER the receipt was committed. Re-check state first.
    try{
     const fresh=await window.RPG_V66.call('/api/tutorial/state',{card_code:playerCode});
     tutorialState=fresh;
     if(fresh.tutorialClaimed){await showSavedTutorialDraw();return;}
    }catch(_){/* keep retry option */}
    tutorialGuide(String(e?.message||e),'TRY AGAIN',()=>showPull(10));
   }
   finally{pullBusy=false;}
   return;
  }
  dismiss();
  if(!playerCode){modal({eyebrow:'ADVENTURE CARD',title:'SIGN IN FIRST',body:'<p>Scan your Adventure Card QR code before using Recruitment.</p>'});return;}
  const free=n===10&&playerState?.dailyEligible&&!playerState?.dailyClaimed;
  const mode=free?'daily':'paid';const cost=free?0:n*100;
  if(!window.confirm(`${free?'Use today’s free 10-pull':`Spend ${cost} Guild Coins for ${n} pull${n>1?'s':''}`}?`))return;
  pullBusy=true;
  try{
   let requestId='';
   // Keep pending IDs isolated by student AND pull count. A network timeout must
   // replay the same paid draw, never charge a new one or show the wrong count.
   const pendingKey=`rpgPaidPullPending:${playerCode}:${n}`;
   if(mode==='paid'){
    const existing=sessionStorage.getItem(pendingKey);
    requestId=existing&&/^p[a-z0-9-]{10,55}$/.test(existing)?existing:('p'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}${Math.random().toString(36).slice(2)}`).replaceAll('-',''));
    sessionStorage.setItem(pendingKey,requestId);
   }
   const result=await window.RPG_V66.call('/api/recruitment/pull',{card_code:playerCode,mode,count:n,request_id:requestId});
   // A wallet refresh failure should not hide a successfully committed draw.
   try{playerState=await window.RPG_V66.call('/api/recruitment/state',{card_code:playerCode});updateWallet();}catch(e){
    console.warn('Wallet refresh after saved draw:',e);
    if(playerState&&Number.isFinite(Number(result.coins)))playerState.coins=Number(result.coins);
    updateWallet();
   }
   window.RPG_RECRUITMENT_REVEAL.openResults(result.results,banners[0]?.title||'RECRUITMENT');
   if(mode==='paid')sessionStorage.removeItem(pendingKey);
  }catch(e){modal({eyebrow:'RECRUITMENT',title:'PULL UNAVAILABLE',body:`<p>${esc(e.message||'Recruitment failed. Please retry.')}</p>`});}
  finally{pullBusy=false;}
 }


 // v148.9 guided steps on the real Recruitment page (guard rails from tutorial-guide.js).
 const G=()=>window.RPG_TUTORIAL_GUIDE;
 const KICK='TUTORIAL · LESSON 05 / 05';
 function guideCoins(){
  const g=G();if(!g){tutorialGuide('Select RECRUIT ×10 below. Your first pull costs 0 Guild Coins.');return;}
  g.show({target:()=>$('walletCoins')?.closest('.wallet-item')||$('walletCoins'),kicker:KICK,title:'Guild Coins',
   text:'These are your COINS. Play games to get more. 10 characters = 1,000 coins.',
   button:{label:'NEXT ▸',onClick:guidePull}});
 }
 function guidePull(){
  const g=G();if(!g)return;
  g.show({target:'[data-pull="10"]',kicker:KICK,title:'Recruit ×10',
   text:'Your first time is FREE! Tap RECRUIT ×10.'});
 }
 function guideResults(){
  const g=G();if(!g)return;g.clear();
  // Let the reveal play freely; once the result lineup appears, point at the way back.
  const started=Date.now();
  const timer=setInterval(()=>{
   const back=document.querySelector('#revealRoot[data-stage="lineup"] .rv-lu-foot [data-reveal="close"]');
   if(back){clearInterval(timer);g.show({target:()=>document.querySelector('#revealRoot .rv-lu-foot [data-reveal="close"]'),kicker:KICK,title:'Your new characters!',dim:false,
    text:'These 10 characters are yours now! Tap BACK TO RECRUITMENT.'});}
   else if(!document.getElementById('revealRoot')||Date.now()-started>600000)clearInterval(timer);
  },250);
 }
 function guideExit(){
  const g=G();if(!g){location.replace('adventure.html');return;}
  // Next: short guides for Pause/Return (first Normal run) and Collection.
  try{const id=JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}').public_id;if(id)g.setPending(id,['pause','collection']);}catch(_){}
  document.body.classList.add('tutorial-exit'); // reveal the × that the tutorial hid
  g.show({target:'a.close[data-return-modes]',kicker:KICK,title:'Back to Mode Select',
   text:'Great job! Tap × to go back.'});
 }
 function tutorialGuide(message='Select RECRUIT ×10 to get your first characters.',action='',callback=null){
  if(G()){
   // Status / error messages: a centred card. During the reveal no card is shown.
   if(document.getElementById('revealRoot'))return;
   G().show({kicker:KICK,title:'Recruitment',text:message,button:action&&callback?{label:action,onClick:()=>{G().clear();callback();}}:null,dim:true});
   return;
  }
  let coach=$('recruitmentTutorialGuide');
  if(!coach){coach=document.createElement('section');coach.id='recruitmentTutorialGuide';coach.className='recruitment-tutorial-guide';coach.setAttribute('aria-live','polite');
   document.body.append(coach);}
  // Inline critical styles survive a failed/stale recruitment-tutorial.css request.
  Object.assign(coach.style,{
   position:'fixed',top:innerWidth<=650?'clamp(75px,14vh,125px)':'clamp(86px,19vh,190px)',
   bottom:'auto',left:innerWidth<=650?'12px':'clamp(12px,2.5vw,38px)',
   right:innerWidth<=650?'12px':'auto',width:innerWidth<=650?'auto':'min(375px, calc(100vw - 24px))',
   maxHeight:innerWidth<=650?'26vh':'min(45vh,350px)',overflow:'auto',
   zIndex:'8000',background:'#f5f5ef',color:'#202123',borderLeft:'7px solid #fff200',
   padding:innerWidth<=650?'10px 12px':'14px 17px',boxShadow:'0 14px 36px #000b',
   boxSizing:'border-box',fontFamily:'Arial, Helvetica, sans-serif'
  });
  coach.replaceChildren();
  const tag=document.createElement('strong');tag.textContent='LESSON 4 / 4 · RECRUITMENT';coach.append(tag);
  const desc=document.createElement('p');desc.textContent=message;coach.append(desc);
  if(action&&callback){const button=document.createElement('button');button.textContent=action;button.type='button';button.addEventListener('click',callback);coach.append(button);}
  if(guided)startRecruitmentSpotlight();
 }
 async function tutorialFinish(){
  try{
   tutorialGuide('Saving tutorial completion…');
   await window.RPG_V66.call('/api/tutorial/progress',{card_code:playerCode,step:5});
   if(G()){G().clear();guideExit();return;}
   location.replace('tutorial.html?complete=1');
  }catch(e){tutorialGuide(String(e?.message||e),'RETRY COMPLETION',()=>tutorialFinish());}
 }
 async function showSavedTutorialDraw(rows=null){
  let saved=rows||tutorialState?.lastDraw||playerState?.lastDrawResults;
  if(!Array.isArray(saved)||saved.length!==10){
   try{
    const recovered=await window.RPG_V66.call('/api/recruitment/tutorial-draw',{card_code:playerCode});
    saved=recovered.results;
    tutorialState={...tutorialState,lastDraw:saved,tutorialClaimed:true};
   }catch(e){tutorialGuide('Draw saved, but results could not be retrieved: '+String(e?.message||e),'RETRY VIEWING',()=>void showSavedTutorialDraw());return;}
  }
  if(G())G().clear();else tutorialGuide('Your ten characters are saved. View all results to finish.');
  try{window.RPG_RECRUITMENT_REVEAL.openResults(saved,banners[0]?.title||'FEATURED',{lockUntilResults:true,onComplete:()=>void tutorialFinish()});guideResults();}
  catch(e){tutorialGuide('Results unavailable: '+String(e?.message||e),'RETRY VIEWING',()=>void showSavedTutorialDraw());}
 }
 async function initGuided(){
  document.body.classList.add('tutorial-recruitment');
  startRecruitmentSpotlight();
  document.querySelectorAll('.banner-actions button').forEach(el=>{el.disabled=true;el.setAttribute('aria-disabled','true')});
  document.querySelectorAll('[data-pull="1"]').forEach(el=>{el.disabled=true;el.setAttribute('aria-disabled','true')});
  if(tutorialDemo){
   tutorialGuide('Press RECRUIT ×10 to preview the real reveal. No rewards on replay.');
   const note=document.querySelector('.pity-note');if(note)note.textContent='TUTORIAL PREVIEW · FREE ×10';
   const ten=document.querySelector('[data-pull="10"]');if(ten)ten.querySelector('span:last-child').textContent='PREVIEW ×10';
   return;
  }
  if(!playerCode){tutorialGuide('Scan your Adventure Card QR code before starting Recruitment.');return;}
  try{
   tutorialState=await window.RPG_V66.call('/api/tutorial/state',{card_code:playerCode});
   if(tutorialState.complete){location.replace('adventure.html');return;}
   if(Number(tutorialState.step)!==4){location.replace('tutorial.html');return;}
   if(tutorialState.tutorialClaimed){
    tutorialGuide('Your first pull was already saved. View the results to continue.','VIEW SAVED RESULTS',()=>void showSavedTutorialDraw());
   }else guideCoins();
  }catch(e){tutorialGuide('Could not load tutorial status: '+String(e?.message||e));}
 }
 async function loadBannerConfig(){
  try{
   const r=await fetch('recruitment-banners.json',{cache:'default'});if(!r.ok)throw Error('No config');
   const data=await r.json();
   // Ignore any old Standard banner still present in a cached file.
   const b=Array.isArray(data.banners)?data.banners.find(x=>x?.id==='featured'):null;
   if(!b||!b.title||!b.tab)return;
   banners=[{id:'featured',tab:String(b.tab).slice(0,22),title:String(b.title).slice(0,70),kicker:String(b.kicker||'RECRUITMENT').slice(0,50),subtitle:String(b.subtitle||'').slice(0,110),description:String(b.description||'').slice(0,260),featured_character_id:/^[a-z][a-z0-9_]{0,39}$/.test(b.featured_character_id)?b.featured_character_id:'tavi',art:validArt(b.art)?b.art:null}];
   paint();
  }catch(e){console.warn('Featured banner configuration unavailable, showing built-in preview.',e);}
 }
 async function loadRoster(){
  try{
   if(window.RPG_GACHA_CATALOG){const data=window.RPG_GACHA_CATALOG;catalog=(data.characters||[]).filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeRosterArt(c.art));window.RPG_RECRUITMENT_REVEAL?.configure?.(data);return;}
   const response=await fetch('gacha_catalog.json',{cache:'no-cache'});if(!response.ok)throw Error('Catalog unavailable');
   const data=await response.json();catalog=(data.characters||[]).filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeRosterArt(c.art));
   window.RPG_RECRUITMENT_REVEAL?.configure?.(data);
  }catch(e){console.warn('Character roster unavailable:',e);}
 }
 async function init(){
  paint();await Promise.all([loadBannerConfig(),loadRoster()]);paint();
  window.RPG_RECRUITMENT_REVEAL?.setFeatured?.(banners[0]?.featured_character_id);
  if(guided)startRecruitmentSpotlight();
  const cloud=window.RPG_V66;if(!cloud){console.error('Could not connect. Reload this page.');if(guided)tutorialGuide('Could not connect. Reload this page.');return;}
  const ready=await cloud.ready;if(!ready||!window.RPG_V68_CONNECTION?.connected){tutorialGuide('No connection. Reconnect, then reload.');return;}
  // Text-only cloud overrides. A missing config doc means use the versioned JSON defaults.
  try{
   const result=await cloud.call('/api/recruitment/banners');
   if(Array.isArray(result.banners)&&result.banners.length){
    banners=window.RPG_RECRUITMENT_BANNERS.merge(banners,result.banners);
    paint();
    window.RPG_RECRUITMENT_REVEAL?.setFeatured?.(banners[0]?.featured_character_id);
    window.RPG_RECRUIT_BGM?.play?.(banners[0]?.featured_character_id);
   }
  }catch(e){console.warn('Recruitment banner text unavailable; showing packaged titles.',e);}

  try{
   const context=JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}');
   if(context.card_code){
    playerCode=context.card_code;
    const data=await cloud.call('/api/profile',{card_code:playerCode});
    displayName=data.name||'';
    window.RPG_AURA?.setPlayer(data); // show equipped auras on operators you pull again
    playerState=await cloud.call('/api/recruitment/state',{card_code:playerCode});
    updateWallet();
   }
  }catch(e){console.warn('Recruitment balance unavailable:',e);}
  if(guided)await initGuided();
 }
 document.getElementById('recruitmentApp').addEventListener('click',e=>{
  const dlg=e.target.closest('[data-dialog]');if(dlg){if(dlg.dataset.dialog==='rates')showRates();else showDetails();return;}
  const pull=e.target.closest('[data-pull]');if(pull)showPull(Number(pull.dataset.pull));
 });
 document.getElementById('modalRoot').addEventListener('click',e=>{if(e.target.id==='dialogBack'||e.target.id==='dialogClose'||e.target.id==='dialogX')dismiss();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dialogBack'))dismiss();});
 void init();
})();
