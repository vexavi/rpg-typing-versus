/* v83 first-time tutorial. State lives in Firestore, not browser storage.
 * A free tutorial ten-pull is the daily free ten-pull; never grant on replay.
 */
const $=id=>document.getElementById(id);
const context=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
const code=context.card_code;
const cloud=window.RPG_V66;
const replay=new URLSearchParams(location.search).has('replay');
let stage=1,stepCount=0,missCount=0,loopTimer=null,busy=false,canClaim=false,replayMode=replay,drawResults=[];
let roster=[],featuredId='tavi';
const prompts={1:['apple'],2:['cat','sun','book'],3:['green','water','happy']};
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(s){$('status').textContent=s||'';}
function heading(i,title,sub){$('stepCounter').textContent=`LESSON ${String(i).padStart(2,'0')} / 04`;$('lesson').innerHTML=`<span class="chip">LESSON ${i}</span><h1>${title}</h1><p class="hint">${sub}</p><div id="activity"></div>`;}
function stop(){if(loopTimer){clearInterval(loopTimer);loopTimer=null;}}
async function progress(next){if(replayMode)return;await cloud.call('/api/tutorial/progress',{card_code:code,step:next});}
function routeMenu(){sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');location.replace('adventure.html?card='+encodeURIComponent(code));}
function fail(e){status(e?.message||String(e)||'Please try again.');busy=false;}
function nextWord(){const list=prompts[stage]||[],w=list[stepCount];if(!w)return void completedLesson();
 const word=$('tutorialWord');word.textContent=w;word.style.setProperty('--top','3%');$('answer').value='';$('answer').focus();
 let position=3;stop();if(stage>=2)loopTimer=setInterval(()=>{position+=.40;if(position>=72){position=3;missCount++;status('Try again. Type the word before it reaches the bottom!');}word.style.setProperty('--top',position+'%');},100);
}
function lesson(i){stop();stage=i;stepCount=0;missCount=0;status('');const labels={1:['Type a word','Type the English word, then press Enter.'],2:['Falling words','Type each word before it reaches the bottom.'],3:['Defeat the boss','Clear three words to defeat the boss.']};
 if(i===4)return recruitmentLesson();const [title,sub]=labels[i];heading(i,title,sub);
 $('activity').innerHTML=`<div class="arena"><div class="lane"><div class="word falling" id="tutorialWord"></div></div><div class="boss">${i===3?`<strong>BOSS HP</strong><div class="bossbar"><div id="bossHP"></div></div><img src="assets/characters/mc.webp" alt="Main character" loading="lazy"><span>Clear the words to attack!</span>`:`<span style="font-size:64px;color:#dace21">⌨</span><span>Correct words disappear.</span>`}</div></div><form class="inputrow" id="answerForm"><input id="answer" type="text" aria-label="Type the word" autocomplete="off" spellcheck="false" autocapitalize="none" placeholder="Type here…" required><button type="submit">ENTER ↵</button></form>`;
 $('answerForm').addEventListener('submit',e=>{e.preventDefault();if(busy)return;const w=prompts[i][stepCount];if($('answer').value.trim().toLowerCase()===w){stepCount++;status('Good job!');if(i===3)$('bossHP').style.width=`${Math.max(0,100-stepCount/3*100)}%`;nextWord();}else{status('Try again.');$('answer').select();}});nextWord();
}
async function completedLesson(){stop();if(busy)return;busy=true;
 try{await progress(stage+1);if(stage<3)lesson(stage+1);else lesson(4);}catch(e){fail(e);}finally{busy=false;}
}
function recruitmentLesson(){stage=4;heading(4,'Recruitment','Open Recruitment to get your first characters!');status('');
 $('activity').innerHTML=`<div class="choicegrid"><div class="choice">NORMAL MODE</div><div class="choice">EXTRA MODE</div><button class="choice active" id="tutorialRecruit">RECRUITMENT ✦</button><div class="choice">STORY MODE</div><div class="choice">PRACTICE</div><div class="choice">PROFILE</div></div>`;
 $('tutorialRecruit').addEventListener('click',()=>recruitPanel());
}
function recruitPanel(){heading(4,'Featured Recruitment','Use your free first 10-pull. It counts as today’s free pull.');
 const featured=roster.find(x=>x.id===featuredId),art=featured?.art||'assets/recruitment/tavi.webp';
 $('activity').innerHTML=`<div class="recruitbox"><img src="${safe(art)}" alt="Featured operator"><div><span class="chip">FEATURED BANNER</span><h2>10 CHARACTERS</h2><p>See the stars first, then meet each character.</p><p class="price">FREE ×10</p><button class="primary" id="claimTen">RECRUIT ×10</button><p class="subtle">Your first 10-pull also uses today’s free claim.</p></div></div>`;
 $('claimTen').addEventListener('click',()=>claim());
 if(replayMode){$('claimTen').textContent='SHOW EXAMPLE ×10';}
}
function resultOverlay(results){drawResults=results;const records=results.map(r=>({...r,...(roster.find(c=>c.id===r.id)||{})}));
 window.RPG_RECRUITMENT_REVEAL.configure({characters:roster,featured_character_id:featuredId});
 window.RPG_RECRUITMENT_REVEAL.openResults(records,'FEATURED',{lockUntilResults:true,onComplete:()=>void finish()});
}
async function claim(){if(busy)return;busy=true;$('claimTen').disabled=true;status('Recruiting characters…');
 try{
  if(replayMode){const mock=Array.from({length:10},(_,i)=>({...roster[i%roster.length],duplicate:false,shards:0}));resultOverlay(mock);return;}
  const response=await cloud.call('/api/recruitment/pull',{card_code:code,mode:'tutorial',count:10});
  resultOverlay(response.results);
 }catch(e){fail(e);$('claimTen').disabled=false;}finally{busy=false;}
}
async function finish(){if(busy)return;busy=true;status('Saving tutorial completion…');
 try{if(!replayMode)await progress(5);
 $('stepCounter').textContent='COMPLETE';$('lesson').innerHTML=`<div style="text-align:center;padding:70px 12px"><span class="chip">COMPLETE</span><h1>TUTORIAL COMPLETE!</h1><p class="hint">You're ready to play.</p><button class="primary" id="finishBtn">START ADVENTURE ▶</button></div>`;$('finishBtn').addEventListener('click',routeMenu);status('');
 }catch(e){fail(e);}finally{busy=false;}
}
async function start(){
 try{
  if(!code)throw Error('Scan your Adventure Card QR to start the tutorial.');
  if(!await cloud.ready)throw Error('Firebase connection required.');
  const data=await cloud.call('/api/tutorial/state',{card_code:code});
  const raw=await fetch('gacha_catalog.json');if(!raw.ok)throw Error('Character roster missing.');roster=(await raw.json()).characters||[];
  try{const banners=await cloud.call('/api/recruitment/banners');const candidate=banners?.banners?.[0]?.featured_character_id;if(roster.some(c=>c.id===candidate&&c.rarity===6))featuredId=candidate;}catch(_){ /* Use the packaged Featured banner if offline demo or config absent. */ }
  $('loading').hidden=true;$('tutorialApp').hidden=false;
  replayMode=replay||data.complete;
  if(data.complete&&!replay){routeMenu();return;}
  if(!replayMode&&data.step>=4&&data.tutorialClaimed&&Array.isArray(data.lastDraw)&&data.lastDraw.length){
   stage=4;heading(4,'Recruitment Results','Your first 10-pull was saved. View the characters to finish.');
   $('activity').innerHTML='<button class="primary" id="resumeResults">VIEW 10-PULL RESULTS ▶</button>';
   $('resumeResults').addEventListener('click',()=>resultOverlay(data.lastDraw));
   return;
  }
  if(replayMode)lesson(1);else lesson(Math.max(1,Math.min(4,data.step)));
 }catch(e){$('loading').textContent=e?.message||String(e);}
}
void start();
