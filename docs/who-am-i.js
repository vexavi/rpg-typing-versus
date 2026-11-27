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
function spawn(pair,{y=-30,mark=null}={}){
 const [jp,en]=pair||nextPair(new Set(S.words.map(w=>w.answer)));
 const el=document.createElement('div');el.className='word';
 el.innerHTML=`<div class="prompt">${esc(jp)}</div><div class="right"><span class="tag"></span><span class="answer muted">${esc(en)}</span></div>`;
 lane().appendChild(el);
 const w={id:S.nextId++,el,prompt:jp,answer:en,y,state:'fall',frozenUntil:0,mark:null};
 el.dataset.wid=String(w.id);
 S.words.push(w);setY(w);if(mark)setMark(w,mark);
 return w;
}
function setY(w){w.el.style.setProperty('--y',`${Math.round(w.y)}px`);}
// v148.10: marks use the SAME classes as a real battle (battle-marks.css), so a word
// looks exactly like it will in Normal / Adventure. mark = {cls, kind, bonus}.
function setMark(w,mark){
 if(w.mark?.cls)w.el.classList.remove(...w.mark.cls.split(' '));
 w.mark=mark||null;w.bonus=mark?.bonus||null;
 if(mark?.cls)w.el.classList.add(...mark.cls.split(' '));
 if(!mark){w.el.removeAttribute('data-hunt-time');w.el.removeAttribute('data-lupa-time');}
}
function setText(w,[jp,en]){w.prompt=jp;w.answer=en;w.el.querySelector('.prompt').textContent=jp;w.el.querySelector('.answer').textContent=en;}
function removeWord(w){
 S.words=S.words.filter(x=>x!==w);w.el.remove();
 restack();
}
function restack(){const landed=S.words.filter(w=>w.state==='landed');landed.forEach((w,i)=>{w.y=H()-30*(i+1)-6;setY(w);});}
function tick(t){
 if(!S.running){S.raf=0;return;}
 const dt=Math.min(.1,(t-(S.last||t))/1000);S.last=t;
 const now=performance.now();
 const globalFrozen=now<S.freezeUntil;
 const kSpeed=S.kurone?S.kurone.getFallMultiplier(now/1000):1;
 const mul=S.speedMul*kSpeed*(now<S.slowUntil?S.slowMul:1);
 for(const w of S.words){
  if(w.state!=='fall'||globalFrozen||now<w.frozenUntil)continue;
  if(w.el.classList.contains('operator-shield-pushing')&&!w.pushT)w.pushT=setTimeout(()=>{w.el.classList.remove('operator-shield-pushing');w.pushT=0;},450);
  w.y+=S.base*mul*dt;
  const floor=H()-30*(landedCount()+1)-6;
  if(w.y>=floor){w.y=floor;w.state='landed';w.el.classList.add('landed');}
  setY(w);
 }
 lane().classList.toggle('operator-frozen-domain',globalFrozen);
 S.words.forEach(w=>w.el.classList.toggle('operator-shield-hold',now<w.frozenUntil));
 if(S.auto&&!globalFrozen&&now>=S.noSpawnUntil&&now-S.lastSpawn>=S.auto/kSpeed&&S.words.length<9){S.lastSpawn=now;spawn();}
 S.raf=requestAnimationFrame(tick);
}
function run(){if(!S.running){S.running=true;S.last=0;S.raf=requestAnimationFrame(tick);}}
function stopSim(){S.running=false;S.auto=0;}

