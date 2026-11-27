/* Teacher Dashboard (v148.8): one page for the everyday class jobs.
 * Students table (grade, card, coins, shards, progress) with a side panel to manage one
 * student, a setup check, and links to the content editors.
 * Writes follow the same paths and Firestore rules as the older single-purpose pages:
 * grades via /api/cards/set-class, coins with a guildCoinGrants receipt, shards on the
 * per-rarity fields, card actions via cloud-api.js.
 */
await import('./online-spark.js?v=148.9');
import {currentTeacher,teacherSignOut,createCards,disableCard,enableCard,clearCard,rotateCard,formatCode,errorMessage} from './cloud-api.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getFirestore,doc,collection,getDocsFromServer,getDocFromServer,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const $=id=>document.getElementById(id),db=getFirestore(getApp());
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-US');
const GRADES={'1':'1年生','2':'2年生','3':'3年生','1b':'1B','2b':'2B','3b':'3B'};
const SHARD_FIELDS={4:'shards',5:'shards5',6:'shards6'};
let teacher=null,students=[],openId=null,busy=false;

function toast(text,bad=false){const t=$('toast');t.textContent=text;t.className='td-toast'+(bad?' bad':'');t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>{t.hidden=true;},bad?6000:3200);}
function dmsg(text,bad=false){$('dMsg').textContent=text;$('dMsg').className='td-msg'+(bad?' bad':text?' good':'');}
const count=v=>Math.max(0,Math.trunc(Number(v)||0));

// ---------- data ----------
async function loadStudents(){
 const [cards,players]=await Promise.all([getDocsFromServer(collection(db,'cloudCards')),getDocsFromServer(collection(db,'players'))]);
 const byId=new Map(players.docs.map(s=>[s.id,s.data()]));
 students=cards.docs.map(s=>({code:s.id,...s.data()})).filter(c=>!c.deleted&&/^P\d{6,}$/.test(c.publicId||'')).map(c=>{
  const p=byId.get(c.publicId)||null,r=p?.recruitment||{};
  const grade=String(c.grade??p?.grade??'')||'';
  return {id:c.publicId,code:c.code,name:c.username||'',grade,registered:!!c.username,disabled:!!c.disabled||!!p?.disabled,hasPlayer:!!p,
   coins:count(r.coins),s4:count(r.shards),s5:count(r.shards5),s6:count(r.shards6),operators:Object.keys(r.owned||{}).length,
   xp:count(p?.adventure?.xp),best:count(p?.adventure?.best_normal),normalClear:!!p?.adventure?.normal_clear,
   conquest:Array.isArray(p?.story?.completed)?p.story.completed.length:0,tutorialDone:!p||p.tutorial?.version>=1||p.tutorial?.step===5,tutorialStep:p?.tutorial?.step||1};
 }).sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
}
function statusOf(s){return s.disabled?'disabled':s.registered?'active':'blank';}

// ---------- students table ----------
function render(){
 const term=$('search').value.trim().toLowerCase(),gf=$('gradeFilter').value,sf=$('statusFilter').value;
 const list=students.filter(s=>(!term||`${s.id} ${s.name}`.toLowerCase().includes(term))&&
  (!gf||(gf==='none'?!s.grade&&s.registered:gf==='b'?s.grade.endsWith('b'):s.grade===gf))&&(!sf||statusOf(s)===sf));
 const playing=students.filter(s=>statusOf(s)==='active').length,blank=students.filter(s=>statusOf(s)==='blank').length,noGrade=students.filter(s=>!s.grade&&!s.disabled&&s.registered).length;
 $('summary').innerHTML=`${students.length} cards · <b>${playing}</b> playing`+(blank?` · <a href="#" data-filter="blank">${blank} not registered yet</a>`:'')+(noGrade?` · <a href="#" data-filter="none" class="warn">${noGrade} need a grade</a>`:'');
 $('rows').innerHTML=list.map(s=>{
  const st=statusOf(s);
  const card=st==='disabled'?'<span class="td-pill off">Disabled</span>':st==='blank'?'<span class="td-pill wait">Not registered</span>':'<span class="td-pill ok">Playing</span>';
  const progress=!s.hasPlayer?'<span class="td-sub">—</span>':!s.tutorialDone?`<span class="td-sub">Tutorial step ${s.tutorialStep}/5</span>`:
   `${s.normalClear?'<span class="td-tag">Normal ✓</span>':'<span class="td-sub">Normal not cleared</span>'}${s.conquest?` <span class="td-tag" title="Conquest encounters cleared">Conquest ${s.conquest} cleared</span>`:''}`;
  return `<tr data-id="${esc(s.id)}" class="${st}">
   <td><button type="button" class="td-name" data-open="${esc(s.id)}"><b>${esc(s.name||'(no name yet)')}</b><small>${esc(s.id)}</small></button></td>
   <td><select class="td-grade${s.grade?'':' missing'}" data-grade="${esc(s.id)}" aria-label="Grade for ${esc(s.name||s.id)}" ${s.disabled?'disabled':''}><option value="">— choose —</option>${Object.entries(GRADES).map(([v,l])=>`<option value="${v}" ${s.grade===v?'selected':''}>${l}</option>`).join('')}</select></td>
   <td>${card}</td><td class="num">${s.hasPlayer?fmt(s.coins):'—'}</td>
   <td class="num">${s.hasPlayer?`${s.s4} · ${s.s5} · ${s.s6}`:'—'}</td><td>${progress}</td>
   <td><button type="button" class="td-btn small" data-open="${esc(s.id)}">Manage</button></td></tr>`;
 }).join('')||'<tr><td colspan="7" class="td-empty">No students match. Clear the search or filters.</td></tr>';
}

