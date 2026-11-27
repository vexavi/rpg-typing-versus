/* v148.9 "Who Am I?" — a guided battle that shows, step by step, what one 5★/6★
   operator's passive does. It is a scripted simulation on the real battle screen
   (same look as Normal Mode); nothing here affects real runs. Finishing it the first
   time earns Guild Coins once per operator (mode 'whoami' in /api/guild/claim).
   Open: who-am-i.html?op=<id>[&from=guide]
*/
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const opId=String(params.get('op')||'').toLowerCase();
const fromGuide=params.get('from')==='guide';
const context=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'{}')}catch{return {}}})();
const cloud=window.RPG_V66;
const RULES=window.RPG_OPERATOR_PASSIVES?.RULES||{};
const CATALOG=(window.RPG_GACHA_CATALOG?.characters||[]);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const WHOAMI_COINS=100;

// ---- word pool --------------------------------------------------------------------
const POOL=[['いぬ','dog'],['ねこ','cat'],['あか','red'],['やま','mountain'],['うみ','sea'],['ほし','star'],['はな','flower'],['くるま','car'],
 ['とり','bird'],['そら','sky'],['かわ','river'],['つき','moon'],['あめ','rain'],['ゆき','snow'],['かぜ','wind'],['ひ','fire'],['いし','stone'],
 ['みち','road'],['まど','window'],['いす','chair'],['つくえ','desk'],['かさ','umbrella'],['ふね','ship'],['くつ','shoes'],['かぎ','key'],
 ['さかな','fish'],['たまご','egg'],['ぼうし','hat'],['ちょうちょ','butterfly'],['としょかん','library'],['たんじょうび','birthday'],['ほん','book'],['たいよう','sun']];
const SHORT=[['いぬ','dog'],['ねこ','cat'],['たいよう','sun'],['あか','red'],['き','tree'],['たまご','egg'],['ぼうし','hat'],['かぎ','key']];
let poolAt=0;
const nextPair=(avoid=new Set())=>{for(let k=0;k<POOL.length;k++){const p=POOL[(poolAt++)%POOL.length];if(!avoid.has(p[1]))return p;}return POOL[0];};

// ---- simulation state ---------------------------------------------------------------
const S={words:[],nextId:1,hp:10,maxHp:10,boss:30,bossMax:30,shield:0,
 base:26,speedMul:1,freezeUntil:0,slowUntil:0,slowMul:1,noSpawnUntil:0,auto:0,lastSpawn:0,invulnUntil:0,
 streak:0,correct:0,misses:0,counter:null,listeners:[],missHooks:[],raf:0,last:0,running:false,bonus:0};
const lane=()=>$('wordLane');
const H=()=>lane().clientHeight;
function landedCount(){return S.words.filter(w=>w.state==='landed').length;}
function spawn(pair,{y=-30,mark=null,hex=false}={}){
 const [jp,en]=pair||nextPair(new Set(S.words.map(w=>w.answer)));
 const el=document.createElement('div');el.className='word';
 el.innerHTML=`<div class="prompt">${esc(jp)}</div><div class="right"><span class="tag"></span><span class="answer muted">${esc(en)}</span></div>`;
 lane().appendChild(el);
 const w={id:S.nextId++,el,prompt:jp,answer:en,y,state:'fall',frozenUntil:0,mark:null};
 el.dataset.wid=String(w.id);
 S.words.push(w);setY(w);if(mark)setMark(w,mark);if(hex)el.classList.add('wai-hex');
 return w;
}
function setY(w){w.el.style.setProperty('--y',`${Math.round(w.y)}px`);}
function setMark(w,mark){ // mark: {label,color,timer}
 w.mark=mark;w.el.classList.toggle('wai-mark',!!mark);
 if(mark){w.el.dataset.mark=mark.label;w.el.style.setProperty('--mk',mark.color||'#fff200');
  if(mark.timer){w.el.style.setProperty('--t',mark.timer+'s');w.el.classList.remove('wai-timer');void w.el.offsetWidth;w.el.classList.add('wai-timer');}}
 else{delete w.el.dataset.mark;w.el.classList.remove('wai-timer');}
}
function setText(w,[jp,en]){w.prompt=jp;w.answer=en;w.el.querySelector('.prompt').textContent=jp;w.el.querySelector('.answer').textContent=en;}
function removeWord(w,fx=true){
 S.words=S.words.filter(x=>x!==w);
 if(fx){w.el.classList.add('wai-gone');setTimeout(()=>w.el.remove(),460);}else w.el.remove();
 restack();
}
function restack(){const landed=S.words.filter(w=>w.state==='landed');landed.forEach((w,i)=>{w.y=H()-30*(i+1)-6;setY(w);});}
function tick(t){
 if(!S.running){S.raf=0;return;}
 const dt=Math.min(.1,(t-(S.last||t))/1000);S.last=t;
 const now=performance.now();
 const globalFrozen=now<S.freezeUntil;
 const mul=S.speedMul*(now<S.slowUntil?S.slowMul:1);
 for(const w of S.words){
  if(w.state!=='fall'||globalFrozen||now<w.frozenUntil)continue;
  w.y+=S.base*mul*dt;
  const floor=H()-30*(landedCount()+1)-6;
  if(w.y>=floor){w.y=floor;w.state='landed';w.el.classList.add('landed');}
  setY(w);
 }
 S.words.forEach(w=>w.el.classList.toggle('wai-frozen',globalFrozen||now<w.frozenUntil));
 if(S.auto&&!globalFrozen&&now>=S.noSpawnUntil&&now-S.lastSpawn>=S.auto&&S.words.length<9){S.lastSpawn=now;spawn();}
 S.raf=requestAnimationFrame(tick);
}
function run(){if(!S.running){S.running=true;S.last=0;S.raf=requestAnimationFrame(tick);}}
function stopSim(){S.running=false;S.auto=0;}