// ---- HUD ------------------------------------------------------------------------------
function bars(){
 $('playerFill').style.width=`${Math.min(100,100*S.hp/S.maxHp)}%`;$('playerHpText').textContent=`${S.hp}/${S.maxHp}`;
 $('bossFill').style.width=`${100*S.boss/S.bossMax}%`;$('bossHpText').textContent=`${S.boss}/${S.bossMax}`;
 $('mistakesText').textContent=String(S.misses);$('scoreText').textContent=String(S.correct*100);
}
const FX=()=>window.RPG_FX;
const elOf=id=>S.words.find(w=>w.id===id)?.el||null;
function fxPassive(effect){FX()?.passive?.({characterId:opId,...effect},elOf);}
function flashDamage(){const f=$('damageFlash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');setTimeout(()=>f.classList.remove('show'),320);}
// Same calls the battle engine makes (damagePlayer / onCorrect in adventure_engine.js).
function hurtPlayer(n=1,reason='input miss'){
 if(S.kurone){const m=S.kurone.takeDamageMultiplier();if(m>1)n=Math.ceil(n*m-1e-9);}
 if(performance.now()<S.invulnUntil){FX()?.guard?.('immune');return;}
 if(S.shield>0){const b=Math.min(S.shield,n);S.shield-=b;n-=b;nitrateShieldUi();
  const el=$('nitrateShield');el.classList.remove('nitrate-block-impact');void el.offsetWidth;el.classList.add('nitrate-block-impact');FX()?.guard?.('block',b);}
 if(n>0){S.hp=Math.max(1,S.hp-n);flashDamage();FX()?.player?.({amount:n,reason,display:n});}
 bars();
}
function setHp(hp,reason='hit'){const n=S.hp-hp;S.hp=hp;bars();if(n>0){flashDamage();FX()?.player?.({amount:n,reason,display:n});}}
function hitBoss(n=1,extra=0,o={}){
 S.boss=Math.max(1,S.boss-n-extra);bars();
 const b=$('bossImg');b.classList.remove('bossFlash');void b.offsetWidth;b.classList.add('bossFlash');
 const dmg=n+extra;
 FX()?.attack?.({rect:o.rect||null,classes:o.classes||'',operatorId:opId,damage:dmg,crit:false,effect:o.effect||null,score:dmg*100,display:String(dmg)});
}
function nitrateShieldUi(){
 const el=$('nitrateShield');if(!el)return;
 el.querySelectorAll('.nitrate-shield-segment').forEach((seg,i)=>seg.classList.toggle('filled',i<S.shield));
 el.classList.toggle('awakened',S.shield>=3);el.classList.toggle('charged',S.shield>=5);
 el.setAttribute('aria-label',`Wrath Shield ${S.shield} of 5`);
 lane().classList.toggle('operator-nitrate-ready',S.shield>=5);
}
// A word cleared by the operator itself (Seraphine / Cassian): slash, no boss damage.
function autoClear(w,kind){
 if(!w)return;FX()?.autoClear?.(w.el,opId);
 const slash=document.createElement('span');slash.className=kind==='cassian'?'operator-sovereign-slash':'operator-phantom-slash';
 slash.style.top=`${Math.max(0,w.y)}px`;slash.setAttribute('aria-hidden','true');lane().appendChild(slash);setTimeout(()=>slash.remove(),500);
 removeWord(w);S.correct++;bars();
}
// The small in-lane status line the real battle shows (Chain Cleave, Last Stand, Ambush timer).
let statusEl=null;
function laneStatus(cls,text,title){
 if(!cls){statusEl?.remove();statusEl=null;return;}
 if(!statusEl||!statusEl.isConnected||statusEl.className!==cls){statusEl?.remove();statusEl=document.createElement('div');statusEl.className=cls;statusEl.setAttribute('aria-live','off');lane().appendChild(statusEl);}
 if(title){statusEl.innerHTML=`<span class="operator-lupa-timer-title">${esc(title)}</span><span class="operator-lupa-timer-value">${esc(text)}</span>`;}
 else statusEl.textContent=text;
}
function countdown(seconds,fn){const end=performance.now()+seconds*1000;fn(seconds);const t=setInterval(()=>{const left=Math.max(0,(end-performance.now())/1000);fn(left);if(left<=0)clearInterval(t);},100);return ()=>clearInterval(t);}
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
 if(S.kurone)kuroneChat(S.kurone.onMistake(0));
 hurtPlayer(1,'input miss');
}
$('answerForm').addEventListener('submit',e=>{
 e.preventDefault();if(input().disabled)return;
 const v=input().value.trim().toLowerCase();input().value='';input().readOnly=false;
 if(!v)return;
 const pool=S.words.filter(x=>x.state!=='hidden').sort((a,b)=>(b.mark?1:0)-(a.mark?1:0));
 const w=pool.find(x=>x.answer===v);
 if(!w){log(`MISS: ${v}`);onMiss();return;}
 // One strike per word, like the real battle: the passive bonus rides on the same hit.
 const rect=w.el.getBoundingClientRect(),classes=w.el.className;
 let bonus=typeof w.bonus==='function'?w.bonus():w.bonus;
 if(!bonus&&S.nextBonus){bonus=S.nextBonus;S.nextBonus=null;}
 const chat=S.kurone?S.kurone.onCorrect([],0,{}):null;
 const extra=(bonus?.extra||0)+(S.perHit||0)+(chat?.bonusDamage||0)+(S.hype>0?(S.hype--,1):0);
 if(chat)kuroneChat(chat);
 log('Correct!');removeWord(w);hitBoss(1,extra,{rect,classes,effect:bonus?.effect});onCorrect(w);
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

// ---- Kurone's Live Chat HUD (same markup/classes as the battle screen) ----------------
function kuroneHud(){
 const on=!!S.kurone,v=on?S.kurone.getViewers():0,P=window.RPG_OPERATOR_PASSIVES,tier=P.kuroneTier(v),r=P.RULES.kurone,steps=P.kuroneSteps(v);
 $('kuroneLive').hidden=!on;
 if(on){$('kuroneViewers').textContent=String(v);$('kuroneLive').className=`kurone-live tier-${tier}${v>30?' danger':''}`;
  $('kuroneLive').querySelectorAll('.kurone-live-pips i').forEach(i=>i.classList.toggle('on',v>=Number(i.dataset.at)));
  $('kuroneBonus').textContent=!tier?'':steps?`+1 / word · +${steps+1} every 5th`:(r.every[tier]===1?'+1 / word':`+1 every ${r.every[tier]===2?'2nd':'3rd'} word`);}
 const taken=on?P.kuroneTaken(v):1,speed=on?P.kuroneSpeed(v):1;
 $('kuroneDanger').hidden=!(on&&v>30);
 $('kuroneTaken').textContent=taken>1?`×${taken} DMG TAKEN`:'TYPO = LOSE HALF';
 $('kuroneSpeed').textContent=speed>1?`+${Math.round((speed-1)*100)}% SPEED`:'';$('kuroneSpeed').hidden=speed<=1;
 lane().classList.toggle('kurone-trending',on&&speed>1);
 $('kuroneHype').hidden=!(S.hype>0);$('kuroneHypeLeft').textContent=String(S.hype||0);
}
function kuroneReact(kind,text=''){
 const host=$('kuroneLive');if(host.hidden)return;const r=host.getBoundingClientRect();
 const el=document.createElement('div');el.className=`kurone-react${kind==='sad'?' sad':''}${kind==='tier'?' big':''}`;
 const list=kind==='sad'?['😢','💔','😭','😞']:['😆','❤️','👍','🔥','✨','😂','💖'];
 el.innerHTML=`${kind==='tier'?'🎉':list[Math.floor(Math.random()*list.length)]}${text?`<small>${esc(text)}</small>`:''}`;
 el.style.left=`${r.left+r.width*(0.15+Math.random()*0.35)}px`;el.style.top=`${r.top-8}px`;el.style.setProperty('--dx',`${Math.round((Math.random()-.5)*24)}px`);
 document.body.appendChild(el);setTimeout(()=>el.remove(),1300);
 const c=$('kuroneViewers');c.classList.remove('bump','drop');void c.offsetWidth;c.classList.add(kind==='sad'?'drop':'bump');
}
function kuroneChat(e){
 if(!e)return;kuroneHud();
 if(e.type==='kurone-chat'){kuroneReact(e.tierUp?'tier':'happy',e.tierUp?`${e.viewers} VIEWERS`:'+1');if(e.tierUp)fxPassive(e);}
 if(e.type==='kurone-chat'&&e.enteredDanger)window.RPG_KURONE_NOTIFY?.('DANGER ZONE!','A typo now = HALF my viewers leave!');
 else if(e.type==='kurone-leave'&&e.lost>0)kuroneReact('sad',e.half?`-${e.lost} (HALF)`:`-${e.lost}`);
}
// A pretend Shoutout picker with two squad mates (the real one lists your actual squad).
function fakePicker(burst,hype){
 return new Promise(res=>{
  const box=document.createElement('div');box.className='kurone-pick';
  const mates=[['alden','Alden'],['lupa','Lupa']];
  box.innerHTML=`<div class="kurone-pick-box"><h2>📣 SHOUTOUT!</h2><p class="kurone-pick-formula">💥 +${burst} · 📣 +1 × ${hype} words</p>
   <div class="kurone-pick-list">${mates.map(([id,n],k)=>`<button type="button" class="kurone-pick-card" data-k="${k}"><img alt="" src="assets/profile-icons/${id}.webp"><span>${n}<small>HP 10/10</small></span><kbd>${k+1}</kbd></button>`).join('')}</div></div>`;
  document.body.appendChild(box);
  const done=k=>{removeEventListener('keydown',keys,true);box.remove();res(mates[k]);};
  const keys=e=>{if(e.key==='1'||e.key==='2'){e.preventDefault();done(Number(e.key)-1);}};
  addEventListener('keydown',keys,true);
  box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>done(Number(b.dataset.k))));
  setTimeout(()=>box.querySelector('button')?.focus(),30);
 });
}


