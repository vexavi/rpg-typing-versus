/* RPG Typing Versus — "Tactical Terminal" theme helpers (v1).
 * Purely presentational: decorates the Mode Select menu the engine builds
 * (tile codes, Japanese sublabels, icons, lock reasons) and adds a status bar.
 * It never creates or removes game buttons and never changes their handlers.
 */
(()=>{
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  // Original line icons (24×24, stroke = currentColor).
  const ICONS={
    conquest:'<path d="M5 21V3"/><path d="M5 4h11l-2.5 4L16 12H5"/>',
    normal:'<path d="M4 20 15 9"/><path d="M15 9l3-5 2 2-5 3"/><path d="M6.5 14.5l3 3"/><path d="M3 21l2-2"/>',
    practice:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>',
    challenge:'<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9"/><path d="M12 13l3 2"/><path d="M9.5 3h5"/><path d="M12 3v2.5"/>',
    shared:'<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 19c.8-3 2.9-4.5 5.5-4.5s4.7 1.5 5.5 4.5"/><path d="M13.5 15c.9-.4 1.9-.5 3-.5 2.6 0 4.4 1.5 5 4.5"/>',
    recruit:'<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c.9-3.6 3.4-5.5 6.5-5.5 1.6 0 3 .5 4.1 1.4"/><path d="M18 13v7"/><path d="M14.5 16.5h7"/>',
    collection:'<rect x="3.5" y="4" width="5" height="16"/><rect x="9.5" y="4" width="5" height="16"/><rect x="15.5" y="4" width="5" height="16"/><path d="M3.5 15l5-3M9.5 15l5-3M15.5 15l5-3"/>',
    aura:'<path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"/>',
    rankings:'<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-6"/><path d="M2.5 20.5h19"/>',
    tournament:'<rect x="3.5" y="3.5" width="6.5" height="6.5"/><rect x="14" y="3.5" width="6.5" height="6.5"/><rect x="3.5" y="14" width="6.5" height="6.5"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 20.5h1.5M20.5 14v1.5"/>',
    reconnect:'<path d="M20 11a8 8 0 0 0-14.6-4.4"/><path d="M4 4v3.5h3.5"/><path d="M4 13a8 8 0 0 0 14.6 4.4"/><path d="M20 20v-3.5h-3.5"/>',
    generic:'<rect x="4" y="4" width="16" height="16"/><path d="M8 12h8"/>',
    lock:'<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
  };
  const TILES={
    'Normal Mode':{key:'normal',code:'01',jp:'通常戦闘',en:'STANDARD OPERATION'},
    'Adventure':{key:'conquest',code:'03',jp:'冒険',en:'CAMPAIGN'},
    'Practice':{key:'practice',code:'02',jp:'練習',en:'TRAINING'},
    'All Grades Challenge':{key:'shared',code:'04',jp:'全学年チャレンジ',en:'SHARED RANKED'},
    'Recruitment':{key:'recruit',code:'05',jp:'採用',en:'RECRUIT OPERATORS'},
    'Collection':{key:'collection',code:'06',jp:'図鑑',en:'OPERATORS · AURAS'},
    'Rankings':{key:'rankings',code:'07',jp:'ランキング',en:'LEADERBOARD'},
    'Tournament':{key:'tournament',code:'08',jp:'大会',en:'QR ENTRY'},
    'Reconnect':{key:'reconnect',code:'09',jp:'再接続',en:'GO ONLINE'}
  };
  const svg=(name,cls)=>{
    const el=document.createElementNS(NS,'svg');
    el.setAttribute('viewBox','0 0 24 24');el.setAttribute('fill','none');el.setAttribute('stroke','currentColor');
    el.setAttribute('stroke-width','1.6');el.setAttribute('stroke-linecap','square');el.setAttribute('aria-hidden','true');
    el.innerHTML=ICONS[name]||ICONS.generic;
    if(cls){const wrap=document.createElement('span');wrap.className=cls;wrap.setAttribute('aria-hidden','true');wrap.appendChild(el);return wrap;}
    return el;
  };
  const span=(cls,text)=>{const s=document.createElement('span');s.className=cls;if(text!=null)s.textContent=text;s.setAttribute('aria-hidden','true');return s;};

  function decorateCard(card){
    if(card.dataset.akDecorated==='1')return;
    const title=card.querySelector('.title')?.textContent?.trim()||'';
    const meta=TILES[title];
    card.dataset.akDecorated='1';
    if(meta)card.dataset.akTile=meta.key;
    const mystery=card.disabled&&card.dataset.mystery==='1';
    const icon=meta&&!mystery?meta.key:'generic';
    card.prepend(span('ak-tile-code',meta?meta.code:'··'));
    card.appendChild(svg(icon,'ak-tile-icon'));
    card.appendChild(svg(icon,'ak-tile-mark'));
    if(meta){
      const sub=span('ak-tile-sub');
      const jp=document.createElement('b');jp.textContent=mystery?'???':meta.jp;
      const en=document.createElement('small');en.textContent=mystery?'???':meta.en;
      sub.append(jp,en);card.appendChild(sub);
    }
    if(card.disabled){
      const lock=span('ak-tile-lock');
      lock.appendChild(svg('lock'));
      // Short badge text; the full reason stays in the button's tooltip / aria-label.
      const reason=card.title||'';
      const short=/online/i.test(reason)?'ONLINE ONLY':/clear normal/i.test(reason)?'CLEAR NORMAL MODE':/qr/i.test(reason)?'TEACHER QR':'LOCKED';
      lock.appendChild(document.createTextNode(mystery?'???':short));
      card.appendChild(lock);
    }
    // Locked-until-Normal-is-cleared modes show only question marks.
    if(mystery){card.classList.add('ak-mystery');const t=card.querySelector('.title');if(t)t.textContent='???';}
  }

  // Only write when the value changes: every DOM write re-triggers the observer.
  const setText=(el,v)=>{if(el&&el.textContent!==v)el.textContent=v;};
  let clockTimer=0;
  function pad(n){return String(n).padStart(2,'0');}
  function updateClock(hud){
    const d=new Date();
    const t=hud.querySelector('.ak-hud-clock b'),s=hud.querySelector('.ak-hud-clock small');
    setText(t,`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setText(s,`${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`);
  }
  function readText(id){return document.getElementById(id)?.textContent?.trim()||'';}
  function fillHud(hud){
    const name=readText('playerLabel')||readText('introProfileName')||'Player';
    const lv=readText('playerLevelText')||readText('introProfileLevel');
    const expText=(document.querySelector('.uiRow .playerExp')?.textContent||readText('introProfileExp')||'').trim();
    const m=expText.match(/(\d+)\s*\/\s*(\d+)/);
    const pct=m&&Number(m[2])>0?Math.max(0,Math.min(100,Number(m[1])/Number(m[2])*100)):0;
    const icon=document.getElementById('playerIcon')?.getAttribute('src')||document.getElementById('introProfileIcon')?.getAttribute('src')||'';
    setText(hud.querySelector('.ak-hud-name-text'),name);
    setText(hud.querySelector('.ak-hud-lv'),lv);
    setText(hud.querySelector('.ak-hud-exp em'),m?`EXP ${m[1]}/${m[2]}`:'EXP');
    hud.querySelector('.ak-hud-exp i').style.setProperty('--ak-exp',pct.toFixed(1)+'%');
    const img=hud.querySelector('.ak-hud-avatar');
    if(icon&&img.getAttribute('src')!==icon)img.setAttribute('src',icon);
    if(img.hidden!==!icon)img.hidden=!icon;
    const local=!!document.getElementById('localPracticeNotice')||window.RPG_V66_DISCONNECTED===true;
    const link=hud.querySelector('.ak-hud-link');
    link.classList.toggle('is-local',local);
    setText(link,local?'LOCAL':'ONLINE');
  }
  function buildHud(){
    const hud=document.createElement('div');
    hud.className='ak-home-hud';hud.setAttribute('aria-hidden','true');
    hud.innerHTML=`<div class="ak-hud-brand"><b>RPG TYPING VERSUS</b><small>ADVENTURE TERMINAL</small></div>
      <div class="ak-hud-player"><img class="ak-hud-avatar" alt="" decoding="async"><div class="ak-hud-id">
        <div class="ak-hud-name"><span class="ak-hud-name-text"></span><span class="ak-hud-lv"></span></div>
        <div class="ak-hud-exp"><i></i><em></em></div></div></div>
      <div class="ak-hud-spacer"></div><div class="ak-hud-link">ONLINE</div>
      <div class="ak-hud-clock"><b>--:--</b><small></small></div>`;
    hud.querySelector('.ak-hud-exp em').style.fontStyle='normal';
    return hud;
  }

  // The overlay lives inside the battlefield's stacking context, so the bottom HUD
  // paints over it. Publish the HUD height so dialogue and banners sit above it.
  function measureHud(){
    const row=document.querySelector('.uiRow');
    let h=0;
    if(row&&getComputedStyle(row).display!=='none'){const r=row.getBoundingClientRect();h=Math.max(0,Math.round(window.innerHeight-r.top));}
    const v=h+'px';
    if(document.documentElement.style.getPropertyValue('--ak-hud-h')!==v)document.documentElement.style.setProperty('--ak-hud-h',v);
  }
  function sync(){
    const overlay=document.getElementById('overlay');
    if(!overlay)return;
    if(overlay.dataset.state&&overlay.dataset.state!=='modeselect')measureHud();
    const box=overlay.querySelector('.overlayBox');
    const home=overlay.classList.contains('mode-select-active')&&box?.classList.contains('modeSelectMenu');
    let hud=box?.querySelector(':scope > .ak-home-hud');
    if(!home){
      hud?.remove();
      if(clockTimer){clearInterval(clockTimer);clockTimer=0;}
      return;
    }
    if(!hud){hud=buildHud();box.prepend(hud);}
    fillHud(hud);updateClock(hud);
    if(!clockTimer)clockTimer=setInterval(()=>{const h=document.querySelector('#overlay .ak-home-hud');if(h)updateClock(h);},20000);
    const choices=box.querySelector('.overlayChoices');
    if(choices){
      choices.querySelectorAll('.student-mode-card').forEach(decorateCard);
      choices.classList.toggle('ak-no-reconnect',!choices.querySelector('[data-ak-tile="reconnect"]'));
    }
    const show=box.querySelector('.operator-showcase');
    const opName=show?.querySelector('.operator-hero-name')?.textContent?.trim()||'';
    if(show&&show.dataset.akName!==opName)show.dataset.akName=opName;
  }

  // ---- Screen-to-screen shutter wipe ----------------------------------------
  // Plays when the player moves between major screens. The new screen is already
  // rendered underneath; the shutter covers it on the first frame, holds briefly,
  // then sweeps away diagonally. It never intercepts clicks or keys.
  const LABELS={home:'MODE SELECT',conquest:'ADVENTURE',squad:'SQUAD ASSEMBLY',battle:'OPERATION START',intro:'RPG TYPING VERSUS',rankings:'RANKINGS',result:''};
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let shutter=null,lastScreen=null,shutterTimer=0;
  function currentScreen(){
    if(document.getElementById('introOverlay')?.classList.contains('show'))return 'intro';
    const squad=document.getElementById('storySquadSelectScreen');
    if(squad&&!squad.hidden)return 'squad';
    const story=document.getElementById('storyRoot');
    if(story&&!story.hidden&&story.childElementCount)return 'conquest';
    const ov=document.getElementById('overlay');
    if(ov?.classList.contains('show')){
      if(ov.classList.contains('mode-select-active'))return 'home';
      if(ov.querySelector('.overlayBox.rankings-card'))return 'rankings';
      if(ov.classList.contains('defeat-active')||ov.dataset.state==='victory')return 'result';
    }
    if(document.getElementById('adventureGate'))return 'gate';
    return 'battle';
  }
  function playShutter(label){
    if(reduceMotion?.matches)return;
    if(!shutter){
      shutter=document.createElement('div');shutter.className='ak-shutter';shutter.setAttribute('aria-hidden','true');
      shutter.innerHTML='<i class="ak-sh-main"></i><i class="ak-sh-line"></i><i class="ak-sh-edge"></i><div class="ak-sh-label"></div>';
      document.body.appendChild(shutter);
    }
    shutter.querySelector('.ak-sh-label').textContent=label||'';
    shutter.classList.remove('is-on');void shutter.offsetWidth;shutter.classList.add('is-on');
    clearTimeout(shutterTimer);shutterTimer=setTimeout(()=>shutter.classList.remove('is-on'),640);
  }
  function checkScreen(){
    const next=currentScreen();
    if(next===lastScreen)return;
    const prev=lastScreen;lastScreen=next;
    if(next==='gate')return;
    // Results get their own banner entrance; continuing after defeat should feel instant.
    if((prev==='battle'&&next==='result')||(prev==='result'&&next==='battle'))return;
    if(prev===null&&!['home','intro'].includes(next))return;
    playShutter(LABELS[next]);
  }

  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{sync();checkScreen();}catch(e){console.warn('ak-theme',e);}});};
  function start(){
    const overlay=document.getElementById('overlay');
    if(!overlay)return;
    new MutationObserver(schedule).observe(overlay,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','data-state']});
    window.addEventListener('resize',()=>{measureHud();schedule();},{passive:true});
    // Watch the other full-screen layers (attributes / direct children only — never the
    // word lane, which mutates every frame during play).
    const screenObserver=new MutationObserver(schedule);
    const watched=new WeakSet();
    const watch=(id,opts)=>{const el=document.getElementById(id);if(el&&!watched.has(el)){watched.add(el);screenObserver.observe(el,opts);}};
    const watchAll=()=>{
      watch('introOverlay',{attributes:true,attributeFilter:['class']});
      watch('storyRoot',{attributes:true,attributeFilter:['hidden'],childList:true}); // added later by story-mode.js
      watch('storySquadSelectScreen',{attributes:true,attributeFilter:['hidden']});
    };
    watchAll();
    new MutationObserver(()=>{watchAll();schedule();}).observe(document.body,{childList:true});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
