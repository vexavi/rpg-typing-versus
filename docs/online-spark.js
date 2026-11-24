/* v86.11 Spark: Firestore data is authoritative; RTDB availability is NOT a login gate.
 * No Functions, Cloud Run, or offline queue.
 * Scores/XP are client-reported (not secure against a modified browser).
 * Never trust this bridge for paid or scarce rewards. */
import {ensureStudent,googleTeacher,currentTeacher} from './cloud-api.js?v=86.30';
import {makePull,getJstDate} from './recruitment-core.mjs';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getAuth} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {getFirestore,doc,collection,getDocFromServer,getDocsFromServer,query,where,orderBy,limit,onSnapshot,setDoc,updateDoc,serverTimestamp,runTransaction,deleteDoc,writeBatch} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
const db=getFirestore(getApp()),auth=getAuth(getApp());
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1'; // Change together with firestore.rules if necessary.
const $=id=>document.getElementById(id),ref=(c,id)=>doc(db,c,id),uid=()=>auth.currentUser?.uid;
const cardPattern=/^[A-HJ-NP-Z2-9]{16}$/;const grades=['1','2','3','1b','2b','3b'];const pools=['1','2','3','b','all'];
const cleanCode=c=>String(c||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
const name=x=>String(x||'').trim().replace(/\s+/g,' ').slice(0,20);
const err=x=>{throw Error(x)};
const read=async(c,id)=>{const snap=await getDocFromServer(ref(c,id));return snap.exists()?snap.data():null};
const teacher=async()=>{const t=await currentTeacher();if(!t)err('Authorized teacher Google sign-in required.');if(t.uid!==TEACHER_UID)err('Teacher UID does not match configured Firestore rules.');return t;};
const poolOf=g=>g?.endsWith('b')?'b':g;
const codeInfo=async(code)=>{code=cleanCode(code);if(!cardPattern.test(code))err('Enter a valid Adventure Card code.');const c=await read('cloudCards',code);if(!c||c.disabled||c.deleted)err('Card not registered or disabled.');if(!/^P\d{6,}$/.test(c.publicId||''))err('Card needs a valid player ID.');return {code,card:c};};
async function currentPlayer(body={}){
 if(!uid())err('Firebase sign-in required.');const s=await read('cardSessions',uid());
 if(!s||!s.code||!s.publicId)err('Scan your Adventure Card first.');
 if(body.card_code&&cleanCode(body.card_code)!==s.code)err('Adventure Card does not match your session.');
 const [c,p]=await Promise.all([read('cloudCards',s.code),read('players',s.publicId)]);
 if(!c||c.disabled||c.deleted||c.publicId!==s.publicId||!p||p.disabled)err('Card session expired, disabled, or missing.');
 return {session:s,card:c,player:p,id:s.publicId,playerRef:ref('players',s.publicId)};
}
const defaultPlayer=(card)=>({publicId:card.publicId,username:card.username,character:'mc',grade:card.grade||null,rankIconId:'icon01',rankIconUpdatedAt:0,disabled:false,
 adventure:{xp:0,best_normal:0,best_extra:0,normal_clear:false,extra_clear:false,achievements:[]},
 cosmetics:{nickname:card.username,motto:'',theme:'signal',background:'default',featured:'mc',showcase:['mc','']},
 story:{completed:[],best_stars:{}},tutorial:{version:0,step:1,updatedAt:null},recruitment:{coins:0,permits:0,pity_six:0,owned:{},recent:[],shards:0,auras:{}},tournament:{count:0,history:[],trophies:{gold:0,silver:0,bronze:0}}});
// Remembered browser sign-in: Firebase Auth already persists its anonymous UID.
// Only a server-verified cardSessions document can restore the linked card.
// Do not save the bearer code to localStorage or trust local identity as login proof.
async function resumeCard(){
 await ensureStudent();
 const p=await currentPlayer();
 if(!p.card.username || typeof p.card.username!=='string')err('Adventure Card registration must be completed again.');
 return {ok:true,public_id:p.id,name:p.card.username,grade:p.card.grade||null,
  card_code:p.session.code,online:true,cloud:true,remembered:true};
}
async function openCard(b){
 await ensureStudent();
 const {code,card:c}=await codeInfo(b.card_code),n=name(b.name);
 if(!c.username){
  if(!n){if(b.probe===true)return {ok:true,registration_required:true,assigned_grade:c.grade||null};err('Enter your name to register this card.');}
  const selectedGrade=String(b.grade||'');
  if(!c.grade&&!['1','2','3'].includes(selectedGrade))err('Choose Grade 1, 2, or 3 when creating your name.');
  // Claim a blank card once. A teacher-preassigned class (including B groups) takes priority.
  const grade=c.grade||selectedGrade;
  if(!grades.includes(grade))err('Invalid grade on Adventure Card; ask your teacher to correct it.');
  const update={username:n};
  if(!c.grade)update.grade=selectedGrade;
  await updateDoc(ref('cloudCards',code),update);
  c.username=n;c.grade=grade;
 }
 // The QR code is a bearer credential. Auth UID sessions can be re-established on another Chromebook.
 await setDoc(ref('cardSessions',uid()),{code,publicId:c.publicId,linkedAt:serverTimestamp()});
 if(!await read('players',c.publicId)){
  try{await setDoc(ref('players',c.publicId),defaultPlayer(c));}
  catch(e){if(!await read('players',c.publicId))throw e;}
 }
 return {ok:true,public_id:c.publicId,name:c.username,grade:c.grade||null,card_code:code,online:true,cloud:true};
}
async function currentConfig(){const data=await read('systemConfig','current');if(!data)err('Firebase setup incomplete. Teacher: run SETUP SPARK first.');return Number(data.revision)||1;}
async function vocab(b){const p=await currentPlayer(b);const shared=b.mode==='shared';const g=shared?'all':p.player.grade;if(!g)err('Teacher must assign your class before playing.');
 const pool=shared?'all':poolOf(g),data=await read('vocabPools',pool);if(!data||!Array.isArray(data.words))err('Vocabulary pool not installed. Teacher: run Spark setup.');
 return {ok:true,pool,grade:shared?'all':g[0],rank_grade:g,revision:Number(data.revision)||1,group:pool==='b'?'b':'standard',words:data.words.filter(x=>x.active!==false),ruleset:shared?`v65-shared-r${data.revision}-fixed-120s`:null};
}
const wordCheck=w=>{const prompt=String(w?.prompt||'').trim().slice(0,160),answer=String(w?.answer||'').trim().replace(/\s+/g,' ').slice(0,80);
 if(!prompt||!/[A-Za-z]/.test(answer))err('Enter a Japanese prompt and an English answer.');return {prompt,answer,active:w.active!==false};};
async function vocabAdmin(b){await teacher();const pool=b.pool;if(!pools.includes(pool))err('Unknown vocabulary pool.');const r=ref('vocabPools',pool),s=await getDocFromServer(r);
 if(!s.exists())err('Pool not seeded. Teacher: open Spark Setup.');const old=s.data(),words=[...(old.words||[])],action=b.action||'list';
 if(action==='add'||action==='edit'){const w=wordCheck(b),i=action==='edit'?words.findIndex(x=>x.id===b.id):-1;
  if(action==='edit'&&i<0)err('Word not found.');if(words.some((x,j)=>j!==i&&x.answer.toLowerCase()===w.answer.toLowerCase()))err('Duplicate English answer.');
  if(action==='add')words.push({id:Math.max(0,...words.map(x=>Number(x.id)||0))+1,...w});else words[i]={...words[i],prompt:w.prompt,answer:w.answer};
 }else if(action==='delete'||action==='toggle'){const i=words.findIndex(x=>x.id===b.id);if(i<0)err('Word not found.');if(action==='delete')words.splice(i,1);else words[i]={...words[i],active:!!b.active};
 }else if(action==='import'){if(!Array.isArray(b.words)||!b.words.length||b.words.length>1000||!['append','replace'].includes(b.method))err('Import 1–1000 words.');
  const next=b.method==='replace'?[]:words;const known=new Set(next.map(w=>w.answer.toLowerCase()));let i=Math.max(0,...next.map(w=>w.id||0));
  for(const input of b.words){const w=wordCheck(input);if(known.has(w.answer.toLowerCase()))continue;next.push({id:++i,...w});known.add(w.answer.toLowerCase());}words.splice(0,words.length,...next);
 }else if(action!=='list')err('Unknown vocabulary operation.');
 const changed=JSON.stringify(old.words)!==JSON.stringify(words);if(changed){if(words.length>1000)err('Maximum 1,000 words per group.');
  await runTransaction(db,async tx=>{const latest=await tx.get(r);if(!latest.exists()||latest.data().revision!==old.revision)err('Vocabulary changed in another tab; refresh.');
   tx.update(r,{words,revision:old.revision+1,updatedAt:serverTimestamp()});});}
 return {ok:true,pool,revision:old.revision+(changed?1:0),words,active_count:words.filter(w=>w.active).length};
}
// One read when Recruitment opens; no listener and no periodic polling.
async function recruitmentBanners(){
 const data=await read('recruitmentConfig','banners');
 return {ok:true,revision:Number(data?.revision)||0,banners:Array.isArray(data?.banners)?data.banners.filter(b=>b?.id==='featured').slice(0,1):[]};
}
async function recruitmentBannersAdmin(body={}){
 await teacher();
 const action=body.action||'load';
 if(action==='load')return recruitmentBanners();
 if(action!=='save')err('Unknown banner editor action.');
 const expected=Number(body.expected_revision);
 if(!Number.isInteger(expected)||expected<0)err('Invalid banner revision; reload the editor.');
 const ids=['featured'],limits={tab:22,title:70,kicker:50,subtitle:110,description:260,featured_character_id:40};
 const fields=Object.keys(limits);
 if(!Array.isArray(body.banners)||body.banners.length!==1)err('Exactly one Featured banner is required.');
 const safe=body.banners.map((b,i)=>{
  if(!b||b.id!==ids[i])err('Banner IDs cannot be changed.');
  const obj={id:ids[i]};
  for(const field of fields){
   if(typeof b[field]!=='string'||b[field].length>limits[field])err('Invalid '+field+' length.');
   obj[field]=b[field].trim();
  }
  if(!obj.tab||!obj.title||!obj.kicker)err('Tab label, title, and kicker are required.');
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(obj.featured_character_id))err('Invalid featured character ID.');
  return obj;
 });
 const target=ref('recruitmentConfig','banners');
 const revision=await runTransaction(db,async tx=>{
  const snapshot=await tx.get(target),oldRevision=snapshot.exists()?Number(snapshot.data().revision)||0:0;
  if(oldRevision!==expected)err('Another teacher tab changed the banners. Reload to avoid overwriting their changes.');
  const signature=items=>Array.isArray(items)?JSON.stringify(items.map(x=>[x?.id,...fields.map(f=>x?.[f])])):'';
  if(snapshot.exists()&&signature(snapshot.data().banners)===signature(safe))return oldRevision;
  tx.set(target,{revision:oldRevision+1,banners:safe,updatedAt:serverTimestamp()});
  return oldRevision+1;
 });
 return {ok:true,revision,banners:safe};
}
async function cardsList(){await teacher();const snaps=await getDocsFromServer(collection(db,'cloudCards'));
 // Keep reads down: card documents carry grade for the teacher table and sync it during assignments.
 const cardDocs=snaps.docs.map(s=>({code:s.id,...s.data()})).filter(x=>!x.deleted);
 const cards=await Promise.all(cardDocs.map(async c=>{const player=await read('players',c.publicId);const grade=player?.grade||c.grade||null;
 return {id:Number(c.publicId?.slice(1))||0,public_id:c.publicId,code:c.code,username:c.username,registered:!!c.username,disabled:!!c.disabled,class_year:grade?.[0]||null,class_section:grade?.endsWith('b')?'b':'a'};}));
 return {ok:true,cards:cards.sort((a,b)=>a.id-b.id)};
}
async function setClass(b){
 await teacher();
 const grade=b.class;
 if(grade!==null&&!grades.includes(grade))err('Invalid grade.');
 const id=Number(b.id);
 if(!Number.isSafeInteger(id)||id<1)err('Invalid Player ID.');
 const publicId='P'+String(id).padStart(6,'0');
 // Find the card directly; do not read every player's profile for one grade correction.
 const cards=await getDocsFromServer(query(collection(db,'cloudCards'),where('publicId','==',publicId),limit(2)));
 if(cards.docs.length!==1||cards.docs[0].data().deleted)err('Card not found.');
 const cardDoc=cards.docs[0].ref,pRef=ref('players',publicId);
 const [player,oldScores]=await Promise.all([
  getDocFromServer(pRef),
  getDocsFromServer(query(collection(db,'rankEntries'),where('public_id','==',publicId),limit(100)))
 ]);
 // Atomically update both grade locations and remove outdated grade-specific rankings.
 const batch=writeBatch(db);
 batch.update(cardDoc,{grade});
 if(player.exists())batch.update(pRef,{grade});
 for(const row of oldScores.docs)batch.delete(row.ref);
 await batch.commit();
 return {ok:true,grade};
}
async function rankIcon(b){const p=await currentPlayer(b);if(b.action==='set'){const icon=String(b.icon_id||'');if(!/^icon\d{2}$/.test(icon))err('Invalid profile icon.');await updateDoc(p.playerRef,{rankIconId:icon,rankIconUpdatedAt:Date.now()});
 for(const mode of ['normal','extra','challenge','shared']){const r=ref('rankEntries',p.id+'_'+mode),snap=await getDocFromServer(r);
  if(snap.exists())try{await updateDoc(r,{icon_id:icon,updatedAt:serverTimestamp()})}catch(e){console.warn('Ranking icon update deferred',e);}}
 return {ok:true,icon_id:icon,updated_at:Date.now()};}
 return {ok:true,icon_id:p.player.rankIconId||'icon01',updated_at:p.player.rankIconUpdatedAt||0};}