// Kurone's squad rule, hands-on, on the REAL Squad Assembly screen (same markup and
// classes as chooseStorySquad in adventure_engine.js): try slot 2 -> angry notification
// -> RESET -> put her in slot 1 -> READY.
function squadRuleDemo(){
 return new Promise(done=>{
  chip('');S.auto=0;
  const screen=$('storySquadSelectScreen'),mount=$('storySquadSelectMount'),coach=$('trainingCoach'),coachHome=coach.parentNode,coachNext=coach.nextSibling;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const roster=[['kurone','Kurone',6],['lupa','Lupa',6],['alden','Alden',4]].map(([id,name,rarity])=>({id,name,rarity}));
  const SLOTS=3;let selected=['alden'],lockedCount=1,activeSlot=1,rarityFilter='all',search='',tried=false,phase=0;
  mount.replaceChildren();screen.hidden=false;screen.setAttribute('aria-hidden','false');document.body.classList.add('story-squad-picker-open','wai-squad-demo');
  screen.appendChild(coach);coach.classList.add('wai-squad-coach');
  const wrap=make('div','storySquadPicker'),stage=make('section','storySquadPickerStage'),heading=make('div','storySquadPickerLegend');
  const countText=make('span','storySquadSubhead','');heading.append(make('span','storySquadEyebrow','DEPLOYMENT ORDER'),countText);
  const lineup=make('div','storySquadStages');const cards=[];
  for(let i=0;i<SLOTS;i++){
   const holder=make('div','storySquadStage'),card=make('button','storySquadSlot');card.type='button';card.id=`waiSlot${i+1}`;
   const number=make('span','storySquadSlotNumber',String(i+1).padStart(2,'0')),image=make('img','storySquadSlotArt');image.alt='';
   const label=make('div','storySquadSlotLabel'),stars=make('span','storySquadSlotStars'),name=make('strong','storySquadSlotName'),state=make('span','storySquadSlotState');
   label.append(stars,name,state);card.append(number,image,label);
   card.addEventListener('click',()=>{if(i!==lockedCount)return;activeSlot=i;message.textContent='';render();});
   const slotAction=make('div','storySquadSlotAction');holder.append(card,slotAction);lineup.appendChild(holder);
   cards.push({holder,card,image,name,stars,state,slotAction});
  }
  const ready=make('button','storySquadAction primary storySquadReadyBtn','READY');ready.type='button';ready.id='waiReady';
  stage.append(heading,lineup);
  const side=make('aside','storySquadPickerRoster'),sideHeading=make('div','storySquadRosterHeading');sideHeading.append(make('strong','','OPERATORS'));
  const searchBox=make('input','storySquadSearch');searchBox.type='search';searchBox.placeholder='Search operators';searchBox.autocomplete='off';
  const filters=make('div','storySquadFilters'),filterButtons=[];
  for(const [value,title] of [['all','ALL'],['6','6★'],['5','5★'],['4','4★']]){const btn=make('button','storySquadFilter',title);btn.type='button';btn.addEventListener('click',()=>{rarityFilter=value;renderRoster();});filters.appendChild(btn);filterButtons.push({btn,value});}
  const rosterList=make('div','storySquadPickerList'),message=make('div','storySquadPickerError');message.setAttribute('role','status');
  side.append(sideHeading,searchBox,filters,rosterList);
  const footer=make('div','storySquadPickerActions'),back=make('button','storySquadAction secondary','BACK'),reset=make('button','storySquadAction secondary','RESET');
  back.type=reset.type='button';reset.id='waiReset';back.disabled=true;footer.append(message,reset,back);
  wrap.append(stage,side,footer);mount.appendChild(wrap);
  function renderRoster(){
   filterButtons.forEach(({btn,value})=>btn.classList.toggle('active',value===rarityFilter));
   rosterList.replaceChildren();
   for(const op of roster.filter(o=>(rarityFilter==='all'||String(o.rarity)===rarityFilter)&&o.name.toLowerCase().includes(search.toLowerCase().trim()))){
    const card=make('button','storySquadRosterCard');card.type='button';card.id=`waiCard_${op.id}`;
    const pos=selected.indexOf(op.id);card.classList.toggle('inSquad',pos!==-1);card.classList.toggle('highlighted',selected[activeSlot]===op.id);
    const pic=make('img','');pic.alt='';pic.src=`assets/profile-icons/${op.id}.webp`;
    const status=make('span','storySquadRosterBadge',pos>=0?String(pos+1):`${op.rarity}★`);
    card.append(pic,make('span','storySquadRosterName',op.name),status);
    const kuroneBlocked=op.id==='kurone'&&lockedCount!==0&&pos<0;
    if(kuroneBlocked){card.classList.add('kurone-blocked');status.textContent='1ST ONLY';}
    card.addEventListener('click',()=>{
     if(lockedCount>SLOTS-1)return;
     if(kuroneBlocked){message.textContent='Kurone must be 1st!';window.RPG_KURONE_NOTIFY?.();tried=true;step();return;}
     const occupied=selected.indexOf(op.id);if(occupied>=0&&occupied!==lockedCount){message.textContent='Already selected.';return;}
     selected[lockedCount]=op.id;activeSlot=lockedCount;message.textContent='';render();step();
    });
    rosterList.appendChild(card);
   }
  }
  function render(){
   cards.forEach(({holder,card,image,name,stars,state,slotAction},i)=>{
    const id=selected[i],op=roster.find(o=>o.id===id),confirmed=i<lockedCount,locked=i!==lockedCount;
    holder.classList.toggle('selected',i===lockedCount);holder.classList.toggle('confirmed',confirmed);holder.classList.toggle('empty',!id);holder.classList.toggle('locked',locked&&!confirmed);
    card.disabled=locked;
    if(id){const art=`assets/deployment/${id}.webp`;image.hidden=false;if(image.dataset.src!==art){image.dataset.src=art;image.src=art;}}
    else{image.hidden=true;image.removeAttribute('src');delete image.dataset.src;}
    name.textContent=op?.name||(locked?'LOCKED':`SELECT ${['FIRST','SECOND','THIRD'][i]}`);
    stars.textContent=op?'★'.repeat(op.rarity):'';
    state.textContent=confirmed?'LOCKED IN':op?'SELECTED':(locked?'':'PICK AN OPERATOR');
    slotAction.replaceChildren();if(i===lockedCount)slotAction.appendChild(ready);
   });
   countText.textContent=`${lockedCount} / ${SLOTS} LOCKED IN`;ready.disabled=!selected[lockedCount];renderRoster();
  }
  searchBox.addEventListener('input',()=>{search=searchBox.value;renderRoster();});
  reset.addEventListener('click',()=>{selected=[];lockedCount=0;activeSlot=0;message.textContent='';render();step();});
  ready.addEventListener('click',()=>{if(!selected[lockedCount])return;lockedCount++;activeSlot=lockedCount;render();step();});
  const talk=o=>{const p=say(o);stopSpot();return p;};
  function finish(){
   coach.classList.remove('wai-squad-coach');coachHome.insertBefore(coach,coachNext);
   mount.replaceChildren();screen.hidden=true;screen.setAttribute('aria-hidden','true');document.body.classList.remove('story-squad-picker-open','wai-squad-demo');
   setArrows([]);done();
  }
  function step(){
   if(phase===0&&!tried){talk({title:'Squad rule',formula:'02 = Kurone ?',text:'Let\'s try! Put me 2nd. Click me.',arrows:[{sel:'#waiCard_kurone',dir:'right'}]});return;}
   if(phase<=1&&lockedCount>0&&selected[0]!=='kurone'){phase=1;talk({formula:'💢 01 ONLY!',text:'I got angry! I must be 1st. Press RESET.',arrows:[{sel:'#waiReset',dir:'down'}]});return;}
   if(phase<=2&&selected[0]!=='kurone'){phase=2;talk({formula:'01 = Kurone',text:'Now click me for slot 01.',arrows:[{sel:'#waiCard_kurone',dir:'right'}]});return;}
   if(phase<=3&&lockedCount===0){phase=3;talk({formula:'READY ▸',text:'Press READY.',arrows:[{sel:'#waiReady',dir:'up'}]});return;}
   if(phase<=4){phase=5;talk({formula:'01 Kurone ✓',text:'Yes! I lead the squad. Then my Shoutout always has teammates!',next:true}).then(finish);}
  }
  render();step();
 });
}

