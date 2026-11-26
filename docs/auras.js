/* Aura Workshop (v148.6). One screen, two choices: pick an operator, pick an aura.
 * - Tapping an unlocked aura equips it immediately (free, reversible).
 * - The next locked aura is unlocked with the main button, which asks for a second tap.
 * - Shards are per rarity: 4★ duplicates buy 4★ auras, 5★ buy 5★, 6★ buy 6★ (see aura-core.js).
 * Purchases still go through /api/aura/change and Firestore rules; this page never
 * awards shards. Shared tier rules come from aura-core.js.
 */
(() => {
 'use strict';
 const core=window.RPG_AURA_CORE,$=id=>document.getElementById(id),cloud=window.RPG_V66;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(s);
 const retired=new Set(['crimson_knight','silver_knight','mc']);
 const JP=['なし','白光','蒼光','紫光','金光'];
 const PERKS=['No aura','Soft rim light','Rim light + rising motes','Motes + rotating tech ring','Everything + golden rays'];
 let player=null,code='',selected='',preview=0,hover=null,working=false,catalog=[],confirmUntil=0,confirmTimer=0;

 const notice=(text,kind='')=>{const m=$('message');m.textContent=text;m.dataset.kind=kind;};
 const rarityOf=id=>catalog.find(x=>x.id===id)?.rarity||4;
 const shards=(r=rarityOf(selected))=>core.balance(player?.recruitment,r);
 const stateOf=id=>core.state(player?.recruitment?.auras?.[id]);
 const nextCost=(s,r=rarityOf(selected))=>s.level<4?core.cost(r,s.level+1):0;
 const stars=n=>'★'.repeat(Number(n)||0);

 function roster(){
  const owned=player?.recruitment?.owned||{};
  return Object.keys(owned).filter(id=>safeId(id)&&!retired.has(id)).map(id=>{
   const c=catalog.find(x=>x.id===id);
   return {id,name:c?.name||id.replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase()),rarity:c?.rarity||4,art:`assets/deployment/${id}.webp`,fallback:c?.art||'assets/characters/mc.webp',icon:`assets/profile-icons/${id}.webp`};
  }).sort((a,b)=>b.rarity-a.rarity||a.name.localeCompare(b.name));
 }

 function tierState(i,s){
  if(i===s.equipped)return 'equipped';
  if(i<=s.level)return 'owned';
  if(i===s.level+1)return 'next';
  return 'locked';
 }

 function renderRoster(list){
  $('rosterCount').textContent=list.length?`· ${list.length}`:'';
  $('characterList').innerHTML=list.map(c=>{const s=stateOf(c.id);return `<button type="button" class="aw-op${c.id===selected?' is-selected':''}" data-char="${esc(c.id)}" aria-pressed="${c.id===selected}" style="--aura:${core.colors[s.equipped]}">
   <span class="aw-op-icon"><img src="${esc(c.icon)}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'"></span>
   <span class="aw-op-name">${esc(c.name)}</span><span class="aw-op-meta r${c.rarity}">${stars(c.rarity)}</span>
   <span class="aw-op-tier${s.equipped?'':' none'}">${s.equipped?core.names[s.equipped]+' AURA':'NO AURA'}</span></button>`;}).join('');
 }

 function renderTiers(s){
  const have=shards(),r=rarityOf(selected);
  $('tierList').innerHTML=core.names.map((name,i)=>{
   const st=tierState(i,s),cost=core.cost(r,i);
   const right=st==='equipped'?'<b class="aw-badge on">EQUIPPED</b>':st==='owned'?'<b class="aw-badge">TAP TO EQUIP</b>':
     st==='next'?`<b class="aw-badge cost${have<cost?' short':''}"><i class="aw-gem r${r}"></i>${cost}</b>`:`<b class="aw-badge lock">LOCKED</b>`;
   return `<button type="button" class="aw-tier is-${st}${i===preview?' is-selected':''}" data-tier="${i}" style="--aura:${core.colors[i]}" aria-pressed="${i===preview}">
    <span class="aw-orb t${i}" aria-hidden="true"></span>
    <span class="aw-tier-name"><b>${i===0?'NO AURA':name}</b><small>${JP[i]} · ${PERKS[i]}</small></span>${right}</button>`;
  }).join('');
 }

 function renderAction(s){
  const btn=$('auraAction'),have=shards();
  btn.className='';btn.disabled=true;
  const st=tierState(preview,s),cost=nextCost(s);
  if(working){btn.textContent='SAVING…';return;}
  if(st==='equipped'){btn.textContent=`✓ ${preview?core.names[preview]+' AURA':'NO AURA'} EQUIPPED`;btn.className='done';return;}
  if(st==='owned'){btn.textContent=`EQUIP ${preview?core.names[preview]+' AURA':'NO AURA'}`;btn.disabled=false;btn.dataset.action='equip';return;}
  if(st==='locked'){btn.textContent=`UNLOCK ${core.names[s.level+1]} FIRST`;return;}
  const r=rarityOf(selected);
  if(have<cost){btn.textContent=`NEED ${cost-have} MORE ${r}★ SHARD${cost-have===1?'':'S'}`;btn.className='short';return;}
  btn.disabled=false;btn.dataset.action='upgrade';
  if(Date.now()<confirmUntil){btn.textContent=`TAP AGAIN · SPEND ${cost} ${r}★ SHARD${cost===1?'':'S'}`;btn.className='confirm';}
  else{btn.innerHTML=`UNLOCK ${core.names[preview]} AURA <span><i class="aw-gem r${r}"></i>${cost}</span>`;btn.className='buy';}
 }

 function renderBank(active){
  $('shards').innerHTML=[4,5,6].map(r=>`<span class="aw-pool r${r}${r===active?' is-active':''}" title="${r}★ shards buy auras for ${r}★ operators"><i class="aw-gem r${r}"></i><small>${r}★</small>${shards(r).toLocaleString()}</span>`).join('');
 }
 function renderStage(c,s){
  const shown=hover??preview;
  const img=$('characterArt');
  $('noArt').hidden=true;$('stageArt').hidden=false;
  if(img.dataset.char!==c.id){img.dataset.char=c.id;img.dataset.fallbackUsed='';img.src=c.art;img.alt=c.name;}
  img.dataset.auraForce=String(shown);
  $('stageArt').style.setProperty('--aura',core.colors[shown]||'transparent');
  $('stageArt').dataset.shown=String(shown);
  $('rarity').textContent=stars(c.rarity);$('rarity').className=`aw-rarity r${c.rarity}`;
  $('characterName').textContent=c.name;
  $('equippedName').textContent=s.equipped?`EQUIPPED · ${core.names[s.equipped]} AURA`:'NO AURA EQUIPPED';
  $('equippedName').style.setProperty('--aura',core.colors[s.equipped]||'#888');
  const isPreview=shown!==s.equipped;
  $('previewTag').hidden=!isPreview;$('previewTag').textContent=shown>s.level?`PREVIEW · ${core.names[shown]} (LOCKED)`:`PREVIEW · ${shown?core.names[shown]:'NO AURA'}`;
  window.RPG_AURA?.refresh();
 }

 function render(){
  if(!player)return;
  const list=roster();
  if(!list.some(c=>c.id===selected))selected=list.find(c=>c.id===player.selected_character)?.id||list[0]?.id||'';
  renderRoster(list);
  if(!selected){
   renderBank(0);$('stageArt').hidden=true;$('noArt').hidden=false;$('characterName').textContent='NO OPERATORS YET';$('rarity').textContent='';$('equippedName').textContent='';
   $('tierList').innerHTML='';$('auraAction').textContent='RECRUIT AN OPERATOR FIRST';$('auraAction').disabled=true;$('previewTag').hidden=true;return;
  }
  const c=list.find(x=>x.id===selected),s=stateOf(selected);
  renderBank(c.rarity);renderTiers(s);renderAction(s);renderStage(c,s);
 }

 async function save(action,target){
  const c=roster().find(x=>x.id===selected);
  working=true;render();notice('Saving…');
  try{
   const r=await cloud.call('/api/aura/change',{card_code:code,character_id:selected,action,target});
   for(const f of ['shards','shards5','shards6'])if(Number.isFinite(Number(r[f])))player.recruitment[f]=Number(r[f]);
   player.recruitment.auras=r.auras;preview=r.equipped;
   window.RPG_AURA?.setPlayer(player);
   notice(action==='upgrade'?`${core.names[r.level]} AURA UNLOCKED AND EQUIPPED ON ${c?.name?.toUpperCase()||'OPERATOR'}`:`${r.equipped?core.names[r.equipped]+' AURA':'NO AURA'} EQUIPPED ON ${c?.name?.toUpperCase()||'OPERATOR'}`,'ok');
   const stage=$('stageArt');stage.classList.remove('aw-flash');void stage.offsetWidth;stage.classList.add('aw-flash');
  }catch(e){notice('Could not save · '+(e?.message||'Try again.'),'error');try{await refresh();}catch{}}
  finally{working=false;confirmUntil=0;render();}
 }

 async function loadCatalog(){
  const d=window.RPG_GACHA_CATALOG||await fetch('gacha_catalog.json',{cache:'no-cache'}).then(r=>r.ok?r.json():{}).catch(()=>({}));
  catalog=(d.characters||[]).filter(x=>safeId(x?.id)&&[4,5,6].includes(x.rarity)).map(x=>({id:x.id,name:String(x.name||x.id).slice(0,40),rarity:x.rarity,
   art:/^assets\/recruitment\/[a-z0-9_-]+\.(?:png|webp|jpg|avif)$/.test(x.art||'')?x.art:null}));
 }
 async function refresh(){player=await cloud.call('/api/profile',{card_code:code});window.RPG_AURA?.setPlayer(player);preview=stateOf(selected).equipped;render();}

 async function initialize(){
  if(!cloud){notice('Connection unavailable.','error');return;}
  if(!await cloud.ready){notice('Connection unavailable.','error');return;}
  const context=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
  code=String(context.card_code||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
  if(window.RPG_AURA_DEMO)code='AAAAAAAAAAAAAAAA';
  if(!/^[A-HJ-NP-Z2-9]{16}$/.test(code)){$('characterList').textContent='Open Adventure with your card first.';notice('Open Adventure with your card, then come back here.','error');return;}
  try{
   await loadCatalog();
   player=await cloud.call('/api/profile',{card_code:code});
   window.RPG_AURA?.setPlayer(player);
   const list=roster();selected=list.find(c=>c.id===player.selected_character)?.id||list[0]?.id||'';
   preview=stateOf(selected).equipped;render();
  }catch(e){notice(e?.message||'Could not load your operators.','error');}
 }

 $('characterArt').addEventListener('error',e=>{const img=e.currentTarget;if(img.dataset.fallbackUsed)return;img.dataset.fallbackUsed='1';const c=roster().find(x=>x.id===img.dataset.char);if(c)img.src=c.fallback;});
 $('characterList').addEventListener('click',e=>{
  const b=e.target.closest('[data-char]');if(!b||working)return;
  selected=b.dataset.char;preview=stateOf(selected).equipped;hover=null;confirmUntil=0;notice('');render();
  document.querySelector(`#characterList [data-char="${CSS.escape(selected)}"]`)?.focus({preventScroll:true});
 });
 $('tierList').addEventListener('click',e=>{
  const b=e.target.closest('[data-tier]');if(!b||working)return;
  const i=Number(b.dataset.tier),s=stateOf(selected);
  preview=i;hover=null;confirmUntil=0;
  if(i<=s.level&&i!==s.equipped){void save('equip',i);return;} // owned → equip right away
  notice(i===s.level+1?'Preview shown. Use the button below to unlock it.':i>s.level?`Unlock ${core.names[s.level+1]} first. Auras unlock in order.`:'');
  render();document.querySelector(`#tierList [data-tier="${i}"]`)?.focus({preventScroll:true});
 });
 // Hovering an aura previews it on the operator without changing anything.
 $('tierList').addEventListener('pointerover',e=>{const b=e.target.closest('[data-tier]');if(!b||!player||!selected)return;const i=Number(b.dataset.tier);if(hover!==i){hover=i;renderStage(roster().find(x=>x.id===selected),stateOf(selected));}});
 $('tierList').addEventListener('pointerleave',()=>{if(hover===null||!selected)return;hover=null;renderStage(roster().find(x=>x.id===selected),stateOf(selected));});
 $('auraAction').addEventListener('click',()=>{
  if(!player||working||!selected)return;
  const s=stateOf(selected),action=$('auraAction').dataset.action;
  if(action==='equip'){void save('equip',preview);return;}
  if(action!=='upgrade')return;
  try{core.change('upgrade',s,shards(),undefined,rarityOf(selected));}catch(e){notice(e.message,'error');return;}
  if(Date.now()>=confirmUntil){ // first tap arms the purchase for 4 seconds
   confirmUntil=Date.now()+4000;clearTimeout(confirmTimer);confirmTimer=setTimeout(()=>{confirmUntil=0;render();},4000);
   notice(`Spend ${nextCost(s)} ${rarityOf(selected)}★ shard${nextCost(s)===1?'':'s'}? Tap again to confirm.`);render();return;
  }
  clearTimeout(confirmTimer);void save('upgrade',s.level+1);
 });
 void initialize();
})();