let currentRun=null;
async function rankStart(b){const p=await currentPlayer(b),mode=b.mode;if(!['normal','extra','challenge','shared'].includes(mode))err('Invalid ranking mode.');
 const grade=mode==='shared'?'all':p.player.grade;if(!grade)err('Assign class before playing.');
 const v=await read('vocabPools',mode==='shared'?'all':poolOf(grade)),configVersion=await currentConfig();if(!v)err('Vocabulary is missing.');
 const revision=Number(v.revision)||1,token=crypto.randomUUID();
 const record={uid:uid(),publicId:p.id,mode,grade,pool:mode==='shared'?'all':poolOf(grade),vocabRevision:revision,configRevision:configVersion,token,status:'active',startedAt:serverTimestamp()};
 await setDoc(ref('sparkRuns',uid()),record);currentRun={...record,startedMs:Date.now()};
 return {ok:true,token,revision,configVersion,grade,pool:record.pool,ruleset:`spark-${mode}-${grade}-v${revision}-c${configVersion}`};
}
function rankQuery(mode,grade,revision,configRevision,n=20){return query(collection(db,'rankEntries'),where('mode','==',mode),where('grade','==',grade),where('vocabRevision','==',revision),where('configRevision','==',configRevision),orderBy('score','desc'),limit(n));}
async function ranking(b){const p=await currentPlayer(b),mode=b.mode||'normal',grade=mode==='shared'?'all':b.grade||p.player.grade;
 if(!['normal','extra','challenge','shared'].includes(mode)||!['all',...grades].includes(grade))err('Invalid ranking selection.');
 const pool=grade==='all'?'all':poolOf(grade),[v,c]=await Promise.all([read('vocabPools',pool),currentConfig()]);if(!v)err('Vocabulary pool missing.');
 const revision=Number(v.revision)||1,rule=`spark-${mode}-${grade}-v${revision}-c${c}`;
 const d=await getDocsFromServer(rankQuery(mode,grade,revision,c,Math.min(20,Number(b.limit)||20)));
 const entries=d.docs.map((s,i)=>({...s.data(),rank:i+1}));const mine=entries.find(x=>x.public_id===p.id)||{public_id:p.id,name:p.player.username,icon_id:p.player.rankIconId||'icon01',rank:null,score:0};
 return {ok:true,mode,grade,assigned_grade:p.player.grade,entries,current:mine,total:entries.length,ruleset:rule,expected_ruleset:rule,source:'firebase-spark-unverified',completed_only:true,vocab_revision:revision};
}
async function rankSubmit(b){const p=await currentPlayer(b);if(!b.completed||!Number.isInteger(b.score)||b.score<=0||b.score>2000000)err('Invalid score.');
 const snap=await getDocFromServer(ref('sparkRuns',uid()));const run=snap.data();if(!run||run.status!=='active'||run.token!==b.run_token)err('Run missing or already completed.');
 if(b.mode!==run.mode||b.grade!==run.grade||b.vocab_pool!==run.pool||b.vocab_revision!==run.vocabRevision)err('Run config mismatch.');
 if(!run.startedAt||Date.now()-run.startedAt.toMillis()<(['shared','challenge'].includes(run.mode)?115000:15000))err('Run completed too quickly.');
 const [c,v]=await Promise.all([currentConfig(),read('vocabPools',run.pool)]);
 if(c!==run.configRevision||v?.revision!==run.vocabRevision)err('Difficulty or vocabulary changed. Run not ranked.');
 const id=p.id+'_'+run.mode,scoreRef=ref('rankEntries',id),runRef=ref('sparkRuns',uid());
 await runTransaction(db,async tx=>{const [r,prior]=await Promise.all([tx.get(runRef),tx.get(scoreRef)]);
  if(!r.exists()||r.data().token!==run.token||r.data().status!=='active')err('Run already submitted.');
  const old=prior.exists()?prior.data():null;
  const fields={uid:uid(),public_id:p.id,name:p.player.username,icon_id:p.player.rankIconId||'icon01',mode:run.mode,grade:run.grade,score:b.score,
   vocabRevision:run.vocabRevision,configRevision:run.configRevision,updatedAt:serverTimestamp()};
  tx.update(runRef,{status:'submitted',score:b.score,finishedAt:serverTimestamp()});
  if(!old||old.vocabRevision!==fields.vocabRevision||old.configRevision!==fields.configRevision||old.grade!==fields.grade||b.score>old.score)tx.set(scoreRef,fields);
 });currentRun=null;return {ok:true,mode:run.mode,grade:run.grade,ruleset:`spark-${run.mode}-${run.grade}-v${run.vocabRevision}-c${run.configRevision}`};
}
/* v73 Guild Coins: client-reported completion claims stored transactionally.
 * Important: Firestore cannot confirm real gameplay. PULLS STAY DISABLED.
 * Claims are idempotent per ranking token / Story attempt; no daily cap. */
