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
  {id:'sleepy',label:'Sleepy · Fighting Sleep',description:'Heavy eyelids droop, flutter partially open, then finally close. Words keep falling even while vision is blocked. New normal spawns pause during complete darkness; Delirium changes words when the eyes close.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'minIntervalSec',label:'Shortest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:16},
    {key:'maxIntervalSec',label:'Longest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:22},
    {key:'closingSec',label:'Fighting sleep / closing (sec)',type:'number',min:0.2,max:4,step:0.1,default:1.8},
    {key:'closedSec',label:'Fully closed (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.8},
    {key:'openingSec',label:'Eyelids reopening (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.8}
   ]},
  {id:'delirium',label:'Delirium · Changed Words',description:'Requires Sleepy. Each time the eyelids fully close, change the text of existing falling and stacked words using the current stage vocabulary. Positions and special marks are preserved.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'changePercent',label:'Words changed (%)',type:'number',min:0,max:100,step:5,default:100}
   ]},
  {id:'panic',label:'Panic · Dangerous Words',description:'Some naturally spawned words become red Panic words. They pass through other words, never stack, and deal damage when they reach the bottom.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'chancePct',label:'Chance per regular spawn (%)',type:'number',min:0,max:100,step:1,default:15},
    {key:'maxActive',label:'Maximum active Panic words',type:'number',min:1,max:8,step:1,default:2},
    {key:'minGapSec',label:'Minimum time between Panic spawns (sec)',type:'number',min:0,max:30,step:0.5,default:5},
    {key:'damage',label:'Damage when reaching bottom',type:'number',min:1,max:10,step:1,default:1}
   ]}
 ];
 for(const item of definitions)window.RPG_MECHANICS?.register({...item,modes:['story'],defaultEnabled:false});
 let active=false,stageId='',nextBlink=Infinity,blink=null,fullyClosed=false,lastPanicAt=-Infinity,overlay=null,upperLid=null,lowerLid=null,upperFeather=null,lowerFeather=null;
 const settings={
  sleepy:{enabled:false,minIntervalSec:16,maxIntervalSec:22,closingSec:1.8,closedSec:0.8,openingSec:0.8},
  delirium:{enabled:false,changePercent:100},
  panic:{enabled:false,chancePct:15,maxActive:2,minGapSec:5,damage:1}
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
 function reset(){active=false;stageId='';blink=null;nextBlink=Infinity;fullyClosed=false;lastPanicAt=-Infinity;setClosure(0);}
 function start(mode,id,elapsedAtStart=0){
  reset();if(mode!=='story'||!/^1-[1-9]\d*$/.test(String(id||'')))return;
  active=true;stageId=String(id);config();ensureOverlay();
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
   relabel(w,entry,normalize);changed++;
  }
  return changed;
 }
 function frame(elapsed,{words=[],vocabulary=[],normalize=s=>String(s).trim().toLowerCase(),onClosed=null}={}){
  if(!active||!settings.sleepy.enabled){fullyClosed=false;setClosure(0);return false;}
  if(!blink&&elapsed>=nextBlink)blink={start:elapsed,changed:false};
  if(!blink){fullyClosed=false;return false;}
  const s=settings.sleepy;
  const t=Math.max(0,elapsed-blink.start);
  const closing=s.closingSec,closed=s.closedSec,opening=s.openingSec,total=closing+closed+opening;
  let fraction=0;
  // Delirium must fire exactly once even if a slow frame skips the closed hold.
  if(t>=closing&&!blink.changed){blink.changed=true;if(typeof onClosed==='function')onClosed();mutateWords(words,vocabulary,normalize);}
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
  setClosure(fraction);return fullyClosed;
 }
 function markSpawn(word,elapsed,words){
  if(!active||!settings.panic.enabled||!word||word.state!=='falling'||fullyClosed)return false;
  const p=settings.panic;
  if(elapsed-lastPanicAt<p.minGapSec||words.filter(w=>w?.chapterPanic&&w.state==='falling').length>=p.maxActive)return false;
  if(Math.random()*100>=p.chancePct)return false;
  word.chapterPanic=true;word.ignoreCollision=true;lastPanicAt=elapsed;
  word.el?.classList?.add('chapter-panic-word');return true;
 }
 function panicDamage(){return settings.panic.damage;}
 function suspend(){setClosure(0);}
 const api=Object.freeze({start,reset,suspend,frame,markSpawn,panicDamage,isFullyClosed:()=>fullyClosed,inspect:()=>({active,stageId,fullyClosed,nextBlink,blinkStart:blink?.start??null,settings:JSON.parse(JSON.stringify(settings))})});
 window.RPG_CH1_SPECIAL=api;
})();
