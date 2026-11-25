/* v76 Teacher-only Guild Coin grants, atomic and audit-logged.
 * No automatic polling. Every manual grant creates a distinct immutable receipt. */
import {googleTeacher,currentTeacher,errorMessage} from './cloud-api.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getFirestore,doc,collection,query,orderBy,limit,getDocsFromServer,getDocFromServer,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
const $=id=>document.getElementById(id),db=getFirestore(getApp());
const core=window.RPG_GUILD_GRANTS_CORE;
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
const format=n=>Number(n).toLocaleString('en-US');
let teacher=null,players=[],selected=null,busy=false,loaded=false;
function status(id,msg,kind=''){$(id).textContent=msg;$(id).className='status '+kind;}
function enabled(){return !!teacher&&!busy;}
function lock(){
 const ok=enabled();$('login').classList.toggle('hidden',!!teacher);$('reload').disabled=!ok;
 $('playerSearch').disabled=!ok;$('player').disabled=!ok;$('amount').disabled=!ok;$('note').disabled=!ok;
 $('grant').disabled=!ok||!selected||selected.disabled||!loaded;
}
function label(p){return `${p.username || 'Unnamed'} · ${p.id}${p.grade?` · Year ${String(p.grade).charAt(0)}`:''}${p.disabled?' · DISABLED':''}`;}
function drawPlayers(){
 const keep=$('player').value||selected?.id||'';
 const term=$('playerSearch').value.trim().toLowerCase();
 const list=players.filter(p=>`${p.username||''} ${p.id} ${p.grade||''}`.toLowerCase().includes(term));
 const dropdown=$('player');dropdown.replaceChildren();
 dropdown.add(new Option(list.length?'Choose a player':'No matching players',''));
 for(const p of list)dropdown.add(new Option(label(p),p.id));
 dropdown.value=list.some(p=>p.id===keep)?keep:'';
 if(!dropdown.value){selected=null;renderPreview();}
 lock();
}
function renderPreview(){
 const p=selected;
 $('previewPlayer').textContent=p?label(p):'No player selected';
 $('playerDetails').textContent=p?(p.disabled?'This player is disabled; grants are unavailable.':`Player ${p.id} · ${p.username||'Unnamed'} · balance ${format(p.coins)} Guild Coins`):'Choose a registered player to see their current balance.';
 $('before').textContent=p?format(p.coins):'—';
 let a=0,after=null;
 try{a=core.amount($('amount').value);if(p&&!p.disabled)after=core.balance(p.coins,a);}catch{}
 $('adding').textContent=a?`+${format(a)}`:'—';$('after').textContent=after===null?'—':format(after);
 lock();
}
async function readPlayer(id){
 const playerRef=doc(db,'players',core.playerId(id)),snap=await getDocFromServer(playerRef);
 if(!snap.exists())throw Error('Player no longer exists. Refresh the list.');
 const p=snap.data();
 if(p.publicId&&p.publicId!==id)throw Error('Player ID mismatch. Refresh the list.');
 if(!Number.isSafeInteger(p.recruitment?.coins)||p.recruitment.coins<0)throw Error('Player wallet is missing or invalid. Migrate the card to the latest format first.');
 return {id,username:String(p.username||'').slice(0,30),grade:p.grade||null,disabled:!!p.disabled,coins:p.recruitment.coins};
}
async function history(){
 const body=$('history');body.replaceChildren();
 try{
  const q=query(collection(db,'guildCoinGrants'),orderBy('createdAt','desc'),limit(20));
  const snaps=await getDocsFromServer(q);
  if(snaps.empty){const row=body.insertRow(),cell=row.insertCell();cell.colSpan=5;cell.textContent='No teacher grants recorded yet.';return;}
  for(const s of snaps.docs){
   const d=s.data(),row=body.insertRow();
   const date=d.createdAt?.toDate?.()?.toLocaleString('en-GB',{timeZone:'Asia/Tokyo'})||'Pending timestamp';
   for(const content of [date,`${d.playerName||'Unnamed'} (${d.playerId||'?'})`,`+${format(d.amount||0)}`,format(d.balanceAfter||0),d.reason||'—'])row.insertCell().textContent=content;
  }
 }catch(e){const row=body.insertRow(),cell=row.insertCell();cell.colSpan=5;cell.textContent='History unavailable: '+errorMessage(e);}
}
async function refresh(){
 if(!teacher)return;
 busy=true;lock();status('authStatus','Loading registered players…');
 try{
  const snap=await getDocsFromServer(collection(db,'players'));
  const valid=[];
  for(const s of snap.docs){
   if(!/^P\d{6,}$/.test(s.id))continue;
   const p=s.data();
   if(!Number.isSafeInteger(p.recruitment?.coins)||p.recruitment.coins<0)continue;
   valid.push({id:s.id,username:String(p.username||''),grade:p.grade||null,disabled:!!p.disabled,coins:p.recruitment.coins});
  }
  players=valid.sort((a,b)=>(a.username||'').localeCompare(b.username||'')||a.id.localeCompare(b.id));
  loaded=true;drawPlayers();const requested=new URLSearchParams(location.search).get('player');if(!selected&&requested&&players.some(p=>p.id===requested)){selected=players.find(p=>p.id===requested);$('player').value=requested;}
  if(selected){const p=players.find(p=>p.id===selected.id);selected=p||null;}
  if(selected)$('player').value=selected.id;
  renderPreview();
  status('authStatus',`Loaded ${players.length} player wallets. Select a player to grant coins.`,'good');
  await history();
 }catch(e){loaded=false;status('authStatus','Could not load players: '+errorMessage(e),'error');}
 finally{busy=false;lock();}
}
async function permit(user){
 teacher=user&&user.uid===TEACHER_UID?user:null;
 $('identity').textContent=teacher?`Teacher signed in: ${teacher.email||teacher.name||teacher.uid}`:'Authorized teacher Google sign-in required';
 if(user&&!teacher)status('authStatus','Signed-in Google account does not match the configured teacher.','error');
 lock();if(teacher)await refresh();
}
$('login').addEventListener('click',async()=>{try{await permit(await googleTeacher())}catch(e){status('authStatus',errorMessage(e),'error')}});
$('reload').addEventListener('click',()=>{void refresh()});
$('playerSearch').addEventListener('input',drawPlayers);
$('player').addEventListener('change',async()=>{
 const id=$('player').value;if(!id){selected=null;renderPreview();return;}
 selected=players.find(p=>p.id===id)||null;
 renderPreview();if(!selected)return;
 try{const p=await readPlayer(id);if($('player').value!==id)return;selected=p;const index=players.findIndex(x=>x.id===id);if(index>=0)players[index]=p;renderPreview();}
 catch(e){selected=null;renderPreview();status('grantStatus',errorMessage(e),'error')}
});
$('amount').addEventListener('input',renderPreview);
$('grantForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!enabled()||!selected||!loaded)return;
 let amount,reason,id;
 try{amount=core.amount($('amount').value);reason=core.note($('note').value);id=core.playerId(selected.id);core.balance(selected.coins,amount);}catch(e){status('grantStatus',e.message,'error');return;}
 const p=selected;
 if(p.disabled){status('grantStatus','This player is disabled.','error');return;}
 if(!window.confirm(`ADD ${format(amount)} Guild Coins to ${p.username||'Unnamed'} (${id})?\nCurrent balance shown: ${format(p.coins)}\n\nThis will modify their Firebase balance and create a grant receipt.`))return;
 busy=true;lock();status('grantStatus','Saving grant…');
 const receiptRef=doc(collection(db,'guildCoinGrants')); // fixed ID throughout transaction retries
 try{
  const result=await runTransaction(db,async tx=>{
   const playerRef=doc(db,'players',id);
   // Read ALL documents before writes, as required by Firestore transactions.
   const existing=await tx.get(receiptRef);
   if(existing.exists()){
    const prior=existing.data();
    if(prior.playerId!==id||prior.amount!==amount)throw Error('Grant receipt conflict.');
    return {newBalance:prior.balanceAfter,wasDuplicate:true};
   }
   const snapshot=await tx.get(playerRef);
   if(!snapshot.exists())throw Error('Player no longer exists. Refresh players.');
   const player=snapshot.data();
   if(player.disabled)throw Error('This player is disabled.');
   if(player.publicId&&player.publicId!==id)throw Error('Player ID mismatch.');
   const before=player.recruitment?.coins;
   if(!Number.isSafeInteger(before))throw Error('This player has no Guild Coin wallet. Migrate the card first.');
   const after=core.balance(before,amount);
   tx.update(playerRef,{'recruitment.coins':after,'recruitment.lastTeacherGrantId':receiptRef.id,'recruitment.lastTeacherGrantAt':serverTimestamp()});
   tx.set(receiptRef,{playerId:id,playerName:String(player.username||'').slice(0,30),amount,balanceBefore:before,balanceAfter:after,reason,teacherUid:teacher.uid,createdAt:serverTimestamp()});
   return {newBalance:after,wasDuplicate:false};
  });
  status('grantStatus',`${result.wasDuplicate?'Previously applied':'SUCCESS'}: Added ${format(amount)} Guild Coins to ${p.username||id}. New balance: ${format(result.newBalance)}.`,'good');
  const current=players.find(x=>x.id===id);if(current)current.coins=result.newBalance;
  if(selected?.id===id)selected={...selected,coins:result.newBalance};
  renderPreview();await history();
 }catch(e){status('grantStatus','GRANT FAILED: '+errorMessage(e),'error');}
 finally{busy=false;lock();}
});
currentTeacher().then(permit).catch(e=>{status('authStatus',errorMessage(e),'error');lock()});