const GUILD_MAX_BALANCE=1000000000;
const guildUUID=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(x||''));
async function guildClaim(b){
 const p=await currentPlayer(b),mode=String(b.mode||'');
 if(!['normal','extra','story'].includes(mode))err('This mode does not earn Guild Coins.');
 if(!p.player.recruitment||!Number.isInteger(p.player.recruitment.coins))err('Guild Coin wallet is missing. Ask teacher to migrate this card.');
 const correct=Number(b.correct),incorrect=Number(b.incorrect);
 if(!Number.isSafeInteger(correct)||!Number.isSafeInteger(incorrect)||correct<0||incorrect<0||correct>1000000||incorrect>1000000||!correct)err('Invalid run answer counts.');
 let claimKey='',stageId='',runToken=null,attemptId=null,preRank=null;
 if(mode==='normal'||mode==='extra'){
  runToken=String(b.run_token||'');if(!guildUUID(runToken))err('Invalid ranked token.');
  preRank=await getDocFromServer(ref('sparkRuns',uid()));
  const rank=preRank.data();
  if(!rank||rank.status!=='submitted'||rank.mode!==mode||rank.token!==runToken||rank.publicId!==p.id)err('Complete and submit the full ranked run before claiming Guild Coins.');
  claimKey=mode+'-'+runToken;
 }else{
  stageId=String(b.stage_id||'');attemptId=String(b.attempt_id||'');
  if(!/^\d{1,4}-\d{1,4}$/.test(stageId)||!guildUUID(attemptId))err('Invalid Story stage or attempt.');
  if(!(p.player.story?.completed||[]).includes(stageId))err('Save the Story battle clear to Firebase before claiming coins.');
 }
 const firstKey=mode==='story'?`story-first-${stageId}`:null;
 let result=await runTransaction(db,async tx=>{
  const playerSnap=await tx.get(p.playerRef);
  if(!playerSnap.exists()||playerSnap.data().disabled)err('Player no longer active.');
  const d=playerSnap.data(),oldCoins=Number(d.recruitment?.coins);
  if(!Number.isSafeInteger(oldCoins)||oldCoins<0)err('Guild Coin wallet is invalid.');
  let refKey=claimKey,amount=0,firstClear=false,duplicate=false,receipt=null;
  if(mode==='story'){
   if(!(d.story?.completed||[]).includes(stageId))err('Story clear not saved.');
   const firstRef=ref('guildClaims',`${p.id}__${firstKey}`),first=await tx.get(firstRef);
   if(!first.exists()){refKey=firstKey;firstClear=b.first_clear===true;amount=firstClear?20:5;}
   else if(first.data().attemptId===attemptId){return {ok:true,awarded:0,coins:oldCoins,duplicate:true,firstClear:true};}
   else{refKey=`story-replay-${stageId}-${attemptId}`;amount=5;}
  }else{
   // Recheck the actual submitted run inside the transaction (not only before it).
   const run=await tx.get(ref('sparkRuns',uid()));
   if(!run.exists()||run.data().status!=='submitted'||run.data().token!==runToken||run.data().mode!==mode||run.data().publicId!==p.id)err('Ranked run is no longer eligible.');
   const accurate=correct*10>=9*(correct+incorrect);
   amount=(mode==='normal'?10:15)+(accurate?5:0);
  }
  const receiptRef=ref('guildClaims',`${p.id}__${refKey}`);
  const prior=await tx.get(receiptRef);
  if(prior.exists())return {ok:true,awarded:0,coins:oldCoins,duplicate:true,firstClear:!!prior.data().firstClear};
  if(oldCoins+amount>GUILD_MAX_BALANCE)err('Guild Coin storage limit reached.');
  receipt={publicId:p.id,claimKey:refKey,mode,coins:amount,correct,incorrect,runToken,stageId,attemptId,firstClear,createdAt:serverTimestamp()};
  tx.set(receiptRef,receipt);
  tx.update(p.playerRef,{'recruitment.coins':oldCoins+amount,'recruitment.lastClaimId':`${p.id}__${refKey}`});
  return {ok:true,awarded:amount,coins:oldCoins+amount,duplicate:false,firstClear};
 });
 return {...result,provisional:true,spendingEnabled:false};
}
// Aura currency is separate from Guild Coins, so existing unverified earnings never turn into shards.
const AURA_TOTALS=[0,10,30,70,150];
const RETIRED_OPERATORS=new Set(['crimson_knight','silver_knight']); // Legacy IDs are excluded from the active roster.
function allowedOperatorIDs(d){return new Set(['mc',...Object.keys(d.recruitment?.owned||{}).filter(id=>auraId(id)&&!RETIRED_OPERATORS.has(id))]);}
function safeShowcase(list,allowed){
 const values=Array.isArray(list)?list:[];
 const first=allowed.has(values[0])?values[0]:'mc';
 const second=allowed.has(values[1])&&values[1]!==first?values[1]:'';
 return [first,second];
}
function sanitizedCosmetics(d){
 const raw=d.cosmetics||{},allowed=allowedOperatorIDs(d);
 const featured=allowed.has(raw.featured)?raw.featured:(allowed.has(d.character)?d.character:'mc');
 return {...raw,featured,showcase:safeShowcase(raw.showcase,allowed),background:'default'};
}
const auraId=id=>typeof id==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(id);
const auraOwned=(d,id)=>id!=='mc'&&allowedOperatorIDs(d).has(id);
async function auraChange(b){
 const p=await currentPlayer(b),id=String(b.character_id||''),action=String(b.action||'');
 if(!auraId(id)||!['upgrade','equip'].includes(action))err('Unknown operator or action.');
 if(!auraOwned(p.player,id))err('You do not own that operator.');
 const target=Number(b.target);
 if(action==='equip'&&(!Number.isInteger(target)||target<0||target>4))err('Invalid aura tier.');
 const result=await runTransaction(db,async tx=>{
  const snap=await tx.get(p.playerRef);
  if(!snap.exists()||snap.data().disabled)err('Player card not active.');
  const d=snap.data();if(!auraOwned(d,id))err('You do not own that operator.');
  const shards=Number(d.recruitment?.shards??0),auras=d.recruitment?.auras||{};
  if(!Number.isSafeInteger(shards)||shards<0||shards>100000000)err('Invalid shard balance.');
  const before=auras[id]||{level:0,equipped:0};
  if(!Number.isInteger(before.level)||!Number.isInteger(before.equipped)||before.level<0||before.level>4||before.equipped<0||before.equipped>before.level)err('Aura record is invalid.');
  let after,cost=0;
  if(action==='upgrade'){
   if(before.level>=4)err('Gold Aura already unlocked.');
   const level=before.level+1;cost=AURA_TOTALS[level]-AURA_TOTALS[before.level];
   if(shards<cost)err(`Need ${cost-shards} more shards.`);
   after={level,equipped:level};
  }else{
   if(target>before.level)err('That aura has not been unlocked.');
   if(target===before.equipped)err('That aura is already equipped.');
   after={level:before.level,equipped:target};
  }
  // One transaction: spend shards and upgrade the *one* owned character.
  tx.update(p.playerRef,{
   'recruitment.shards':shards-cost,
   [`recruitment.auras.${id}`]:after,
   'recruitment.lastAuraCharacter':id,
   'recruitment.lastAuraAt':serverTimestamp()
  });
  return {ok:true,shards:shards-cost,auras:{...auras,[id]:after},level:after.level,equipped:after.equipped,spent:cost};
 });return result;
}
async function profile(b){const p=await currentPlayer(b),d=p.player;const owned=Object.keys(d.recruitment?.owned||{}).filter(id=>auraId(id)&&!RETIRED_OPERATORS.has(id));const safe=sanitizedCosmetics(d);
 return {ok:true,public_id:p.id,name:d.username,selected_character:safe.featured,cosmetics:safe,adventure:d.adventure||{},tournament:d.tournament||{},collection:{owned:['mc',...owned],available:['mc',...owned]},recruitment:{coins:Math.max(0,Math.trunc(Number(d.recruitment?.coins)||0)),permits:0,pity_six:Math.max(0,Number(d.recruitment?.pity_six)||0),pity_five:Math.max(0,Number(d.recruitment?.pity_five)||0),featured_guarantee:!!d.recruitment?.featured_guarantee,status:'classroom-browser-reported',daily_claimed:d.recruitment?.lastDailyDate===getJstDate(),shards:Math.max(0,Math.trunc(Number(d.recruitment?.shards)||0)),auras:d.recruitment?.auras||{},owned:Object.fromEntries(Object.entries(d.recruitment?.owned||{}).filter(([id])=>!RETIRED_OPERATORS.has(id)))},tutorial:d.tutorial||{version:1,step:5}};}