// ---- HUD ------------------------------------------------------------------------------
function bars(){
 $('playerFill').style.width=`${Math.min(100,100*S.hp/S.maxHp)}%`;$('playerHpText').textContent=`${S.hp}/${S.maxHp}`;
 $('bossFill').style.width=`${100*S.boss/S.bossMax}%`;$('bossHpText').textContent=`${S.boss}/${S.bossMax}`;
 $('mistakesText').textContent=String(S.misses);$('scoreText').textContent=String(S.correct*100);
 $('shieldText').textContent=`${S.shield} / 5`;
}
function flashDamage(){const f=$('damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');setTimeout(()=>f.classList.remove('show'),320);}
function hurtPlayer(n=1){
 if(performance.now()<S.invulnUntil){pop('IMMUNE',$('tutorialPlayerRow'));return;}
 if(S.shield>0){const b=Math.min(S.shield,n);S.shield-=b;n-=b;pop(`BLOCKED ${b}`,$('tutorialPlayerRow'));}
 if(n>0){S.hp=Math.max(1,S.hp-n);flashDamage();}
 bars();
}
function hitBoss(n=1,extra=0,anchor=null){
 S.boss=Math.max(1,S.boss-n-extra);bars();
 const b=$('bossImg');b.classList.remove('bossFlash');void b.offsetWidth;b.classList.add('bossFlash');
 if(extra)pop(`+${extra} DMG`,anchor||$('bossWrap'));
}
function pop(text,anchor){
 const r=(anchor||$('battlefield')).getBoundingClientRect(),f=$('battlefield').getBoundingClientRect();
 const el=document.createElement('div');el.className='wai-pop';el.textContent=text;
 el.style.left=`${r.left-f.left+r.width/2-40}px`;el.style.top=`${r.top-f.top}px`;
 $('battlefield').appendChild(el);setTimeout(()=>el.remove(),1150);
}
function banner(text){const b=$('waiBanner');b.textContent=text;b.hidden=false;b.style.animation='none';void b.offsetWidth;b.style.animation='';clearTimeout(banner.t);banner.t=setTimeout(()=>{b.hidden=true;},1650);}
function chip(name,text,state=''){const c=$('passiveChip');c.hidden=!name;$('chipName').textContent=name||'';
 const m=/^(\d+) \/ (\d+)$/.exec(text||'');
 $('chipCount').innerHTML=m?`${'<i class="on"></i>'.repeat(+m[1])}${'<i></i>'.repeat(Math.max(0,m[2]-m[1]))}<span>${m[1]}/${m[2]}</span>`:esc(text||'');
 c.classList.remove('is-ready','is-reset');if(state){void c.offsetWidth;c.classList.add('is-'+state);}}

