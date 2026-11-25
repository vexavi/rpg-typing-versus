/* Future custom word mechanics go here; append RPG_MECHANICS.register({...}).
 * Registration is deliberately CODE, not executable strings downloaded from Firebase.
 * Example hook signatures: onSpawn({word,mode,stageIndex}, settings),
 * onTick({word,dt,mode},settings), onCorrect({word,mode},settings),
 * onLand({word,mode},settings), onMistake, onPlayerDamage, onStageStart.
 * The context also includes spawn(options), remove(id), damagePlayer(n), damageBoss(n), time(). Settings: .enabled() and .get(key,fallback).
 * Declare fields for the dashboard: boolean or bounded number.
 * Add the implementation once, then manage its settings live without code changes.
 */

// Included example: a safe, opt-in story mechanic that changes falling speed of selected words.
// The editor discovers its fields automatically. New behaviors can be registered similarly.
window.RPG_MECHANICS?.register({
 id:'drift_words', label:'Drifting Words', description:'Randomly slow some falling words in Story battles.',
 modes:['story'], defaultEnabled:false,
 fields:[
  {key:'enabled',label:'Enabled',type:'boolean',default:false},
  {key:'chancePct',label:'Affected words (%)',type:'number',min:0,max:100,step:1,default:25},
  {key:'speedPercent',label:'Word speed (%)',type:'number',min:20,max:200,step:5,default:65}
 ],
 onSpawn(ctx,settings){
  if(!ctx.word||Math.random()*100>=settings.get('chancePct',25))return;
  const percent=Number(settings.get('speedPercent',65));
  ctx.word.fallMult=(ctx.word.fallMult||1)*Math.max(0.2,Math.min(2,percent/100));
  ctx.word.el?.classList.add('story-drifting-word');
 }
});


/* Chapter 1 special stages: only explicit Story stage overrides activate these.
 * The Story Editor stores BOOLEAN and NUMBER settings, never executable code.
 * A shared controller coordinates eyelids/word swaps and Panic impacts.
 */