// Each new profile has tutorial.version=0. Profiles created in older builds do not,
// and are treated as previously onboarded, avoiding forced replay for existing students.
async function tutorialState(b={}){
 const p=await currentPlayer(b),t=p.player.tutorial||{version:1,step:5};
 return {ok:true,version:Number(t.version)||0,step:Math.max(1,Math.min(5,Number(t.step)||1)),complete:Number(t.version)>=1,
  tutorialClaimed:!!p.player.recruitment?.tutorialClaimed,
  lastDraw:p.player.recruitment?.lastDrawResults||[],lastDrawMode:p.player.recruitment?.lastDrawMode||null};
}
async function tutorialProgress(b={}){
 const p=await currentPlayer(b),step=Math.trunc(Number(b.step)),now=p.player.tutorial||{version:1,step:5};
 if(Number(now.version)>=1)return {ok:true,complete:true,step:5};
 if(!Number.isInteger(step)||step<1||step>5)err('Invalid tutorial stage.');
 if(step>Number(now.step)+1)err('Complete the previous lesson first.');
 if(step===5&&!p.player.recruitment?.tutorialClaimed)err('Complete the free first 10-pull before finishing the tutorial.');
 if(step<=Number(now.step))return {ok:true,step:now.step,complete:false,alreadySaved:true};
 const next=step===5?{version:1,step:5,updatedAt:serverTimestamp()}:{version:0,step,updatedAt:serverTimestamp()};
 await updateDoc(p.playerRef,{tutorial:next});return {ok:true,step,complete:step===5};
}
// v127: optional, independent Story help flags. Preserve the existing onboarding map.
async function squadTutorialProgress(b={}){
 const kind=b.guide;
 if(!['squadAssembly','squadKnockout'].includes(kind))err('Invalid squad guide.');
 const p=await currentPlayer(b);
 if(p.player.tutorial?.[kind]===true)return {ok:true,alreadySaved:true};
 if(p.player.tutorial){await updateDoc(p.playerRef,{[`tutorial.${kind}`]:true});}
 else{await updateDoc(p.playerRef,{[`tutorial.${kind}`]:true,'tutorial.version':1,'tutorial.step':5});}
 return {ok:true};
}
async function recruitmentState(b={}){
 const p=await currentPlayer(b),r=p.player.recruitment||{},date=getJstDate();
 let eligible=false;
 const last=r.lastClaimId;
 if(typeof last==='string'&&last.startsWith(p.id+'__')){
  try{const claim=await read('guildClaims',last);const ts=claim?.createdAt?.toDate?.();eligible=!!ts&&getJstDate(ts)===date;}catch(_){}
 }
 return {ok:true,coins:Math.max(0,Math.trunc(Number(r.coins)||0)),shards:Math.max(0,Math.trunc(Number(r.shards)||0)),pity_six:Number(r.pity_six)||0,pity_five:Number(r.pity_five)||0,featured_guarantee:!!r.featured_guarantee,
   dailyClaimed:r.lastDailyDate===date,dailyEligible:eligible, tutorialClaimed:!!r.tutorialClaimed,
   lastDrawId:r.lastDrawId||null,lastDrawMode:r.lastDrawMode||null,lastDrawResults:r.lastDrawResults||[]};
}
async function recruitmentPull(b={}){
 const p=await currentPlayer(b);
 const count=Number(b.count);if(![1,10].includes(count))err('Use single or ten pulls.');
 const mode=String(b.mode||'paid');if(!['paid','daily','tutorial'].includes(mode))err('Unknown recruitment mode.');
 if(mode!=='paid'&&count!==10)err('Only ten-pulls are free.');
 const roster=await fetch('gacha_catalog.json',{cache:'no-cache'}).then(r=>r.json());
 const pool=(roster.characters||[]).filter(c=>[4,5,6].includes(c.rarity)&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id));
 const config=await recruitmentBanners();
 const featured=String(config.banners?.[0]?.featured_character_id||roster.featured_character_id||'tavi');
 if(!pool.some(c=>c.id===featured&&c.rarity===6))err('The featured 6-star operator is missing from the roster.');
 const date=getJstDate(),now=Date.now();
 const clientId=String(b.request_id||'');
 const drawId=(mode==='paid'&&/^p[a-z0-9-]{10,55}$/.test(clientId)?clientId:mode==='paid'?`p${now.toString(36)}${Math.random().toString(36).slice(2,11)}`:`daily-${date}`);
 const receiptId=`${p.id}__${drawId}`;
 const receiptRef=ref('recruitmentDraws',receiptId);
 // The transaction handles race conditions and duplicate free claims across devices.
 const out=await runTransaction(db,async tx=>{
  const [snapshot,prior]=await Promise.all([tx.get(p.playerRef),tx.get(receiptRef)]);
  if(!snapshot.exists())err('Player not found.');
  const d=snapshot.data(),r=d.recruitment||{},t=d.tutorial||{version:1,step:5};
  if(prior.exists()){
   const saved=prior.data();
   // A reused request ID must never silently return a different pull or another player's receipt.
   if(saved.publicId!==p.id||saved.mode!==mode||saved.count!==count)err('This request belongs to another recruitment. Please retry the original pull.');
   return {ok:true,replayed:true,results:saved.results||[],coins:r.coins,pity_six:r.pity_six,shards:r.shards,drawId:receiptId};
  }
  let guildClaim=null;
  if(mode==='daily'&&typeof r.lastClaimId==='string'&&r.lastClaimId.startsWith(p.id+'__')){
   guildClaim=await tx.get(ref('guildClaims',r.lastClaimId));
  }
  if(mode==='tutorial'&&(Number(t.version)>=1||Number(t.step)!==4||r.tutorialClaimed))err('Complete the tutorial boss before the free 10-pull.');
  if(mode!=='tutorial'&&Number(t.version)<1)err('Complete your first-time tutorial before normal Recruitment.');
  if(mode==='daily'&&(Number(t.version)<1||!guildClaim?.exists()||getJstDate(guildClaim.data()?.createdAt?.toDate?.()||new Date(0))!==date))err('Complete a qualifying game run today to claim your free 10-pull.');
  if(mode!=='paid'&&r.lastDailyDate===date)err('Your free 10-pull was already claimed today.');
  const spent=mode==='paid'?count*100:0,coins=Math.max(0,Math.trunc(Number(r.coins)||0));
  if(coins<spent)err(`Need ${spent-coins} more Guild Coins.`);
  const roll=makePull({count,owned:r.owned||{},pitySix:r.pity_six,pityFive:r.pity_five,featuredGuarantee:r.featured_guarantee,featuredId:featured,catalog:pool});
  const results=roll.results.map(x=>({id:x.id,rarity:x.rarity,duplicate:x.duplicate,shards:x.shards,featured:x.featured}));
  const next={...r,coins:coins-spent,owned:roll.owned,pity_six:roll.pitySix,pity_five:roll.pityFive,featured_guarantee:roll.featuredGuarantee,
   shards:Math.max(0,Math.trunc(Number(r.shards)||0))+roll.shardsEarned,lastDrawId:receiptId,lastDrawMode:mode,lastDrawResults:results,lastDrawAt:serverTimestamp(),
   recent:[...results,...(r.recent||[])].slice(0,10)};
  if(mode!=='paid')next.lastDailyDate=date;
  if(mode==='tutorial')next.tutorialClaimed=true;
  tx.update(p.playerRef,{recruitment:next});
  tx.set(receiptRef,{publicId:p.id,mode,count,spent,coinsBefore:coins,coinsAfter:next.coins,results,shardsEarned:roll.shardsEarned,featuredId:featured,dateJst:date,createdAt:serverTimestamp()});
  return {ok:true,replayed:false,results,coins:next.coins,pity_six:next.pity_six,shards:next.shards,drawId:receiptId};
 });
 // Merge display metadata from versioned roster, never from user content.
 return {...out,results:(out.results||[]).map(x=>({...x,...(pool.find(c=>c.id===x.id)||{})}))};
}
// Read only this player's most recent saved tutorial receipt if a legacy or interrupted
// profile no longer has the ten display results cached. No new write permissions needed.
async function recruitmentTutorialDraw(b={}){
 const p=await currentPlayer(b),r=p.player.recruitment||{};
 if(!r.tutorialClaimed)err('The tutorial recruitment has not been claimed yet.');
 const id=String(r.lastDrawId||'');
 if(!/^P\d{6,}__daily-\d{4}-\d{2}-\d{2}$/.test(id)||!id.startsWith(p.id+'__'))err('No recoverable tutorial receipt found.');
 const receipt=await read('recruitmentDraws',id);
 if(!receipt||receipt.publicId!==p.id||receipt.mode!=='tutorial'||receipt.count!==10||!Array.isArray(receipt.results)||receipt.results.length!==10)err('Tutorial receipt is not available.');
 return {ok:true,results:receipt.results,drawId:id};
}
async function profileCustom(b){
 const p=await currentPlayer(b),allowed=allowedOperatorIDs(p.player);
 const c={...sanitizedCosmetics(p.player)};
 if(typeof b.nickname==='string')c.nickname=name(b.nickname);
 if(typeof b.motto==='string')c.motto=String(b.motto).trim().slice(0,80);
 if(['signal','steel','amber','frost'].includes(b.theme))c.theme=b.theme;
 if(typeof b.character==='string'){
  if(!allowed.has(b.character))err('You do not own that operator.');
  c.featured=b.character;
 }
 if(b.showcase!==undefined){
  if(!Array.isArray(b.showcase)||b.showcase.length!==2||b.showcase.some(id=>typeof id!=='string'||(id!==''&&!allowed.has(id)))||(b.showcase[0]&&b.showcase[0]===b.showcase[1]))err('Choose owned operators or leave a showcase slot blank.');
  c.showcase=[...b.showcase];
 }
 c.background='default';
 await updateDoc(p.playerRef,{cosmetics:c,character:c.featured});
 return {ok:true,cosmetics:c,selected_character:c.featured};
}

