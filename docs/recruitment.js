(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const validArt=p=>typeof p==='string' && /^assets\/recruitment\/[\w-]+\.(?:webp|png|jpe?g|avif)$/.test(p);
 const fallback=[{id:'featured',tab:'FEATURED',title:'CRIMSON SIGNAL',kicker:'SPECIAL RECRUITMENT',subtitle:'FEATURED 6★ OPERATOR',description:'Featured recruitment operator preview.',featured_character_id:'tavi',art:null}];
 let banners=fallback,displayName='',catalog=[],playerState=null,playerCode='',pullBusy=false;
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
 function showRates(){modal({eyebrow:'PROBABILITY INFORMATION',title:'RECRUITMENT RATES',body:`<p>4★ <strong>91.2%</strong> · 5★ <strong>8%</strong> · 6★ <strong>0.8%</strong> before pity.</p><p>Guaranteed 5★ or higher every 10 pulls. 6★ probability starts increasing on pull 66 (+5 percentage points each pull), with a guaranteed 6★ by pull 80.</p><p>When a 6★ appears: featured 6★ 50% / other 6★ 50%. Losing that 50/50 guarantees featured on the next 6★. Single and ten-pulls share all counters.</p><p>Duplicated characters award shards: 4★ +1, 5★ +3, 6★ +8.</p><div class="dialog-notice">Classroom-grade implementation: outcomes are generated in the browser and are not cheat-proof.</div>`});}
 function updateWallet(){
  if(!playerState)return;
  $('walletPermits').textContent='—';$('walletCoins').textContent=Number(playerState.coins||0).toLocaleString();$('walletPity').textContent=Number(playerState.pity_six||0);
  const free=playerState.dailyEligible&&!playerState.dailyClaimed;
  const ten=document.querySelector('[data-pull="10"]');
  if(ten)ten.querySelector('span:last-child').textContent=free?'FREE DAILY ×10':'1,000 COINS';
  const note=document.querySelector('.pity-note');if(note)note.textContent=free?'FREE DAILY 10-PULL AVAILABLE':playerState.dailyClaimed?'DAILY FREE 10-PULL CLAIMED':'COMPLETE A RUN TODAY TO UNLOCK FREE ×10';
 }
 async function showPull(n){
  if(pullBusy)return;
  dismiss();
  if(!playerCode){modal({eyebrow:'ADVENTURE CARD',title:'SIGN IN FIRST',body:'<p>Scan your Adventure Card QR code before using Recruitment.</p>'});return;}
  const free=n===10&&playerState?.dailyEligible&&!playerState?.dailyClaimed;
  const mode=free?'daily':'paid';const cost=free?0:n*100;
  if(!window.confirm(`${free?'Use today’s free 10-pull':`Spend ${cost} Guild Coins for ${n} pull${n>1?'s':''}`}?`))return;
  pullBusy=true;
  try{
   let requestId='';
   if(mode==='paid'){
    requestId=sessionStorage.getItem('rpgPaidPullPending')||('p'+(crypto?.randomUUID?.()||`${Date.now()}${Math.random().toString(36).slice(2)}`).replaceAll('-',''));
    sessionStorage.setItem('rpgPaidPullPending',requestId);
   }
   const result=await window.RPG_V66.call('/api/recruitment/pull',{card_code:playerCode,mode,count:n,request_id:requestId});
   if(mode==='paid')sessionStorage.removeItem('rpgPaidPullPending');
   playerState=await window.RPG_V66.call('/api/recruitment/state',{card_code:playerCode});updateWallet();
   window.RPG_RECRUITMENT_REVEAL.openResults(result.results,banners[0]?.title||'RECRUITMENT');
  }catch(e){modal({eyebrow:'RECRUITMENT',title:'PULL UNAVAILABLE',body:`<p>${esc(e.message||'Recruitment failed. Please retry.')}</p>`});}
  finally{pullBusy=false;}
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
   const response=await fetch('gacha_catalog.json',{cache:'default'});if(!response.ok)throw Error('Catalog unavailable');
   const data=await response.json();catalog=(data.characters||[]).filter(c=>c&&[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&safeRosterArt(c.art));
   window.RPG_RECRUITMENT_REVEAL?.configure?.(data);
  }catch(e){console.warn('Character roster unavailable:',e);}
 }
 async function init(){
  paint();await Promise.all([loadBannerConfig(),loadRoster()]);paint();
  window.RPG_RECRUITMENT_REVEAL?.setFeatured?.(banners[0]?.featured_character_id);
  const cloud=window.RPG_V66;if(!cloud){console.error('Firebase bridge unavailable.');return}
  const ready=await cloud.ready;if(!ready||!window.RPG_V68_CONNECTION?.connected)return;
  // Text-only cloud overrides. A missing config doc means use the versioned JSON defaults.
  try{
   const result=await cloud.call('/api/recruitment/banners');
   if(Array.isArray(result.banners)&&result.banners.length){
    banners=window.RPG_RECRUITMENT_BANNERS.merge(banners,result.banners);
    paint();
    window.RPG_RECRUITMENT_REVEAL?.setFeatured?.(banners[0]?.featured_character_id);
   }
  }catch(e){console.warn('Recruitment banner text unavailable; showing packaged titles.',e);}

  try{
   const context=JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}');
   if(context.card_code){
    playerCode=context.card_code;
    const data=await cloud.call('/api/profile',{card_code:playerCode});
    displayName=data.name||'';
    playerState=await cloud.call('/api/recruitment/state',{card_code:playerCode});
    updateWallet();
   }
  }catch(e){console.warn('Recruitment balance unavailable:',e);}
 }
 document.getElementById('recruitmentApp').addEventListener('click',e=>{
  const dlg=e.target.closest('[data-dialog]');if(dlg){if(dlg.dataset.dialog==='rates')showRates();else showDetails();return;}
  const pull=e.target.closest('[data-pull]');if(pull)showPull(Number(pull.dataset.pull));
 });
 document.getElementById('modalRoot').addEventListener('click',e=>{if(e.target.id==='dialogBack'||e.target.id==='dialogClose'||e.target.id==='dialogX')dismiss();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('dialogBack'))dismiss();});
 void init();
})();
