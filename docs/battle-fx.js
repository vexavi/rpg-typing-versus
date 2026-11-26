/* RPG Typing Versus — battle effects (v148.5).
 * Presentation only. The engine calls RPG_FX at a few points (correct word,
 * player damage, operator passives, special impacts); nothing here changes
 * scoring, damage, timers or which words exist. Every effect is a short-lived
 * element animated with transform/opacity and removed when it finishes.
 */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const RULES=()=>window.RPG_OPERATOR_PASSIVES?.RULES||{};
  // Face points (percent of deployment art) used to frame 6★ cut-ins.
  const FACE={alden:[45.2,10.7],anodyne:[46.7,9.0],aveline:[59.8,10.2],cassian:[59.4,19.9],crossbow:[51.2,10.7],elise:[48.5,12.2],hexaxe:[51.7,10.0],hound:[65.2,33.7],isolde:[50.6,14.3],kade:[49.4,10.0],livia:[44.2,14.7],lupa:[79.2,20.0],mira:[51.7,10.2],nitrate:[40.8,19.7],nora:[48.1,12.4],seraphine:[57.3,9.9],shield:[38.5,12.2],tavi:[52.5,21.3],vern:[39.8,15.9],vex:[56.2,9.7]};
  // 4★ operators (and the default character) share the standard strike.
  const THEMES={
    std:      {kind:'std',     c1:'#2cc5f6',c2:'#eafcff',c3:'#0b5f86',bg:'#06202c',band:'#06202c'},
    aveline:  {kind:'thrust',  c1:'#6ea8ff',c2:'#eef4ff',c3:'#ffd36a',bg:'#0d1d3d',band:'#0d1d3d',skill:'WEAK POINT ANALYSIS'},
    isolde:   {kind:'ice',     c1:'#8fe3ff',c2:'#ffffff',c3:'#3c79d8',bg:'#0b2a48',band:'#0b2a48',skill:'FROZEN DOMAIN'},
    shield:   {kind:'bash',    c1:'#f2b632',c2:'#fff1c4',c3:'#3a2a08',bg:'#2a1f05',band:'#2a1f05',skill:'SHIELD ADVANCE'},
    hexaxe:   {kind:'hex',     c1:'#b06cff',c2:'#f3e6ff',c3:'#4b1c78',bg:'#1e0a33',band:'#1e0a33',skill:'CHAIN CLEAVE'},
    crossbow: {kind:'bolt',    c1:'#ff7a2a',c2:'#ffe6cc',c3:'#ff3b30',bg:'#2a1206',band:'#2a1206',skill:'SHOW-OFF'},
    anodyne:  {kind:'vial',    c1:'#38e0bd',c2:'#e4fff8',c3:'#2a6cff',bg:'#062a24',band:'#062a24',skill:'EXPERIMENTAL MEDICINE'},
    seraphine:{kind:'phantom', c1:'#ff4567',c2:'#f4ecff',c3:'#7d0f2a',bg:'#2a0612',band:'#2a0612',skill:'PHANTOM EXECUTION'},
    tavi:     {kind:'foxfire', c1:'#ffae35',c2:'#fff3c9',c3:'#ff5a1f',bg:'#3a1605',band:'#e0621c',skill:'FOXFIRE REWIND'},
    lupa:     {kind:'claw',    c1:'#ff2e4d',c2:'#e9edff',c3:'#4a0c18',bg:'#2a0610',band:'#6a0b1f',skill:'MOONLIT AMBUSH'},
    nitrate:  {kind:'blast',   c1:'#ffd21a',c2:'#ff6a1a',c3:'#141414',bg:'#141414',band:'#1a1a1a',skill:'WRATH'},
    hound:    {kind:'fang',    c1:'#e3122f',c2:'#ffb3bd',c3:'#26050a',bg:'#1c0306',band:'#5a0611',skill:'BLOOD HUNT'},
    cassian:  {kind:'decree',  c1:'#f6c84c',c2:'#fff6d6',c3:'#1e2d74',bg:'#121c4f',band:'#1a2a78',skill:'SOVEREIGN’S DECREE'}
  };
  const rarityOf=id=>Number(RULES()[id]?.rarity)||0;
  const nameOf=id=>String(RULES()[id]?.name||'').toUpperCase();
  function theme(id){
    const r=rarityOf(id);
    const t=r>=5&&THEMES[id]?THEMES[id]:THEMES.std;
    return {...t,id,tier:r>=6?6:r>=5?5:4};
  }

  // ---------- layers ----------
  let layer=null,hud=null,laneBack=null,laneFront=null,reticle=null;
  const MAX_NODES=90;
  function ensure(){
    const bf=$('battlefield');if(!bf)return null;
    if(!layer||!layer.isConnected){
      layer=document.createElement('div');layer.className='fx-layer';layer.setAttribute('aria-hidden','true');
      bf.insertBefore(layer,$('overlay')||null);
    }
    if(!hud||!hud.isConnected){
      hud=document.createElement('div');hud.className='fx-hud';hud.setAttribute('aria-hidden','true');
      document.body.appendChild(hud);
    }
    const lane=$('wordLane');
    if(lane){
      if(!laneBack||laneBack.parentNode!==lane){laneBack=document.createElement('div');laneBack.className='fx-lane';laneBack.setAttribute('aria-hidden','true');lane.prepend(laneBack);}
      if(!laneFront||laneFront.parentNode!==lane){laneFront=document.createElement('div');laneFront.className='fx-lane-front';laneFront.setAttribute('aria-hidden','true');lane.appendChild(laneFront);}
    }
    return bf;
  }
  function rel(r){
    const b=$('battlefield')?.getBoundingClientRect();
    if(!r||!b)return null;
    return {x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height};
  }
  function relEl(e){return e?rel(e.getBoundingClientRect()):null;}
  function px(v){return typeof v==='number'?`${Math.round(v*10)/10}px`:v;}
  function node(cls,parent,vars,html){
    const e=document.createElement('div');e.className=cls;
    if(vars)for(const k in vars)if(vars[k]!=null)e.style.setProperty('--'+k,px(vars[k]));
    if(html!=null)e.innerHTML=html;
    parent.appendChild(e);return e;
  }
  function life(e,ms){setTimeout(()=>e.remove(),ms);return e;}
  function busy(){return !layer||layer.childElementCount>MAX_NODES;}
  function colors(th){return {c1:th.c1,c2:th.c2,c3:th.c3,bg:th.bg||'#06202c',band:th.band||th.bg||'#06202c'};}
  function restart(e,cls){if(!e)return;e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls);}

  function bossPoint(){
    const img=$('bossImg'),fb=$('bossFallback');
    const target=img&&img.style.display==='block'&&img.naturalWidth?img:(fb&&fb.offsetParent?fb:document.querySelector('.bossWrap'));
    const r=relEl(target);if(!r||!r.w)return null;
    if(target===img){
      // object-fit: contain + bottom alignment: aim at the upper body of the drawn sprite.
      const ratio=img.naturalWidth/img.naturalHeight,boxRatio=r.w/r.h;
      const drawnH=ratio>boxRatio?r.w/ratio:r.h;
      return {x:r.x+r.w/2,y:r.y+r.h-drawnH*0.58,size:Math.min(r.w,drawnH)};
    }
    return {x:r.x+r.w/2,y:r.y+r.h*0.42,size:Math.min(r.w,r.h)*1.4};
  }
  // Area to the right of the word lane (where the boss stands) for banners and cut-ins.
  function stageArea(){
    const bf=$('battlefield'),lane=relEl($('wordLane')),bw=relEl(document.querySelector('.bossWrap'));
    if(!bf)return null;
    const W=bf.clientWidth,H=bf.clientHeight;
    let left=lane?lane.x+lane.w+14:W*0.4,right=W-10;
    if(right-left<240&&bw){left=bw.x;right=bw.x+bw.w;}
    if(right-left<200){left=W*0.25;right=W-10;}
    return {x:left,w:right-left,y:bw?bw.y:H*0.05,h:bw?bw.h:H*0.9,H};
  }

  // ---------- HP chip (the pale segment that drains after a hit) ----------
  function chip(meterId,fillId,delay){
    const meter=$(meterId),fill=$(fillId);if(!meter||!fill)return;
    let c=meter.querySelector(':scope>.fx-chip');
    if(!c){c=document.createElement('div');c.className='fx-chip';meter.insertBefore(c,meter.firstChild);}
    if(!c._active){c.style.transition='none';c.style.width=fill.style.width||getComputedStyle(fill).width;void c.offsetWidth;}
    c._active=true;clearTimeout(c._t);
    c._t=setTimeout(()=>{
      c.style.transition='width .5s cubic-bezier(.3,.7,.25,1)';c.style.width=fill.style.width||'0%';
      setTimeout(()=>{c._active=false;},520);
    },delay);
    restart(meter,'fx-meter-hit');
  }

  // ---------- numbers ----------
  function number(text,at,th,{crit=false,label='',cls=''}={}){
    if(!layer||!at)return;
    const j=()=>(Math.random()-.5)*Math.min(70,(at.size||120)*.35);
    const n=node(`fx-num fx-num--t${th.tier} fx-num--${th.kind}${crit?' fx-num--crit':''} ${cls}`,layer,{x:at.x+j(),y:at.y-Math.min(90,(at.size||120)*.45)+j()*.5,...colors(th)});
    n.innerHTML=`${label?`<small>${label}</small>`:''}<b>${text}</b>`;
    life(n,crit?1400:1100);
  }
  function hudNumber(text,meterId,kind){
    ensure();const m=$(meterId);if(!m||!hud)return;
    const r=m.getBoundingClientRect();
    const n=node(`fx-hudnum fx-hudnum--${kind}`,hud,{x:r.left+r.width*(0.55+Math.random()*.3),y:r.top-4});
    n.textContent=text;life(n,1150);
  }

  // ---------- word clear ----------
  function ghost(r,th){
    const g=node(`fx-ghost fx-ghost--${th.kind}`,layer,{x:r.x,y:r.y,w:r.w,h:r.h,...colors(th)});
    life(g,520);
  }

  // ---------- projectiles: return travel time in ms ----------
  function geo(a,b){const dx=b.x-a.x,dy=b.y-a.y;return {dx,dy,len:Math.hypot(dx,dy),ang:`${Math.atan2(dy,dx)}rad`};}
  const PROJ={
    std(a,b,th){const g=geo(a,b);life(node('fx-tracer',layer,{x:a.x,y:a.y,...g,...colors(th)}),420);return 110;},
    thrust(a,b,th){
      const g=geo(a,b);life(node('fx-tracer fx-tracer--needle',layer,{x:a.x,y:a.y,...g,...colors(th)}),460);
      life(node('fx-lockon',layer,{x:b.x,y:b.y,...colors(th)}),420);return 150;},
    ice(a,b,th){const g=geo(a,b);
      life(node('fx-shot fx-shard',layer,{x:a.x,y:a.y,...g,t:'.22s',...colors(th)},'<i></i>'),260);
      life(node('fx-tracer fx-tracer--frost',layer,{x:a.x,y:a.y,...g,...colors(th)}),520);return 210;},
    bash(a,b,th){const g=geo(a,b);
      life(node('fx-shot fx-hexshot',layer,{x:a.x,y:a.y,...g,t:'.24s',...colors(th)},'<i></i>'),280);return 230;},
    hex(a,b,th){const g=geo(a,b);
      life(node('fx-shot fx-crescent',layer,{x:a.x,y:a.y,...g,t:'.26s',...colors(th)},'<i></i>'),300);return 250;},
    bolt(a,b,th){const g=geo(a,b);
      life(node('fx-shot fx-boltshot',layer,{x:a.x,y:a.y,...g,t:'.15s',...colors(th)},'<i></i>'),190);
      life(node('fx-tracer fx-tracer--bolt',layer,{x:a.x,y:a.y,...g,...colors(th)}),380);return 140;},
    vial(a,b,th){const g=geo(a,b);
      life(node('fx-arcshot fx-vial',layer,{x:a.x,y:a.y,...g,arc:-Math.max(60,g.len*.28),t:'.38s',...colors(th)},'<span><i></i></span>'),420);return 370;},
    phantom(a,b,th){const g=geo(a,b);
      for(let i=0;i<3;i++)life(node('fx-shot fx-dagger',layer,{x:a.x,y:a.y+(i-1)*9,...g,t:'.2s',d:`${i*55}ms`,...colors(th)},'<i></i>'),360);
      return 230;},
    foxfire(a,b,th){const g=geo(a,b);
      [[-70,-.2],[40,.15],[95,.32]].forEach(([arc,lag],i)=>life(node('fx-arcshot fx-wisp',layer,{x:a.x,y:a.y,...g,arc,t:`${.42+lag*.2}s`,d:`${i*70}ms`,...colors(th)},'<span><i></i><i></i></span>'),760));
      return 470;},
    claw(a,b,th){const g=geo(a,b);
      life(node('fx-tracer fx-tracer--dash',layer,{x:a.x,y:a.y,...g,...colors(th)}),420);return 120;},
    blast(a,b,th){const g=geo(a,b);
      life(node('fx-arcshot fx-shell',layer,{x:a.x,y:a.y,...g,arc:-Math.max(50,g.len*.18),t:'.32s',...colors(th)},'<span><i></i></span>'),360);
      for(let i=0;i<3;i++)life(node('fx-smoke',layer,{x:a.x+g.dx*(.18+i*.22),y:a.y+g.dy*(.18+i*.22)-Math.sin(Math.PI*(.18+i*.22))*Math.max(50,g.len*.18),d:`${60+i*70}ms`}),900);
      return 320;},
    fang(a,b,th){const g=geo(a,b);
      life(node('fx-tracer fx-tracer--blood',layer,{x:a.x,y:a.y,...g,...colors(th)}),460);return 140;},
    decree(a,b,th){life(node('fx-pillar',layer,{x:a.x,y:a.y,...colors(th)}),620);return 170;}
  };

  // ---------- impacts at the boss ----------
  function shakeBoss(level){
    const b=document.querySelector('.bossInner');if(b){b.dataset.fxHit=level;restart(b,'fx-boss-hit');}
  }
  function shakeField(level){
    if(reduced())return;
    const bf=$('battlefield');if(!bf)return;
    bf.classList.remove('fx-shake-1','fx-shake-2','fx-shake-3');void bf.offsetWidth;bf.classList.add(`fx-shake-${level}`);
    clearTimeout(bf._fxShake);bf._fxShake=setTimeout(()=>bf.classList.remove(`fx-shake-${level}`),460);
  }
  function radial(cls,at,count,th,dist,ms){
    for(let i=0;i<count;i++){
      const a=(i/count)*Math.PI*2+Math.random()*.4;
      life(node(cls,layer,{x:at.x,y:at.y,a:`${a}rad`,dist:dist*(.7+Math.random()*.5),...colors(th)}),ms);
    }
  }
  const IMPACT={
    std(at,th){life(node('fx-spark',layer,{x:at.x,y:at.y,...colors(th)}),420);life(node('fx-slashmark',layer,{x:at.x,y:at.y,...colors(th)}),420);life(node('fx-ring',layer,{x:at.x,y:at.y,...colors(th)}),460);},
    thrust(at,th,o){
      const gold=o.effect?.type==='boss-bonus';
      life(node(`fx-reticle-hit${gold?' fx-reticle-hit--gold':''}`,layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i>'),640);
      life(node('fx-spark fx-spark--long',layer,{x:at.x,y:at.y,...colors(th)}),420);
      if(gold)life(node('fx-crack',layer,{x:at.x,y:at.y,...colors(th)}),800);},
    ice(at,th){life(node('fx-frostburst',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i><i></i>'),720);radial('fx-iceshard',at,7,th,70,620);life(node('fx-ring fx-ring--frost',layer,{x:at.x,y:at.y,...colors(th)}),560);},
    bash(at,th){life(node('fx-hexring',layer,{x:at.x,y:at.y,...colors(th)}),620);life(node('fx-hexring fx-hexring--late',layer,{x:at.x,y:at.y,...colors(th)}),720);life(node('fx-spark',layer,{x:at.x,y:at.y,...colors(th)}),420);},
    hex(at,th){life(node('fx-rune',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i>'),820);life(node('fx-arcslash',layer,{x:at.x,y:at.y,...colors(th)}),520);},
    bolt(at,th,o){
      const bull=/operator-crossbow-bullseye/.test(o.classes||'');
      life(node(`fx-target${bull?' fx-target--bull':''}`,layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i><i></i>'),720);
      life(node('fx-stuckbolt',layer,{x:at.x,y:at.y,...colors(th)}),720);},
    vial(at,th){life(node('fx-splash',layer,{x:at.x,y:at.y,...colors(th)}),640);radial('fx-drop',at,9,th,85,700);life(node('fx-vapor',layer,{x:at.x,y:at.y,...colors(th)}),1100);},
    phantom(at,th){life(node('fx-xslash',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i>'),620);life(node('fx-xslash fx-xslash--ghost',layer,{x:at.x+12,y:at.y-6,...colors(th)},'<i></i><i></i>'),700);},
    foxfire(at,th){life(node('fx-bloom',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i><i></i><i></i><i></i><i></i>'),900);life(node('fx-ring fx-ring--fox',layer,{x:at.x,y:at.y,...colors(th)}),700);radial('fx-ember',at,10,th,110,1100);},
    claw(at,th,o){
      const big=/lupa-/.test(o.effect?.type||'')||/operator-lupa-weakpoint/.test(o.classes||'');
      life(node(`fx-moon${big?' fx-moon--full':''}`,layer,{x:at.x,y:at.y,...colors(th)}),big?1100:820);
      life(node('fx-claws',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i><i></i>'),760);
      radial('fx-petal',at,big?9:5,th,95,900);},
    blast(at,th,o){
      const big=o.effect?.type==='nitrate-release';
      life(node(`fx-boom${big?' fx-boom--big':''}`,layer,{x:at.x,y:at.y,...colors(th)},'<i></i>'),big?1100:760);
      life(node('fx-shock',layer,{x:at.x,y:at.y,...colors(th)}),640);
      life(node('fx-hazardband',layer,{x:at.x,y:at.y,...colors(th)}),big?1000:620);
      radial('fx-debris',at,big?14:8,th,big?170:110,800);
      shakeField(big?3:2);},
    fang(at,th,o){
      const hunt=/hound-/.test(o.effect?.type||'')||/operator-hound-prey/.test(o.classes||'');
      life(node(`fx-jaws${hunt?' fx-jaws--hunt':''}`,layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i>'),720);
      radial('fx-splat',at,hunt?10:7,th,hunt?120:90,640);},
    decree(at,th){life(node('fx-sword',layer,{x:at.x,y:at.y,...colors(th)},'<i></i>'),900);life(node('fx-seal',layer,{x:at.x,y:at.y,...colors(th)},'<i></i>'),1100);life(node('fx-lightcol',layer,{x:at.x,y:at.y,...colors(th)}),900);}
  };

  // Correct word → strike the boss.
  function attack(o={}){
    if(!ensure())return;
    const th=theme(o.operatorId);
    const to=bossPoint();
    const r=o.rect?rel(o.rect):null;
    const from=r?{x:r.x+r.w*0.72,y:r.y+r.h/2}:null;
    const showNumber=()=>{
      if(!to)return;
      if(o.immune){if(o.score)number(`+${o.score}`,to,th,{cls:'fx-num--score'});return;}
      if(o.display!=null&&o.display!==''&&Number(o.damage)>0){
        const extra=o.effect?.type==='boss-bonus'?'WEAK POINT':/operator-crossbow-bullseye/.test(o.classes||'')?'BULLSEYE':
          o.effect?.type==='nitrate-release'?'WRATH':o.effect?.type==='lupa-complete'?'AMBUSH':o.effect?.type==='hound-next'&&o.effect.damage>0?'HUNT':'';
        number(o.display,to,th,{crit:!!o.crit,label:o.crit?'CRITICAL':extra});
      }
    };
    if(!o.immune&&Number(o.damage)>0)chip('bossMeter','bossFill',reduced()?120:520);
    if(reduced()||busy()){ if(to){showNumber();shakeBoss(1);} return; }
    if(r)ghost(r,th);
    const travel=from&&to?(PROJ[th.kind]||PROJ.std)(from,to,th,o):0;
    setTimeout(()=>{
      if(!to||!layer?.isConnected)return;
      (IMPACT[th.kind]||IMPACT.std)(to,th,o);
      shakeBoss(o.crit||th.tier===6?3:th.tier===5?2:1);
      if(o.crit){life(node('fx-critflash',layer,{x:to.x,y:to.y,...colors(th)}),520);shakeField(2);}
      showNumber();
    },travel);
  }

  // Operator clears a word on its own (Seraphine, Cassian, Aveline in survival stages).
  function autoClear(el,operatorId){
    if(!ensure()||!el||busy())return;
    const r=relEl(el);if(!r)return;
    const th=theme(operatorId);
    const at={x:r.x+r.w/2,y:r.y+r.h/2};
    if(operatorId==='cassian'){life(node('fx-sword fx-sword--lane',layer,{x:at.x,y:at.y,...colors(th)},'<i></i>'),760);life(node('fx-ring fx-ring--gold',layer,{x:at.x,y:at.y,...colors(th)}),600);}
    else if(operatorId==='seraphine'){life(node('fx-xslash fx-xslash--lane',layer,{x:at.x,y:at.y,...colors(th)},'<i></i><i></i>'),600);}
    else life(node('fx-slashmark fx-slashmark--lane',layer,{x:at.x,y:at.y,...colors(th)}),460);
    ghost(r,th);
  }

  // ---------- incoming damage ----------
  function reasonKind(reason){
    const r=String(reason||'');
    if(r==='input miss')return 'miss';
    if(r==='overflow')return 'overflow';
    if(r==='comet')return 'comet';
    if(r==='shooting star')return 'star';
    if(r==='Panic word')return 'panic';
    if(r==='Duel')return 'duel';
    if(r==='Moonlit Execution')return 'execution';
    if(r==='Moonlit Ambush timeout')return 'lupa';
    if(r==='Vesper')return document.querySelector('.word.vesper-poison-active')?'poison':'vesper';
    return 'hit';
  }
  function laneRect(){return relEl($('wordLane'));}
  function player(o={}){
    if(!ensure())return;
    const kind=reasonKind(o.reason);
    const vig=layer.querySelector(':scope>.fx-vignette')||node('fx-vignette',layer);
    vig.dataset.kind=kind;restart(vig,'fx-on');
    chip('playerMeter','playerFill',reduced()?120:420);
    hudNumber(`-${o.display??o.amount}`,'playerMeter',kind);
    shakeField(Number(o.amount)>=2||['comet','duel','execution','lupa'].includes(kind)?3:2);
    const lane=laneRect();
    if(reduced()||busy()||!lane)return;
    if(kind==='miss'){
      restart($('inputBar'),'fx-input-miss');
      const ib=relEl($('inputBar'));
      if(ib)life(node('fx-stamp fx-stamp--miss',layer,{x:ib.x+ib.w*0.62,y:ib.y+ib.h/2},'MISS'),760);
    }else if(kind==='overflow'){
      life(node('fx-overflow',layer,{x:lane.x,y:lane.y,w:lane.w,h:lane.h}),760);
    }else if(kind==='duel'){
      life(node('fx-bigslash fx-bigslash--gold',layer,{x:lane.x+lane.w/2,y:lane.y+lane.h*.55,w:lane.w*1.5}),620);
    }else if(kind==='execution'){
      life(node('fx-moonslash',layer,{x:lane.x+lane.w/2,y:lane.y+lane.h*.45,w:lane.w*1.4}),800);
    }else if(kind==='lupa'){
      life(node('fx-claws fx-claws--lane',layer,{x:lane.x+lane.w/2,y:lane.y+lane.h*.5,c1:THEMES.lupa.c1,c2:THEMES.lupa.c2},'<i></i><i></i><i></i>'),800);
    }else if(kind==='poison'){
      const m=$('playerMeter')?.getBoundingClientRect();
      if(m&&hud)for(let i=0;i<6;i++)life(node('fx-bubble',hud,{x:m.left+m.width*Math.random(),y:m.top,d:`${i*60}ms`}),1000);
    }
  }
  // A special word hits the bottom (or explodes) at its own position.
  function impact(el,kind){
    if(!ensure()||!el||reduced()||busy())return;
    const r=relEl(el);if(!r)return;
    const at={x:r.x+r.w/2,y:r.y+r.h/2};
    const th={kind:'impact',tier:4,c1:'#fff',c2:'#fff',c3:'#000'};
    if(kind==='comet'){life(node('fx-cometboom',layer,{x:at.x,y:r.y+r.h,w:r.w}),900);radial('fx-debris fx-debris--comet',{x:at.x,y:r.y+r.h},10,{...th,c1:'#ffb347',c2:'#7fd3ff'},120,800);}
    else if(kind==='star'){life(node('fx-starburst',layer,{x:at.x,y:at.y,w:r.w},'<i></i><i></i>'),820);}
    else if(kind==='panic'){life(node('fx-shatter',layer,{x:r.x,y:r.y,w:r.w,h:r.h}),700);radial('fx-shard-red',at,9,th,90,700);}
    else if(kind==='duel'){life(node('fx-shatter fx-shatter--gold',layer,{x:r.x,y:r.y,w:r.w,h:r.h}),700);}
  }
  function armorBreak(el){
    if(!ensure()||!el||reduced()||busy())return;
    const r=relEl(el);if(!r)return;
    const at={x:r.x+r.w/2,y:r.y+r.h/2};
    life(node('fx-armorbreak',layer,{x:r.x,y:r.y,w:r.w,h:r.h},'<i></i><i></i><i></i><i></i>'),720);
    radial('fx-spark-steel',at,10,{tier:4,c1:'#cfe6ff',c2:'#fff',c3:'#4a6a90'},80,520);
    life(node('fx-stamp fx-stamp--armor',layer,{x:at.x,y:r.y-6},'ARMOR BROKEN'),820);
  }
  // Damage prevented: invulnerability, Kade's evade, Nitrate's Wrath Shield.
  function guard(kind,amount){
    if(!ensure())return;
    const m=$('playerMeter')?.getBoundingClientRect();
    if(kind==='evade'){
      const ib=relEl($('inputBar'));
      if(ib&&!reduced())life(node('fx-stamp fx-stamp--evade',layer,{x:ib.x+ib.w*0.62,y:ib.y+ib.h/2},'EVADE'),900);
      return;
    }
    if(!m||!hud)return;
    const n=node(`fx-guard fx-guard--${kind}`,hud,{x:m.left+m.width/2,y:m.top+m.height/2,w:m.width});
    n.innerHTML=`<b>${kind==='block'?`BLOCK${amount?` −${amount}`:''}`:'IMMUNE'}</b>`;life(n,900);
  }

  // ---------- operator passives ----------
  function toast(text,th){
    const lane=laneRect();if(!lane||!layer)return;
    layer.querySelectorAll(':scope>.fx-toast').forEach(e=>e.remove());
    life(node('fx-toast',layer,{x:lane.x+lane.w/2,y:lane.y+6,...colors(th)},`<b>${text}</b>`),1500);
  }
  function banner(id,skill,th,sub=''){
    const a=stageArea();if(!a||!layer)return;
    layer.querySelectorAll(':scope>.fx-banner').forEach(e=>e.remove());
    const e=node('fx-banner',layer,{x:a.x,y:a.y+Math.min(26,a.h*.04),w:Math.min(a.w,520),...colors(th)},
      `<span class="fx-banner-rank">${'★'.repeat(rarityOf(id)||5)}</span><span class="fx-banner-name">${nameOf(id)}</span><b>${skill}</b>${sub?`<em>${sub}</em>`:''}`);
    life(e,1700);
  }
  function cutin(id,skill,th,sub=''){
    const a=stageArea();if(!a||!layer)return;
    layer.querySelectorAll(':scope>.fx-cutin').forEach(e=>e.remove());
    const h=Math.max(150,Math.min(260,a.H*0.36));
    // Sits below the boss's centre so strikes and damage numbers stay visible during the cut-in.
    const e=node(`fx-cutin fx-cutin--${th.kind}`,layer,{x:a.x,y:Math.min(a.y+a.h*0.66-h/2,a.y+a.h-h),w:a.w,h,...colors(th)});
    const face=FACE[id]||[50,14];
    const artW=Math.min(a.w*0.46,h*1.05),imgH=h*2.7,imgW=imgH*480/900;
    e.innerHTML=`<div class="fx-cutin-band"></div><div class="fx-cutin-deco"></div>
      <div class="fx-cutin-art" style="width:${Math.round(artW)}px"><img alt="" decoding="async" src="assets/deployment/${id}.webp"
        style="height:${Math.round(imgH)}px;left:${Math.round(artW*0.5-imgW*face[0]/100)}px;top:${Math.round(h*0.40-imgH*face[1]/100)}px"></div>
      <div class="fx-cutin-text"><small>${'★'.repeat(6)} · ${nameOf(id)}</small><b>${skill}</b>${sub?`<em>${sub}</em>`:''}</div>`;
    life(e,reduced()?1200:1500);
  }
  function laneState(cls,seconds){
    ensure();if(!laneBack)return;
    laneBack.classList.add(cls);
    clearTimeout(laneBack['_t_'+cls]);
    laneBack['_t_'+cls]=setTimeout(()=>laneBack?.classList.remove(cls),Math.max(300,(Number(seconds)||1)*1000));
  }
  // Lane flashes sit behind the words so they never cover a prompt or answer.
  function laneFlash(cls,ms=900){ensure();if(!laneBack)return;life(node(`fx-laneflash ${cls}`,laneBack),ms);}
  function wordPing(el,cls,ms=700){
    if(!el||!layer)return;const r=relEl(el);if(!r)return;
    life(node(`fx-ping ${cls}`,layer,{x:r.x,y:r.y,w:r.w,h:r.h}),ms);
  }
  function healFx(amount){
    const m=$('playerMeter')?.getBoundingClientRect();if(!m||!hud)return;
    hudNumber(`+${amount}`,'playerMeter','heal');
    if(!reduced())for(let i=0;i<7;i++)life(node('fx-heal',hud,{x:m.left+m.width*Math.random(),y:m.top+m.height/2,d:`${i*70}ms`}),1100);
  }
  function setReticle(on){
    if(!on){reticle?.remove();reticle=null;return;}
    const at=bossPoint();if(!at||!layer)return;
    reticle?.remove();
    reticle=node('fx-boss-reticle',layer,{x:at.x,y:at.y,...colors(THEMES.aveline)},'<i></i><i></i><b>WEAK POINT</b>');
  }

  const recent=new Map();
  function passive(effect,lookup){
    if(!effect||!effect.type||!ensure())return;
    const now=performance.now(),key=effect.type+':'+(effect.wordId??'')+':'+(effect.chainHits??'');
    if(now-(recent.get(key)||0)<250)return;recent.set(key,now);
    const id=effect.characterId||'';
    const th=theme(id);
    const elFor=wid=>{try{return lookup?.(wid)||null;}catch(_){return null;}};
    const name=nameOf(id);
    switch(effect.type){
      // ---- 4★: one shared, simple style ----
      case 'slowdown':toast(`${name} · ${id==='alden'?'SECOND WIND':'QUICK RECOVERY'}`,th);laneState('fx-slow',effect.seconds);break;
      case 'word-freeze':toast(`${name} · SHADOW HOLD`,th);wordPing(elFor(effect.wordId),'fx-ping--shadow',900);break;
      case 'spawn-pause':toast(`${name} · BREATHING ROOM`,th);laneState('fx-hold',effect.seconds);break;
      case 'heal':toast(`${name} · ENDURANCE`,th);healFx(effect.hp);break;
      case 'mistake-guard':toast(`${name} · TRICKSTER`,th);guard('evade');break;
      // ---- 5★: themed banner + field effect ----
      case 'charge':banner(id,'WEAK POINT READY',th,'NEXT HIT +2');setReticle(true);break;
      case 'boss-bonus':setReticle(false);break;
      case 'domain-freeze':banner(id,'FROZEN DOMAIN',th,`${effect.seconds}s FREEZE`);laneFlash('fx-laneflash--frost',1100);break;
      case 'shield-advance':banner(id,'SHIELD ADVANCE',th,effect.freezeSeconds?`PUSH 35% · HOLD ${effect.freezeSeconds}s`:'PUSH 10%');laneFlash('fx-laneflash--shield',800);break;
      case 'chain-cleave-start':banner(id,'CHAIN CLEAVE',th,`HEX ${effect.seconds||4}s`);laneFlash('fx-laneflash--hex',1000);break;
      case 'crossbow-showoff':banner(id,'SHOW-OFF',th,'BULLSEYE MARKED');{const w=elFor(effect.wordId);if(w)wordPing(w,'fx-ping--bull',900);}break;
      case 'fletcher-last-stand':banner(id,'ADRENALINE RUSH',th,'LAST STAND');laneFlash('fx-laneflash--adrenaline',1100);break;
      case 'anodyne-serum':banner(id,'RECOVERY SERUM',th,`+${effect.hp} HP`);healFx(effect.hp);break;
      case 'anodyne-cryo':banner(id,'CRYOGENIC SOLUTION',th,`SLOW ${effect.percent||30}%`);laneState('fx-cryo',effect.seconds);laneFlash('fx-laneflash--cryo',900);break;
      case 'anodyne-suppression':banner(id,'SUPPRESSION FORMULA',th,'SPAWNS HALTED');laneState('fx-suppress',effect.seconds);break;
      case 'anodyne-suppression-ended':ensure();laneBack?.classList.remove('fx-suppress');break;
      case 'mark-word':banner(id,'PHANTOM EXECUTION',th,'TARGET MARKED');wordPing(elFor(effect.wordId),'fx-ping--phantom',900);break;
      // ---- 6★: full cut-in with the operator ----
      case 'foxfire-start':cutin(id,'FOXFIRE REWIND',th,`${effect.wordIds?.length||0} WORDS REWOUND`);laneFlash('fx-laneflash--foxfire',1300);break;
      case 'lupa-start':cutin(id,'MOONLIT AMBUSH',th,`${effect.wordIds?.length||3} WEAK POINTS · ${effect.seconds||6}s`);laneFlash('fx-laneflash--moon',1400);
        (effect.wordIds||[]).forEach(w=>wordPing(elFor(w),'fx-ping--moon',900));break;
      case 'nitrate-mark':(effect.wordIds||[]).forEach(w=>wordPing(elFor(w),'fx-ping--hazard',700));break;
      case 'nitrate-charge':{const s=$('nitrateShield');if(s)restart(s,'fx-shield-charge');}break;
      case 'nitrate-release':cutin(id,'WRATH RELEASE',th,'SHIELD DETONATED · +7');break;
      case 'hound-mark':wordPing(elFor(effect.wordId),effect.chain?'fx-ping--hunt':'fx-ping--prey',800);break;
      case 'hound-next':if(!(effect.damage>0))cutin(id,'BLOOD HUNT',th,'3 PREY · 3s EACH');break;
      case 'hound-complete':banner(id,'HUNT COMPLETE',th);break;
      case 'cassian-decree':
        cutin(id,'SOVEREIGN’S DECREE',th,effect.invulnerable?'ROYAL AUTHORITY · 5s':'');
        (effect.wordIds||[]).forEach(w=>{const e=elFor(w);if(e)autoClear(e,'cassian');});
        if(effect.invulnerable)laneFlash('fx-laneflash--royal',1200);
        break;
    }
  }

  function reset(){
    recent.clear();setReticle(false);
    layer?.querySelectorAll(':scope>*:not(.fx-vignette)').forEach(e=>e.remove());
    hud?.replaceChildren();
    if(laneBack){laneBack.className='fx-lane';}
    laneFront?.replaceChildren();
  }

  // Preload cut-in art for the operator the student takes into battle.
  const preloaded=new Set();
  function prepare(id){
    if(!id||preloaded.has(id)||rarityOf(id)<6)return;
    preloaded.add(id);const i=new Image();i.decoding='async';i.src=`assets/deployment/${id}.webp`;
  }

  document.documentElement.classList.add('fx-on');
  window.RPG_FX=Object.freeze({attack,autoClear,player,impact,armorBreak,guard,passive,reset,prepare,theme});
})();
