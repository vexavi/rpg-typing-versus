/* Guided first-time tutorial (v148.9).
   Lessons 1–3 run on a battle screen that uses the SAME stylesheets and layout as
   Normal Mode (Stage 1 · Sporemaw), so students meet exactly what they will see later.
   Lesson 4 is the REAL Mode Select (adventure.html) with guard rails, followed by the
   REAL Recruitment page (recruitment.html?tutorial=1) — see tutorial-guide.js.
   Training never awards HP, XP, Guild Coins or rankings; only the free first 10-pull is real.
*/
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
// A preview must never change the live student's sessionStorage card credentials.
const demo=query.has('demo')||/tutorial-preview\.html$/.test(location.pathname);
const replay=query.has('replay')||demo;
const context=demo?(window.RPG_TUTORIAL_DEMO_CONTEXT||{}):(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
const cloud=window.RPG_V66;
const code=context.card_code;
const samples={
  1:[{prompt:'りんご',answer:'apple'}],
  2:[{prompt:'ねこ',answer:'cat'},{prompt:'たいよう',answer:'sun'},{prompt:'ほん',answer:'book'}],
  3:[{prompt:'みどり',answer:'green'},{prompt:'みず',answer:'water'},{prompt:'うれしい',answer:'happy'}]
};
const titles={1:'Type a word',2:'Falling words',3:'Defeat the boss',4:'Recruitment'};
const hints={
  1:'Each word shows Japanese on the left and its English on the right. Type apple, then press Enter.',
  2:'Words fall toward the bottom. Type each English word before it lands.',
  3:'Every correct word hits the boss. Clear all three words to defeat it!',
  4:'Select Recruitment to get your first ten characters.'
};
// Spotlight targets per lesson. Presentation only; never moves anything.
const focusMap={
  1:['#trainingWord','.inputBar','#trainingCoach'],
  2:['#trainingWord','.inputBar','#trainingCoach','.wordLane'],
  3:['#trainingWord','.inputBar','#trainingCoach','.wordLane','#bossWrap','#storyStatusPanel']
};
let stage=1,stepCount=0,playerHP=10,bossHP=3,misses=0,score=0,frameId=null,startMs=0,busy=false;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(message){$('messageLog').textContent=message||'';}
function status(message){$('status').textContent=message||'';}

// One translucent veil with rectangular cutouts. It never captures clicks or moves elements.
const spotlightCanvas=$('tutorialSpotlight');
const spotlightContext=spotlightCanvas?.getContext('2d');
let spotlightFrame=null,lastSpotlightPaint=0;
function stopSpotlight(){
 if(spotlightFrame!==null)cancelAnimationFrame(spotlightFrame);
 spotlightFrame=null;
 if(spotlightCanvas)spotlightCanvas.hidden=true;
}
function drawSpotlight(timestamp=0){
 if(!spotlightContext||stage>3||$('tutorialApp').hidden){stopSpotlight();return;}
 // Limit full-screen repaint work on school Chromebooks while tracking falling words.
 const interval=stage===1?140:42;
 if(timestamp-lastSpotlightPaint<interval){spotlightFrame=requestAnimationFrame(drawSpotlight);return;}
 lastSpotlightPaint=timestamp;
 const vw=window.innerWidth,vh=window.innerHeight;
 if(spotlightCanvas.width!==vw||spotlightCanvas.height!==vh){spotlightCanvas.width=vw;spotlightCanvas.height=vh;}
 spotlightContext.clearRect(0,0,vw,vh);
 spotlightContext.fillStyle='rgba(5, 8, 12, 0.62)';
 spotlightContext.fillRect(0,0,vw,vh);
 const targets=[];
 for(const selector of focusMap[stage]||[]){
  for(const element of document.querySelectorAll(selector)){
   if(!element.getClientRects().length||element.hidden)continue;
   const r=element.getBoundingClientRect(),pad=4;
   const left=Math.max(0,r.left-pad),top=Math.max(0,r.top-pad),right=Math.min(vw,r.right+pad),bottom=Math.min(vh,r.bottom+pad);
   if(right<=left||bottom<=top)continue;
   targets.push({x:left,y:top,w:right-left,h:bottom-top,outline:['#trainingWord','.inputBar'].includes(selector)});
  }
 }
 for(const r of targets)spotlightContext.clearRect(r.x,r.y,r.w,r.h);
 spotlightContext.strokeStyle='#fff200';spotlightContext.lineWidth=3;
 for(const r of targets)if(r.outline)spotlightContext.strokeRect(r.x+1.5,r.y+1.5,r.w-3,r.h-3);
 spotlightFrame=requestAnimationFrame(drawSpotlight);
}
function startSpotlight(){
 if(!spotlightContext||stage>3)return stopSpotlight();
 spotlightCanvas.hidden=false;
 if(spotlightFrame===null)spotlightFrame=requestAnimationFrame(drawSpotlight);
}
function stop(){if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}}
function routeMenu(){
 if(demo){location.replace('tutorial-preview.html?demo=1');return;}
 // Lesson 4 happens on the REAL Mode Select; the engine adds the guard rails.
 sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');
 location.replace('adventure.html?card='+encodeURIComponent(code||''));
}
function updateBars(){
 $('playerFill').style.width=`${playerHP*10}%`;$('playerHpText').textContent=`${playerHP}/10`;
 $('bossFill').style.width=`${bossHP/3*100}%`;$('bossHpText').textContent=`${bossHP}/3`;
 $('mistakesText').textContent=String(misses);$('scoreText').textContent=String(score);
}
function updateProgress(){$('progressText').textContent=`${stepCount} / ${(samples[stage]||[]).length} words cleared`;}
function nextWord(){
 stop();const record=samples[stage]?.[stepCount];if(!record){if(stage<=3)void advance();return;}
 const lane=$('wordLane');lane.replaceChildren();
 // Same markup as a real Normal Mode word.
 const word=document.createElement('div');word.className='word';word.id='trainingWord';
 word.innerHTML=`<div class="prompt">${escapeHtml(record.prompt)}</div><div class="right"><span class="tag"></span><span class="answer muted">${escapeHtml(record.answer)}</span></div>`;
 word.style.setProperty('--y','18px');
 lane.appendChild(word);
 startSpotlight();
 $('answerInput').value='';$('answerInput').disabled=false;$('answerInput').focus({preventScroll:true});
 updateProgress();
 if(stage===1)return;
 startMs=performance.now();
 const travel=stage===2?18000:14500;
 function tick(ts){
  if(stage===1||busy||!word.isConnected)return;
  const distance=Math.max(10,lane.clientHeight-word.getBoundingClientRect().height-20);
  const y=18+Math.min(1,(ts-startMs)/travel)*Math.max(0,distance-18);
  word.style.setProperty('--y',`${y}px`);
  if(ts-startMs>=travel){
   if(stage===3){playerHP=Math.max(1,playerHP-1);updateBars();flashDamage();log('A word reached the bottom! You lost 1 HP. Try again.');}
   else log('A word reached the bottom. Try again!');
   startMs=ts;
  }
  frameId=requestAnimationFrame(tick);
 }
 frameId=requestAnimationFrame(tick);
}
function flashDamage(){const f=$('damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');setTimeout(()=>f.classList.remove('show'),260);}
function lesson(i){
 stop();stage=i;stepCount=0;playerHP=10;bossHP=3;busy=false;
 $('retryTutorialSave').hidden=true;
 $('stepCounter').textContent=`LESSON ${String(i).padStart(2,'0')} / 04`;
 $('stageName').textContent=`Lesson ${i}`;
 $('lessonTitle').textContent=titles[i];$('lessonObjective').textContent=hints[i];
 $('answerInput').disabled=i===4;
 log('');status('');
 $('wordLane').replaceChildren();
 updateBars();updateProgress();
 if(i===4){
  // The live tutorial continues on the real Mode Select. Only the teacher preview
  // (no player account) keeps a stand-in menu.
  if(!demo){routeMenu();return;}
  showDemoModeSelect();return;
 }
 nextWord();
}
async function advance(){
 if(busy||stage>3)return;
 busy=true;stop();$('answerInput').disabled=true;
 $('retryTutorialSave').hidden=true;status('Saving lesson progress…');
 try{
  if(!replay)await cloud.call('/api/tutorial/progress',{card_code:code,step:stage+1});
  status('');log('Lesson complete!');
  await new Promise(r=>setTimeout(r,650));
  lesson(stage+1);
 }catch(e){
  busy=false;
  log('Lesson cleared. Progress could not be confirmed: '+String(e?.message||e));
  status('Press RETRY SAVING to continue. Your cleared words will not be lost.');
  $('retryTutorialSave').hidden=false;
  $('retryTutorialSave').focus({preventScroll:true});
 }
}
$('retryTutorialSave').addEventListener('click',()=>void advance());
// Teacher preview only: a stand-in for the real Mode Select (no account to open it with).
function showDemoModeSelect(){
 stopSpotlight();
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
 $('stepCounter').textContent='COMPLETE';$('wordLane').replaceChildren();$('answerInput').disabled=true;
 $('finishBtn').onclick=routeMenu;$('finishBtn').focus({preventScroll:true});
}
$('answerForm').addEventListener('submit',e=>{
 e.preventDefault();if(busy||stage>3)return;
 const current=samples[stage]?.[stepCount];if(!current)return;
 if($('answerInput').value.trim().toLowerCase()!==current.answer){
  misses++;updateBars();log('Not quite! Check the English word and try again.');$('answerInput').select();return;
 }
 stop();stepCount++;score+=100;
 if(stage===3){
  bossHP=Math.max(0,3-stepCount);
  const boss=$('bossImg');boss.classList.remove('bossFlash');void boss.offsetWidth;boss.classList.add('bossFlash');
 }
 updateBars();updateProgress();
 log('Correct!');$('wordLane').replaceChildren();
 if(stepCount>=samples[stage].length)void advance();else nextWord();
});
// Keep typing focused on the answer box, like the real battle.
document.addEventListener('pointerdown',e=>{if(stage<=3&&!busy&&!e.target.closest('button'))setTimeout(()=>$('answerInput').focus({preventScroll:true}),0);});
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
  // Lessons 1–3 done: continue on the real Mode Select (it resumes Recruitment too).
  if(!replay&&data.step>=4){routeMenu();return;}
  lesson(replay?1:Math.max(1,Math.min(3,Number(data.step)||1)));
 }catch(e){$('loading').textContent=e?.message||String(e);}
}
void start();