(function(){
 'use strict';
 const definitions=[
  {id:'sleepy',label:'Sleepy · Fighting Sleep',description:'Heavy eyelids droop, flutter partially open, then finally close. Regular words keep falling during darkness; Panic words freeze and Disorientation acceleration pauses. New spawns pause.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'minIntervalSec',label:'Shortest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:16},
    {key:'maxIntervalSec',label:'Longest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:22},
    {key:'bgmDipPct',label:'BGM reduction at full closure (%)',type:'number',min:0,max:90,step:5,default:45},
    {key:'closingSec',label:'Fighting sleep / closing (sec)',type:'number',min:0.2,max:4,step:0.1,default:1.8},
    {key:'closedSec',label:'Fully closed (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.8},
    {key:'openingSec',label:'Eyelids reopening (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.8}
   ]},
  {id:'delirium',label:'Delirium · Changed Words',description:'Requires Sleepy. Each time the eyelids fully close, change the text of existing falling and stacked words using the current stage vocabulary. Positions and special marks are preserved. Changed words lose Repression mist.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'changePercent',label:'Words changed (%)',type:'number',min:0,max:100,step:5,default:100}
   ]},
  {id:'panic',label:'Panic · Dangerous Words',description:'Some naturally spawned words become red Panic words. They pass through other words and damage on impact. Immune to Repression and Disorientation acceleration; frozen during complete darkness.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'chancePct',label:'Chance per regular spawn (%)',type:'number',min:0,max:100,step:1,default:15},
    {key:'maxActive',label:'Maximum active Panic words',type:'number',min:1,max:8,step:1,default:2},
    {key:'minGapSec',label:'Minimum time between Panic spawns (sec)',type:'number',min:0,max:30,step:0.5,default:5},
    {key:'damage',label:'Damage when reaching bottom',type:'number',min:1,max:10,step:1,default:1}
   ]},
  {id:'disorientation',label:'Disorientation',description:'Falling words freeze, then accelerate except Panic words. The cycle pauses during complete darkness. Spawns and typing otherwise continue.',fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'intervalSec',label:'Normal time between cycles (sec)',type:'number',min:3,max:120,step:1,default:15},
    {key:'freezeSec',label:'Freeze duration (sec)',type:'number',min:0.5,max:5,step:0.5,default:2},
    {key:'rushSec',label:'Acceleration duration (sec)',type:'number',min:0.5,max:5,step:0.5,default:2},
    {key:'speedPct',label:'Accelerated falling speed (%)',type:'number',min:100,max:300,step:10,default:200}
   ]},
  {id:'repression',label:'Repression',description:'Some regular words are briefly hidden by dark mist. They remain typeable. Mist clears on landing, Delirium word changes, or Disorientation acceleration.',fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'chancePct',label:'Affected words (%)',type:'number',min:0,max:100,step:5,default:25},
    {key:'visibleSec',label:'Time before mist (sec)',type:'number',min:0.5,max:10,step:0.5,default:2},
    {key:'hiddenSec',label:'Mist duration (sec)',type:'number',min:0.5,max:5,step:0.5,default:1.5},
    {key:'maxActive',label:'Maximum affected words',type:'number',min:1,max:6,step:1,default:2}
   ]}
 ];
 for(const item of definitions)window.RPG_MECHANICS?.register({...item,modes:['story'],defaultEnabled:false});
 let active=false,stageId='',nextBlink=Infinity,blink=null,fullyClosed=false,lastPanicAt=-Infinity,overlay=null,upperLid=null,lowerLid=null,upperFeather=null,lowerFeather=null,eyelidClosure=0;
 const settings={
  sleepy:{enabled:false,minIntervalSec:16,maxIntervalSec:22,bgmDipPct:45,closingSec:1.8,closedSec:0.8,openingSec:0.8},
  delirium:{enabled:false,changePercent:100},
  panic:{enabled:false,chancePct:15,maxActive:2,minGapSec:5,damage:1},
  disorientation:{enabled:false,intervalSec:15,freezeSec:2,rushSec:2,speedPct:200},
  repression:{enabled:false,chancePct:25,visibleSec:2,hiddenSec:1.5,maxActive:2}
 };
 const number=(v,min,max,otherwise)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:otherwise;
 const get=(id,key,fallback)=>window.RPG_BALANCE?.mechanic(id,key,fallback)??fallback;
 function config(){
  for(const spec of definitions){
   const dst=settings[spec.id];
   for(const f of spec.fields){
    const v=get(spec.id,f.key,f.default);
    dst[f.key]=f.type==='boolean'?v===true:number(v,f.min,f.max,f.default);
   }
  }
  if(settings.sleepy.maxIntervalSec<settings.sleepy.minIntervalSec)settings.sleepy.maxIntervalSec=settings.sleepy.minIntervalSec;
 }
 // A human upper eyelid moves much farther than the lower one. Use smooth
 // curved edges with a slight left/right asymmetry rather than flat curtains.
 const SVG_NS='http://www.w3.org/2000/svg';
 function ensureOverlay(){
  if(typeof document==='undefined'||!document.body)return;
  if(overlay?.isConnected)return;
  overlay=document.createElement('div');overlay.className='chapter-sleep-veil';overlay.setAttribute('aria-hidden','true');overlay.hidden=true;
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('viewBox','0 0 1000 1000');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('class','chapter-eye-svg');
  const defs=document.createElementNS(SVG_NS,'defs');const filter=document.createElementNS(SVG_NS,'filter');
  filter.setAttribute('id','chapter-eye-soft-edge');filter.setAttribute('x','-10%');filter.setAttribute('y','-10%');filter.setAttribute('width','120%');filter.setAttribute('height','120%');
  const blur=document.createElementNS(SVG_NS,'feGaussianBlur');blur.setAttribute('stdDeviation','11');filter.appendChild(blur);defs.appendChild(filter);svg.appendChild(defs);
  function addPath(cls){const path=document.createElementNS(SVG_NS,'path');path.setAttribute('class',cls);svg.appendChild(path);return path;}
  upperLid=addPath('sleep-eye-lid sleep-eye-upper');lowerLid=addPath('sleep-eye-lid sleep-eye-lower');
  upperFeather=addPath('sleep-eye-feather');lowerFeather=addPath('sleep-eye-feather');
  overlay.appendChild(svg);document.body.appendChild(overlay);
 }
 // The raised centers approximate the rounded, slightly uneven shape of real
 // eyelids. Overlap at f=1 means there is *never* a slit in complete darkness.
 function setClosure(fraction){
  if(!overlay)return;
  const f=Math.max(0,Math.min(1,Number(fraction)||0));
  eyelidClosure=f;
  overlay.hidden=f<=0.001;
  if(overlay.hidden)return;
  const topY=765*f, bottomY=1000-295*f;
  const upperBow=115*f,lowerBow=36*f;
  const upperCurve=`M0 0 H1000 V${topY.toFixed(2)} C825 ${(topY+upperBow*.68).toFixed(2)} 665 ${(topY+upperBow).toFixed(2)} 494 ${(topY+upperBow).toFixed(2)} C315 ${(topY+upperBow).toFixed(2)} 135 ${(topY+upperBow*.54).toFixed(2)} 0 ${(topY-12*f).toFixed(2)} Z`;
  const lowerCurve=`M0 1000 H1000 V${bottomY.toFixed(2)} C830 ${(bottomY-lowerBow*.70).toFixed(2)} 680 ${(bottomY-lowerBow).toFixed(2)} 500 ${(bottomY-lowerBow).toFixed(2)} C310 ${(bottomY-lowerBow).toFixed(2)} 140 ${(bottomY-lowerBow*.55).toFixed(2)} 0 ${(bottomY+8*f).toFixed(2)} Z`;
  upperLid?.setAttribute('d',upperCurve);lowerLid?.setAttribute('d',lowerCurve);
  // Fully closed eyes have no visible eyelid seam. Fade feathering at the last 10%.
  const seamOpacity=String(Math.min(1,Math.max(0,(1-f)/.10)));
  if(upperFeather)upperFeather.style.opacity=seamOpacity;
  if(lowerFeather)lowerFeather.style.opacity=seamOpacity;
  // Feather only the boundary, not the whole screen, so the covered area is dark.
  const upperEdge=upperCurve.replace(/^M0 0 H1000 V/,'M1000 ').replace(/ Z$/,'');
  const lowerEdge=lowerCurve.replace(/^M0 1000 H1000 V/,'M1000 ').replace(/ Z$/,'');
  upperFeather?.setAttribute('d',upperEdge);lowerFeather?.setAttribute('d',lowerEdge);
 }
 function ease(a,b,phase){const t=Math.min(1,Math.max(0,phase));const v=t*t*(3-2*t);return a+(b-a)*v;}
 function keyedClosure(progress,points){
  const p=Math.max(0,Math.min(1,progress));
  for(let i=1;i<points.length;i++){
   if(p<=points[i][0])return ease(points[i-1][1],points[i][1],(p-points[i-1][0])/(points[i][0]-points[i-1][0]));
  }
  return points[points.length-1][1];
 }
 // Hesitant droop -> effortful recovery -> deeper droop -> brief fight back -> sleep.
 const sleepyClosing=[[0,0],[.23,.50],[.40,.29],[.65,.77],[.77,.61],[1,1]];
 // Coming around is uneven too; the eye momentarily falters before fully opening.
 const sleepyOpening=[[0,1],[.22,.70],[.38,.81],[.70,.26],[.83,.32],[1,0]];
 function rollInterval(){
  const s=settings.sleepy;return s.minIntervalSec+Math.random()*(s.maxIntervalSec-s.minIntervalSec);
 }
 // Effects are local to the battle clock; no new timers, network calls or assets.
 let lastBlackoutSeconds=0,disorientStart=0,disorientLastElapsed=0,disorientPhase='normal',disorientLane=null;
 const repressed=new Map();
 function showPhase(phase,lane=disorientLane){
  if(disorientLane!==lane){disorientLane?.classList?.remove('rift-freeze','rift-rush');disorientLane=lane;disorientPhase='normal';}
  if(phase===disorientPhase)return;
  disorientPhase=phase;
  lane?.classList?.toggle('rift-freeze',phase==='freeze');lane?.classList?.toggle('rift-rush',phase==='rush');
 }
 function clearRepression(word){
  const entry=repressed.get(word);if(!entry)return;
  if(entry.hidden)word.el?.classList?.remove('rift-repressed');repressed.delete(word);
 }
 function updateRift(elapsed,lane,blackoutSeconds=0){
  if(!active)return;
  if(settings.disorientation.enabled){
   // Pause the phase clock for the actual overlap with the fully closed interval.
   // This also covers a slow frame which crosses both blackout boundaries.
   disorientStart+=blackoutSeconds;
   const d=settings.disorientation,cycle=d.intervalSec+d.freezeSec+d.rushSec;
   const t=Math.max(0,elapsed-disorientStart)%cycle;
   showPhase(t<d.intervalSec?'normal':t<d.intervalSec+d.freezeSec?'freeze':fullyClosed?'normal':'rush',lane);
  }
  for(const [word,entry] of repressed){
   if(disorientPhase==='rush'||word.chapterPanic||word.state!=='falling'||word.el?.isConnected===false||word.foxfireHidden||word.ex2Hacked||elapsed>=entry.until){clearRepression(word);continue;}
   if(!entry.hidden&&elapsed>=entry.from){
    // Do not start a new concealment while the player cannot read the word.
    if(fullyClosed){clearRepression(word);continue;}
    entry.hidden=true;word.el?.classList?.add('rift-repressed');
   }
  }
 }
 function motionMultiplier(panic=false){
  if(!active)return 1;
  if(panic&&fullyClosed)return 0;
  if(!settings.disorientation.enabled)return 1;
  if(disorientPhase==='freeze')return 0;
  if(disorientPhase==='rush'&&!fullyClosed&&!panic)return settings.disorientation.speedPct/100;
  return 1;
 }
 function markRepression(word,elapsed){
  const r=settings.repression;
  if(!r.enabled||fullyClosed||disorientPhase==='rush'||word.chapterPanic||word.challengeComet||word.ex1Highlighted||word.ex5StarStruck||word.operatorHexSummoned||word.chainHexed||repressed.has(word)||repressed.size>=Math.floor(r.maxActive)||Math.random()*100>=r.chancePct)return;
  repressed.set(word,{from:elapsed+r.visibleSec,until:elapsed+r.visibleSec+r.hiddenSec,hidden:false});
 }
 function reset(){lastBlackoutSeconds=0;showPhase('normal');disorientLane=null;for(const word of repressed.keys())clearRepression(word);active=false;stageId='';blink=null;nextBlink=Infinity;fullyClosed=false;lastPanicAt=-Infinity;eyelidClosure=0;setClosure(0);}
 function start(mode,id,elapsedAtStart=0){
  reset();if(mode!=='story'||!/^1-[1-9]\d*$/.test(String(id||'')))return;
  active=true;stageId=String(id);config();ensureOverlay();disorientStart=Math.max(0,Number(elapsedAtStart)||0);disorientLastElapsed=disorientStart;
  if(settings.sleepy.enabled)nextBlink=Math.max(0,Number(elapsedAtStart)||0)+rollInterval();
 }
 function relabel(word,entry,normalize){
  // Chain Cleave owns temporary text. Update its original word instead, so expiry restores the new Delirium result.
  if(word.chainHexed&&word.chainHexOrigin){
   Object.assign(word.chainHexOrigin,{prompt:entry.prompt,answer:entry.answer,answerNorm:normalize(entry.answer),shownPrompt:entry.prompt,shownAnswer:entry.answer});return;
  }
  word.prompt=entry.prompt;word.answer=entry.answer;
  word.answerNorm=normalize(entry.answer);
  if(word.promptEl)word.promptEl.textContent=entry.prompt;
  if(word.answerEl)word.answerEl.textContent=entry.answer;
 }
 function mutateWords(words,vocabulary,normalize){
  if(!settings.delirium.enabled||!vocabulary?.length||!words?.length)return 0;
  let changed=0;
  for(const w of words){
   if(!w||!['falling','landed'].includes(w.state)||w.foxfireHidden||w.ex2Hacked)continue;
   if(Math.random()*100>=settings.delirium.changePercent)continue;
   // The player's current answer is avoided when a different valid word exists.
   const choices=vocabulary.filter(x=>x&&x.answer&&x.prompt&&normalize(x.answer)!==(w.answerNorm||normalize(w.answer)));
   const pool=choices.length?choices:vocabulary;
   const entry=pool[Math.floor(Math.random()*pool.length)];if(!entry)continue;
   const previous=w.chainHexed&&w.chainHexOrigin?w.chainHexOrigin.answerNorm??normalize(w.chainHexOrigin.answer):w.answerNorm||normalize(w.answer);
   if(normalize(entry.answer)!==previous)clearRepression(w);
   relabel(w,entry,normalize);changed++;
  }
  return changed;
 }
 function frame(elapsed,{words=[],vocabulary=[],normalize=s=>String(s).trim().toLowerCase(),onClosed=null,lane=null,onRelabel=null}={}){
  lastBlackoutSeconds=0;
  if(!active||!settings.sleepy.enabled){fullyClosed=false;setClosure(0);updateRift(elapsed,lane);disorientLastElapsed=elapsed;return false;}
  if(!blink&&elapsed>=nextBlink)blink={start:elapsed,changed:false};
  if(!blink){fullyClosed=false;setClosure(0);updateRift(elapsed,lane);disorientLastElapsed=elapsed;return false;}
  const s=settings.sleepy;
  const t=Math.max(0,elapsed-blink.start);
  const closing=s.closingSec,closed=s.closedSec,opening=s.openingSec,total=closing+closed+opening;
  const blackoutStart=blink.start+closing,blackoutEnd=blackoutStart+closed;
  const blackoutSeconds=Math.max(0,Math.min(elapsed,blackoutEnd)-Math.max(disorientLastElapsed,blackoutStart));
  lastBlackoutSeconds=blackoutSeconds;
  let fraction=0;
  // Delirium must fire exactly once even if a slow frame skips the closed hold.
  if(t>=closing&&!blink.changed){blink.changed=true;if(typeof onClosed==='function')onClosed();mutateWords(words,vocabulary,normalize);if(typeof onRelabel==='function')for(const w of words)onRelabel(w);}
  if(t<closing){
   const p=t/Math.max(0.001,closing);
   fraction=keyedClosure(p,sleepyClosing);
   // Tiny irregular muscle flutter; never shifts either endpoint.
   fraction+=0.008*Math.sin(p*37)*Math.sin(Math.PI*p);
  }else if(t<closing+closed)fraction=1;
  else if(t<total){
   const p=(t-closing-closed)/Math.max(0.001,opening);
   fraction=keyedClosure(p,sleepyOpening);
   fraction+=0.006*Math.sin(p*32)*Math.sin(Math.PI*p);
  }else{blink=null;nextBlink=elapsed+rollInterval();}
  fullyClosed=!!blink&&t>=closing&&t<closing+closed;
  setClosure(fraction);updateRift(elapsed,lane,blackoutSeconds);disorientLastElapsed=elapsed;return fullyClosed;
 }
 function markSpawn(word,elapsed,words){
  if(!active||!word||word.state!=='falling'||fullyClosed)return false;
  const p=settings.panic;
  if(p.enabled&&elapsed-lastPanicAt>=p.minGapSec&&words.filter(w=>w?.chapterPanic&&w.state==='falling').length<p.maxActive&&Math.random()*100<p.chancePct){
   word.chapterPanic=true;word.ignoreCollision=true;lastPanicAt=elapsed;
   word.el?.classList?.add('chapter-panic-word');return true;
  }
  markRepression(word,elapsed);return false;
 }
 function panicDamage(){return settings.panic.damage;}
 function suspend(){eyelidClosure=0;setClosure(0);}
 // Multiplier follows the visual eyelids, including both groggy partial reopenings.
 // At the default 45% dip, full closure retains 55% of the user's chosen BGM volume.
 function bgmGain(){return active&&settings.sleepy.enabled?1-(settings.sleepy.bgmDipPct/100)*eyelidClosure:1;}
 const api=Object.freeze({start,reset,suspend,frame,markSpawn,clearRepression,motionMultiplier,panicDamage,bgmGain,isFullyClosed:()=>fullyClosed,blackoutSeconds:()=>lastBlackoutSeconds,inspect:()=>({active,stageId,fullyClosed,eyelidClosure,nextBlink,blinkStart:blink?.start??null,settings:JSON.parse(JSON.stringify(settings))})});
 window.RPG_CH1_SPECIAL=api;
})();