async function adventureProgress(b){const p=await currentPlayer(b),a=p.player.adventure||{};if(b.action==='load')return {ok:true,...a};if(b.action!=='save')err('Invalid action.');
 const up={xp:Math.max(a.xp||0,Number(b.xp)||0),best_normal:Math.max(a.best_normal||0,Number(b.best_normal)||0),best_extra:Math.max(a.best_extra||0,Number(b.best_extra)||0),normal_clear:!!(a.normal_clear||b.normal_clear),extra_clear:!!(a.extra_clear||b.extra_clear),achievements:[...new Set([...(a.achievements||[]),...(Array.isArray(b.achievements)?b.achievements:[])])].slice(0,200)};
 if(up.xp>100000000||up.best_normal>2000000||up.best_extra>2000000)err('Progress out of range.');await updateDoc(p.playerRef,{adventure:up});return {ok:true,...up};}
async function storyProgress(b){const p=await currentPlayer(b),old=p.player.story||{},base=old.best_stars||{};
 if(!b.action||b.action==='load')return {ok:true,completed:old.completed||[],best_stars:base};
 const completed=[...new Set([...(old.completed||[]),...(Array.isArray(b.completed)?b.completed:[])])].slice(0,200);
 const stars={...base};for(const [key,val] of Object.entries(b.best_stars||{})){if(/^\d+-\d+$/.test(key)&&Number.isInteger(val)&&val>=0&&val<=4)stars[key]=Math.max(stars[key]||0,val);}
 await updateDoc(p.playerRef,{story:{completed,best_stars:stars}});return {ok:true,completed,best_stars:stars};}
