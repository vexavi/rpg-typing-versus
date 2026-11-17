/* v84 guided tutorial: uses the actual Adventure battlefield/HUD presentation.
   Training never awards HP, XP, Guild Coins, rankings, or free pulls.
   Lesson 4 sends the player to the REAL Recruitment screen for the saved draw.
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
const hints={1:'The Japanese word is shown. Type the English translation and press Enter.',2:'Type the English translations before the words reach the bottom.',3:'Each correct answer damages the enemy. Clear all three words!',4:'Open Recruitment to obtain your first ten characters.'};
const lessonGuidance={
  1:'Look at the Japanese word. The English translation is "apple". Type apple, then press Enter.',
  2:'Words fall, just like Normal Mode. Type their English translations before they reach the bottom.',
  3:'Defeat the training opponent by clearing the words and watching the HP bars.',
  4:'Select Recruitment from the menu to continue the tutorial.'
};
// Focus changes presentation only. Never change positioning or gameplay logic.
const focusMap={
  1:{focus:['#trainingWord','.inputBar'],dim:['.bossWrap','#statusPanel','.adventure-topbar']},
  2:{focus:['#trainingWord','.inputBar'],dim:['.bossWrap','#statusPanel','.adventure-topbar']},
  3:{focus:['#trainingWord','.inputBar','#statusPanel .statRow'],dim:['.adventure-topbar']},
  4:{focus:['.tutorial-target'],dim:['.adventure-topbar','.bossWrap','.inputBar','#lessonPanel','#statusPanel','.training-coach']}
};
let stage=1,stepCount=0,playerHP=10,frameId=null,startMs=0,busy=false;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function log(message){$('messageLog').textContent=message;}
function status(message){$('status').textContent=message||'';}
function clearTutorialFocus(){
  document.querySelectorAll('.tutorial-focus').forEach(el=>el.classList.remove('tutorial-focus'));
  document.querySelectorAll('.tutorial-dim').forEach(el=>el.classList.remove('tutorial-dim'));
}
function applyTutorialFocus(i){
  clearTutorialFocus();
  const cfg=focusMap[i];
  if(!cfg)return;
  for(const selector of cfg.focus||[]){
    document.querySelectorAll(selector).forEach(el=>el.classList.add('tutorial-focus'));
  }
  for(const selector of cfg.dim||[]){
    document.querySelectorAll(selector).forEach(el=>el.classList.add('tutorial-dim'));
  }
}
function stop(){if(frameId!==null){cancelAnimationFrame(frameId);frameId=null;}}
function routeMenu(){
 if(demo){location.replace('tutorial-preview.html?demo=1');return;}
 sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');
 location.replace('adventure.html?card='+encodeURIComponent(code||''));
}
function nextWord(){
 stop();const record=samples[stage]?.[stepCount];if(!record){if(stage<=3)void advance();return;}
 const lane=$('wordLane');lane.replaceChildren();
 const word=document.createElement('div');word.className='word';word.id='trainingWord';word.style.setProperty('--y','18px');
 word.innerHTML=`<span class="prompt">${escapeHtml(record.prompt)}</span><span class="right"><span class="tag">${stage===1?'TRAINING':'FALLING'}</span></span>`;
 lane.appendChild(word);
 applyTutorialFocus(stage);
 $('answerInput').value='';$('answerInput').disabled=false;$('answerInput').focus({preventScroll:true});
 $('progressText').textContent=`${stepCount} / ${samples[stage].length} words cleared`;
 if(stage===1)return;
 startMs=performance.now();
 const travel=stage===2?18000:14500;
 function tick(ts){
  if(stage===1||busy||!word.isConnected)return;
  const distance=Math.max(10,lane.clientHeight-word.getBoundingClientRect().height-20);
  const y=18+Math.min(1,(ts-startMs)/travel)*Math.max(0,distance-18);
  word.style.setProperty('--y',`${y}px`);
  if(ts-startMs>=travel){
   if(stage===3){playerHP=Math.max(1,playerHP-1);updateBars();log('A word reached the bottom! You lost 1 HP. Try again.');}
   else log('A word reached the bottom. Try again!');
   startMs=ts;
  }
  frameId=requestAnimationFrame(tick);
 }
 frameId=requestAnimationFrame(tick);
}
function updateBars(){
 $('playerHP').style.width=`${playerHP*10}%`;$('playerHpText').textContent=`${playerHP}/10`;
 const remaining=stage===3?Math.max(0,3-stepCount):3;
 $('bossHP').style.width=`${remaining/3*100}%`;$('bossHpText').textContent=`${remaining}/3`;
}
function lesson(i){
 stop();stage=i;stepCount=0;playerHP=10;busy=false;
 $('retryTutorialSave').hidden=true;
 $('tutorialModeOverlay').classList.remove('show');$('tutorialModeOverlay').setAttribute('aria-hidden','true');
 $('tutorialFinishOverlay').classList.remove('show');$('tutorialFinishOverlay').setAttribute('aria-hidden','true');
 $('lessonNumber').textContent=i;$('stepCounter').textContent=`LESSON ${String(i).padStart(2,'0')} / 04`;
 $('lessonTitle').textContent=titles[i];$('lessonObjective').textContent=hints[i];
 $('trainingCoach').textContent=hints[i];
 $('answerInput').disabled=i===4;
 $('progressText').textContent=`0 / ${(samples[i]||[]).length} words cleared`;
 $('bossImg').style.opacity=i===3?'1':'.38';
 $('bossHP').closest('.statRow').style.opacity=i===3?'1':'.45';
 $('wordLane').replaceChildren();status('');
 updateBars();
 if(i===4){showModeSelect();return;}
 log(lessonGuidance[i]||'');
 applyTutorialFocus(i);
 nextWord();
}
async function advance(){
 if(busy||stage>3)return;
 busy=true;stop();$('answerInput').disabled=true;
 $('retryTutorialSave').hidden=true;status('Saving lesson progress…');
 try{
  if(!replay)await cloud.call('/api/tutorial/progress',{card_code:code,step:stage+1});
  status('');log('Lesson complete!');lesson(stage+1);
 }catch(e){
  busy=false;
  log('Lesson cleared. Progress could not be confirmed: '+String(e?.message||e));
  status('Press RETRY SAVING to continue. Your cleared words will not be lost.');
  // Do not re-enable the input when the last word has already been cleared.
  $('retryTutorialSave').hidden=false;
  $('retryTutorialSave').focus({preventScroll:true});
 }
}
$('retryTutorialSave').addEventListener('click',()=>void advance());
function showModeSelect(){
 $('trainingCoach').textContent='Select Recruitment from Mode Select.';
 $('wordLane').replaceChildren();$('answerInput').disabled=true;
 const choices=$('tutorialModeChoices');
 choices.replaceChildren();
 // The names and ordering intentionally match the real post-login Mode Select.
 const names=['Story Mode','Practice','Normal Mode','Extra Mode','Challenge Mode',
   'All Grades Challenge','Profile','Recruitment','Rankings','Tournament'];
 for(const title of names){
  const button=document.createElement('button');
  button.type='button';
  button.className='choiceBtn student-mode-card'+(title==='Recruitment'?' tutorial-target':' disabled');
  button.disabled=title!=='Recruitment';
  button.setAttribute('aria-label',title);
  const label=document.createElement('span');label.className='title';label.textContent=title;
  button.appendChild(label);
  if(title==='Recruitment')button.addEventListener('click',()=>{
   location.assign((demo?'recruitment-preview-v84.html':'recruitment.html')+'?tutorial='+(replay?'demo':'1'));
  });
  choices.appendChild(button);
 }
 $('tutorialModeOverlay').classList.add('show');$('tutorialModeOverlay').setAttribute('aria-hidden','false');
 applyTutorialFocus(4);
 choices.querySelector('.tutorial-target')?.focus({preventScroll:true});
}
function completed(){
 stop();$('tutorialFinishOverlay').classList.add('show');$('tutorialFinishOverlay').setAttribute('aria-hidden','false');
 $('lessonNumber').textContent='4';$('stepCounter').textContent='COMPLETE';
 $('trainingCoach').textContent='Tutorial complete!';
 $('wordLane').replaceChildren();$('answerInput').disabled=true;
 $('finishBtn').onclick=routeMenu;$('finishBtn').focus({preventScroll:true});
}
$('answerForm').addEventListener('submit',e=>{
 e.preventDefault();if(busy||stage>3)return;
 const current=samples[stage]?.[stepCount];if(!current)return;
 if($('answerInput').value.trim().toLowerCase()!==current.answer){
  log('Not quite! Try again.');$('answerInput').select();return;
 }
 stop();stepCount++;$('progressText').textContent=`${stepCount} / ${samples[stage].length} words cleared`;
 if(stage===3){updateBars();$('bossImg').classList.remove('bossFlash');void $('bossImg').offsetWidth;$('bossImg').classList.add('bossFlash');}
 log('Correct!');$('wordLane').replaceChildren();
 if(stepCount>=samples[stage].length)void advance();else nextWord();
});
async function start(){
 try{
  if(!code)throw Error('Scan your Adventure Card QR before starting the tutorial.');
  if(!cloud||!await cloud.ready)throw Error('Firebase connection required.');
  const data=await cloud.call('/api/tutorial/state',{card_code:code});
  $('loading').hidden=true;$('tutorialApp').hidden=false;
  if(query.has('complete')&&(data.complete||demo)){completed();return;}
  if(data.complete&&!replay){routeMenu();return;}
  if(!replay&&data.step>=4&&data.tutorialClaimed){
   // The previous pull was saved but its reveal was interrupted. Resume in real Recruitment.
   location.replace('recruitment.html?tutorial=1&resume=1');return;
  }
  lesson(replay?1:Math.max(1,Math.min(4,Number(data.step)||1)));
 }catch(e){$('loading').textContent=e?.message||String(e);}
}
void start();