/* Valcrest: one simulation-clock scheduler, no network or independent timers. */
(function(){
 'use strict';
 const num=(key,label,min,max,step,def)=>({key,label,type:'number',min,max,step,default:def});
 const enable={key:'enabled',label:'Enabled',type:'boolean',default:false};
 const definitions=[
  {id:'fortification',label:'Fortification',description:'Armored words need two correct entries. Only the final entry grants damage and rewards.',fields:[enable,num('chancePct','Chance (%)',0,100,1,20),num('maxActive','Maximum armored words',1,5,1,2),num('hits','Required entries',2,3,1,2),num('speedPct','Falling speed (%)',40,100,5,75)]},
  {id:'reinforcements',label:'Reinforcements',description:'A warned wave of normal words replaces regular spawning temporarily.',fields:[enable,num('intervalSec','Interval (sec)',5,120,1,20),num('count','Words per wave',1,5,1,3),num('gapSec','Spawn gap (sec)',0.5,3,0.1,0.5),num('warningSec','Warning (sec)',0.5,4,0.5,1.5)]},
  {id:'siege',label:'Siege',description:'Oversized words occupy extra stack rows; one correct entry clears them.',fields:[enable,num('chancePct','Chance (%)',0,100,1,15),num('rows','Stack rows',2,3,1,2),num('speedPct','Falling speed (%)',40,100,5,80),num('maxActive','Maximum Siege words',1,3,1,1)]},
  {id:'encirclement',label:'Encirclement',description:'Warned words enter from alternating sides if sufficient space is available.',fields:[enable,num('intervalSec','Interval (sec)',5,120,1,15),num('count','Words per event',1,3,1,2),num('warningSec','Warning (sec)',0.5,4,0.5,1),num('entrySec','Entry duration (sec)',0.2,1.5,0.1,0.5),num('heightPct','Entry depth (%)',0,35,5,25)]},
  {id:'duel',label:'Duel',description:'One golden word falls through the stack while normal words freeze. Clear it for bonus boss damage.',fields:[enable,num('intervalSec','Interval (sec)',5,120,1,25),num('speedPct','Falling speed (%)',40,150,5,100),num('damagePct','Boss damage (%)',100,500,25,300),num('damage','Miss damage (10 HP units)',1,10,1,1)]}
 ];
 for(const d of definitions)window.RPG_MECHANICS?.register({...d,modes:['story'],defaultEnabled:false});
 let active=false,settings={},due={},event=null,recovery=0,lastTime=0,side=1,lane=null;
 const timed=['duel','reinforcements','encirclement'];
 const enabled=id=>settings[id]?.enabled===true;
 const rows=w=>Math.max(1,Number(w?.valcrestRows)||1);
 const count=(words,id)=>words.reduce((n,w)=>n+(w.valcrestKind===id&&(id!=='fortification'||w.valcrestArmor>0)?1:0),0);
 function reset(){active=false;event=null;settings={};due={};recovery=0;lastTime=0;side=1;if(lane){lane.removeAttribute?.('data-valcrest-event');lane.removeAttribute?.('data-valcrest-side');lane=null;}}
 function start(mode,id,t=0){reset();if(mode!=='story'||!/^2-[1-9]\d*$/.test(String(id)))return;
  for(const d of definitions){settings[d.id]={};for(const f of d.fields){const v=window.RPG_BALANCE?.mechanic(d.id,f.key,f.default)??f.default;settings[d.id][f.key]=f.type==='boolean'?v===true:(typeof v==='number'&&Number.isFinite(v)?Math.min(f.max,Math.max(f.min,f.step===1?Math.round(v):v)):f.default);}}
  active=definitions.some(d=>enabled(d.id));lastTime=t;for(const id of timed)due[id]=t+settings[id].intervalSec;
 }
 function mark(w,kind){w.valcrestKind=kind;w.el?.classList?.add('valcrest-'+kind);}
 function markSpawn(w,words){if(!active||!w||w.state!=='falling'||w.valcrestKind||w.operatorHexSummoned||w.challengeComet||w.ex1Highlighted||w.chapterPanic)return;
  const s=settings.siege,f=settings.fortification;
  if(enabled('siege')&&count(words,'siege')<s.maxActive&&Math.random()*100<s.chancePct){mark(w,'siege');w.valcrestRows=s.rows;w.el?.style?.setProperty('--valcrest-height',`${30*s.rows}px`);w.fallMult=(w.fallMult||1)*s.speedPct/100;w.y=Math.min(w.y,-30*s.rows);return;}
  if(enabled('fortification')&&count(words,'fortification')<f.maxActive&&Math.random()*100<f.chancePct){mark(w,'fortification');w.valcrestArmor=f.hits-1;w.fallMult=(w.fallMult||1)*f.speedPct/100;w.el?.setAttribute?.('data-armor',String(w.valcrestArmor));}
 }
 function armorHit(w){if(!(w?.valcrestArmor>0))return false;w.valcrestArmor--;if(w.valcrestArmor>0)w.el?.setAttribute?.('data-armor',String(w.valcrestArmor));else{w.el?.classList?.remove('valcrest-fortification');w.el?.removeAttribute?.('data-armor');}return true;}
 function finish(t){if(!event)return;due[event.id]=t+settings[event.id].intervalSec;event=null;recovery=t+3;for(const k of timed)if(enabled(k)&&due[k]<=t)due[k]=t+settings[k].intervalSec;lane?.removeAttribute?.('data-valcrest-event');lane?.removeAttribute?.('data-valcrest-side');}
 function removed(w,t=lastTime){if(event?.id==='duel'&&event.wordId===w?.id)finish(t);}
 function frame(t,{words=[],height=0,paused=false,spawn,notify=()=>{},field=null,fallSpeed=50,lupaActive=false}={}){
  if(!active)return false;lastTime=t;lane=field||lane;
  if(event?.id==='duel'&&event.wordId!=null){if(!words.some(w=>w.id===event.wordId))finish(t);else return true;}
  if(paused){if(event)event.next=Math.max(event.next,t+0.1);return !!event;}
  const stack=words.reduce((n,w)=>n+(w.state==='landed'?30*rows(w):0),0);
  const safe=height-stack>=120;
  if(!event){if(t<recovery||!safe)return false;const id=timed.find(k=>enabled(k)&&t>=due[k]&&(k!=='duel'||(!lupaActive&&!words.some(w=>w.ex1Highlighted||w.challengeComet)))); if(!id)return false;
   const s=settings[id];event={id,next:t+(id==='duel'?0.75:s.warningSec),remaining:s.count||1,wordId:null};lane?.setAttribute?.('data-valcrest-event',id);if(id==='encirclement')lane?.setAttribute?.('data-valcrest-side',side>0?'right':'left');notify(id.toUpperCase());return true;}
  if(t<event.next)return true;
  const {id}=event,s=settings[id];if(!safe){finish(t);return false;}
  let y=-30;
  if(id==='reinforcements')y=words.reduce((min,w)=>w.state==='falling'&&!w.foxfireHidden?Math.min(min,w.y-30):min,-30);
  if(id==='encirclement'){
   y=Math.floor(height*s.heightPct/100);const bottom=height-stack;
   // The entire entry row and 90px below it must be clear. Postpone instead of dropping onto a word.
   if(bottom-y<Math.max(120,30+2*fallSpeed)||words.some(w=>w.state==='falling'&&!w.foxfireHidden&&y<w.y+30*rows(w)+4&&y+34>w.y)){event.next=t+0.25;event.retries=(event.retries||0)+1;if(event.retries>=8){finish(t);return false;}return true;}
  }
  const w=spawn?.({state:'falling',y,countSpawn:false,skipMechanicHooks:true,valcrestEvent:id});
  if(!w){event.next=t+0.25;return true;}
  mark(w,id);
  if(id==='duel'){w.ignoreCollision=true;w.fallMult=(w.fallMult||1)*s.speedPct/100;w.valcrestDuelDamage=s.damagePct/100;w.valcrestMiss=s.damage;event.wordId=w.id;return true;}
  if(id==='encirclement'){w.valcrestEntryUntil=t+s.entrySec;w.el?.style?.setProperty('--valcrest-entry',`${s.entrySec}s`);w.el?.style?.setProperty('--valcrest-side',`${side*105}%`);side=-side;lane?.setAttribute?.('data-valcrest-side',side>0?'right':'left');w.el?.classList?.add('valcrest-entering');}
  event.remaining--;event.retries=0;if(event.remaining<=0){finish(t);return true;}event.next=t+(id==='reinforcements'?s.gapSec:Math.max(0.5,s.entrySec));return true;
 }
 function motion(w,t){if(!active)return 1;if(event?.id==='duel'&&event.wordId!=null&&w.id!==event.wordId)return 0;if(w.valcrestEntryUntil){if(t<w.valcrestEntryUntil)return 0;delete w.valcrestEntryUntil;w.el?.classList?.remove('valcrest-entering');}return 1;}
 window.RPG_VALCREST=Object.freeze({start,reset,markSpawn,armorHit,frame,motion,removed,rows,active:()=>active,busy:()=>!!event,dueling:()=>event?.id==='duel',inspect:()=>({active,event:event?{...event}:null,recovery,due:{...due}})});
})();