async function call(path,body={}){
 if(!navigator.onLine || blocked)err('Online Firestore session required. Reconnect and reload.');
 if(path==='ping'){await currentConfig();return {ok:true,source:'firestore'};}
 if(path==='/api/config/version')return {ok:true,revision:await currentConfig()};
 if(path==='/api/adventure/card')return openCard(body);
 if(path==='/api/adventure/resume')return resumeCard();
 if(path==='/api/adventure/progress')return adventureProgress(body);
 if(path==='/api/profile')return profile(body);
 if(path==='/api/tutorial/state')return tutorialState(body);
 if(path==='/api/tutorial/progress')return tutorialProgress(body);
 if(path==='/api/tutorial/squad')return squadTutorialProgress(body);
 if(path==='/api/recruitment/state')return recruitmentState(body);
 if(path==='/api/recruitment/tutorial-draw')return recruitmentTutorialDraw(body);
 if(path==='/api/recruitment/pull')return recruitmentPull(body);
 if(path==='/api/profile/customize')return profileCustom(body);
 if(path==='/api/story/progress')return storyProgress(body);
 if(path==='/api/guild/claim')return guildClaim(body);
 if(path==='/api/aura/change')return auraChange(body);
 if(path==='/api/vocab/load')return vocab(body);
 if(path==='/api/vocab/admin')return vocabAdmin(body);
 if(path==='/api/recruitment/banners')return recruitmentBanners();
 if(path==='/api/recruitment/banners/admin')return recruitmentBannersAdmin(body);
 if(path==='/api/cards/list')return cardsList();
 if(path==='/api/cards/set-class')return setClass(body);
 if(path==='/api/rankings/start')return rankStart(body);
 if(path==='/api/rankings/submit')return rankSubmit(body);
 if(path==='/api/rankings')return ranking(body);
 if(path==='/api/rankings/icon')return rankIcon(body);
 if(path.startsWith('/api/recruitment/')||path.startsWith('/api/rewards/'))err('Cloud rewards and recruitment are disabled on the zero-cost Spark plan.');
 err('This action is unavailable in the Spark edition.');
}
// v86.11: RTDB .info/connected is not a valid indicator of Firestore availability.
// The authoritative Firestore reads/writes below decide whether actions work.
// Browser offline events invalidate ranked runs, without requiring another database.
let bootReady=false, blocked=true;
function message(s,teacherRequired=false){
 let gate=$('v66OnlineGate');
 if(!gate){gate=document.createElement('div');gate.id='v66OnlineGate';Object.assign(gate.style,{position:'fixed',inset:'0',zIndex:2147483647,background:'#131426',color:'#ffecc0',display:'grid',placeItems:'center',padding:'22px',fontFamily:'system-ui,sans-serif'});
 gate.innerHTML='<section style="max-width:500px;text-align:center;background:#25233c;padding:26px;border:3px solid #ddc07a"><h1>CONNECTION REQUIRED</h1><p id="v67status"></p><button id="v67retry" style="padding:12px">RELOAD</button> <button id="v67google" style="padding:12px">TEACHER SIGN IN</button></section>';document.body.append(gate);
 $('v67retry').addEventListener('click',()=>location.reload());$('v67google').addEventListener('click',async()=>{try{await googleTeacher();location.reload();}catch(e){message(String(e.message||e),true)}});}
 $('v67status').textContent=s;$('v67google').style.display=teacherRequired?'inline-block':'none';
}
function lost(reason){
 if(!blocked || bootReady){window.RPG_V66_DISCONNECTED=true;sessionStorage.setItem('rpgV66Interrupted','1');}
 const shouldNotify=!blocked;
 blocked=true;
 if(shouldNotify)window.dispatchEvent(new Event('rpg-v66-offline'));
 message(reason||'Firestore session interrupted. Reload after reconnecting.');
}
async function check(){
 try{
  if(!navigator.onLine)err('Internet unavailable.');
  await ensureStudent();
  // One server read verifies the Firestore connection and current settings.
  await currentConfig();
  const needTeacher=document.documentElement.dataset.v66Teacher==='required';if(needTeacher)await teacher();
  if(!navigator.onLine||window.RPG_V66_DISCONNECTED)err('Connection interrupted during login.');
  bootReady=true;blocked=false;$('v66OnlineGate')?.remove();$('v66Startup')?.remove();return true;
 }catch(e){
  // Show the actual setup/auth error instead of blaming RTDB.
  lost('Firestore initialization failed: '+String(e.message||e).slice(0,230));return false;
 }
}
const fetchNative=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const raw=typeof input==='string'?input:input?.url||'',url=new URL(raw,location.href);
 if(url.origin!==location.origin||!url.pathname.startsWith('/api/'))return fetchNative(input,init);
 try{if(blocked)err('Connection interrupted. Reload after reconnecting.');let b={};try{b=init?.body?JSON.parse(init.body):{};}catch{err('Invalid JSON');}
 const response=await call(url.pathname,b);return new Response(JSON.stringify(response),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }catch(e){if(!navigator.onLine||/unavailable|offline|network|deadline/i.test(String(e.code||e.message||'')))lost('Lost Firebase connection; ranked run invalidated.');
 return new Response(JSON.stringify({ok:false,error:String(e.message||e)}),{status:400,headers:{'Content-Type':'application/json'}});}
};
window.addEventListener('offline',()=>lost('Internet connection lost.'));
// Realtime Database listener resumes transport; an interrupted run requires manual reload.
window.addEventListener('online',()=>{if(blocked)message('Internet restored. Reload to start a new online session.');});
const ready=check();
// Practice/Story teacher settings: at most one verified fetch per scope set / 15 minutes.
const soloBalanceSyncs=new Map();
window.RPG_V68_CONNECTION={get connected(){return bootReady&&!blocked&&navigator.onLine;},get blocked(){return blocked;}};
window.RPG_V66={ready,call,ping:()=>call('ping'),teacherToken:async()=>{await teacher();return auth.currentUser.getIdToken();},
 async fetchSoloBalance(mode,stageIds=[],chapterId=null){
  if(blocked||!['practice','story'].includes(mode))return false;
  const scopes=[`mode:${mode}`,...(chapterId?[`chapter:${chapterId}`]:[]),...stageIds.map(x=>`stage:${mode}:${x}`)];
  const key=scopes.join('|');
  if(Date.now()-(soloBalanceSyncs.get(key)||0)<15*60*1000)return true;
  // Failure is not fatal: the runtime uses locally cached/built-in values for unranked play.
  const configs=await Promise.all(scopes.map(scope=>read('gameBalance',scope)));
  for(let i=0;i<scopes.length;i++)window.RPG_BALANCE?.apply(scopes[i],configs[i]||{},'server');
  soloBalanceSyncs.set(key,Date.now());return true;
 },
 async prepareBalanceRun(mode,stageIds=[],chapterId=null){if(blocked)err('Connection required.');const before=await currentConfig();
 const scopes=[`mode:${mode}`,...(chapterId?[`chapter:${chapterId}`]:[]),...stageIds.map(x=>`stage:${mode}:${x}`)];
 for(const scope of scopes){const s=await read('gameBalance',scope);window.RPG_BALANCE?.apply(scope,s||{},'server');}
 const after=await currentConfig();if(before!==after)err('Difficulty settings changed during run setup.');window.RPG_V66_PREPARED_REVISION=after;return after;},
 watchRankings(mode,grade,update){let disposed=false;Promise.all([read('vocabPools',grade==='all'?'all':poolOf(grade)),currentConfig()]).then(([v,c])=>{
 if(disposed||!v)return;return onSnapshot(rankQuery(mode,grade,Number(v.revision)||1,c,20),{includeMetadataChanges:true},snap=>{
 if(disposed||snap.metadata.fromCache)return;const entries=snap.docs.map(s=>s.data());update({ruleset:`spark-${mode}-${grade}-v${v.revision}-c${c}`,entries});
 },e=>console.warn('Rankings live-update unavailable:',e?.message||e));}).then(unsub=>{if(disposed)unsub?.();else stop=unsub;}).catch(e=>console.warn('Rankings',e));let stop=null;
 return ()=>{disposed=true;stop?.()};}
};
// No periodic connection polling; ranked operations verify current server state.
