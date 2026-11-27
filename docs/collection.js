/* Collection (v148.9). Every recruitable operator in one archive grid.
 * Recruited operators show in colour; the rest are greyed out. Tapping a recruited
 * operator opens an Arknights-style archive page with the full-body art.
 * v148.9: the Aura Workshop lives here now — each operator page has an Aura row.
 * Tap an unlocked aura to equip it; tap the next locked aura twice (within 4 s) to
 * spend shards of that operator's rarity. Writes go only through /api/aura/change.
 */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),cloud=window.RPG_V66,core=window.RPG_AURA_CORE;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(s);
 // Face centres [x%, y%] in the 480×900 deployment art (same values as the recruitment lineup).
 const FACE={alden:[45.2,10.7],anodyne:[46.7,9.0],aveline:[59.8,10.2],cassian:[59.4,19.9],crossbow:[51.2,10.7],elise:[48.5,12.2],hexaxe:[51.7,10.0],hound:[65.2,33.7],isolde:[50.6,14.3],kade:[49.4,10.0],livia:[44.2,14.7],lupa:[79.2,20.0],mira:[51.7,10.2],nitrate:[40.8,19.7],nora:[48.1,12.4],seraphine:[57.3,9.9],shield:[38.5,12.2],tavi:[52.5,21.3],vern:[39.8,15.9],vex:[56.2,9.7],kurone:[49.5,22.1]};
 const NAMES=['NONE','WHITE','AZURE','VIOLET','GOLD'];
 let player=null,code='',catalog=[],filter='all',ownedOnly=false,current=-1,lastFocus=null,openId='',working=false,armed=-1,armTimer=0,hover=null;
 const JP=['なし','白光','蒼光','紫光','金光'];

 const owned=id=>Math.max(0,Math.trunc(Number(player?.recruitment?.owned?.[id])||0));
 const auraOf=id=>{const a=player?.recruitment?.auras?.[id]||{};const e=Number(a.equipped),l=Number(a.level);return {equipped:Number.isInteger(e)&&e>=0&&e<=4?e:0,level:Number.isInteger(l)&&l>=0&&l<=4?l:0};};
 const stars=n=>'★'.repeat(n);
 const notice=t=>{$('message').textContent=t;};

 function list(){
  return catalog.filter(c=>(filter==='all'||String(c.rarity)===filter)&&(!ownedOnly||owned(c.id)>0))
   .sort((a,b)=>(owned(b.id)>0)-(owned(a.id)>0)||b.rarity-a.rarity||a.name.localeCompare(b.name));
 }
 function portrait(c){
  const [fx,fy]=FACE[c.id]||[50,14];
  return `<img class="cl-card-img" style="--fx:${fx};--fy:${fy}" src="assets/deployment/${esc(c.id)}.webp" data-fallback="${esc(c.art||'')}" alt="" loading="lazy" decoding="async" draggable="false">`;
 }
 function render(){
  const items=list(),have=catalog.filter(c=>owned(c.id)>0).length;
  $('ownedCount').innerHTML=`${have}<small> / ${catalog.length}</small>`;
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
  $('grid').innerHTML=items.length?items.map((c,i)=>{
   const n=owned(c.id),a=auraOf(c.id),got=n>0;
   return `<button type="button" class="cl-card r${c.rarity}${got?'':' is-locked'}${got&&a.equipped?' has-aura':''}" data-id="${esc(c.id)}" style="--i:${i};--aura:${core?.colors?.[a.equipped]||'transparent'}" aria-label="${esc(c.name)}, ${c.rarity} stars${got?`, recruited ×${n}`:', not recruited'}"${got?'':' aria-disabled="true"'}>
    <span class="cl-card-art">${portrait(c)}</span>
    <span class="cl-card-head"><i class="cl-card-gem" aria-hidden="true"></i><span class="cl-card-stars">${stars(c.rarity)}</span></span>
    ${got&&a.equipped?`<span class="cl-card-aura" title="${NAMES[a.equipped]} aura">${NAMES[a.equipped]}</span>`:''}
    <span class="cl-card-foot"><span class="cl-card-stripe" aria-hidden="true"></span>
     <span class="cl-card-copies">${got?`<small>COPIES</small><b>${n}</b>`:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'}</span>
     <span class="cl-card-name">${esc(c.name)}</span></span>
   </button>`;}).join(''):'<p class="cl-empty">No operators match this filter yet.</p>';
  $('grid').querySelectorAll('img[data-fallback]').forEach(img=>img.addEventListener('error',()=>{if(img.dataset.fallback&&!img.dataset.used){img.dataset.used='1';img.src=img.dataset.fallback;img.classList.add('is-banner');}},{once:false}));
 }

 // ---- Archive page --------------------------------------------------------------
 const viewable=()=>list().filter(c=>owned(c.id)>0);
 function openDetail(id){
  const items=viewable(),i=items.findIndex(c=>c.id===id);if(i<0)return;
  if($('detail').hidden)lastFocus=document.activeElement;
  current=i;const c=items[i],n=owned(c.id),a=auraOf(c.id);
  if(openId!==c.id){armed=-1;hover=null;clearTimeout(armTimer);delete $('dImg').dataset.auraForce;$('dAuraMsg').textContent='';$('dAuraMsg').dataset.kind='';}
  openId=c.id;
  const rule=window.RPG_OPERATOR_PASSIVES?.RULES?.[c.id];
  const d=$('detail');d.className=`cl-detail r${c.rarity}`;d.hidden=false;document.body.classList.add('cl-open');
  $('dEmblem').textContent=c.rarity;
  $('dRarityLabel').textContent=`${c.rarity}★ OPERATOR`;$('dStars').textContent=stars(c.rarity);
  $('dName').textContent=c.name;

  $('dCopies').textContent=`RECRUITED ×${n}`;
  renderAura(c);
  const art=$('dArt');art.dataset.operatorId=c.id;
  // Full-body original (transparent, high-res); the 480×900 deployment crop is only a fallback.
  const img=$('dImg');img.dataset.used='';img.src=c.art||`assets/deployment/${c.id}.webp`;img.dataset.fallback=c.art?`assets/deployment/${c.id}.webp`:'';
  art.classList.remove('is-in');void art.offsetWidth;art.classList.add('is-in');
  const row=(k,v)=>`<div><dt>[${esc(k)}]</dt><dd>${v}</dd></div>`;
  $('dInfo').innerHTML=row('Code Name',esc(c.name))+row('Rarity',`<span class="cl-d-rs">${stars(c.rarity)}</span> ${c.rarity}-star`)+
   row('Recruited',`×${n}${n>1?` · ${n-1} duplicate${n>2?'s':''}`:''}`);
  $('dPassive').innerHTML=rule?row('Skill',esc(rule.title))+`<p class="cl-d-desc">${esc(rule.description)}</p>`:'<p class="cl-d-desc">No passive.</p>';
  $('dIndex').textContent=`${i+1} / ${items.length}`;
  d.querySelectorAll('[data-step]').forEach(b=>b.disabled=items.length<2);
  if(!d.contains(document.activeElement))d.querySelector('[data-close]').focus({preventScroll:true});
  window.RPG_AURA?.refresh?.();
  // v148.9: 5★/6★ operators have a "Who Am I?" lesson.
  $('dWho').hidden=c.rarity<5;
  if(guideStep==='pick'){guideStep='aura';guideChar=c.id;setTimeout(guideAura,450);}
  else if(guideStep==='pick56'&&c.rarity>=5){guideStep='who';setTimeout(guideWho,450);}
 }

 // ---- First-visit guide (runs once, right after the first-time tutorial) ------------
 const G=()=>window.RPG_TUTORIAL_GUIDE,KG='GUIDE · COLLECTION';
 let guideStep='',guideChar='',freeAura=false;
 const pid=()=>String(player?.public_id||'');
 function startGuide(){
  const g=G();if(!g||!pid()||!g.pending(pid()).includes('collection')||player?.tutorial?.collectionGuide===true)return;
  // Coming back from the guided "Who Am I?": finish the tour.
  let resume='';try{resume=sessionStorage.getItem('rpgCollectionGuideResume')||'';sessionStorage.removeItem('rpgCollectionGuideResume');}catch(_){}
  if(resume==='after-whoami'){guideExit();return;}
  filter='all';ownedOnly=false;$('ownedOnly').checked=false;render();
  guideStep='owned';
  g.show({target:()=>$('grid').querySelector('.cl-card:not(.is-locked)'),kicker:KG,title:'Your characters',
   text:'Color cards = your characters.',
   button:{label:'NEXT ▸',onClick:guideLocked}});
 }
 function guideLocked(){
  const locked=$('grid').querySelector('.cl-card.is-locked');
  if(!locked){guidePick();return;}
  locked.scrollIntoView({block:'nearest'});
  G().show({target:()=>$('grid').querySelector('.cl-card.is-locked'),kicker:KG,title:'Not recruited yet',
   text:'Gray cards with a 🔒 = not yours yet.',
   button:{label:'NEXT ▸',onClick:guidePick}});
 }
 function guidePick(){
  guideStep='pick';
  // Show only the operators they can pick: owned 4★ (or any owned one if they have no 4★).
  const has4=catalog.some(c=>c.rarity===4&&owned(c.id)>0);
  filter=has4?'4':'all';ownedOnly=true;$('ownedOnly').checked=true;render();window.scrollTo({top:0});
  G().show({target:()=>[...$('grid').querySelectorAll('.cl-card:not(.is-locked)')],park:true,kicker:KG,title:'Open a character',
   text:has4?'Tap a 4★ character.':'Tap one of your characters.'});
 }
 function guideAura(){
  G().show({target:'#dAuras',kicker:KG,title:'Auras',
   text:'AURA = a glow for your character. It costs ◆ shards. You get shards from the same character again.',
   button:{label:'NEXT ▸',onClick:guideFree}});
 }
 function guideFree(){
  const c=catOf(guideChar);
  const canGift=c&&c.rarity===4&&auraOf(c.id).level===0&&player?.recruitment?.tutorialAuraFree!==true;
  if(!canGift){guideBack();return;}
  freeAura=true;renderAura(c);
  G().show({target:()=>$('dAuras').querySelector('[data-tier="1"]'),kicker:KG,title:'A free gift!',
   text:'A FREE gift for you! Tap WHITE.'});
 }
 function guideEquipped(){
  G().show({target:'#dArt',kicker:KG,title:'Aura unlocked!',
   text:'Your character glows now! Tap NONE to turn it off.',
   button:{label:'NEXT ▸',onClick:guideBack}});
 }
 function guideFreeFailed(){
  G().show({kicker:KG,title:'Gift not saved',text:'The gift did not save. Please tell your teacher.',
   button:{label:'NEXT ▸',onClick:guideBack}});
 }
 function guideBack(){
  guideStep='back';
  G().show({target:'#detail [data-close]',kicker:KG,title:'Go back',text:'Tap ‹ to go back.'});
 }
 function guidePick56(){
  const has=catalog.some(c=>c.rarity>=5&&owned(c.id)>0);
  if(!has){guideExit();return;}
  guideStep='pick56';filter='all';ownedOnly=true;$('ownedOnly').checked=true;render();window.scrollTo({top:0});
  G().show({target:()=>[...$('grid').querySelectorAll('.cl-card.r5:not(.is-locked),.cl-card.r6:not(.is-locked)')],park:true,kicker:KG,title:'Your best characters',
   text:'Now tap a 5★ or 6★ character.'});
 }
 function guideWho(){
  G().show({target:'#dWho',kicker:KG,title:'Who am I?',
   text:'WHO AM I? shows this character\'s skill. Finish it once = 🪙 +100 coins! Tap it, or tap LATER.',
   button:{label:'LATER',onClick:()=>{guideStep='back2';G().show({target:'#detail [data-close]',kicker:KG,title:'Go back',text:'You can play WHO AM I? any time. Tap ‹ to go back.'});}}});
 }
 function guideExit(){
  guideStep='exit';filter='all';ownedOnly=false;$('ownedOnly').checked=false;render();
  G().done(pid(),'collection',code);
  try{sessionStorage.setItem('rpgTutorialJustDone','1');}catch(_){}
  G().show({target:'.cl-back',kicker:KG,title:'Back to Mode Select',text:'All done! Tap ‹ MODE SELECT.'});
 }

 // ---- Aura row (former Aura Workshop) -------------------------------------------
 const catOf=id=>catalog.find(c=>c.id===id);
 function tierState(i,a){return i===a.equipped?'equipped':i<=a.level?'owned':i===a.level+1?'next':'locked';}
 function showAura(lv){ // preview on the art only; nothing is saved
  const img=$('dImg');if(lv==null)delete img.dataset.auraForce;else img.dataset.auraForce=String(lv);
  window.RPG_AURA?.refresh?.();
 }
 function auraMsg(t,kind=''){const m=$('dAuraMsg');m.textContent=t;m.dataset.kind=kind;}
 function renderAura(c){
  const a=auraOf(c.id),r=c.rarity,have=core?core.balance(player?.recruitment,r):0;
  $('dAura').textContent=a.equipped?`${NAMES[a.equipped]} AURA`:'NO AURA';
  $('dBank').innerHTML=`<i class="cl-gem r${r}" aria-hidden="true"></i>${have} <small>${r}★ SHARD${have===1?'':'S'}</small>`;
  $('dAuras').innerHTML=NAMES.map((nm,i)=>{
   const st=tierState(i,a),cost=core?core.cost(r,i):0;
   const gift=freeAura&&c.id===guideChar&&st==='next'&&i===1;
   const sub=gift?'FREE':st==='equipped'?'✓ ON':st==='owned'?'EQUIP':st==='next'?(armed===i?'CONFIRM':`<i class="cl-gem r${r}" aria-hidden="true"></i>${cost}`):'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
   const label=`${i?nm.charAt(0)+nm.slice(1).toLowerCase()+' aura':'No aura'}: ${st==='equipped'?'equipped':st==='owned'?'tap to equip':st==='next'?`unlock for ${cost} ${r}-star shard${cost===1?'':'s'}`:'locked'}`;
   return `<button type="button" class="cl-aura is-${st}${armed===i?' is-armed':''}${st==='next'&&have<cost&&!gift?' is-short':''}" data-tier="${i}" style="--aura:${core?.colors?.[i]||'#999'}" aria-pressed="${st==='equipped'}" aria-label="${esc(label)}"${working?' disabled':''}>
    <span class="cl-orb t${i}" aria-hidden="true"></span><b>${i?nm:'NONE'}</b><small>${sub}</small></button>`;
  }).join('');
 }
 async function saveAura(action,target,free=false){
  const c=catOf(openId);if(!c)return;
  working=true;renderAura(c);auraMsg('Saving…');
  try{
   const r=await cloud.call('/api/aura/change',{card_code:code,character_id:c.id,action,target,...(free?{free:true}:{})});
   if(free){freeAura=false;player.recruitment.tutorialAuraFree=true;}
   for(const f of ['shards','shards5','shards6'])if(Number.isFinite(Number(r[f])))player.recruitment[f]=Number(r[f]);
   player.recruitment.auras=r.auras;window.RPG_AURA?.setPlayer?.(player);
   auraMsg(action==='upgrade'?`${NAMES[r.level]} aura unlocked and equipped.`:`${r.equipped?NAMES[r.equipped]+' aura':'No aura'} equipped.`,'ok');
   const art=$('dArt');art.classList.remove('is-flash');void art.offsetWidth;art.classList.add('is-flash');
  }catch(e){
   auraMsg('Could not save · '+(e?.message||'Try again.'),'error');
   if(free){freeAura=false;setTimeout(guideFreeFailed,60);}
   try{player=await cloud.call('/api/profile',{card_code:code});window.RPG_AURA?.setPlayer?.(player);}catch{}
  }finally{
   working=false;armed=-1;hover=null;clearTimeout(armTimer);showAura(null);render();
   if(!$('detail').hidden){renderAura(c);$('dCopies').textContent=`RECRUITED ×${owned(c.id)}`;}
   $('dAuras').querySelector(`[data-tier="${target}"]`)?.focus({preventScroll:true});
   if(free&&player.recruitment.tutorialAuraFree===true)setTimeout(guideEquipped,250);
  }
 }
 function auraTap(i){
  const c=catOf(openId);if(!c||working||!player)return;
  const a=auraOf(c.id),st=tierState(i,a),r=c.rarity;
  if(st==='equipped'){auraMsg(i?`${NAMES[i]} aura is already equipped.`:'No aura is equipped.');return;}
  if(st==='owned'){void saveAura('equip',i);return;}
  if(st==='locked'){armed=-1;auraMsg(`Unlock ${NAMES[a.level+1]} first · auras unlock in order.`);renderAura(c);return;}
  if(freeAura&&c.id===guideChar&&i===1&&st==='next'){void saveAura('upgrade',1,true);return;} // guide gift: one tap
  const cost=core.cost(r,i),have=core.balance(player.recruitment,r);
  if(have<cost){auraMsg(`Need ${cost-have} more ${r}★ shard${cost-have===1?'':'s'} · get them from duplicate ${r}★ recruits.`,'error');return;}
  if(armed!==i){ // first tap arms the purchase for 4 seconds
   armed=i;clearTimeout(armTimer);armTimer=setTimeout(()=>{armed=-1;if(catOf(openId))renderAura(catOf(openId));auraMsg('');},4000);
   showAura(i);auraMsg(`Spend ${cost} ${r}★ shard${cost===1?'':'s'} on ${NAMES[i]}? Tap again to confirm.`);renderAura(c);
   $('dAuras').querySelector(`[data-tier="${i}"]`)?.focus({preventScroll:true});return;
  }
  clearTimeout(armTimer);void saveAura('upgrade',i);
 }
 function closeDetail(){
  const d=$('detail');if(d.hidden)return;
  armed=-1;hover=null;clearTimeout(armTimer);showAura(null);
  d.classList.add('is-leaving');
  setTimeout(()=>{d.hidden=true;d.classList.remove('is-leaving');document.body.classList.remove('cl-open');lastFocus?.focus?.({preventScroll:true});if(guideStep==='back')guidePick56();else if(guideStep==='back2')guideExit();},180);
 }
 function step(n){const items=viewable();if(items.length<2)return;openDetail(items[(current+n+items.length)%items.length].id);}

 // ---- Events -------------------------------------------------------------------
 $('grid').addEventListener('click',e=>{
  const b=e.target.closest('[data-id]');if(!b)return;
  if(owned(b.dataset.id)<1){notice('Not recruited yet · recruit this operator to view their file.');b.classList.remove('is-shake');void b.offsetWidth;b.classList.add('is-shake');return;}
  notice('');openDetail(b.dataset.id);
 });
 document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;render();}));
 $('ownedOnly').addEventListener('change',e=>{ownedOnly=e.target.checked;render();});
 $('detail').addEventListener('click',e=>{
  if(e.target.closest('[data-close]')){closeDetail();return;}
  const t=e.target.closest('[data-tier]');if(t){auraTap(Number(t.dataset.tier));return;}
  const s=e.target.closest('[data-step]');if(s)step(Number(s.dataset.step));
 });
 // Hovering an aura previews it on the art without saving.
 $('dAuras').addEventListener('pointerover',e=>{const b=e.target.closest('[data-tier]');if(!b||armed>=0)return;const i=Number(b.dataset.tier);if(hover!==i){hover=i;showAura(i);}});
 $('dAuras').addEventListener('pointerleave',()=>{if(hover===null||armed>=0)return;hover=null;showAura(null);});
 $('dWho').addEventListener('click',()=>{if(!openId)return;location.href=`who-am-i.html?op=${encodeURIComponent(openId)}${guideStep==='who'?'&from=guide':''}`;});
 $('dImg').addEventListener('error',e=>{const img=e.currentTarget;if(img.dataset.fallback&&!img.dataset.used){img.dataset.used='1';img.src=img.dataset.fallback;}});
 document.addEventListener('keydown',e=>{
  if($('detail').hidden)return;
  if(e.key==='Escape'){e.preventDefault();closeDetail();}
  else if(e.target.closest?.('#dAuras'))return; // arrows inside the aura row stay there
  else if(e.key==='ArrowLeft')step(-1);
  else if(e.key==='ArrowRight')step(1);
 });

 async function loadCatalog(){
  const d=window.RPG_GACHA_CATALOG||await fetch('gacha_catalog.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
  catalog=(d.characters||[]).filter(x=>safeId(x?.id)&&[4,5,6].includes(x.rarity)).map(x=>({id:x.id,name:String(x.name||x.id).slice(0,40),rarity:x.rarity,
   art:/^assets\/recruitment\/[a-z0-9_-]+\.(?:png|webp|jpg|avif)$/.test(x.art||'')?x.art:null}));
 }
 async function initialize(){
  await loadCatalog();render();
  if(!cloud||!await cloud.ready){notice('Connection unavailable.');return;}
  const context=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
  code=String(context.card_code||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
  if(!/^[A-HJ-NP-Z2-9]{16}$/.test(code)){notice('Open Adventure with your card first.');return;}
  try{player=await cloud.call('/api/profile',{card_code:code});window.RPG_AURA?.setPlayer?.(player);render();
   const want=new URLSearchParams(location.search).get('op');if(safeId(want)&&owned(want)>0)openDetail(want);
   else setTimeout(startGuide,500);}
  catch(e){notice(e?.message||'Could not load your operators.');}
 }
 void initialize();
})();
