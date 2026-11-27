(() => {
 'use strict';
 const root=document.getElementById('app'),$=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const params=new URLSearchParams(location.search);
 const session=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')||{}}catch{return {}}})();
 let code=cleanCode(params.get('card')||session.card_code||''),player=null,mode='server',draft=null,section='overview',editor='',notice='',busy=false;
 let editorTrigger=null,showcaseSlot=0;
 let chars=[{id:'mc',name:'Player',img:(window.RPG_MEDIA?.url('assets/characters/mc.webp')||'assets/characters/mc.webp')}];
 const backgrounds=[{id:'default',name:'Guild Grid',locked:false},{id:'horizon',name:'Horizon',locked:true},{id:'ruins',name:'Ruins',locked:true},{id:'afterglow',name:'Afterglow',locked:true}];
 const themes=[{id:'signal',name:'Signal',color:'#f0f500'},{id:'steel',name:'Steel',color:'#e1e2e5'},{id:'amber',name:'Amber',color:'#ffcf60'},{id:'frost',name:'Frost',color:'#91e4ff'}];
 const defaults=()=>({nickname:'',motto:'',theme:'signal',featured:'mc',background:'default',showcase:['mc','']});
 // Custom portrait assets are explicit opt-ins; no fallback to cropped full-body artwork.
 const customIconIds=new Set(['alden','anodyne','aveline','cassian','crossbow','elise','hound','isolde','kade','livia','lupa','mc','mira','nora','seraphine','shield','hexaxe','nitrate','tavi','vern','vex','kurone']);
 function customIcon(id){return customIconIds.has(id)?`assets/profile-icons/${id}.webp`:'';}
 function iconMarkup(ch,klass='showcase-custom-icon'){
  const url=customIcon(ch?.id);
  return url?`<img class="${klass}" src="${url}" alt="" loading="lazy" decoding="async">`:'';
 }
 function cleanCode(s){return String(s||'').toUpperCase().replace(/[^A-Z2-9]/g,'')}
 const num=n=>Math.max(0,Math.trunc(Number(n)||0));
 const storageKey=(s,id)=>`${s}__${String(id||'guest').replace(/[^\w-]/g,'').slice(0,32)}`;
 const localId=()=>localStorage.getItem('rpgAdventureOfflinePlayerId')||'LOCAL_DEVICE';
 function localAdventure(id){const get=k=>{try{return localStorage.getItem(storageKey(k,id))}catch{return null}};let v={};try{v=JSON.parse(get('bossTyping_profile_v1')||'{}')||{}}catch{}
  return {xp:num(v.xp),coins:num(v.coins),best_normal:num(get('bossTyping_hiScore_normal_v1')),normal_clear:get('bossTyping_normalCleared_v1')==='1',achievements:Array.isArray(v.achievements)?v.achievements.filter(x=>typeof x==='string'&&!['extra_clear','master_clear'].includes(x)).slice(0,100):[]};}
 function mergeAdv(a={},b={}){return {...a,...b,xp:Math.max(num(a.xp),num(b.xp)),best_normal:Math.max(num(a.best_normal),num(b.best_normal)),normal_clear:!!(a.normal_clear||b.normal_clear),achievements:[...new Set([...(a.achievements||[]),...(b.achievements||[])])].filter(x=>!['extra_clear','master_clear'].includes(x)),coins:num(b.coins??a.coins)}}
 function levelOf(xp){return Math.max(1,Math.floor((-39+Math.sqrt(39*39+8*xp))/2)+1)}
 function xpNeed(level){let n=level-1;return n*(39+n)/2}
 function date(ts){return ts?new Date(ts*1000).toLocaleDateString():'—'}
 async function loadOwnedOperators(){
  if(!player)return;
  const keys=new Set(Object.keys(player.recruitment?.owned||{}).filter(id=>!retired.has(id)));
  try{
   const response=await fetch('gacha_catalog.json',{cache:'no-cache'});
   if(!response.ok)return;
   const catalog=(await response.json()).characters||[];
   const starters=chars.filter(x=>x.id==='mc');
   chars=[...starters,...catalog.filter(x=>keys.has(x.id)&&[4,5,6].includes(x.rarity)&&/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(x.art||'')).map(x=>({id:x.id,name:x.name,img:x.art}))];
  }catch(e){console.warn('Operator portraits unavailable:',e)}
 }
 function pick(id){return chars.find(x=>x.id===id)||chars[0]}
 const retired=new Set(['crimson_knight','silver_knight']); // Read-only migration for existing saves; never render these characters.
 function normalizedShowcase(list){
  const values=Array.isArray(list)?list:[];
  const available=new Set(chars.map(ch=>ch.id));
  const first=available.has(values[0])?values[0]:'mc';
  const second=available.has(values[1])&&values[1]!==first?values[1]:'';
  return [first,second];
 }
 function normalizeCosmetics(raw={}){
  const featured=chars.some(x=>x.id===raw.featured)?raw.featured:'mc';
  return {...defaults(),...raw,featured,showcase:normalizedShowcase(raw.showcase),background:'default'};
 }
 function getCosmeticCache(id){try{return JSON.parse(localStorage.getItem(storageKey('rpgProfileCosmetics',id))||'null')}catch{return null}}
 function setCosmeticCache(id,c){try{localStorage.setItem(storageKey('rpgProfileCosmetics',id),JSON.stringify(c))}catch{}}
 function cosmetics(p){const saved=getCosmeticCache(p.public_id),raw=p.cosmetics||saved||{};return normalizeCosmetics(raw)}
 function applyTheme(){document.body.className='profile-client theme-'+(themes.some(t=>t.id===player?.cosmetics?.theme)?player.cosmetics.theme:'signal')}
 async function api(path,body){const control=new AbortController(),timeout=setTimeout(()=>control.abort(),3600);try{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:control.signal}),j=await r.json();if(!r.ok)throw Error(j.error||'Request failed');return j}finally{clearTimeout(timeout)}}
 function localPlayer(){let id=localId();return {public_id:id,name:localStorage.getItem('rpgAdventureOfflineName')||'Adventurer',selected_character:'mc',adventure:localAdventure(id),tournament:{count:null,history:[],trophies:null},collection:{owned:['mc'],available:['mc']},recruitment:{status:'offline',permits:null,coins:null,pity_six:0,owned:{},catalog:[]}}}
 function profileStatus(title,message='',actions=''){
  root.innerHTML=`<section class="setup profile-gate"><small>PLAYER PROFILE</small><h1>${esc(title)}</h1><p>${esc(message)}</p>${actions}</section>`;
 }
 function login(error=''){
  applyTheme();
  root.innerHTML=`<section class="setup profile-gate"><small>ADVENTURE CARD</small><h1>OPEN PROFILE</h1>
  <p>Your profile uses the same Adventure Card as the game. Scan your card in Adventure if this is a new browser.</p>
  <a class="primary profile-gate-link" href="adventure.html">GO TO ADVENTURE</a>
  <form id="profile-login" class="loginform"><label>OR ENTER CARD CODE<input id="card-code" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" value="${esc(code.replace(/(.{4})/g,'$1-').replace(/-$/,''))}" required></label>
  <button class="smallbtn" type="submit">USE CARD</button></form><p class="error" role="alert">${esc(error)}</p></section>`;
 }
 async function waitFirebase(){
  if(!window.RPG_V66?.ready)throw Error('Firebase session is not initialized. Reload this page.');
  if(!await window.RPG_V66.ready)throw Error('Firebase connection unavailable. Check your connection and reload.');
 }
 async function setPlayer(next){
  player=next;mode='server';code=cleanCode(next.card_code||code);
  chars[0].name=String(next.name||'').trim()||'Player';
  notice='';await loadOwnedOperators();player.cosmetics=normalizeCosmetics(player.cosmetics||{});player.selected_character=player.cosmetics.featured;
  try{
   const current=JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')||{};
   const samePlayer=current.public_id===player.public_id;
   const context={...(samePlayer?current:{}),public_id:player.public_id,name:player.name,online:true,cloud:true,selected_character:player.selected_character};
   if(code)context.card_code=code;
   sessionStorage.setItem('rpgAdventureContext',JSON.stringify(context));
  }catch(_){/* Session storage may be disabled. */}
  render();
 }
 async function openCard(){
  if(!/^[A-HJ-NP-Z2-9]{16}$/.test(code)){login('Enter a valid card code.');return;}
  profileStatus('OPENING PROFILE','Checking your Adventure Card…');
  try{
   await waitFirebase();
   // Only explicitly supplied cards need linking. Existing players are read directly.
   await api('/api/adventure/card',{card_code:code});
   await setPlayer(await api('/api/profile',{card_code:code}));
  }catch(e){
   const message=String(e?.message||e);
   if(/enter your name to register|choose grade|registration/i.test(message)){
    profileStatus('FIRST-TIME SETUP','Finish registering this new card in Adventure before opening Profile.',`<a class="primary profile-gate-link" href="adventure.html?card=${encodeURIComponent(code)}">REGISTER IN ADVENTURE</a>`);
   }else if(/card not registered|card disabled|card not found|card code|invalid card/i.test(message))login(message);
   else profileStatus('PROFILE UNAVAILABLE',message,'<button class="primary" type="button" id="retry-profile">RETRY</button><a class="smallbtn profile-gate-link" href="adventure.html">BACK TO ADVENTURE</a>');
  }
 }
 async function restoreProfile(){
  if(!code){login('Scan your Adventure Card to sign in on this tab.');return;}
  profileStatus('LOADING PROFILE','Loading your saved Adventure Card session…');
  try{
   await waitFirebase();
   // Reuse the card code saved only for this browser tab by Adventure login.
   // Do not re-register, ask for a username, or prompt for a card again.
   if(params.has('card')){await openCard();return;}
   const next=await api('/api/profile',code?{card_code:code}:{});
   await setPlayer(next);
  }catch(e){
   const message=String(e?.message||e);
   if(/scan your Adventure Card first|card session expired|Adventure Card does not match your session/i.test(message)){
    if(code){
     // A fresh tab can have context from an earlier verified visit but no Firebase card session.
     await openCard();
    }else login('Open Adventure with your card once to connect your profile.');
   }else{
    profileStatus('PROFILE UNAVAILABLE',message,'<button class="primary" type="button" id="retry-profile">RETRY</button><a class="smallbtn profile-gate-link" href="adventure.html">BACK TO ADVENTURE</a>');
   }
  }
 }
 function metric(value,label){return `<div class="metric"><strong>${esc(value)}</strong><small>${esc(label)}</small></div>`}
 function trophyCount(){let t=player.tournament?.trophies;return t?num(t.gold)+num(t.silver)+num(t.bronze):null}
 function editorButton(field,label='EDIT'){return `<button type="button" class="editbtn" data-edit="${esc(field)}" aria-label="${esc(label)}" title="${esc(label)}">✎</button>`}
 function auraClass(id){const level=Number(player?.recruitment?.auras?.[id]?.equipped)||0;return 'aura-outline-'+(level>=0&&level<=4?level:0);}
 // Display dedicated icons only when provided. No full-body image crop or wrong-character fallback.
 function spotlight(){
  const selections=player.cosmetics.showcase.map(id=>id?chars.find(x=>x.id===id)||null:null);
  return `<div class="dark-card profile-showcase-card"><div class="section-top"><span class="mini-kicker">OPERATOR SHOWCASE · 02/04</span>${editorButton('showcase','Edit showcase')}</div>
   <div class="showcase-list" role="list" aria-label="Featured operator icon slots">
    ${selections.map((ch,i)=>`<div class="showcase-tile ${ch&&customIcon(ch.id)?'showcase-has-icon':'showcase-placeholder'}" role="listitem" aria-label="Slot ${i+1}: ${ch?esc(ch.name):'empty'}" title="${ch?esc(ch.name):'Empty slot'}">${ch?iconMarkup(ch):''}</div>`).join('')}
    <div class="showcase-tile locked" role="listitem" aria-label="Slot 3: locked"><span aria-hidden="true">+</span></div>
    <div class="showcase-tile locked" role="listitem" aria-label="Slot 4: locked"><span aria-hidden="true">+</span></div>
   </div></div>`;
 }

 function detailContent(){const a=player.adventure||{},t=player.tournament||{},rw=player.recruitment||{},hist=t.history||[];
  if(section==='adventure')return `<div class="detail-panel"><div class="record"><strong>Normal Campaign</strong><span>${a.normal_clear?'CLEARED':'IN PROGRESS'}</span></div><div class="record"><strong>Best Score · Normal</strong><span>${num(a.best_normal).toLocaleString()}</span></div><div class="record"><strong>Achievements</strong><span>${a.achievements?.length||0}</span></div>${a.achievements?.length?`<div class="subtext">${a.achievements.map(x=>esc(x.replaceAll('_',' '))).join(' · ')}</div>`:''}</div>`;
  if(section==='tournaments')return `<div class="detail-panel">${hist.length?hist.slice(0,12).map(r=>`<div class="record"><strong>${esc(date(r.date))} · ${esc(r.award?.toUpperCase())}</strong><span>#${num(r.place)} · ${num(r.score).toLocaleString()}</span></div>`).join(''):'<div class="subtext">No finalized tournament results yet.</div>'}</div>`;
  if(section==='characters')return `<div class="detail-panel">${player.cosmetics.showcase.filter(Boolean).map(id=>pick(id)).map(c=>`<div class="record"><strong>${esc(c.name)}</strong><span>${esc(['NONE','WHITE','AZURE','VIOLET','GOLD'][Number(player.recruitment?.auras?.[c.id]?.equipped)||0]||'NONE')} AURA</span></div>`).join('')}<div class="record"><strong>Character Shards</strong><span>${num(player.recruitment?.shards)}</span></div><a class="smallbtn" href="auras.html" style="display:inline-block;margin-top:10px">OPEN AURA WORKSHOP ✦</a> <button class="smallbtn" data-edit="featured" style="margin-top:10px">CHANGE FEATURED</button></div>`;
  if(section==='recruitment')return `<div class="detail-panel"><div class="record"><strong>Guild Coins</strong><span>${num(rw.coins).toLocaleString()} · ${Math.floor(num(rw.coins)/100)} SINGLE PULL EQUIVALENT</span></div><div class="record"><strong>Recruitment</strong><span>FEATURED</span></div><a class="smallbtn" href="recruitment.html" style="display:inline-block;margin:10px 0;text-decoration:none">OPEN RECRUITMENT</a></div>`;
    return `<div class="detail-panel"><div class="subtext">Select Adventure, Tournaments, Characters, or Recruitment to view records.</div></div>`;
 }
 function render(){if(!player){login();return}applyTheme();const a=player.adventure||{},t=player.tournament||{},rw=player.recruitment||{},c=player.cosmetics||defaults();const level=levelOf(num(a.xp)),start=xpNeed(level),end=xpNeed(level+1),progress=Math.max(0,Math.min(100,100*(num(a.xp)-start)/(end-start||1)));const selected=pick(c.featured);const decorated=c.nickname||player.name;
  root.innerHTML=`<section class="hero-area"><p class="crumbs"><b>//</b> PLAYER PROFILE</p><div class="hero-grid"><div class="hero-left"><div class="identity"><div class="avatar"><img class="${auraClass(selected.id)}" src="${esc(selected.img)}" alt="${esc(selected.name)}"></div><div class="identity-text"><div class="edit-line"><strong class="player-name">${esc(decorated)}</strong>${editorButton('name','Edit display name')}</div><div class="idline">${esc(player.public_id)} <span aria-label="Player account">· ADVENTURE CARD</span></div><div class="edit-line"><p class="motto">${esc(c.motto||'')}</p>${editorButton('motto','Edit profile message')}</div><div class="meta"><span class="pill">FEATURED / ${esc(selected.name.toUpperCase())}</span>${editorButton('featured','Change featured character')}</div></div></div><div class="summary-row"><div class="summary-num"><b>${level}</b><small>ADVENTURE LV.</small></div><div class="summary-num"><b>${t.count??'—'}</b><small>TOURNAMENTS</small></div><div class="summary-num"><b>${player.collection?.owned?.length||1}</b><small>OPERATORS</small></div></div></div><div class="featured-stage" aria-label="Featured character: ${esc(selected.name)}"><div class="featured-stage-backdrop" aria-hidden="true"></div><img class="featured-stage-art ${auraClass(selected.id)}" src="${esc(selected.img)}" alt="${esc(selected.name)} full character portrait"><div class="featured-stage-label"><span>FEATURED OPERATOR</span><strong>${esc(selected.name)}</strong></div></div><div class="hero-right"><div class="dark-card progress-card"><div class="section-top"><span class="mini-kicker">ADVENTURE PROGRESS</span><span class="mini-kicker">LV. ${level}</span></div><div class="progress-value">${num(a.xp).toLocaleString()} <small>XP</small></div><div class="xpbar"><div style="width:${progress}%"></div></div><div class="xp-line"><span>${start.toLocaleString()} XP</span><span>NEXT LEVEL · ${end.toLocaleString()} XP</span></div></div>${spotlight()}</div></div></section>
  ${notice?`<div class="notice profile-inline-notice" role="status">${esc(notice)}</div>`:''}<div id="editor-root"></div>`;
  if(editor)renderEditor();
 }
 function editChoices(values,active){return values.map(v=>`<button class="pick ${v.id===active?'active':''}" type="button" data-option="${esc(v.id)}"><strong>${esc(v.name)}</strong>${v.img?`<img src="${esc(v.img)}" alt="">`:''}</button>`).join('')}
 function renderEditor(){const c=draft||player.cosmetics||defaults(),title={name:'Display Name',motto:'Profile Message',featured:'Featured Character',showcase:'Operator Showcase',background:'Background Editor',theme:'Profile Theme'}[editor]||'Customize';let content='';
  if(editor==='name')content=`<label class="field">DISPLAY NAME<input id="edit-name" class="edit-input" maxlength="20" autocomplete="off" value="${esc(c.nickname||player.name)}"><small>This is the name shown on your profile. Your Adventure Card login stays the same.</small></label>`;
  if(editor==='motto')content=`<label class="field">PROFILE MESSAGE<textarea id="edit-motto" class="edit-input" rows="3" maxlength="80">${esc(c.motto||'')}</textarea><small>Up to 80 characters.</small></label>`;
  if(editor==='featured')content=`<div class="field">CHOOSE FEATURED OPERATOR</div><div class="pick-grid">${chars.map(x=>`<button class="pick ${c.featured===x.id?'active':''}" aria-pressed="${c.featured===x.id}" type="button" data-featured="${x.id}"><img src="${x.img}" alt="" loading="lazy" decoding="async"><strong>${x.name}</strong><small>${x.id==='mc'?'DEFAULT CHARACTER':'RECRUITED · OWNED'}</small></button>`).join('')}</div>`;
  if(editor==='showcase')content=`<div class="field">SELECT A SLOT, THEN AN OWNED OPERATOR</div>
   <div class="showcase-edit-slots" role="group" aria-label="Choose showcase slot">${c.showcase.map((id,i)=>{const ch=id?chars.find(x=>x.id===id):null;return `<button type="button" class="pick showcase-edit-slot ${showcaseSlot===i?'active':''}" data-showcase-slot="${i}" aria-pressed="${showcaseSlot===i}">${ch?iconMarkup(ch):''}<strong>SLOT ${i+1}</strong><small>${esc(ch?.name||'EMPTY')}</small></button>`}).join('')}</div>
   <div class="showcase-edit-choices" role="group" aria-label="Owned operators">${chars.map(ch=>`<button type="button" class="pick showcase-edit-choice ${c.showcase[showcaseSlot]===ch.id?'active':''}" data-showcase-pick="${esc(ch.id)}" aria-pressed="${c.showcase[showcaseSlot]===ch.id}" ${c.showcase[1-showcaseSlot]===ch.id?'disabled title="Already assigned to the other slot"':''}>${iconMarkup(ch)}<strong>${esc(ch.name)}</strong></button>`).join('')}</div>
   <button class="smallbtn" type="button" id="clear-showcase">CLEAR SLOT</button> <button class="smallbtn" type="button" id="swap-showcase">⇄ SWAP ORDER</button>`;
  if(editor==='theme')content=`<div class="field">COLOR ACCENT</div><div class="theme-grid">${themes.map(x=>`<button class="pick ${c.theme===x.id?'active':''}" aria-pressed="${c.theme===x.id}" type="button" data-theme-choice="${x.id}"><span class="swatch" style="--swatch:${x.color}"></span><strong>${x.name.toUpperCase()}</strong></button>`).join('')}</div>`;
  if(editor==='background')content=`<div class="background-grid">${backgrounds.map(x=>`<button type="button" class="pick placeholder ${x.locked?'locked':''} ${c.background===x.id?'active':''}" ${x.locked?'disabled':''} data-background="${x.id}"><strong>${x.locked?'🔒':'✓'} ${esc(x.name.toUpperCase())}</strong><small>${x.locked?'LOCKED':'EQUIPPED'}</small></button>`).join('')}</div>`;
  $('editor-root').innerHTML=`<div class="dialog-back" id="edit-backdrop"><section class="editor" role="dialog" aria-modal="true" aria-labelledby="editor-title"><header><h2 id="editor-title">${esc(title)}</h2><button class="smallbtn" id="close-editor" type="button" aria-label="Close editor">×</button></header><div class="editor-body">${content}<div class="modalerror" id="editor-error" role="alert"></div></div><footer><button class="smallbtn" type="button" id="cancel-editor">CANCEL</button><button class="primary" type="button" id="save-editor" ${busy?'disabled':''}>SAVE</button></footer></section></div>`;
  if(editor==='name'&&$('edit-name'))$('edit-name').focus();
 }
 function errorEditor(text){if($('editor-error'))$('editor-error').textContent=text}
 function editorOpen(field){editorTrigger=document.activeElement;editor=field;showcaseSlot=0;draft={...defaults(),...player.cosmetics,showcase:[...player.cosmetics.showcase]};busy=false;renderEditor()}
 function editorClose(){editor='';draft=null;if($('editor-root'))$('editor-root').innerHTML='';if(editorTrigger?.isConnected)editorTrigger.focus({preventScroll:true});editorTrigger=null}
 function refocusOption(attribute,value){const list=root.querySelectorAll('button['+attribute+']');for(const button of list){if(button.getAttribute(attribute)===String(value)){button.focus({preventScroll:true});break}}}
 async function saveEditor(){if(!player||busy)return;const c={...defaults(),...draft};if(editor==='name'){c.nickname=String($('edit-name')?.value||'').trim();if(!c.nickname||c.nickname.length>20){errorEditor('Enter a display name (1–20 characters).');return}}
  if(editor==='motto'){c.motto=String($('edit-motto')?.value||'').trim();if(c.motto.length>80){errorEditor('Maximum 80 characters.');return}}
  if(!chars.some(x=>x.id===c.featured))c.featured='mc';
  if(!Array.isArray(c.showcase)||c.showcase.length!==2||c.showcase.some(id=>id&&!chars.some(ch=>ch.id===id))||(c.showcase[0]&&c.showcase[0]===c.showcase[1])){errorEditor('Choose two different owned operators, or leave a slot empty.');return}
  if(c.background!=='default'){errorEditor('Background locked.');return}
  busy=true;if($('save-editor'))$('save-editor').disabled=true;
  let status='';try{
    if(mode==='server'){
      const response=await api('/api/profile/customize',{card_code:code,nickname:c.nickname,motto:c.motto,theme:c.theme,background:'default',showcase:c.showcase,character:c.featured});
      c.nickname=response.cosmetics.nickname;c.motto=response.cosmetics.motto;c.theme=response.cosmetics.theme;c.showcase=response.cosmetics.showcase;c.featured=response.selected_character;
      status='PROFILE UPDATED · FIREBASE';
    }else if(mode==='cloud'){
      const cloud=await import('./cloud-api.js');await cloud.writeProfileCosmetics(code,c);status='PROFILE UPDATED · FIREBASE';
    }else{status='PROFILE SAVED · THIS DEVICE'}
  }catch(e){
    if(mode==='cloud'&&String(e?.code||'').includes('permission-denied')){status='SAVED ON THIS DEVICE · PUBLISH UPDATED FIRESTORE RULES FOR CLOUD SYNC'}
    else{busy=false;if($('save-editor'))$('save-editor').disabled=false;errorEditor(e?.message||'Save failed.');return}
  }
  player.cosmetics=c;player.selected_character=c.featured;setCosmeticCache(player.public_id,c);notice=status;busy=false;editorClose();render();
 }
 async function syncAdventure(){if(mode!=='server'||!code)return;const a=player.adventure||{};try{await api('/api/adventure/progress',{card_code:code,action:'save',xp:num(a.xp),best_normal:num(a.best_normal),normal_clear:!!a.normal_clear,achievements:a.achievements||[]});const p=await api('/api/profile',{card_code:code});p.cosmetics=player.cosmetics;player=p;notice='ADVENTURE PROGRESS SYNCED';render()}catch(e){notice=e.message||'Sync failed';render()}}
 async function pullTen(){window.location.href='recruitment.html';return; if(mode!=='server'||!code)return;try{const result=await api('/api/recruitment/pull',{card_code:code,banner:'featured'});const p=await api('/api/profile',{card_code:code});p.cosmetics=player.cosmetics;player=p;notice='RECRUITMENT (LOCKED) · '+(result.results||[]).map(x=>`${x.rarity}★ ${x.name||x.id}${x.duplicate?' (DUPE)':''}`).join(' · ');render()}catch(e){notice=e.message||'Recruitment failed';render()}}
 async function exchangeCoins(){notice='EXCHANGE DISABLED IN ZERO-COST EDITION';render();return; if(mode!=='server'||!code)return;try{await api('/api/recruitment/exchange',{card_code:code});const p=await api('/api/profile',{card_code:code});p.cosmetics=player.cosmetics;player=p;notice='10 PERMITS ADDED';render()}catch(e){notice=e.message||'Exchange failed';render()}}
 function rememberModeReturn(){
  try{
    if(player){
      let existing={};
      try{existing=JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')||{}}catch(_){/* no context */}
      const identity={...(existing.public_id===player.public_id?existing:{}),public_id:player.public_id,name:player.name,selected_character:player.selected_character,online:true,cloud:true};
      if(code)identity.card_code=code;
      sessionStorage.setItem('rpgAdventureContext',JSON.stringify(identity));
    }
    sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');
  }catch(_){/* Browser storage disabled: Adventure will show login normally. */}
 }
 document.addEventListener('click',e=>{
  if(e.target.closest('a[data-return-modes="1"]'))rememberModeReturn();
 });
 root.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.edit){editorOpen(b.dataset.edit);return}
  if(b.id==='close-editor'||b.id==='cancel-editor'){editorClose();return}
  if(b.id==='save-editor'){void saveEditor();return}
  if(b.dataset.featured){draft.featured=b.dataset.featured;renderEditor();refocusOption('data-featured',draft.featured);return}
  if(b.dataset.themeChoice){draft.theme=b.dataset.themeChoice;renderEditor();refocusOption('data-theme-choice',draft.theme);return}
  if(b.dataset.showcaseSlot!==undefined){showcaseSlot=Number(b.dataset.showcaseSlot)===1?1:0;renderEditor();refocusOption('data-showcase-slot',showcaseSlot);return}
  if(b.dataset.showcasePick){const id=b.dataset.showcasePick;if(draft?.showcase&&chars.some(ch=>ch.id===id)&&draft.showcase[1-showcaseSlot]!==id){draft.showcase[showcaseSlot]=id;renderEditor();refocusOption('data-showcase-pick',id)}return}
  if(b.id==='clear-showcase'){draft.showcase[showcaseSlot]='';renderEditor();refocusOption('data-showcase-slot',showcaseSlot);return}
  if(b.id==='swap-showcase'){draft.showcase=[...draft.showcase].reverse();renderEditor();return}
  if(b.dataset.background){if(b.dataset.background==='default'){draft.background='default';renderEditor();refocusOption('data-background',draft.background)}return}
  if(b.id==='change-card'){sessionStorage.removeItem('rpgAdventureContext');sessionStorage.removeItem('rpgReturnToAdventureModeSelect');window.location.assign('adventure.html?switch=1');return}

  // Progress is synchronized automatically through the authenticated Firebase API.
  if(b.id==='exchange-coins'){void exchangeCoins();return}
  if(b.id==='do-ten-pull'){void pullTen();return}
 });
 // If a custom file is missing, leave a neat blank slot instead of a broken-image icon.
 root.addEventListener('error',e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.classList.contains('showcase-custom-icon'))return;const tile=img.closest('.showcase-tile');if(tile){tile.classList.remove('showcase-has-icon');tile.classList.add('showcase-placeholder')}img.remove();},true);
 root.addEventListener('submit',e=>{if(e.target.id==='profile-login'){e.preventDefault();code=cleanCode($('card-code').value);void openCard()}});
 root.addEventListener('click',e=>{if(e.target.closest('#retry-profile'))void restoreProfile();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&editor){editorClose()}});
 void restoreProfile();
})();