// ---- coach, spotlight and arrows (same guard rails as the tutorial) -------------------
let focusSel=[],onNext=null,arrowSpecs=[],arrowEls=[],stepNo=0;
function setArrows(list){
 arrowEls.forEach(el=>el.remove());arrowEls=[];arrowSpecs=list||[];
 for(const a of arrowSpecs){const el=document.createElement('div');
  if(a.mark){el.className='tut-q';el.innerHTML='<span>?</span>';}
  else{el.className='tut-arrow';el.dataset.dir=a.dir;el.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4 60 34H43v26H21V34H4z"/></svg>';}
  el.setAttribute('aria-hidden','true');el.style.visibility='hidden';document.body.append(el);arrowEls.push(el);}
 placeArrows();
}
function placeArrows(){
 arrowSpecs.forEach((a,i)=>{const el=arrowEls[i];const t=typeof a.sel==='function'?a.sel():document.querySelector(a.sel);
  if(!el)return;if(!t||!t.getClientRects().length){el.style.visibility='hidden';return;}
  const r=t.getBoundingClientRect(),Sz=66,g=10;let x,y;
  if(a.dir==='up'){x=r.left+r.width/2-Sz/2;y=r.bottom+g;}else if(a.dir==='down'){x=r.left+r.width/2-Sz/2;y=r.top-Sz-g;}
  else if(a.dir==='left'){x=r.right+g;y=r.top+r.height/2-Sz/2;}else{x=r.left-Sz-g;y=r.top+r.height/2-Sz/2;}
  el.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;el.style.visibility='visible';});
}
const canvas=$('tutorialSpotlight'),ctx=canvas?.getContext('2d');let spotRaf=0,spotLast=0;
function drawSpot(ts=0){
 spotRaf=requestAnimationFrame(drawSpot);
 if(ts-spotLast<60)return;spotLast=ts;
 const vw=innerWidth,vh=innerHeight;if(canvas.width!==vw||canvas.height!==vh){canvas.width=vw;canvas.height=vh;}
 ctx.clearRect(0,0,vw,vh);ctx.fillStyle='rgba(5,8,12,.55)';ctx.fillRect(0,0,vw,vh);
 for(const sel of ['#trainingCoach','#passiveChip',...focusSel]){
  const list=typeof sel==='function'?[sel()].flat():[...document.querySelectorAll(sel)];
  for(const el of list){if(!el||!el.getClientRects().length||el.hidden)continue;const r=el.getBoundingClientRect();ctx.clearRect(r.left-5,r.top-5,r.width+10,r.height+10);}
 }
 placeArrows();
}
function startSpot(){canvas.hidden=false;if(!spotRaf)spotRaf=requestAnimationFrame(drawSpot);}
function stopSpot(){cancelAnimationFrame(spotRaf);spotRaf=0;canvas.hidden=true;}
const DEFAULT_FOCUS=['.wordLane','.inputBar','#bossWrap','#storySquadVisual','#storyStatusPanel','#storyEnemyPanel'];
function say({title,text,formula='',next=false,focus=DEFAULT_FOCUS,arrows=[],enter=false}){
 stepNo++;$('stepCounter').textContent=`STEP ${stepNo}`;
 const f=$('coachFormula');f.textContent=formula;f.hidden=!formula;if(formula){f.classList.remove('pop');void f.offsetWidth;f.classList.add('pop');}
 if(title)$('lessonTitle').textContent=title;
 $('lessonObjective').textContent=text||'';
 $('enterKey').hidden=!enter;
 focusSel=focus;setArrows(arrows);startSpot();
 $('coachNext').hidden=!next;
 if(!next)return Promise.resolve();
 return new Promise(res=>{onNext=res;setTimeout(()=>$('coachNext').focus({preventScroll:true}),30);});
}
$('coachNext').addEventListener('click',()=>{const f=onNext;onNext=null;$('coachNext').hidden=true;f?.();input().focus({preventScroll:true});});
const input=()=>$('answerInput');
function log(t){$('messageLog').textContent=t||'';}

// ---- counters and waiting -------------------------------------------------------------
function count(n,{label,streak=false,skipHexed=false}={}){
 return new Promise(res=>{S.counter={n,cur:0,streak,label,skipHexed,res};chip(label,`0 / ${n}`);});
}
function waitCleared(pred){return new Promise(res=>{S.listeners.push({pred,res});});}
function onCorrect(w){
 S.correct++;S.streak++;
 const c=S.counter;
 if(c&&!(c.skipHexed&&w.hexed)){c.cur++;chip(c.label,`${Math.min(c.cur,c.n)} / ${c.n}`,c.cur>=c.n?'ready':'');if(c.cur>=c.n){S.counter=null;c.res();}}
 for(const l of S.listeners.slice()){if(l.pred(w)){S.listeners=S.listeners.filter(x=>x!==l);l.res(w);}}
}
function onMiss(){
 S.misses++;S.streak=0;
 const c=S.counter;if(c&&c.streak&&c.cur>0){c.cur=0;chip(c.label,`0 / ${c.n}`,'reset');log('A mistake reset the count to 0.');}
 S.missHooks.forEach(f=>f());
 hurtPlayer(1);
}
$('answerForm').addEventListener('submit',e=>{
 e.preventDefault();if(input().disabled)return;
 const v=input().value.trim().toLowerCase();input().value='';input().readOnly=false;
 if(!v)return;
 const pool=S.words.slice().sort((a,b)=>(b.mark?1:0)-(a.mark?1:0));
 const w=pool.find(x=>x.answer===v);
 if(!w){log(`MISS: ${v}`);onMiss();return;}
 log('Correct!');removeWord(w);hitBoss(1,0);onCorrect(w);
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('button'))setTimeout(()=>input().focus({preventScroll:true}),0);});

