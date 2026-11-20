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
  {id:'sleepy',label:'Sleepy · Blinking',description:'The screen gradually closes like eyelids. During complete darkness, words and spawn timers stop. Delirium can change words at the closed moment.',
   fields:[
    {key:'enabled',label:'Enabled',type:'boolean',default:false},
    {key:'minIntervalSec',label:'Shortest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:16},
    {key:'maxIntervalSec',label:'Longest time between blinks (sec)',type:'number',min:4,max:120,step:1,default:22},
    {key:'closingSec',label:'Eyelids closing (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.6},
    {key:'closedSec',label:'Fully closed (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.8},
    {key:'openingSec',label:'Eyelids reopening (sec)',type:'number',min:0.2,max:4,step:0.1,default:0.6}
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
 let active=false,stageId='',nextBlink=Infinity,blink=null,fullyClosed=false,lastPanicAt=-Infinity,overlay=null,top=null,bottom=null;
 const settings={
  sleepy:{enabled:false,minIntervalSec:16,maxIntervalSec:22,closingSec:0.6,closedSec:0.8,openingSec:0.6},
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
 function ensureOverlay(){
  if(typeof document==='undefined'||!document.body)return;
  if(overlay?.isConnected)return;
  overlay=document.createElement('div');overlay.className='chapter-sleep-veil';overlay.setAttribute('aria-hidden','true');overlay.hidden=true;
  top=document.createElement('div');top.className='sleep-lid sleep-lid-top';
  bottom=document.createElement('div');bottom.className='sleep-lid sleep-lid-bottom';
  overlay.append(top,bottom);document.body.appendChild(overlay);
 }
 function setClosure(fraction){
  if(!overlay)return;
  const f=Math.max(0,Math.min(1,fraction));
  overlay.hidden=f<=0;
  if(top)top.style.transform=`translate3d(0,${(f-1)*100}%,0)`;
  if(bottom)bottom.style.transform=`translate3d(0,${(1-f)*100}%,0)`;
 }
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
  if(t<closing)fraction=t/closing;
  else if(t<closing+closed){fraction=1;
   if(!blink.changed){blink.changed=true;if(typeof onClosed==='function')onClosed();mutateWords(words,vocabulary,normalize);}
  }else if(t<total)fraction=1-(t-closing-closed)/opening;
  else{blink=null;nextBlink=elapsed+rollInterval();}
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
