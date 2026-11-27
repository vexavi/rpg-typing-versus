/* Guided first-time tutorial (v148.9).
   Lessons 1–4 run on a battle screen that uses the SAME stylesheets and layout as Normal
   Mode, so students meet exactly what they will see later:
     1 Type a word   · 2 Taking damage · 3 Falling words · 4 Defeat the boss
   Lesson 5 is the REAL Mode Select + Recruitment with guard rails (tutorial-guide.js).
   Saved checkpoints (Firestore tutorial.step): 2 after Lesson 2, 3 after Lesson 3,
   4 after Lesson 4. Training never awards HP, XP, Guild Coins or rankings.
*/
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
// A preview must never change the live student's sessionStorage card credentials.
const demo=query.has('demo')||/tutorial-preview\.html$/.test(location.pathname);
const replay=query.has('replay')||demo;
const context=demo?(window.RPG_TUTORIAL_DEMO_CONTEXT||{}):(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
const cloud=window.RPG_V66;
const code=context.card_code;
const TOTAL=5;
const samples={
  1:[{prompt:'りんご',answer:'apple'}],
  2:[{prompt:'りんご',answer:'apple'}],
  3:[{prompt:'ねこ',answer:'cat'},{prompt:'たいよう',answer:'sun'},{prompt:'ほん',answer:'book'}],
  4:[{prompt:'みどり',answer:'green'},{prompt:'みず',answer:'water'},{prompt:'うれしい',answer:'happy'}]
};
const titles={1:'Type a word',2:'Taking damage',3:'Falling words',4:'Defeat the boss'};
// Firestore checkpoint saved when a lesson is finished (Lesson 1 continues straight into 2).
const saveStepAfter={2:2,3:3,4:4};
const lessonForStep=s=>s>=3?4:s>=2?3:1;

let stage=1,stepCount=0,playerHP=10,bossHP=3,misses=0,score=0,frameId=null,startMs=0,busy=false;
let phase='';            // sub-step inside a lesson
let focusSel=[];         // spotlight cut-outs for the current sub-step
let onNext=null;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(message){$('messageLog').textContent=message||'';}
function status(message){$('status').textContent=message||'';}
const input=()=>$('answerInput');

// ---- coach + spotlight -----------------------------------------------------------
function coach({title,text,next=null,enter=false,focus=[],arrows=[]}){
 setArrows(arrows);
 if(title)$('lessonTitle').textContent=title;
 $('lessonObjective').textContent=text||'';
 $('enterKey').hidden=!enter;$('enterKey').querySelector('.tutorial-keycap').classList.remove('is-pressed');
 onNext=next;$('coachNext').hidden=!next;
 focusSel=focus;startSpotlight();
 if(next)setTimeout(()=>$('coachNext').focus({preventScroll:true}),30);
}
$('coachNext').addEventListener('click',()=>{const f=onNext;onNext=null;$('coachNext').hidden=true;f?.();});
const spotlightCanvas=$('tutorialSpotlight');
const spotlightContext=spotlightCanvas?.getContext('2d');
let spotlightFrame=null,lastSpotlightPaint=0;
const OUTLINED=new Set(['#trainingWord','.inputBar','#trainingWord .answer','#tutorialPlayerRow','#overflowBadge','#storyBossHpRow']);
// Big animated arrows (and a "?" badge) pointing at the lesson targets.
// Each entry: {sel, dir:'up'|'down'|'left'|'right'} (dir = where the arrow POINTS) or {sel, mark:'?'}.
let arrowSpecs=[],arrowEls=[];
function setArrows(list){
 arrowEls.forEach(el=>el.remove());arrowEls=[];arrowSpecs=list||[];
 for(const a of arrowSpecs){
  const el=document.createElement('div');
  if(a.mark){el.className='tut-q';el.innerHTML='<span>?</span>';}
  else{el.className='tut-arrow';el.dataset.dir=a.dir;
   el.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 60 34H43v26H21V34H4z"/></svg>';}
  el.setAttribute('aria-hidden','true');el.style.visibility='hidden';
  document.body.append(el);arrowEls.push(el);
 }
 placeArrows();
}
function placeArrows(){
 arrowSpecs.forEach((a,i)=>{
  const el=arrowEls[i],t=document.querySelector(a.sel);
  if(!el)return;
  if(!t||!t.getClientRects().length){el.style.visibility='hidden';return;}
  const r=t.getBoundingClientRect(),S=a.mark?56:66,g=a.gap??10;
  let x,y;
  if(a.mark){x=r.right-S-(a.inset??14);y=r.top+r.height/2-S/2;}
  else if(a.dir==='up'){x=r.left+r.width/2-S/2;y=r.bottom+g;}
  else if(a.dir==='down'){x=r.left+r.width/2-S/2;y=r.top-S-g;}
  else if(a.dir==='left'){x=r.right+g;y=r.top+r.height/2-S/2;}
  else{x=r.left-S-g;y=r.top+r.height/2-S/2;}
  el.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;el.style.visibility='visible';
 });
}
addEventListener('resize',placeArrows,{passive:true});
function stopSpotlight(){
 if(spotlightFrame!==null)cancelAnimationFrame(spotlightFrame);
 spotlightFrame=null;
 if(spotlightCanvas)spotlightCanvas.hidden=true;
}
function drawSpotlight(timestamp=0){
 if(!spotlightContext||stage>4||$('tutorialApp').hidden){stopSpotlight();return;}
 // Limit full-screen repaint work on school Chromebooks while tracking falling words.
 const interval=frameId===null?140:42;
 if(timestamp-lastSpotlightPaint<interval){spotlightFrame=requestAnimationFrame(drawSpotlight);return;}
 lastSpotlightPaint=timestamp;
 const vw=window.innerWidth,vh=window.innerHeight;
 if(spotlightCanvas.width!==vw||spotlightCanvas.height!==vh){spotlightCanvas.width=vw;spotlightCanvas.height=vh;}
 spotlightContext.clearRect(0,0,vw,vh);
 spotlightContext.fillStyle='rgba(5, 8, 12, 0.64)';
 spotlightContext.fillRect(0,0,vw,vh);
 const targets=[];
 for(const selector of ['#trainingCoach',...focusSel]){
  for(const element of document.querySelectorAll(selector)){
   if(!element.getClientRects().length||element.hidden)continue;
   const r=element.getBoundingClientRect(),pad=selector==='#trainingWord .answer'?6:4;
   const left=Math.max(0,r.left-pad),top=Math.max(0,r.top-pad),right=Math.min(vw,r.right+pad),bottom=Math.min(vh,r.bottom+pad);
   if(right<=left||bottom<=top)continue;
   targets.push({x:left,y:top,w:right-left,h:bottom-top,outline:OUTLINED.has(selector)});
  }
 }
 for(const r of targets)spotlightContext.clearRect(r.x,r.y,r.w,r.h);
 spotlightContext.strokeStyle='#fff200';spotlightContext.lineWidth=3;
 for(const r of targets)if(r.outline)spotlightContext.strokeRect(r.x+1.5,r.y+1.5,r.w-3,r.h-3);
 placeArrows();
 spotlightFrame=requestAnimationFrame(drawSpotlight);
}
function startSpotlight(){
 if(!spotlightContext||stage>4)return stopSpotlight();
 spotlightCanvas.hidden=false;
 if(spotlightFrame===null)spotlightFrame=requestAnimationFrame(drawSpotlight);
}

// ---- battle helpers ---------------------------------------------------------------
function stop(){if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}}
function routeMenu(){
 if(demo){location.replace('tutorial-preview.html?demo=1');return;}
 // Lesson 5 happens on the REAL Mode Select; the engine adds the guard rails.
 sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');
 location.replace('adventure.html?card='+encodeURIComponent(code||''));
}
function updateBars(){
 $('playerFill').style.width=`${playerHP*10}%`;$('playerHpText').textContent=`${playerHP}/10`;
 $('bossFill').style.width=`${bossHP/3*100}%`;$('bossHpText').textContent=`${bossHP}/3`;
 $('mistakesText').textContent=String(misses);$('scoreText').textContent=String(score);
}
function updateProgress(){$('progressText').textContent=`${stepCount} / ${(samples[stage]||[]).length} words cleared`;}
function flashDamage(){const f=$('damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');setTimeout(()=>f.classList.remove('show'),320);}
function setInput({enabled=true,value='',readOnly=false}={}){
 const el=input();el.disabled=!enabled;el.readOnly=readOnly;el.value=value;
 if(enabled)setTimeout(()=>el.focus({preventScroll:true}),30);
}
// Same markup as a real Normal Mode word.
function spawnWord(record,{falling=false}={}){
 stop();const lane=$('wordLane');lane.replaceChildren();
 const word=document.createElement('div');word.className='word';word.id='trainingWord';
 word.innerHTML=`<div class="prompt">${escapeHtml(record.prompt)}</div><div class="right"><span class="tag"></span><span class="answer muted">${escapeHtml(record.answer)}</span></div>`;
 word.style.setProperty('--y','18px');
 lane.appendChild(word);
 if(!falling)return word;
 startMs=performance.now();
 const travel=stage===3?16000:13000;
 let landed=false;
 function tick(ts){
  if(busy||!word.isConnected){frameId=null;return;}
  const distance=Math.max(10,lane.clientHeight-word.getBoundingClientRect().height-20);
  const y=18+Math.min(1,(ts-startMs)/travel)*Math.max(0,distance-18);
  word.style.setProperty('--y',`${y}px`);
  if(!landed&&ts-startMs>=travel){
   landed=true;word.classList.add('landed');
   // Real rule: a landed word piles up at the bottom (no damage until OVERFLOW).
   log('It landed at the bottom — you can still type it!');
  }
  frameId=landed?null:requestAnimationFrame(tick);
 }
 frameId=requestAnimationFrame(tick);
 return word;
}
function clearWord(){stop();$('wordLane').replaceChildren();}

// Lesson 2 demo: a rush of fast words piles up until OVERFLOW, then HP ticks down to 1.
const RUSH=[['いぬ','dog'],['あか','red'],['やま','mountain'],['うみ','sea'],['ほし','star'],['はな','flower'],['くるま','car'],['とり','bird'],
 ['そら','sky'],['き','tree'],['かわ','river'],['つき','moon'],['あめ','rain'],['ゆき','snow'],['かぜ','wind'],['ひ','fire'],['いし','stone'],['みち','road'],
 ['まど','window'],['いす','chair'],['つくえ','desk'],['かさ','umbrella'],['ふね','ship'],['くつ','shoes'],['かぎ','key'],['さかな','fish']];
let demoTimers=[];
function demoLater(fn,ms){const t=setTimeout(fn,ms);demoTimers.push(t);return t;}
function overflowDemo(){
 phase='l2-overflow';setInput({enabled:false});clearWord();
 coach({focus:['.wordLane','#tutorialPlayerRow'],text:'Words you do not clear fall to the bottom and pile up. Watch what happens when lots of words fall at once…'});
 const lane=$('wordLane'),rowH=30;
 const rows=Math.floor(lane.clientHeight/rowH);   // same OVERFLOW rule as the real game
 const words=[];let i=0;
 const spawn=()=>{
  if(i>=rows){startOverflow();return;}
  const [jp,en]=RUSH[i%RUSH.length];
  const w=document.createElement('div');w.className='word';
  w.innerHTML=`<div class="prompt">${escapeHtml(jp)}</div><div class="right"><span class="tag"></span><span class="answer muted">${escapeHtml(en)}</span></div>`;
  w.style.setProperty('--y','-30px');lane.appendChild(w);
  const target=lane.clientHeight-rowH*(i+1)-4;   // pile from the bottom up
  words.push({w,target,start:performance.now()});i++;
  demoLater(spawn,170);
 };
 const fall=ts=>{
  let moving=false;
  for(const o of words){
   const t=Math.min(1,(ts-o.start)/520),y=-30+(o.target+30)*t*t;
   o.w.style.setProperty('--y',`${y}px`);
   if(t<1)moving=true;else o.w.classList.add('landed');
  }
  if(phase==='l2-overflow'&&(moving||i<rows))frameId=requestAnimationFrame(fall);else frameId=null;
 };
 frameId=requestAnimationFrame(fall);spawn();
}
function startOverflow(){
 $('overflowBadge').classList.add('show');
 coach({focus:['.wordLane','#overflowBadge','#tutorialPlayerRow'],arrows:[{sel:'#overflowBadge',dir:'up'},{sel:'#tutorialPlayerRow',dir:'down'}],
  text:'OVERFLOW! The pile reached the top, so you lose 1 HP every second until you clear words. Watch your HP…'});
 const tickHp=()=>{
  if(phase!=='l2-overflow')return;
  if(playerHP>1){playerHP--;updateBars();flashDamage();log(`OVERFLOW · HP ${playerHP}/10`);demoLater(tickHp,1000);return;}
  // Stop at 1 HP: the tutorial never makes them lose.
  coach({focus:['#tutorialPlayerRow','#overflowBadge'],arrows:[{sel:'#overflowBadge',dir:'up'},{sel:'#tutorialPlayerRow',dir:'down'}],
   text:'Your HP dropped to 1! In a real battle you would lose at 0. Clear words quickly so the pile never reaches the top.',
   next:()=>{
    demoTimers.forEach(clearTimeout);demoTimers=[];stop();
    $('overflowBadge').classList.remove('show');clearWord();
    playerHP=10;updateBars();log('HP restored for the tutorial.');
    spawnWord(samples[2][0]);phase='l2-fix';setInput({enabled:true});
    coach({focus:['.inputBar','#trainingWord'],arrows:[{sel:'.inputBar',dir:'left'}],enter:true,text:'Your HP is back to 10. Now type apple correctly and press ENTER to clear it.'});
   }});
 };
 demoLater(tickHp,900);
}

// ---- lessons ----------------------------------------------------------------------
function lesson(i){
 stop();stage=i;stepCount=0;busy=false;phase='';setArrows([]);
 bossHP=3;
 $('retryTutorialSave').hidden=true;$('overflowBadge').classList.remove('show');
 $('stepCounter').textContent=`LESSON ${String(i).padStart(2,'0')} / ${String(TOTAL).padStart(2,'0')}`;
 $('stageName').textContent=`Lesson ${i}`;
 $('lessonTitle').textContent=titles[i]||'';
 log('');status('');clearWord();updateBars();updateProgress();
 if(i>=5){
  // The live tutorial continues on the real Mode Select. Only the teacher preview
  // (no player account) keeps a stand-in menu.
  if(!demo){routeMenu();return;}
  showDemoModeSelect();return;
 }
 ({1:lesson1,2:lesson2,3:fallingLesson,4:fallingLesson})[i]();
}
// Pip (the tutorial bot) introduces itself before Lesson 1, using the real boss speech bubble.
function pipSays(text){const b=$('bossBubble');b.textContent=text;b.classList.remove('show');void b.offsetWidth;b.classList.add('show');}
function pipQuiet(){const b=$('bossBubble');b.classList.remove('show');b.textContent='';}
function lesson1(){
 setInput({enabled:false});phase='pip';
 $('progressText').hidden=true;
 pipSays('Hello! My name is Pip.');
 coach({title:'Pip',focus:['#bossWrap'],text:'Hello! My name is Pip.',
  next:()=>{
   pipSays('Let me help you!');
   coach({title:'Pip',focus:['#bossWrap'],text:'Let me help you!',next:()=>{pipQuiet();$('progressText').hidden=false;lesson1Word();}});
  }});
}
function lesson1Word(){
 spawnWord(samples[1][0]);setInput({enabled:false});
 phase='l1-answer';
 coach({title:'Type a word',focus:['#trainingWord .answer'],arrows:[{sel:'#trainingWord .answer',dir:'up'}],
  text:'Every word shows Japanese on the left and its English answer on the right. The English word is important — it is exactly what you type!',
  next:()=>{
   phase='l1-type';setInput({enabled:true});
   coach({focus:['.inputBar','#trainingWord'],arrows:[{sel:'.inputBar',dir:'left'}],text:'This is where you type. Click the box and type apple.'});
  }});
}
function lesson2(){
 spawnWord(samples[2][0]);
 phase='l2-wrong';
 setInput({enabled:true,value:'aple',readOnly:true});
 coach({title:'Taking damage',focus:['.inputBar','#trainingWord'],enter:true,arrows:[{sel:'#trainingWord .answer',dir:'up'},{sel:'.inputBar',dir:'left'},{sel:'.inputBar',mark:'?'}],
  text:'What happens if you make a mistake? Someone typed "aple" instead of "apple". Press ENTER and watch your HP.'});
}
function fallingLesson(){
 phase='falling';
 const isBoss=stage===4;
 coach({title:titles[stage],arrows:isBoss?[{sel:'#storyBossHpRow',dir:'down'},{sel:'.inputBar',dir:'left'}]:[],focus:isBoss?['#trainingWord','.inputBar','.wordLane','#bossWrap','#storyStatusPanel']:['#trainingWord','.inputBar','.wordLane'],
  text:isBoss?'Every correct word hits the boss. Clear all three words to defeat it!':'Words fall toward the bottom. Type each English word and press ENTER to clear it.'});
 nextFallingWord();
}
function nextFallingWord(){
 const record=samples[stage]?.[stepCount];if(!record){void advance();return;}
 spawnWord(record,{falling:true});setInput({enabled:true});updateProgress();
}
async function advance(){
 if(busy)return;
 busy=true;stop();input().disabled=true;
 const finished=stage,save=saveStepAfter[finished];
 $('retryTutorialSave').hidden=true;
 if(!save){status('');log('Lesson complete!');await new Promise(r=>setTimeout(r,700));busy=false;lesson(finished+1);return;}
 status('Saving lesson progress…');
 try{
  if(!replay)await cloud.call('/api/tutorial/progress',{card_code:code,step:save});
  status('');log('Lesson complete!');
  await new Promise(r=>setTimeout(r,700));
  busy=false;lesson(finished+1);
 }catch(e){
  busy=false;
  log('Lesson cleared. Progress could not be confirmed: '+String(e?.message||e));
  status('Press RETRY SAVING to continue. Your cleared words will not be lost.');
  $('retryTutorialSave').hidden=false;
  $('retryTutorialSave').focus({preventScroll:true});
 }
}
$('retryTutorialSave').addEventListener('click',()=>{busy=false;void advance();});

// Lesson 1: the Enter key appears once "apple" is typed.
input().addEventListener('input',()=>{
 if(stage!==1)return;
 const ok=input().value.trim().toLowerCase()==='apple';
 if(phase==='l1-type'&&ok){phase='l1-enter';coach({focus:['.inputBar','#trainingWord'],enter:true,text:'Perfect! Now press the ENTER key on your keyboard.'});}
 else if(phase==='l1-enter'&&!ok){phase='l1-type';coach({focus:['.inputBar','#trainingWord'],arrows:[{sel:'.inputBar',dir:'left'}],text:'Type apple in the box.'});}
});

$('answerForm').addEventListener('submit',e=>{
 e.preventDefault();if(busy)return;
 const value=input().value.trim().toLowerCase();
 const keycap=$('enterKey').querySelector('.tutorial-keycap');keycap.classList.add('is-pressed');
 if(stage===1){
  if(phase!=='l1-enter'||value!=='apple'){log('Type apple exactly, then press ENTER.');keycap.classList.remove('is-pressed');return;}
  stepCount=1;score+=100;updateBars();updateProgress();clearWord();input().value='';
  log('Correct! The word is cleared.');coach({focus:[],text:'Great job! Correct words disappear and give you points.'});
  void advance();return;
 }
 if(stage===2){
  if(phase==='l2-wrong'){
   // Same rule as the real game: a wrong answer is a miss and costs 1 HP.
   misses++;playerHP=Math.max(1,playerHP-1);updateBars();flashDamage();input().value='';input().readOnly=true;
   log('MISS: aple');phase='l2-hp';
   coach({focus:['#tutorialPlayerRow'],
    text:'Ouch! A wrong answer is a MISS and costs 1 HP (10 → 9). If your HP reaches 0, the run is over.',
    next:()=>overflowDemo()});
   return;
  }
  if(phase!=='l2-fix')return;
  if(value!=='apple'){log('Not quite! Type apple, then press ENTER.');keycap.classList.remove('is-pressed');input().select();return;}
  stepCount=1;score+=100;updateBars();clearWord();log('Correct!');void advance();return;
 }
 // Lessons 3–4: falling words. Mistakes here are free (practice).
 const current=samples[stage]?.[stepCount];if(!current)return;
 if(value!==current.answer){misses++;updateBars();log('Not quite! Check the English word and try again.');input().select();return;}
 stop();stepCount++;score+=100;
 if(stage===4){
  bossHP=Math.max(0,3-stepCount);
  const boss=$('bossImg');boss.classList.remove('bossFlash');void boss.offsetWidth;boss.classList.add('bossFlash');
 }
 updateBars();updateProgress();log('Correct!');clearWord();input().value='';
 if(stepCount>=samples[stage].length)void advance();else nextFallingWord();
});
// Keep typing focused on the answer box, like the real battle.
document.addEventListener('pointerdown',e=>{if(stage<=4&&!busy&&!e.target.closest('button')&&!input().disabled)setTimeout(()=>input().focus({preventScroll:true}),0);});

// Teacher preview only: a stand-in for the real Mode Select (no account to open it with).
function showDemoModeSelect(){
 stopSpotlight();$('trainingCoach').hidden=true;
 const choices=$('tutorialModeChoices');choices.replaceChildren();
 for(const title of ['Normal Mode','Practice','???','???','Recruitment','Collection','Rankings']){
  const button=document.createElement('button');
  button.type='button';
  button.className='choiceBtn student-mode-card'+(title==='Recruitment'?' tutorial-target':' disabled');
  button.disabled=title!=='Recruitment';
  const label=document.createElement('span');label.className='title';label.textContent=title;
  button.appendChild(label);
  if(title==='Recruitment')button.addEventListener('click',()=>location.assign('recruitment-preview-v84.html?tutorial=demo'));
  choices.appendChild(button);
 }
 $('tutorialModeOverlay').classList.add('show');$('tutorialModeOverlay').setAttribute('aria-hidden','false');
 choices.querySelector('.tutorial-target')?.focus({preventScroll:true});
}
function completed(){
 stop();stopSpotlight();$('tutorialFinishOverlay').classList.add('show');$('tutorialFinishOverlay').setAttribute('aria-hidden','false');
 $('stepCounter').textContent='COMPLETE';clearWord();input().disabled=true;
 $('finishBtn').onclick=routeMenu;$('finishBtn').focus({preventScroll:true});
}
function fillPlayer(){
 $('playerLabel').textContent=String(context.name||'Player').slice(0,16);
 const op=String(context.selected_character||'mc');
 if(/^[a-z][a-z0-9_]{0,39}$/.test(op))$('playerIcon').src=`assets/profile-icons/${op}.webp`;
}
async function start(){
 try{
  if(!code)throw Error('Scan your Adventure Card QR before starting the tutorial.');
  if(!cloud||!await cloud.ready)throw Error('Firebase connection required.');
  const data=await cloud.call('/api/tutorial/state',{card_code:code});
  fillPlayer();
  $('loading').hidden=true;$('tutorialApp').hidden=false;
  if(query.has('complete')&&(data.complete||demo)){completed();return;}
  if(data.complete&&!replay){routeMenu();return;}
  // Lessons 1–4 done: continue on the real Mode Select (it resumes Recruitment too).
  if(!replay&&data.step>=4){routeMenu();return;}
  const first=replay?1:lessonForStep(Number(data.step)||1);
  // First time only: "WELCOME, <name>" → "TUTORIAL" title cards, then the battle.
  const introKey='rpgTutorialIntro:'+String(context.public_id||'');
  let seen=false;try{seen=sessionStorage.getItem(introKey)==='1';}catch(_){}
  lesson(first);   // set up underneath so the intro fades straight into Lesson 1
  if(first===1&&!seen&&window.RPG_TUTORIAL_INTRO){
   try{sessionStorage.setItem(introKey,'1');}catch(_){}
   await window.RPG_TUTORIAL_INTRO.play(context.name);
   $('coachNext').focus({preventScroll:true});
  }
 }catch(e){$('loading').textContent=e?.message||String(e);}
}
void start();