// ---------- side panel ----------
function openDrawer(id){
 const s=students.find(x=>x.id===id);if(!s)return;openId=id;
 $('drawer').hidden=false;document.body.classList.add('td-drawer-open');
 $('dName').textContent=s.name||'(no name yet)';
 $('dSub').textContent=`${s.id} · ${s.grade?GRADES[s.grade]:'no grade'} · ${statusOf(s)==='active'?'playing':statusOf(s)==='blank'?'card not registered yet':'card disabled'}`;
 $('dStats').innerHTML=[['Coins',fmt(s.coins)],['Shards 4★/5★/6★',`${s.s4} / ${s.s5} / ${s.s6}`],['Operators',s.operators],['XP',fmt(s.xp)],['Best Normal score',fmt(s.best)],['Conquest stages',s.conquest]]
  .map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
 $('dGrade').value=s.grade||'';
 $('dToggle').textContent=s.disabled?'Enable card':'Disable card';
 $('dCardText').textContent=s.disabled?'This card is disabled: the student cannot sign in.':s.registered?`Registered as “${s.name}”. Card code ${formatCode(s.code).slice(0,4)}-••••-••••-••••.`:'Not registered yet: the student types their name the first time they scan it.';
 $('dPrint').href=`cloud-cards.html?player=${encodeURIComponent(s.id)}`;$('dProgress').href=`player-management.html?player=${encodeURIComponent(s.id)}`;
 for(const b of [$('dCoinGive'),$('dShardGive'),$('dClear')])b.disabled=!s.hasPlayer&&b!==$('dClear');
 $('dClear').disabled=!s.registered;
 dmsg(s.hasPlayer?'':'This card has not been used yet, so coins and shards can be given after the student registers.');
}
function closeDrawer(){$('drawer').hidden=true;openId=null;document.body.classList.remove('td-drawer-open');}
async function act(job,ok){
 if(busy)return;busy=true;document.body.classList.add('td-busy');dmsg('Saving…');
 try{const text=await job();await loadStudents();render();if(openId)openDrawer(openId);dmsg(text||ok);toast(text||ok);}
 catch(e){const m=errorMessage(e);dmsg(m,true);toast(m,true);}
 finally{busy=false;document.body.classList.remove('td-busy');}
}