// ---- one script per operator (kid-friendly, accurate to the real passive) ------------
// Each step shows a picture formula (trigger → effect) so it makes sense even without reading.
const SCRIPTS={
 aveline:async()=>{
  await say({title:'Weak Point',formula:'✓ ×6 → ⚡ +2',text:'Type 6 words. Then your next word hits harder: +2!',next:true});
  S.auto=2600;say({formula:'✓ ×6 → ⚡',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'⚡'});
  chip('⚡','READY','ready');
  $('bossHpText').classList.add('operator-weak-point-ready');fxPassive({type:'charge'});
  S.nextBonus={extra:2,effect:{type:'boss-bonus',characterId:opId}};
  say({formula:'⚡ → +2',text:'Charged! Type 1 more word.',arrows:[{sel:'.inputBar',dir:'left'}]});
  await waitCleared(()=>true);
  $('bossHpText').classList.remove('operator-weak-point-ready');fxPassive({type:'boss-bonus'});chip('⚡','');
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
  S.freezeUntil=performance.now()+2500;S.noSpawnUntil=S.freezeUntil;fxPassive({type:'domain-freeze',seconds:2.5,slowSeconds:3});
  say({formula:'❄️ 2.5s',text:'Frozen! Words stop. Type them!',arrows:[{sel:'.wordLane',dir:'left'}]});
  await wait(2500);S.slowMul=.85;S.slowUntil=performance.now()+3000;
  await say({formula:'❄️ → 🐢 3s',text:'Then words fall slower for 3 seconds.',next:true});
 },
 shield:async()=>{
  S.maxHp=13;S.hp=13;bars();
  await say({title:'More HP',formula:'❤️ 10 → 13',text:'You get 3 more HP. 13 instead of 10!',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#tutorialPlayerRow']});
  for(let i=0;i<4;i++)spawn(null,{y:H()*(.5+i*.08)});run();
  await say({title:'Shield Advance',formula:'❤️ < 10 → ⬆️',text:'If your HP goes under 10, words go back UP. Watch!',next:true});
  setHp(9);await wait(400);
  pushUp(.10);fxPassive({type:'shield-advance',percent:10,freezeSeconds:0});
  await say({formula:'❤️ 9 → ⬆️',text:'HP is 9. The words moved up!',next:true,arrows:[{sel:'.wordLane',dir:'left'}]});
  setHp(2);await wait(400);
  pushUp(.35);const until=performance.now()+4000;S.words.forEach(w=>{if(w.state==='fall')w.frozenUntil=until;});
  fxPassive({type:'shield-advance',percent:35,freezeSeconds:4});
  await say({formula:'❤️ < 3 → ⬆️⬆️ + ⛨',text:'HP under 3: a BIG push, and the words HOLD for 4 seconds!',next:true,arrows:[{sel:'.wordLane',dir:'left'}]});
  S.hp=13;bars();
 },
 hexaxe:async()=>{
  await say({title:'Chain Cleave',formula:'✓ ×6 → ☾ = short words',text:'Type 6 words. Then ALL words become one short, easy word!',next:true});
  S.auto=3200;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'☾',skipHexed:true});
  hexAll();fxPassive({type:'chain-cleave-start',seconds:4});
  const stop=countdown(4,left=>laneStatus('operator-chain-hex-status',`CHAIN CLEAVE · ${left.toFixed(1)}s`));
  say({formula:'☾ 4s',text:'Easy words! Type them fast. 4 seconds!',arrows:[{sel:'.wordLane',dir:'left'}]});
  await wait(4000);stop();laneStatus(null);unhex();
  await say({formula:'⏱️ → ☾ ✖',text:'Time is up. The words go back to normal.',next:true});
 },
 crossbow:async()=>{
  await say({title:'Show-Off',formula:'🔥 ×5 → ◎ long word',text:'Type 5 words in a row. I mark the LONGEST word. Type it for +1!',next:true});
  S.auto=2600;say({formula:'🔥 ×5',text:'Type 5 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(5,{label:'◎',streak:true});
  let w=longest();if(!w||w.answer.length<6)w=spawn(['ちょうちょ','butterfly'],{y:40});
  setMark(w,{cls:'operator-crossbow-bullseye',bonus:{extra:1}});fxPassive({type:'crossbow-showoff',wordId:w.id});
  say({formula:'◎ → +1',text:'Type the ◎ word!',arrows:[{sel:wordSel(w),dir:'left'}]});
  await waitCleared(x=>x===w);
  await say({title:'Last Stand',formula:'❤️ 1 → 🛡️ 3s',text:'When your HP is 1, you are SAFE for 3 seconds.',next:true});
  setHp(1);S.invulnUntil=performance.now()+3000;S.slowMul=.1;S.slowUntil=S.invulnUntil;S.noSpawnUntil=S.invulnUntil;
  fxPassive({type:'fletcher-last-stand',seconds:3});lane().classList.add('operator-fletcher-last-stand');
  const stop=countdown(3,left=>laneStatus('operator-fletcher-status',`LAST STAND · ${left.toFixed(1)}s`));
  say({formula:'🛡️ 3s 🐢',text:'Safe! Words almost stop.',arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#tutorialPlayerRow','.wordLane']});
  await wait(3000);stop();
  lane().classList.replace('operator-fletcher-last-stand','operator-fletcher-overdrive');
  S.speedMul=1.25;S.auto=2100;laneStatus('operator-fletcher-status','OVERDRIVE · 0/3 WORDS');
  say({formula:'🔥 ×3 → +1 ⚡',text:'Now words are faster! Type 3 in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  const watch=setInterval(()=>laneStatus('operator-fletcher-status',`OVERDRIVE · ${Math.min(3,S.counter?.cur??3)}/3 WORDS`),150);
  await count(3,{label:'⚡',streak:true});clearInterval(watch);
  S.speedMul=1;S.perHit=1;laneStatus('operator-fletcher-status','ADRENALINE MOMENTUM · +1 DMG');
  S.words.forEach(x=>x.el.classList.add('operator-crossbow-adrenaline'));
  await say({formula:'⚡ +1 every word',text:'Now every word hits +1 harder!',next:true});
  S.perHit=0;laneStatus(null);lane().classList.remove('operator-fletcher-overdrive');S.words.forEach(x=>x.el.classList.remove('operator-crossbow-adrenaline'));S.hp=10;bars();
 },
 anodyne:async()=>{
  await say({title:'Medicine',formula:'✓ ×6 → 💊',text:'Type 6 words. Then you get a medicine!',next:true});
  S.hp=7;bars();S.auto=2600;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'💊'});
  S.hp+=2;bars();fxPassive({type:'anodyne-serum',hp:2});
  await say({formula:'💊 = ❤️ or 🐢 or ⛔',text:'You got +2 HP! Next time it may be: slow words, or no new words.',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}]});
 },
 seraphine:async()=>{
  await say({title:'Phantom',formula:'✓ ×5 → ✦ → ✂️',text:'Type 5 words. I mark the LOWEST word. Type it, and I remove one more word!',next:true});
  S.auto=2300;say({formula:'✓ ×5',text:'Type 5 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(5,{label:'✦'});
  ensureWords(3);const w=lowest();setMark(w,{cls:'operator-phantom-mark'});fxPassive({type:'mark-word',wordId:w.id});
  say({formula:'✦ → ✂️',text:'Type the ✦ word!',arrows:[{sel:wordSel(w),dir:'left'}]});
  await waitCleared(x=>x===w);
  await wait(500);autoClear(lowest()||S.words[0],'seraphine');
  await say({formula:'✦ ✓ + ✂️ 1 free',text:'One more word is gone for free!',next:true});
 },
 tavi:async()=>{
  await say({title:'Rewind',formula:'🔥 ×6 → ⏪',text:'Type 6 words in a row. All words go back up, then come back one by one. Short words first!',next:true});
  S.auto=2200;say({formula:'🔥 ×6',text:'Type 6 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'⏪',streak:true});
  ensureWords(4);await rewind();
  await say({formula:'⏪ short → long',text:'Short words came back first. Easy!',next:true});
 },
 lupa:async()=>{
  await say({title:'Ambush',formula:'🔥 ×6 → ☾☾☾',text:'Type 6 words in a row. I mark 3 words at the BOTTOM. Type them in 6 seconds!',next:true});
  for(let i=0;i<4;i++){const w=spawn();w.state='landed';w.el.classList.add('landed');}restack();
  S.auto=3000;say({formula:'🔥 ×6',text:'Type 6 falling words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'☾',streak:true});
  let pile=S.words.filter(w=>w.state==='landed');while(pile.length<3){const w=spawn();w.state='landed';w.el.classList.add('landed');restack();pile=S.words.filter(x=>x.state==='landed');}
  const targets=pile.slice(0,3);
  // Each Weak Point is +2; the last one also carries the +3 full-clear bonus (lupa-complete).
  const left=()=>targets.filter(t=>S.words.includes(t)).length;
  targets.forEach(w=>setMark(w,{cls:'operator-lupa-weakpoint',bonus:()=>left()===1?{extra:5,effect:{type:'lupa-complete',characterId:opId}}:{extra:2,effect:{type:'lupa-hit',characterId:opId}}}));
  document.body.classList.add('operator-lupa-focus');lane().classList.add('operator-lupa-focus');
  fxPassive({type:'lupa-start',wordIds:targets.map(t=>t.id),seconds:6});
  const stop=countdown(6,s=>laneStatus('operator-lupa-timer',`${s.toFixed(1)}s`,'MOONLIT AMBUSH'));
  say({formula:'☾ = +2 · ☾☾☾ = +3 more',text:'Type all 3 ☾ words! 6 seconds!',arrows:[{sel:'.wordLane',dir:'left'}]});
  let got=0;const done=Promise.all(targets.map(t=>waitCleared(x=>x===t).then(()=>{got++;})));
  await Promise.race([done,wait(6000)]);
  stop();laneStatus(null);document.body.classList.remove('operator-lupa-focus');lane().classList.remove('operator-lupa-focus');
  if(got===3){await say({formula:'☾☾☾ ✓ → +3',text:'All 3! +3 more damage!',next:true});}
  else{const rest=targets.filter(t=>S.words.includes(t));rest.forEach(t=>setMark(t,null));hurtPlayer(2*rest.length,'Moonlit Ambush timeout');
   await say({formula:'⏱️ ☾ → ❤️ -2',text:'Too slow! Each ☾ left hurt you 2 HP.',next:true});}
 },
 nitrate:async()=>{
  $('nitrateShield').hidden=false;nitrateShieldUi();
  await say({title:'Wrath',formula:'WRATH word → 🛡️ +1',text:'I mark some words WRATH (yellow and black). Type one = +1 shield. Shields stop damage!',next:true,arrows:[{sel:'#nitrateShield',dir:'down'}],focus:['#nitrateShield']});
  S.auto=2400;wrathMarks(true);
  say({formula:'WRATH ×5 → 🛡️🛡️🛡️🛡️🛡️',text:'Type 5 WRATH words.',arrows:[{sel:'#nitrateShield',dir:'down'}]});
  chip('🛡️','0 / 5');
  const isWrath=x=>x.mark?.cls==='operator-nitrate-wrath';
  while(S.shield<5){await waitCleared(isWrath);S.shield++;nitrateShieldUi();fxPassive({type:'nitrate-charge',shield:S.shield});chip('🛡️',`${S.shield} / 5`,S.shield>=5?'ready':'');}
  // Full shield: the next Wrath word detonates it (+7), exactly as in battle.
  S.words.filter(isWrath).forEach(x=>{x.bonus={extra:7,effect:{type:'nitrate-release',characterId:opId}};});
  wrathMarks.full=true;
  say({formula:'🛡️ ×5 + WRATH → 💥 +7',text:'Full! Type 1 more WRATH word for a big hit!',arrows:[{sel:'#bossWrap',dir:'right'}]});
  await waitCleared(isWrath);
  S.shield=0;nitrateShieldUi();fxPassive({type:'nitrate-release',damage:7});
  const hit=document.createElement('div');hit.className='operator-nitrate-release';hit.setAttribute('aria-hidden','true');hit.textContent='WRATH · +7';lane().appendChild(hit);setTimeout(()=>hit.remove(),800);
  wrathMarks(false);chip('🛡️','0 / 5');
  await say({formula:'💥 +7',text:'+7 damage! Wow!',next:true});
 },
 hound:async()=>{
  await say({title:'Blood Hunt',formula:'🔥 ×4 → PREY',text:'Type 4 words in a row. I mark a PREY word. Type it in 6 seconds!',next:true});
  S.auto=2400;say({formula:'🔥 ×4',text:'Type 4 words in a row.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(4,{label:'🐾',streak:true});
  const prey=(p,sec,chain,bonus)=>{setMark(p,{cls:chain?'operator-hound-prey operator-hound-chain':'operator-hound-prey',bonus});
   fxPassive({type:'hound-mark',wordId:p.id,seconds:sec,chain});
   return countdown(sec,s=>{if(p.el.isConnected)p.el.setAttribute('data-hunt-time',s.toFixed(1));});};
  let ok=false;
  for(let tries=0;tries<3&&!ok;tries++){
   ensureWords(2);const p=lowest()||S.words[0];const stop=prey(p,6,false,null);
   say({formula:'PREY ⏱️ 6s',text:'Type the PREY word! Quick!',arrows:[{sel:wordSel(p),dir:'left'}]});
   ok=await Promise.race([waitCleared(x=>x===p).then(()=>true),wait(6000).then(()=>false)]);stop();
   if(!ok){setMark(p,null);await say({formula:'PREY 💨',text:'It got away! Try again.',next:true});}
  }
  fxPassive({type:'hound-next',damage:0,chainHits:0});let hits=0;
  for(let i=0;i<3;i++){
   ensureWords(2);const p=lowest()||S.words[0];
   const stop=prey(p,3,true,{extra:2,effect:{type:'hound-next',damage:2,chainHits:i+1,characterId:opId}});
   say({formula:`BLOOD HUNT ${i+1}/3 → +2`,text:'Type it! 3 seconds!',arrows:[{sel:wordSel(p),dir:'left'}]});
   const got=await Promise.race([waitCleared(x=>x===p).then(()=>true),wait(3000).then(()=>false)]);stop();
   if(!got){setMark(p,null);break;}hits++;
  }
  if(hits===3)fxPassive({type:'hound-complete',damage:6});
  await say({formula:`BLOOD HUNT ×${hits} → +${hits*2}`,text:hits===3?'Great hunt! +6 damage!':'The hunt ended. Be fast next time!',next:true});
 },
 kurone:async()=>{
  const P=window.RPG_OPERATOR_PASSIVES;S.kurone=P.create('kurone','normal');S.hype=0;S.maxHp=8;S.hp=8;bars();kuroneHud();
  const waitViewers=n=>new Promise(r=>{const t=setInterval(()=>{if(S.kurone.getViewers()>=n){clearInterval(t);r();}},100);});
  await say({title:'Glass cannon',formula:'❤️ 8 = LOWEST HP',text:"I'm strong but fragile! I have the lowest HP of everyone.",next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#tutorialPlayerRow']});
  await say({title:'Live Chat',formula:'✓ → 👁 +1',text:"I'm streaming! Every word you type brings 1 viewer.",next:true,arrows:[{sel:'#kuroneLive',dir:'down'}],focus:['#kuroneLive','#tutorialPlayerRow']});
  S.auto=2400;say({formula:'👁 10 → 💥 more damage',text:'Type 10 words. Get 10 viewers!',arrows:[{sel:'#kuroneLive',dir:'down'}],focus:[...DEFAULT_FOCUS,'#kuroneLive']});
  await waitViewers(10);
  await say({formula:'👁 10 · 20 · 30 → 💥💥💥',text:'More viewers = more damage. 10, 20, 30… and it keeps going up!',next:true,arrows:[{sel:'#kuroneLive',dir:'down'}],focus:['#kuroneLive']});
  await mistakeDemo();
  await say({formula:'❌ → 👁 −5 😢',text:'A mistake = 5 viewers leave.',next:true,arrows:[{sel:'#kuroneLive',dir:'down'}],focus:['#kuroneLive']});
  // DANGER ZONE: past 30
  S.kurone.setViewers(29);kuroneHud();
  say({title:'Danger zone',formula:'👁 30 → ⚠',text:'My stream is popular now! Type 2 words.',arrows:[{sel:'#kuroneLive',dir:'down'}],focus:[...DEFAULT_FOCUS,'#kuroneLive']});
  await waitViewers(31);
  await say({formula:'⚠ 31+ : ❌ = 👁 ½',text:'DANGER! Past 30, one mistake = HALF my viewers leave!',next:true,arrows:[{sel:'#kuroneDanger',dir:'down'}],focus:['#kuroneLive','#kuroneDanger']});
  S.kurone.setViewers(49);kuroneHud();
  say({formula:'👁 50 → 💥💥 ❤️×2 ⏩',text:'Type 1 more word and watch.',arrows:[{sel:'#kuroneLive',dir:'down'}],focus:[...DEFAULT_FOCUS,'#kuroneLive','#kuroneDanger']});
  await waitViewers(50);
  await say({formula:'💥 ↑ · ❤️ ×2 · ⏩ +15%',text:'50 viewers! Big damage… but I take DOUBLE damage, and words come FASTER!',next:true,arrows:[{sel:'#kuroneDanger',dir:'down'}],focus:['#kuroneLive','#kuroneDanger','.wordLane']});
  const hp0=S.hp;await mistakeDemo();
  await say({formula:`❌ → 👁 50→25 · ❤️ −${hp0-S.hp}`,text:`Ouch! Half my viewers left, and I lost ${hp0-S.hp} HP. Be careful!`,next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}],focus:['#kuroneLive','#tutorialPlayerRow']});
  S.hp=S.maxHp;bars();S.auto=0;
  // Shoutout = cash out before it gets too risky
  S.kurone.setViewers(60);kuroneHud();
  const btn=$('kuroneShoutout');btn.hidden=false;
  say({title:'Shoutout',formula:'👁 60 → 📣 💰',text:'Too risky? Cash out! In Adventure, click my BIG button to swap me out.',arrows:[{sel:'#kuroneShoutout',dir:'left'}],focus:['#kuroneShoutout','#kuroneLive']});
  await new Promise(r=>btn.addEventListener('click',r,{once:true}));btn.hidden=true;
  const exit=P.kuroneExit(S.kurone.getViewers(),'swap');
  const mate=await fakePicker(exit.burst,exit.hype);
  S.kurone.kuroneLeave('swap');
  fxPassive({type:'kurone-shoutout',burst:exit.burst,hype:exit.hype});
  hitBoss(0,exit.burst,{effect:{type:'kurone-burst',characterId:'kurone'}});S.hype=exit.hype;
  $('storySquadArt').src=`assets/recruitment/${mate[0]}.webp`;$('storySquadHeroName').textContent=mate[1];$('playerLabel').textContent=mate[1];
  $('storyActiveLabel').textContent=` · ${mate[1]}`;
  $('storySquadRoster').innerHTML=`<div class="storySquadCell"><img alt="" src="assets/profile-icons/kurone.webp"><span>Kurone</span><small>BENCH</small></div><div class="storySquadCell active"><img alt="" src="assets/profile-icons/${mate[0]}.webp"><span>${mate[1]}</span><small>ACTIVE</small></div>`;
  S.kurone=null;S.maxHp=10;S.hp=10;bars();kuroneHud();
  await say({formula:`📣 → 💥 +${exit.burst} (½) + 📣 ×${exit.hype}`,text:`${mate[1]} is in! I hit the boss on the way out, and ${mate[1]} gets HYPE: +1 on the next ${exit.hype} words.`,next:true,arrows:[{sel:'#kuroneHype',dir:'down'}],focus:['#kuroneHype','#bossWrap']});
  S.auto=2400;say({formula:'📣 +1 ×3',text:'Type 3 words with HYPE!',arrows:[{sel:'#kuroneHype',dir:'down'}],focus:[...DEFAULT_FOCUS,'#kuroneHype']});
  await count(3,{label:'📣'});
  await say({title:'Rage Quit',formula:'💀 → 💥 FULL (max 20) + 📣',text:'If I get knocked out, my post is FULL damage. More viewers = bigger post!',next:true});
  await squadRuleDemo();
  S.hype=0;kuroneHud();
 },
 cassian:async()=>{
  await say({title:'Decree',formula:'✓ ×6 → ✖✖✖',text:'Type 6 words. Then I remove 3 falling words at once!',next:true});
  S.auto=1600;say({formula:'✓ ×6',text:'Type 6 words.',arrows:[{sel:'#passiveChip',dir:'up'}]});
  await count(6,{label:'✖✖✖'});
  ensureWords(5);const falling=S.words.filter(w=>w.state==='fall');const before=falling.length;
  const doomed=falling.slice(0,3),invulnerable=before>=4;
  fxPassive({type:'cassian-decree',wordIds:doomed.map(w=>w.id),invulnerable});
  doomed.forEach(w=>{const slash=document.createElement('span');slash.className='operator-sovereign-slash';slash.style.top=`${Math.max(0,w.y)}px`;slash.setAttribute('aria-hidden','true');lane().appendChild(slash);setTimeout(()=>slash.remove(),500);removeWord(w);S.correct++;});bars();
  if(invulnerable){S.invulnUntil=performance.now()+5000;lane().classList.add('operator-sovereign-guard');setTimeout(()=>lane().classList.remove('operator-sovereign-guard'),5000);}
  await say({formula:'✖✖✖ + 🛡️ 5s',text:'3 words gone! You are also SAFE for 5 seconds.',next:true,arrows:[{sel:'#tutorialPlayerRow',dir:'down'}]});
 }
};
function pushUp(frac){
 const moved=[];
 S.words.forEach(w=>{if(w.state!=='fall')return;const before=w.y;w.y=Math.max(-20,w.y-H()*frac);const d=before-w.y;if(d<=0)return;
  w.el.classList.remove('operator-shield-pushing');w.el.style.setProperty('--mara-shield-push-distance',`${d}px`);setY(w);moved.push(w);});
 if(moved.length){void lane().offsetWidth;moved.forEach(w=>{w.el.classList.add('operator-shield-pushing');clearTimeout(w.pushT);w.pushT=0;});}
}
// Chain Cleave: like the battle, every word turns into the SAME shortest word.
const HEX=['き','tree'];
function hexAll(){
 const field=S.words.filter(w=>w.state!=='hidden');
 const hex=w=>{w.orig=w.orig||[w.prompt,w.answer];setText(w,HEX);w.el.querySelector('.tag').textContent='☾';w.el.classList.add('operator-chain-hex');w.hexed=true;};
 field.forEach(hex);
 if(field.length<=2)for(let i=0;i<4;i++){const w=spawn(HEX,{y:-30-i*32});w.summoned=true;hex(w);}
}
function unhex(){S.words.slice().forEach(w=>{if(!w.hexed)return;if(w.summoned){removeWord(w);return;}setText(w,w.orig);w.el.querySelector('.tag').textContent='';w.hexed=false;w.el.classList.remove('operator-chain-hex');});}
// Foxfire Rewind: words fly back up the lane, then return one by one, shortest first.
async function rewind(){
 S.auto=0;const list=S.words.slice();
 fxPassive({type:'foxfire-start',wordIds:list.map(w=>w.id)});
 lane().classList.add('operator-foxfire-active','operator-foxfire-rewinding');
 list.forEach(w=>{const from=w.y;w.state='hidden';w.y=-30;w.el.classList.remove('landed','operator-foxfire-released');
  w.el.classList.add('operator-foxfire-hidden','operator-foxfire-rewinding');w.el.style.setProperty('--tavi-rewind-distance',`${Math.max(0,from+30)}px`);setY(w);});
 restack();
 await wait(600);
 list.forEach(w=>{w.el.classList.remove('operator-foxfire-rewinding');w.el.style.removeProperty('--tavi-rewind-distance');});
 lane().classList.remove('operator-foxfire-rewinding');
 say({text:'All words went back up… now watch them come back one at a time, shortest first.',arrows:[{sel:'.wordLane',dir:'left'}]});
 for(const w of list.sort((a,b)=>a.answer.length-b.answer.length)){
  if(!S.words.includes(w))continue;
  w.state='fall';w.el.classList.remove('operator-foxfire-hidden');w.el.classList.add('operator-foxfire-released');setY(w);await wait(1100);
 }
 lane().classList.remove('operator-foxfire-active');S.auto=2600;
}
let wrathTimer=0;
function wrathMarks(on){clearInterval(wrathTimer);wrathMarks.full=false;if(!on)return;
 const markOne=w=>{setMark(w,{cls:'operator-nitrate-wrath',bonus:wrathMarks.full?{extra:7,effect:{type:'nitrate-release',characterId:opId}}:null});return w.id;};
 const mark=()=>{const free=S.words.filter(w=>!w.mark&&w.state==='fall');const n=Math.random()<.25?2:1;
  const ids=free.slice(0,n).map(markOne);if(!free.length){const w=spawn();ids.push(markOne(w));}
  fxPassive({type:'nitrate-mark',wordIds:ids});};
 mark();wrathTimer=setInterval(mark,3000);}

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
 const loading=$('loading');let prof=null;
 try{
  if(!rule||!cat||cat.rarity<5||!SCRIPTS[opId])throw Error('This operator does not have a Who Am I? lesson.');
  if(!context.card_code)throw Error('Open Adventure with your card first.');
  if(!cloud||!await cloud.ready)throw Error('Firebase connection required.');
  prof=await cloud.call('/api/profile',{card_code:context.card_code});
  if(!prof?.collection?.owned?.includes(opId))throw Error('Recruit this operator first to unlock their Who Am I?.');
 }catch(e){loading.textContent=e?.message||String(e);loading.insertAdjacentHTML('beforeend','<p><a href="collection.html" style="color:#fff200">‹ Back to Collection</a></p>');return;}
 FX()?.prepare?.(opId);window.RPG_AURA?.setPlayer?.(prof);
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
 stopSim();stopSpot();setArrows([]);chip('');input().disabled=true;wrathMarks(false);laneStatus(null);
 $('waiDoneTitle').textContent=`✓ YOU KNOW ${String(rule.name||cat.name).toUpperCase()}!`;
 $('waiDoneText').textContent=rule.description;
 $('waiDoneCoins').textContent='Saving…';
 $('waiDone').classList.add('show');$('waiDone').setAttribute('aria-hidden','false');$('waiBack').focus();
 $('waiDoneCoins').textContent=await claim();
}
void start();
