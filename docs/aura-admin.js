/* Teacher-only staging helper. For now, only the teacher can create shards. */
import {googleTeacher,currentTeacher,errorMessage} from './cloud-api.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getFirestore,doc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
const $=id=>document.getElementById(id),db=getFirestore(getApp());
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
let authorized=false,busy=false;
const message=s=>$('status').textContent=s;
const permit=user=>{authorized=!!(user&&user.uid===TEACHER_UID);$('identity').textContent=authorized?`Teacher: ${user.email||user.name}`:'Teacher Google sign-in required';$('add').disabled=!authorized||busy;if(user&&!authorized)message('This account is not the configured teacher.');};
$('login').onclick=async()=>{try{permit(await googleTeacher())}catch(e){message(errorMessage(e))}};
$('grant').onsubmit=async e=>{e.preventDefault();if(!authorized||busy)return;
 const playerId=$('playerId').value.trim().toUpperCase(),amount=Number($('amount').value);
 if(!/^P\d{6,}$/.test(playerId)||!Number.isInteger(amount)||amount<1||amount>1000){message('Check Player ID and amount (1–1,000).');return;}
 if(!confirm(`Grant ${amount} TEST Character Shards to ${playerId}?`))return;
 busy=true;$('add').disabled=true;try{
  const result=await runTransaction(db,async tx=>{const playerRef=doc(db,'players',playerId),s=await tx.get(playerRef);
   if(!s.exists()||s.data().disabled)throw Error('Player not found or disabled.');
   const old=s.data().recruitment?.shards??0;
   if(!Number.isSafeInteger(old)||old<0||old+amount>100000000)throw Error('Shard balance out of range.');
   tx.update(playerRef,{'recruitment.shards':old+amount,'recruitment.lastShardGrant':{amount,teacher:true,at:serverTimestamp()}});
   return old+amount;
  });message(`SUCCESS: ${playerId} has ${result} Character Shards. This is a teacher test grant.`);
 }catch(e){message('GRANT FAILED: '+errorMessage(e))}finally{busy=false;$('add').disabled=!authorized;}
};
currentTeacher().then(permit).catch(e=>message(errorMessage(e)));