async function setGrade(id,grade){
 const r=await window.RPG_V66.call('/api/cards/set-class',{id:Number(id.slice(1)),class:grade||null});
 return r.unchanged?'Grade unchanged.':`Grade saved${grade?` (${GRADES[grade]})`:''}. Old ranking scores were cleared.`;
}
async function giveCoins(id,amount,reason){
 if(!Number.isInteger(amount)||amount<1||amount>1000000)throw Error('Enter a whole number of coins between 1 and 1,000,000.');
 const receiptRef=doc(collection(db,'guildCoinGrants'));
 const after=await runTransaction(db,async tx=>{
  const playerRef=doc(db,'players',id);
  const existing=await tx.get(receiptRef);if(existing.exists())return existing.data().balanceAfter;
  const snap=await tx.get(playerRef);if(!snap.exists())throw Error('This student has not registered yet.');
  const p=snap.data();if(p.disabled)throw Error('This card is disabled.');
  const before=p.recruitment?.coins;if(!Number.isSafeInteger(before)||before<0)throw Error('This student has no coin wallet yet.');
  const next=before+amount;if(next>1000000000)throw Error('Balance would be too large.');
  tx.update(playerRef,{'recruitment.coins':next,'recruitment.lastTeacherGrantId':receiptRef.id,'recruitment.lastTeacherGrantAt':serverTimestamp()});
  tx.set(receiptRef,{playerId:id,playerName:String(p.username||'').slice(0,30),amount,balanceBefore:before,balanceAfter:next,reason:String(reason||'').trim().slice(0,100),teacherUid:teacher.uid,createdAt:serverTimestamp()});
  return next;
 });
 return `Gave ${fmt(amount)} coins. New balance: ${fmt(after)}.`;
}
async function giveShards(id,rarity,amount){
 const field=SHARD_FIELDS[rarity];if(!field)throw Error('Choose a shard type.');
 if(!Number.isInteger(amount)||amount<1||amount>1000)throw Error('Enter 1–1,000 shards.');
 const after=await runTransaction(db,async tx=>{
  const ref=doc(db,'players',id),snap=await tx.get(ref);if(!snap.exists()||snap.data().disabled)throw Error('Student not found or card disabled.');
  const old=Number(snap.data().recruitment?.[field]??0);if(!Number.isSafeInteger(old)||old<0||old+amount>100000000)throw Error('Shard balance out of range.');
  tx.update(ref,{[`recruitment.${field}`]:old+amount,'recruitment.lastShardGrant':{amount,rarity,teacher:true,at:serverTimestamp()}});
  return old+amount;
 });
 return `Gave ${amount} ${rarity}★ shard${amount===1?'':'s'}. They now have ${after}.`;
}

// ---------- setup check ----------
async function health(){
 const items=[];
 const read=async(c,id)=>{try{const s=await getDocFromServer(doc(db,c,id));return s.exists()?s.data():null;}catch{return undefined;}};
 const pools=await Promise.all(['1','2','3','b','all'].map(p=>read('vocabPools',p)));
 const missing=['1年生','2年生','3年生','B group','All Grades'].filter((_,i)=>!pools[i]);
 const words=pools.map(p=>Array.isArray(p?.words)?p.words.filter(w=>w.active!==false).length:0);
 items.push(missing.length?{bad:true,text:`Word lists missing: ${missing.join(', ')}`,href:'setup-spark.html',link:'Run Firebase setup'}:{text:`Word lists ready (${words.slice(0,3).join(' / ')} words for grades 1–3)`});
 const thin=words.slice(0,4).some((n,i)=>pools[i]&&n<20);
 if(!missing.length&&thin)items.push({warn:true,text:'A word list has fewer than 20 active words',href:'vocabulary-admin.html',link:'Open word lists'});
 $('metaWords').textContent=missing.length?'Some lists missing':`${words[0]} · ${words[1]} · ${words[2]} · B ${words[3]} · All ${words[4]} active words`;
 const config=await read('systemConfig','current');
 items.push(config?{text:'Game settings ready'}:{bad:true,text:'Game settings not set up',href:'setup-spark.html',link:'Run Firebase setup'});
 const story=await read('storyContent','published');
 items.push(story?{text:'Conquest published'}:{warn:true,text:'Conquest uses the built-in stages (nothing published yet)',href:'story-editor.html',link:'Open Conquest editor'});
 $('metaStory').textContent=story?'Published':'Built-in stages (not published)';
 const banner=await read('recruitmentConfig','banners');
 const featured=banner?.banners?.[0]?.featured_character_id;
 $('metaBanner').textContent=featured?`Featured: ${featured.charAt(0).toUpperCase()+featured.slice(1)}`:'Using default banner';
 const noGrade=students.filter(s=>!s.grade&&!s.disabled&&s.registered).length;
 if(noGrade)items.push({warn:true,text:`${noGrade} student${noGrade===1?' has':'s have'} no grade (they get the 1年生 list)`,filter:'none',link:'Show them'});
 $('health').innerHTML=items.map(i=>`<span class="td-chip ${i.bad?'bad':i.warn?'warn':'ok'}">${i.bad?'✕':i.warn?'!':'✓'} ${esc(i.text)}${i.link?` ${i.href?`<a href="${i.href}">${esc(i.link)} ›</a>`:`<a href="#" data-filter="${i.filter}">${esc(i.link)} ›</a>`}`:''}</span>`).join('');
}