// ---- reusable demo pieces -----------------------------------------------------------
async function mistakeDemo(){
 input().value='oops';input().readOnly=true;
 await say({formula:'❌ ?',text:'"oops" is wrong. Press ENTER and watch.',enter:true,arrows:[{sel:'.inputBar',dir:'left'},{sel:'#passiveChip',dir:'up'}],focus:['.inputBar']});
 await new Promise(res=>{const h=()=>{S.missHooks=S.missHooks.filter(x=>x!==h);res();};S.missHooks.push(h);});
 input().readOnly=false;
}
function lowest(filter=()=>true){return S.words.filter(w=>w.state==='fall'&&filter(w)).sort((a,b)=>b.y-a.y)[0]||null;}
function longest(){return S.words.slice().sort((a,b)=>b.answer.length-a.answer.length)[0]||null;}
function ensureWords(n){while(S.words.length<n)spawn(null,{y:20+Math.random()*120});}
const wordSel=w=>()=>w?.el?.isConnected?w.el:null;

// ---- one script per operator (kid-friendly, accurate to the real passive) ------------
// Each step shows a picture formula (trigger → effect) so it makes sense even without reading.
const SCRIPTS={
 aveline:async()=>{
  await say({title:'Weak Point',formula:'✓ ×6 → ⚡ +2',text:'Type 6 words. Then your next word hits harder: +2!',next:true});
  S.auto=2600;say({formula:'✓ ×6 → ⚡',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'⚡'});
  chip('⚡','READY','ready');banner('⚡ CHARGED');
  say({formula:'⚡ → +2',text:'Charged! Type 1 more word.',arrows:[{sel:'.inputBar',dir:'left'}]});
  const w=await waitCleared(()=>true);hitBoss(0,2,w.el);chip('⚡','');
  await say({formula:'⚡ +2 💥',text:'Boom! +2 damage to the boss.',next:true,arrows:[{sel:'#storyBossHpRow',dir:'down'}]});
 },
 isolde:async()=>{
  await say({title:'Frozen Domain',formula:'🔥 ×6 → ❄️',text:'Type 6 words in a row. Then all words FREEZE!',next:true});
  S.auto=2600;say({formula:'🔥 ×3',text:'Type 3 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  const c=count(6,{label:'❄️',streak:true});
  await new Promise(r=>{const t=setInterval(()=>{if(S.streak>=3){clearInterval(t);r();}},100);});
  await mistakeDemo();
  await say({formula:'❌ → 🔥 0',text:'A mistake = back to 0. Try 6 in a row!',next:true,arrows:[{sel:'#passiveChip',dir:'up'}]});
  say({formula:'🔥 ×6 → ❄️',text:'Type 6 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await c;
  banner('❄️ FREEZE');S.freezeUntil=performance.now()+2500;S.noSpawnUntil=S.freezeUntil;
  say({formula:'❄️ 2.5s',text:'Frozen! Words stop. Type them!',arrows:[{sel:'.wordLane',dir:'left'}]});
  await wait(2500);S.slowMul=.85;S.slowUntil=performance.now()+3000;banner('🐢 SLOW');
  await say({formula:'❄️ → 🐢 3s',text:'Then words fall slower for 3 seconds.',next:true});
 },
 shield:async()=>{
  S.maxHp=13;S.hp=13;bars();
  await say({title:'More HP',formula:'❤️ 10 → 13',text:'You get 3 more HP. 13 instead of 10!',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#tutorialPlayerRow']});
  for(let i=0;i<4;i++)spawn(null,{y:H()*(.5+i*.08)});run();
  await say({title:'Shield Advance',formula:'❤️ < 10 → ⬆️',text:'If your HP goes under 10, words go back UP. Watch!',next:true});
  S.hp=9;bars();flashDamage();await wait(500);
  pushUp(.10);banner('⬆️ PUSH');
  await say({formula:'❤️ 9 → ⬆️',text:'HP is 9. The words moved up!',next:true,arrows:[{sel:'.wordLane',dir:'left'}]});
  S.hp=2;bars();flashDamage();await wait(500);
  pushUp(.35);const until=performance.now()+4000;S.words.forEach(w=>{if(w.state==='fall')w.frozenUntil=until;});banner('⬆️⬆️ BIG PUSH ❄️');
  await say({formula:'❤️ < 3 → ⬆️⬆️ + ❄️',text:'HP under 3: a BIG push, and the words freeze for 4 seconds!',next:true,arrows:[{sel:'.wordLane',dir:'left'}]});
  S.hp=13;bars();
 },
 hexaxe:async()=>{
  await say({title:'Chain Cleave',formula:'✓ ×6 → 🔮 = short words',text:'Type 6 words. Then ALL words become short, easy words!',next:true});
  S.auto=3200;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'🔮',skipHexed:true});
  banner('🔮 HEX');hexAll();
  say({formula:'🔮 4s',text:'Easy words! Type them fast. 4 seconds!',arrows:[{sel:'.wordLane',dir:'left'}]});
  await wait(4000);unhex();
  await say({formula:'⏱️ → 🔮 ✖',text:'Time is up. The words go back to normal.',next:true});
 },
 crossbow:async()=>{
  await say({title:'Show-Off',formula:'🔥 ×5 → ⭐ long word',text:'Type 5 words in a row. I mark the LONGEST word. Type it for +1!',next:true});
  S.auto=2600;say({formula:'🔥 ×5',text:'Type 5 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(5,{label:'⭐',streak:true});
  let w=longest();if(!w||w.answer.length<6)w=spawn(['ちょうちょ','butterfly'],{y:40});
  setMark(w,{label:'⭐',color:'#ffd447'});banner('⭐');
  say({formula:'⭐ → +1',text:'Type the ⭐ word!',arrows:[{sel:wordSel(w),dir:'left'}]});
  const t=await waitCleared(x=>x===w);hitBoss(0,1,t.el);
  await say({title:'Last Stand',formula:'❤️ 1 → 🛡️ 3s',text:'When your HP is 1, you are SAFE for 3 seconds.',next:true});
  S.hp=1;bars();flashDamage();banner('🛡️ SAFE');S.invulnUntil=performance.now()+3000;S.slowMul=.1;S.slowUntil=S.invulnUntil;S.noSpawnUntil=S.invulnUntil;
  $('tutorialPlayerRow').classList.add('wai-invuln');
  say({formula:'🛡️ 3s 🐢',text:'Safe! Words almost stop.',arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#tutorialPlayerRow','.wordLane']});
  await wait(3000);$('tutorialPlayerRow').classList.remove('wai-invuln');
  S.speedMul=1.25;S.auto=2100;banner('⚡ FAST');
  say({formula:'🔥 ×3 → +1 ⚡',text:'Now words are faster! Type 3 in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(3,{label:'⚡',streak:true});banner('+1 ⚡');S.speedMul=1;S.hp=10;bars();
  await say({formula:'⚡ +1 every word',text:'Now every word hits +1 harder!',next:true});
 },
 anodyne:async()=>{
  await say({title:'Medicine',formula:'✓ ×6 → 💊',text:'Type 6 words. Then you get a medicine!',next:true});
  S.hp=7;bars();S.auto=2600;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'💊'});
  await roulette(['💊❤️<br><small>+2 HP</small>','💊❄️<br><small>slow</small>','💊⛔<br><small>no new words</small>'],0);
  S.hp+=2;bars();$('tutorialPlayerRow').classList.add('wai-heal');setTimeout(()=>$('tutorialPlayerRow').classList.remove('wai-heal'),900);banner('💊 +2 ❤️');
  await say({formula:'💊 = ❤️ or ❄️ or ⛔',text:'You got +2 HP! Next time it may be: slow words, or no new words.',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}]});
 },
 seraphine:async()=>{
  await say({title:'Phantom',formula:'✓ ×5 → 🎯 → ✂️',text:'Type 5 words. I mark the LOWEST word. Type it, and I remove one more word!',next:true});
  S.auto=2300;say({formula:'✓ ×5',text:'Type 5 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(5,{label:'🎯'});
  ensureWords(3);const w=lowest();setMark(w,{label:'🎯',color:'#d49bff'});banner('🎯');
  say({formula:'🎯 → ✂️',text:'Type the 🎯 word!',arrows:[{sel:wordSel(w),dir:'left'}]});
  await waitCleared(x=>x===w);
  const other=lowest()||S.words[0];if(other){removeWord(other);hitBoss(1,0,other.el);pop('✂️',$('wordLane'));}
  await say({formula:'🎯 ✓ + ✂️ 1 free',text:'One more word is gone for free!',next:true});
 },
 tavi:async()=>{
  await say({title:'Rewind',formula:'🔥 ×6 → ⏪',text:'Type 6 words in a row. All words go away, then come back one by one. Short words first!',next:true});
  S.auto=2200;say({formula:'🔥 ×6',text:'Type 6 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'⏪',streak:true});
  ensureWords(4);await rewind();
  await say({formula:'⏪ short → long',text:'Short words came back first. Easy!',next:true});
 },
 lupa:async()=>{
  await say({title:'Ambush',formula:'🔥 ×6 → 🎯🎯🎯',text:'Type 6 words in a row. I mark 3 words at the BOTTOM. Type them in 6 seconds!',next:true});
  for(let i=0;i<4;i++){const w=spawn();w.state='landed';w.el.classList.add('landed');}restack();
  S.auto=3000;say({formula:'🔥 ×6',text:'Type 6 falling words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'🎯',streak:true});
  let pile=S.words.filter(w=>w.state==='landed');while(pile.length<3){const w=spawn();w.state='landed';w.el.classList.add('landed');restack();pile=S.words.filter(x=>x.state==='landed');}
  const targets=pile.slice(0,3);targets.forEach(w=>setMark(w,{label:'🎯',color:'#ff6f91',timer:6}));banner('🎯🎯🎯');
  say({formula:'🎯 = +2 · 🎯🎯🎯 = +3 more',text:'Type all 3 🎯 words! 6 seconds!',arrows:[{sel:'.wordLane',dir:'left'}]});
  let got=0;const done=Promise.all(targets.map(t=>waitCleared(x=>x===t).then(w=>{got++;hitBoss(0,2,w.el);})));
  await Promise.race([done,wait(6000)]);
  if(got===3){hitBoss(0,3);banner('🎯🎯🎯 +3');await say({formula:'🎯🎯🎯 ✓ → +3',text:'All 3! +3 more damage!',next:true});}
  else{const left=targets.filter(t=>S.words.includes(t));left.forEach(t=>setMark(t,null));hurtPlayer(2*left.length);
   await say({formula:'⏱️ 🎯 → ❤️ -2',text:'Too slow! Each 🎯 left hurt you 2 HP.',next:true});}
 },
 nitrate:async()=>{
  $('shieldLine').hidden=false;bars();
  await say({title:'Wrath',formula:'🔴 word → 🛡️ +1',text:'I make some words RED. Type a red word = +1 shield. Shields stop damage!',next:true,arrows:[{sel:'#storyContinuesLine',dir:'down'}],focus:['#storyContinuesLine']});
  S.auto=2400;wrathMarks(true);
  say({formula:'🔴 ×5 → 🛡️🛡️🛡️🛡️🛡️',text:'Type 5 red words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  chip('🛡️','0 / 5');
  while(S.shield<5){await waitCleared(x=>x.mark?.label==='🔴');S.shield++;bars();chip('🛡️',`${S.shield} / 5`,S.shield>=5?'ready':'');pop('🛡️ +1',$('tutorialPlayerRow'));}
  say({formula:'🛡️ ×5 + 🔴 → 💥 +7',text:'Full! Type 1 more red word for a big hit!',arrows:[{sel:'#bossWrap',dir:'right'}]});
  const w=await waitCleared(x=>x.mark?.label==='🔴');S.shield=0;bars();hitBoss(0,7,w.el);banner('💥 +7');wrathMarks(false);chip('🛡️','0 / 5');
  await say({formula:'💥 +7',text:'+7 damage! Wow!',next:true});
 },
 hound:async()=>{
  await say({title:'Blood Hunt',formula:'🔥 ×4 → 🐾',text:'Type 4 words in a row. I mark a 🐾 word. Type it in 6 seconds!',next:true});
  S.auto=2400;say({formula:'🔥 ×4',text:'Type 4 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(4,{label:'🐾',streak:true});
  let ok=false;
  for(let tries=0;tries<3&&!ok;tries++){
   ensureWords(2);const p=lowest()||S.words[0];setMark(p,{label:'🐾',color:'#ff5b4d',timer:6});banner('🐾');
   say({formula:'🐾 ⏱️ 6s',text:'Type the 🐾 word! Quick!',arrows:[{sel:wordSel(p),dir:'left'}]});
   ok=await Promise.race([waitCleared(x=>x===p).then(()=>true),wait(6000).then(()=>false)]);
   if(!ok){setMark(p,null);await say({formula:'🐾 💨',text:'It got away! Try again.',next:true});}
  }
  banner('🐾 HUNT!');let hits=0;
  for(let i=0;i<3;i++){
   ensureWords(2);const p=lowest()||S.words[0];setMark(p,{label:`🐾 ${i+1}/3`,color:'#ff5b4d',timer:3});
   say({formula:`🐾 ${i+1}/3 → +2`,text:'Type it! 3 seconds!',arrows:[{sel:wordSel(p),dir:'left'}]});
   const got=await Promise.race([waitCleared(x=>x===p).then(w=>{hitBoss(0,2,w.el);return true;}),wait(3000).then(()=>false)]);
   if(!got){setMark(p,null);break;}hits++;
  }
  await say({formula:`🐾 ×${hits} → +${hits*2}`,text:hits===3?'Great hunt! +6 damage!':'The hunt ended. Be fast next time!',next:true});
 },
 cassian:async()=>{
  await say({title:'Decree',formula:'✓ ×6 → ✖✖✖',text:'Type 6 words. Then I remove 3 falling words at once!',next:true});
  S.auto=1600;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'✖✖✖'});
  ensureWords(5);const before=S.words.filter(w=>w.state==='fall').length;
  const doomed=S.words.filter(w=>w.state==='fall').slice(0,3);doomed.forEach(w=>{removeWord(w);hitBoss(1,0);});banner('✖✖✖');
  if(before>=4){S.invulnUntil=performance.now()+5000;$('tutorialPlayerRow').classList.add('wai-invuln');setTimeout(()=>$('tutorialPlayerRow').classList.remove('wai-invuln'),5000);}
  await say({formula:'✖✖✖ + 🛡️ 5s',text:'3 words gone! You are also SAFE for 5 seconds.',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}]});
 }
};
function pushUp(frac){S.words.forEach(w=>{if(w.state==='fall'){w.y=Math.max(-20,w.y-H()*frac);setY(w);}});}
function hexAll(){
 let field=S.words.filter(w=>w.state==='fall');
 if(field.length<=2)for(let i=0;i<4;i++)field.push(spawn(SHORT[i%SHORT.length],{y:10+i*40,hex:true}));
 field.forEach((w,i)=>{w.orig=[w.prompt,w.answer];if(!w.el.classList.contains('wai-hex')){setText(w,SHORT[i%SHORT.length]);w.el.classList.add('wai-hex');}w.hexed=true;});
}
function unhex(){S.words.forEach(w=>{if(w.hexed){if(w.orig)setText(w,w.orig);else{removeWord(w);return;}w.hexed=false;w.el.classList.remove('wai-hex');}});}
async function rewind(){
 banner('FOXFIRE REWIND');S.auto=0;lane().classList.add('wai-rewind');
 const list=S.words.slice();list.forEach(w=>{w.el.style.opacity='0';});
 await wait(600);list.forEach(w=>{w.el.remove();});S.words=[];lane().classList.remove('wai-rewind');
 say({text:'All words vanished… now watch them come back one at a time, shortest first.',arrows:[{sel:'.wordLane',dir:'left'}]});
 for(const w of list.sort((a,b)=>a.answer.length-b.answer.length)){spawn([w.prompt,w.answer],{y:-30});await wait(1100);}
 S.auto=2600;
}
let wrathTimer=0;
function wrathMarks(on){clearInterval(wrathTimer);if(!on)return;
 const mark=()=>{const free=S.words.filter(w=>!w.mark&&w.state==='fall');const n=Math.random()<.25?2:1;free.slice(0,n).forEach(w=>setMark(w,{label:'🔴',color:'#ff4d4d'}));if(!free.length)spawn(null,{mark:{label:'🔴',color:'#ff4d4d'}});};
 mark();wrathTimer=setInterval(mark,3000);}
async function roulette(items,pick){
 const box=document.createElement('div');box.className='wai-roulette';box.innerHTML=items.map(t=>`<span>${t}</span>`).join('');$('battlefield').appendChild(box);
 const spans=[...box.children];for(let i=0;i<10+pick;i++){spans.forEach((s,k)=>s.classList.toggle('on',k===i%spans.length));await wait(110+i*12);}
 spans.forEach((s,k)=>s.classList.toggle('on',k===pick));await wait(900);box.remove();
}

// ---- page flow ----------------------------------------------------------------------
function backToCollection(){
 if(fromGuide){try{sessionStorage.setItem('rpgCollectionGuideResume','after-whoami');}catch(_){}}
 location.href='collection.html'+(fromGuide?'':`?op=${encodeURIComponent(opId)}`);
}
$('waiExit').addEventListener('click',backToCollection);
$('waiBack').addEventListener('click',backToCollection);
$('waiAgain').addEventListener('click',()=>location.reload());
async function claim(){
 try{
  const r=await cloud.call('/api/guild/claim',{card_code:context.card_code,mode:'whoami',character_id:opId,correct:Math.max(1,S.correct),incorrect:S.misses});
  return r?.duplicate?'✓ Coins already received. You can play again any time!':r?.awarded?`🪙 +${r.awarded} GUILD COINS`:'';
 }catch(e){return 'Coins could not be saved right now ('+String(e?.message||e).slice(0,80)+').';}
}
async function start(){
 const rule=RULES[opId],cat=CATALOG.find(c=>c.id===opId);
 const loading=$('loading');
 try{
  if(!rule||!cat||cat.rarity<5||!SCRIPTS[opId])throw Error('This operator does not have a Who Am I? lesson.');
  if(!context.card_code)throw Error('Open Adventure with your card first.');
  if(!cloud||!await cloud.ready)throw Error('Firebase connection required.');
  const prof=await cloud.call('/api/profile',{card_code:context.card_code});
  if(!prof?.collection?.owned?.includes(opId))throw Error('Recruit this operator first to unlock their Who Am I?.');
 }catch(e){loading.textContent=e?.message||String(e);loading.insertAdjacentHTML('beforeend','<p><a href="collection.html" style="color:#fff200">‹ Back to Collection</a></p>');return;}
 $('playerLabel').textContent=rule.name||cat.name;$('playerIcon').src=`assets/profile-icons/${opId}.webp`;
 // Adventure layout: the operator stands between the words and the boss.
 const art=$('storySquadArt');art.onload=()=>art.classList.toggle('storySquadArtWide',art.naturalWidth/art.naturalHeight>=.78);
 art.src=cat.art||`assets/recruitment/${opId}.webp`;$('storySquadHeroName').textContent=rule.name||cat.name;
 $('storySquadRoster').innerHTML=`<div class="storySquadCell active"><img alt="" src="assets/profile-icons/${esc(opId)}.webp"><span>${esc(rule.name||cat.name)}</span><small>ACTIVE</small></div>`;
 $('storyActiveLabel').textContent=` · ${rule.name||cat.name}`;
 $('stageName').textContent=rule.name||cat.name;$('playerExpText').textContent=`${cat.rarity}★ OPERATOR`;
 $('bossImg').src='assets/bosses/tutorial.webp';$('bgImg').src='assets/bosses/tutorial-bg.webp';
 S.boss=S.bossMax=30;bars();$('progressText').textContent='';
 loading.hidden=true;$('tutorialApp').hidden=false;input().disabled=false;run();
 const b=$('bossBubble');b.textContent='Show me your skill!';b.classList.add('show');setTimeout(()=>b.classList.remove('show'),3500);
 // Big full-body art for the introduction (the picture explains "this is me").
 await say({title:`Who am I? · ${rule.name||cat.name}`,formula:'👤 → ❓',text:`Hi! I'm ${rule.name||cat.name}. Let me show you my skill!`,next:true,
  arrows:[{sel:'#storySquadVisual',dir:'left'}],focus:['#storySquadVisual','#bossWrap']});
 await SCRIPTS[opId]();
 stopSim();stopSpot();setArrows([]);chip('');input().disabled=true;wrathMarks(false);
 $('waiDoneTitle').textContent=`✓ YOU KNOW ${String(rule.name||cat.name).toUpperCase()}!`;
 $('waiDoneText').textContent=rule.description;
 $('waiDoneCoins').textContent='Saving…';
 $('waiDone').classList.add('show');$('waiDone').setAttribute('aria-hidden','false');$('waiBack').focus();
 $('waiDoneCoins').textContent=await claim();
}
void start();
