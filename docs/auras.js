/* v74 Aura Workshop. Student changes are transactional and checked by Firestore rules.
 * This page never awards duplicate shards or starts character pulls. */
(() => {
 'use strict';
 const core=window.RPG_AURA_CORE,$=id=>document.getElementById(id),cloud=window.RPG_V66;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeId=s=>typeof s==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(s);
 const starter=[]; // Aura upgrades apply to recruited operators only.
 const retired=new Set(['crimson_knight','silver_knight']); // Exclude retired operators from old Firestore saves.
 let player=null,code='',selected='',preview=0,working=false,catalog=[],characters=[];
 function notice(message){$('message').textContent=message;}
 function collection(){
  const owned=player?.recruitment?.owned||{};
  const keys=new Set([...starter.map(x=>x.id),...Object.keys(owned).filter(id=>safeId(id)&&!retired.has(id))]);
  const all=[...starter,...catalog];
  return [...keys].map(id=>all.find(c=>c.id===id)||{id,name:id.replaceAll('_',' ').toUpperCase(),img:null,rarity:'OPERATOR'});
 }
 function current(){return core.state(player?.recruitment?.auras?.[selected]);}
 function shards(){return Number(player?.recruitment?.shards)||0;}
 function restoreSelectedFocus(list,field,value){
  for(const b of document.querySelectorAll(list))if(b.dataset[field]===String(value)){b.focus({preventScroll:true});break;}
 }
 function render(){if(!player)return;characters=collection();if(!characters.some(x=>x.id===selected))selected=characters[0]?.id||'';
  if(!characters.length){
   $('shards').textContent=shards().toLocaleString();
   $('characterList').textContent='Recruit an operator first.';
   $('characterName').textContent='NO OPERATORS';$('rarity').textContent='NONE';$('equippedName').textContent='';
   $('previewTag').textContent='';$('characterArt').hidden=true;$('noArt').hidden=false;
   $('tierList').textContent='';$('progressText').textContent='0 / 150 SHARDS';$('progressFill').style.width='0%';
   $('actionHint').textContent='NO RECRUITED OPERATORS';$('actionCost').textContent='';
   $('auraAction').textContent='RECRUIT AN OPERATOR';$('auraAction').disabled=true;return;
  }

  const ch=characters.find(x=>x.id===selected),state=current();$('shards').textContent=shards().toLocaleString();
  $('characterList').innerHTML=characters.map(c=>`<button type="button" class="roster-item ${c.id===selected?'selected':''}" aria-pressed="${c.id===selected}" data-char="${esc(c.id)}"><span>${c.img?`<img class="roster-icon" loading="lazy" src="${esc(c.img)}" alt="">`:'<span class="roster-placeholder">◇</span>'}</span>${esc(c.name)}<small>${esc(core.names[core.state(player.recruitment.auras?.[c.id]).equipped])} AURA</small></button>`).join('');
  $('characterName').textContent=ch.name;$('rarity').textContent=ch.rarity;$('equippedName').textContent=`EQUIPPED · ${state.equipped===0?'NO AURA':core.names[state.equipped]+' AURA'}`;
  $('previewTag').textContent=preview===state.equipped?'EQUIPPED LOOK':'AURA PREVIEW';
  $('characterArt').hidden=!ch.img;$('noArt').hidden=!!ch.img;if(ch.img){$('characterArt').src=ch.img;$('characterArt').alt=`${ch.name} — ${core.names[preview]} Aura preview`;}
  $('auraBackdrop').parentElement.dataset.aura=String(preview);
  $('tierList').innerHTML=core.names.map((name,i)=>{const unlocked=i<=state.level;const equipped=i===state.equipped;return `<button type="button" class="tier ${i===preview?'selected':''}" data-tier="${i}" style="--tint:${core.colors[i]}" aria-pressed="${i===preview}"><span class="orb" aria-hidden="true"></span><span><strong>${i===0?'NO AURA':name+' AURA'}</strong><small>${i===0?'FREE':core.totals[i]+' SHARDS TOTAL'}</small></span><span class="tier-state">${equipped?'EQUIPPED':unlocked?'UNLOCKED':'LOCKED'}</span></button>`}).join('');
  $('progressText').textContent=`${core.totals[state.level]} / 150 SHARDS UNLOCKED ON THIS OPERATOR`;
  $('progressFill').style.width=`${100*core.totals[state.level]/150}%`;
  const upgrade=preview>state.level;
  const next=state.level<4?state.level+1:4;
  const cost=core.totals[next]-core.totals[state.level];
  $('actionHint').textContent=upgrade?`NEXT UNLOCK: ${core.names[next]} AURA`:preview===state.equipped?'ALREADY EQUIPPED':'CHANGE EQUIPPED AURA';
  $('actionCost').textContent=upgrade?`${cost} SHARDS`:'FREE';
  $('auraAction').textContent=upgrade?`UNLOCK ${core.names[next]} AURA`:preview===state.equipped?'EQUIPPED':`EQUIP ${core.names[preview]} AURA`;
  $('auraAction').disabled=working||preview===state.equipped||upgrade&&shards()<cost;
  $('auraAction').dataset.action=upgrade?'upgrade':'equip';
 }
 async function loadCatalog(){try{const d=window.RPG_GACHA_CATALOG||await fetch('gacha_catalog.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Missing catalog');return r.json()});if(!Array.isArray(d.characters))return;
   catalog=d.characters.filter(x=>safeId(x?.id)&&[4,5,6].includes(x.rarity)).map(x=>({id:x.id,name:String(x.name||x.id).slice(0,70),rarity:`${x.rarity}★`,img:/^assets\/recruitment\/[a-z0-9_-]+\.(?:png|webp|jpg|avif)$/.test(x.art||'')?x.art:null}));
  }catch(e){console.warn('Operator catalog unavailable:',e);}}
 async function refresh(){const result=await cloud.call('/api/profile',{card_code:code});player=result;render();}
 async function initialize(){
  if(!cloud){notice('Firebase bridge unavailable.');return;}
  if(!await cloud.ready){notice('Firebase connection unavailable.');return;}
  const context=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
  code=String(context.card_code||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
  if(window.RPG_AURA_DEMO)code='AAAAAAAAAAAAAAAA';
  if(!/^[A-HJ-NP-Z2-9]{16}$/.test(code)){document.getElementById('characterList').textContent='Open Adventure with your card first.';notice('Open Adventure with your card, then return to Aura Workshop.');return;}
  try{await loadCatalog();await refresh();notice('Auras are cosmetic. Your shared shard balance is saved in Firebase.');}
  catch(e){notice(e?.message||'Could not load your operator collection.');}
 }
 document.getElementById('characterList').addEventListener('click',e=>{const target=e.target.closest('[data-char]');if(!target||working)return;selected=target.dataset.char;preview=core.state(player?.recruitment?.auras?.[selected]).equipped;notice('');render();restoreSelectedFocus('#characterList [data-char]','char',selected)});
 document.getElementById('tierList').addEventListener('click',e=>{const target=e.target.closest('[data-tier]');if(!target||working)return;preview=Number(target.dataset.tier);notice(preview>current().level?'Preview only — unlock tiers in order.':'');render();restoreSelectedFocus('#tierList [data-tier]','tier',preview)});
 $('auraAction').addEventListener('click',async()=>{
  if(!player||working)return;const state=current(),action=preview>state.level?'upgrade':'equip';const target=preview;
  let proposal;try{proposal=core.change(action,state,shards(),target);}catch(e){notice(e.message);return;}
  if(action==='upgrade'&&!window.confirm(`Spend ${proposal.spent} Character Shards to unlock ${core.names[proposal.level]} Aura for ${characters.find(c=>c.id===selected)?.name||selected}?`))return;
  working=true;render();notice('SAVING AURA TO FIREBASE…');
  try{
   const r=await cloud.call('/api/aura/change',{card_code:code,character_id:selected,action,target});
   player.recruitment.shards=r.shards;player.recruitment.auras=r.auras;
   preview=r.equipped;notice(action==='upgrade'?`UNLOCKED ${core.names[r.level]} AURA · ${r.spent} SHARDS SPENT`:`EQUIPPED ${core.names[r.equipped]} AURA`);
  }catch(e){notice('SAVE FAILED · '+(e?.message||'Try again.'));try{await refresh()}catch{}}
  finally{working=false;render();}
 });
 void initialize();
})();