// ---------- events ----------
for(const id of ['search','gradeFilter','statusFilter'])$(id).addEventListener('input',render);
$('refresh').addEventListener('click',()=>void act(async()=>{await health();return 'Refreshed.';},'Refreshed.'));
document.addEventListener('click',e=>{
 const f=e.target.closest('[data-filter]');
 if(f){e.preventDefault();const v=f.dataset.filter;if(v==='none'){$('gradeFilter').value='none';$('statusFilter').value='';}else{$('statusFilter').value=v;$('gradeFilter').value='';}render();$('studentsTitle').scrollIntoView({behavior:'smooth'});}
 const o=e.target.closest('[data-open]');if(o)openDrawer(o.dataset.open);
});
$('rows').addEventListener('change',e=>{const s=e.target.closest('[data-grade]');if(!s)return;const id=s.dataset.grade,v=s.value;void act(()=>setGrade(id,v));});
$('dClose').addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('drawer').hidden)closeDrawer();});
$('dGradeSave').addEventListener('click',()=>{const v=$('dGrade').value;void act(()=>setGrade(openId,v));});
$('dCoinQuick').addEventListener('click',e=>{const b=e.target.closest('[data-coins]');if(b)$('dCoins').value=b.dataset.coins;});
$('dCoinGive').addEventListener('click',()=>{const n=Number($('dCoins').value),s=students.find(x=>x.id===openId);
 if(!confirm(`Give ${fmt(n)} Guild Coins to ${s?.name||openId}?`))return;void act(async()=>{const t=await giveCoins(openId,n,$('dCoinNote').value);$('dCoins').value='';$('dCoinNote').value='';return t;});});
$('dShardGive').addEventListener('click',()=>{const n=Number($('dShards').value),r=Number($('dShardType').value),s=students.find(x=>x.id===openId);
 if(!confirm(`Give ${n} ${r}★ shards to ${s?.name||openId}?`))return;void act(async()=>{const t=await giveShards(openId,r,n);$('dShards').value='';return t;});});
$('dToggle').addEventListener('click',()=>{const s=students.find(x=>x.id===openId);if(!s)return;
 if(!s.disabled&&!confirm(`Disable ${s.name||s.id}'s card? They will not be able to sign in until you enable it again.`))return;
 void act(async()=>{if(s.disabled){await enableCard(s.code);return 'Card enabled.';}await disableCard(s.code);return 'Card disabled.';});});
$('dClear').addEventListener('click',()=>{const s=students.find(x=>x.id===openId);if(!s||!confirm(`Clear the name on ${s.id}? The next person to scan it chooses a new name. Their progress stays with the Player ID.`))return;
 void act(async()=>{await clearCard(s.code);return 'Name cleared.';});});
$('dRotate').addEventListener('click',()=>{const s=students.find(x=>x.id===openId);if(!s||!confirm(`Make a new QR code for ${s.name||s.id}? The old printed card stops working, so print the new one.`))return;
 void act(async()=>{const fresh=await rotateCard(s.code);return `New card code ${formatCode(fresh)}. Print the new card from Player cards.`;});});
$('newCards').addEventListener('submit',e=>{e.preventDefault();const n=Number($('newCount').value);if(!confirm(`Create ${n} new blank cards?`))return;
 void act(async()=>{await createCards(n);$('statusFilter').value='blank';return `${n} new cards created. Print them from Player cards.`;});});
$('signOut').addEventListener('click',async()=>{await teacherSignOut();location.reload();});

// ---------- start ----------
(async()=>{
 if(!await window.RPG_V66?.ready)return; // online-spark shows the sign-in screen
 teacher=await currentTeacher();
 $('who').textContent=teacher?`Signed in as ${teacher.name||teacher.email}${teacher.name&&teacher.email?` · ${teacher.email}`:''}`:'Not signed in';
 try{await loadStudents();render();await health();}
 catch(e){$('rows').innerHTML=`<tr><td colspan="7" class="td-empty bad">${esc(errorMessage(e))}</td></tr>`;}
 // v148.9 backstop: quietly refresh leaderboard snapshots older than 4 hours.
 setTimeout(()=>{try{window.RPG_V66?.call?.('/api/rankings/rebuild',{}).catch(()=>{});}catch(_){}},4000);
})();