/* Vesper: exclusive word modifiers and one execution event on the battle clock. */
(function(){
 'use strict';
 const n=(key,label,min,max,step,def)=>({key,label,type:'number',min,max,step,default:def});
 const enable={key:'enabled',label:'Enabled',type:'boolean',default:false};
 const definitions=[
  {id:'poison',label:'Poison',description:'Landing applies damage over time. Clearing its source stops the damage; poison never stacks.',fields:[enable,n('chancePct','Chance (%)',0,100,1,15),n('damage','Damage per second (displayed HP)',1,10,1,2),n('durationSec','Duration (sec)',1,15,1,5),n('maxActive','Maximum words',1,4,1,2),n('speedPct','Falling speed (%)',50,200,5,100)]},
  {id:'blood_pact',label:'Blood Pact',description:'A marked word heals the boss once if it lands.',fields:[enable,n('chancePct','Chance (%)',0,100,1,15),n('healPct','Boss maximum HP restored (%)',0,15,1,3),n('maxActive','Maximum words',1,3,1,1),n('speedPct','Falling speed (%)',50,200,5,100)]},
  {id:'infiltration',label:'Infiltration',description:'A fast word bypasses the stack, inserts at the bottom and temporarily locks ordinary stacked words.',fields:[enable,n('chancePct','Chance (%)',0,100,1,10),n('speedPct','Falling speed (%)',100,300,5,200),n('lockSec','Maximum lockdown (sec)',1,10,1,5),n('maxActive','Maximum words',1,1,1,1),n('minGapSec','Minimum spawn gap (sec)',5,60,1,10)]},
  {id:'death_mark',label:'Death Mark',description:'Clear before its countdown ends. On expiry, one hit occurs and the word becomes normal.',fields:[enable,n('chancePct','Chance (%)',0,100,1,10),n('durationSec','Countdown (sec)',3,20,1,6),n('damage','Expiration damage (displayed HP)',0,100,1,10),n('maxActive','Maximum words',1,3,1,1),n('speedPct','Falling speed (%)',50,200,5,100)]},
  {id:'moonlit_execution',label:'Moonlit Execution',description:'Freeze falling words and spawning while marked existing words must be cleared. Lupa’s passive cannot overlap.',fields:[enable,n('intervalSec','Interval (sec)',10,120,1,25),n('count','Maximum targets',1,5,1,3),n('durationSec','Countdown (sec)',4,20,1,8),n('damage','Damage per remaining target (displayed HP)',0,100,1,10),n('maxDamage','Maximum total damage (displayed HP)',0,100,1,30)]}
 ];
 for(const d of definitions)window.RPG_MECHANICS?.register({...d,modes:['story'],defaultEnabled:false});
 let active=false,settings={},lastTime=0,lastInfil=-Infinity,due=Infinity,execution=null,poison=null,lock=null,lane=null,fieldWords=[],lupaPending=false,weakPoints=new Set();
 const enabled=id=>settings[id]?.enabled===true;
 const klass=(w,c,on)=>{const cl=w?.el?.classList;if(!cl)return;if(cl.contains?.(c)===on)return;if(on)cl.add(c);else cl.remove(c);};
 const has=(w,c)=>!!w?.el?.classList?.contains?.(c);
 const eligible=w=>w&&!w.operatorHexSummoned&&!w.chainHexed&&!w.foxfireHidden&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost&&!w.challengeComet&&!w.ex1Highlighted&&!w.chapterPanic&&!w.valcrestKind;
 const normal=w=>eligible(w)&&!w.vesperKind&&!w.vesperExecution;
 const display=(el,key,text)=>{if(el?.getAttribute?.(key)!==text)el?.setAttribute?.(key,text);};
 const markTime=(w,text)=>{display(w.el,'data-vesper-time',text);display(w.tagEl,'data-vesper-time',text);};
 function refreshLocks(words=fieldWords){for(const w of words){if(lock||has(w,'vesper-locked'))klass(w,'vesper-locked',locked(w));}}
 function locked(w){return !!(active&&lock&&!execution&&w?.state==='landed'&&!w.vesperKind&&!w.vesperExecution&&!weakPoints.has(w.id)&&!has(w,'operator-lupa-weakpoint')&&!has(w,'operator-hound-prey')&&!has(w,'operator-phantom-mark')&&!has(w,'operator-nitrate-wrath')&&!has(w,'operator-crossbow-bullseye'));}
 function clearExecution(t){if(!execution)return;for(const w of fieldWords){delete w.vesperExecution;klass(w,'vesper-execution-target',false);}execution=null;due=t+settings.moonlit_execution.intervalSec;lane?.removeAttribute?.('data-vesper-execution');refreshLocks();}
 function reset(){for(const w of fieldWords){delete w.vesperExecution;klass(w,'vesper-execution-target',false);klass(w,'vesper-locked',false);}lane?.removeAttribute?.('data-vesper-execution');lane=null;active=false;settings={};lastTime=0;lastInfil=-Infinity;due=Infinity;execution=poison=lock=null;fieldWords=[];weakPoints=new Set();lupaPending=false;}
 function start(mode,id,t=0){reset();if(mode!=='story'||!/^3-[1-9]\d*$/.test(String(id)))return;
  for(const d of definitions){settings[d.id]={};for(const f of d.fields){const v=window.RPG_BALANCE?.mechanic(d.id,f.key,f.default)??f.default;settings[d.id][f.key]=f.type==='boolean'?v===true:typeof v==='number'&&Number.isFinite(v)?Math.min(f.max,Math.max(f.min,f.step===1?Math.round(v):v)):f.default;}}
  active=definitions.some(d=>enabled(d.id));lastTime=t;due=t+settings.moonlit_execution.intervalSec;
 }
 function markSpawn(w,words,t=lastTime){if(!active||execution||!normal(w)||w.state!=='falling')return;fieldWords=words;
  // A single probability roll gives exclusive modifiers their actual configured chance when total <=100%.
  let roll=Math.random()*100;
  for(const id of ['infiltration','death_mark','poison','blood_pact']){
   const s=settings[id];if(!enabled(id)||words.filter(v=>v.vesperKind===id).length>=s.maxActive||(id==='infiltration'&&t-lastInfil<s.minGapSec))continue;
   if(roll>=s.chancePct){roll-=s.chancePct;continue;}
   w.vesperKind=id;klass(w,'vesper-'+id,true);w.fallMult=(w.fallMult||1)*s.speedPct/100;
   if(id==='infiltration'){lastInfil=t;w.ignoreCollision=true;}
   if(id==='death_mark'){w.vesperRemaining=s.durationSec;w.vesperClock=t;markTime(w,s.durationSec.toFixed(1));}
   return;
  }
 }
 function land(w,t,heal=()=>{}){if(!active||!w?.vesperKind||w.vesperLanded)return;w.vesperLanded=true;
  if(w.vesperKind==='blood_pact')heal(settings.blood_pact.healPct/100);
  else if(w.vesperKind==='poison'&&!poison){poison={id:w.id,remaining:settings.poison.durationSec,acc:0,clock:t};klass(w,'vesper-poison-active',true);}
  else if(w.vesperKind==='infiltration'){lock={id:w.id,remaining:settings.infiltration.lockSec,clock:t};w.ignoreCollision=false;w.vesperBottom=true;refreshLocks();}
 }
 function removed(w,t=lastTime){if(!active||!w)return;if(poison?.id===w.id)poison=null;if(lock?.id===w.id){lock=null;refreshLocks();}if(execution?.ids.delete(w.id)&&!execution.ids.size)clearExecution(t);}
 function frame(t,{words=[],field=null,lupaActive=false,lupaTargets=[],paused=false,grace=false,damage=()=>{},notify=()=>{}}={}){
  if(!active)return false;fieldWords=words;lane=field||lane;const dt=Math.max(0,t-lastTime);lastTime=t;weakPoints=new Set(lupaTargets);let hits=0,executionHit=0;
  const wasExecution=!!execution;
  if(execution){for(const id of execution.ids)if(!words.some(w=>w.id===id&&!w.foxfireHidden))execution.ids.delete(id);
   if(!execution.ids.size)clearExecution(t);
   else {execution.remaining=Math.max(0,execution.remaining-(grace?0:dt));if(execution.remaining<=0){executionHit=Math.min(settings.moonlit_execution.maxDamage,execution.ids.size*settings.moonlit_execution.damage);clearExecution(t);}
    else display(lane,'data-vesper-execution',`MOONLIT EXECUTION · ${execution.remaining.toFixed(1)}s · ${execution.ids.size}`);}
  }
  // Resolve a due execution before ticking other threats; no concurrent deadline damage.
  if(!wasExecution&&!execution&&enabled('moonlit_execution')&&t>=due&&!lupaActive&&!lupaPending&&!paused){
   const candidates=words.filter(w=>normal(w)&&(w.state==='landed'||(w.state==='falling'&&w.y>=0))&&!has(w,'operator-hound-prey')&&!has(w,'operator-phantom-mark')).sort((a,b)=>(b.state==='landed')-(a.state==='landed')||b.y-a.y).slice(0,settings.moonlit_execution.count);
   if(candidates.length){execution={ids:new Set(candidates.map(w=>w.id)),remaining:settings.moonlit_execution.durationSec};for(const w of candidates){w.vesperExecution=true;klass(w,'vesper-execution-target',true);}display(lane,'data-vesper-execution',`MOONLIT EXECUTION · ${execution.remaining.toFixed(1)}s · ${execution.ids.size}`);notify('MOONLIT EXECUTION');}
  }
  const suspended=wasExecution||!!execution||grace;
  if(lock){const w=words.find(v=>v.id===lock.id&&v.state==='landed');if(!w)lock=null;else {if(!suspended)lock.remaining-=Math.max(0,t-Math.max(t-dt,lock.clock));if(lock.remaining<=0)lock=null;}}
  if(poison){const w=words.find(v=>v.id===poison.id&&v.state==='landed');if(!w){if(words.some(v=>v.id===poison.id))klass(words.find(v=>v.id===poison.id),'vesper-poison-active',false);poison=null;}
   else if(!suspended){const d=Math.min(poison.remaining,Math.max(0,t-Math.max(t-dt,poison.clock)));poison.remaining-=d;poison.acc+=d;const ticks=Math.floor(poison.acc+1e-8);poison.acc-=ticks;hits+=ticks*settings.poison.damage;if(poison.remaining<=1e-8){klass(w,'vesper-poison-active',false);poison=null;}}
  }
  for(const w of words){if(w.vesperKind!=='death_mark')continue;const d=Math.max(0,t-Math.max(t-dt,w.vesperClock??t));w.vesperClock=t;const unreadable=!!w.foxfireHidden||(w.state==='falling'&&w.y<0);if(!suspended&&!unreadable&&!w.vesperUnreadable)w.vesperRemaining-=d;w.vesperUnreadable=unreadable;
   if(w.vesperRemaining<=0){hits+=settings.death_mark.damage;delete w.vesperKind;klass(w,'vesper-death_mark',false);w.el?.removeAttribute?.('data-vesper-time');w.tagEl?.removeAttribute?.('data-vesper-time');w.fallMult=(w.fallMult||1)*100/settings.death_mark.speedPct;}
   else markTime(w,Math.max(0,w.vesperRemaining).toFixed(1));}
  refreshLocks();
  if(executionHit>0)damage(executionHit/10,'Moonlit Execution');else if(hits>0)damage(hits/10,'Vesper');
  return !!execution;
 }
 function motion(){return execution?0:1;}
 function deferLupa(){if(!execution)return false;lupaPending=true;return true;}
 function takeLupa(){if(execution||!lupaPending)return false;lupaPending=false;return true;}
 function retireLupa(){lupaPending=false;weakPoints.clear();}
 window.RPG_VESPER=Object.freeze({start,reset,markSpawn,land,removed,frame,motion,locked,deferLupa,takeLupa,retireLupa,active:()=>active,executing:()=>!!execution,inspect:()=>({active,lock:lock?{...lock}:null,poison:poison?{...poison}:null,execution:execution?{remaining:execution.remaining,ids:[...execution.ids]}:null,lupaPending})});
})();
