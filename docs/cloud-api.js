/* Firebase cloud Adventure Cards. No client reward/permit writes. */
import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getAuth,signInAnonymously,signInWithPopup,GoogleAuthProvider,browserLocalPersistence,setPersistence,signOut} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import {getFirestore,doc,getDoc,getDocs,collection,runTransaction,serverTimestamp,Timestamp,updateDoc,deleteDoc,writeBatch,setDoc} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const cfg={apiKey:'AIzaSyD13H9-Be2lscbzF5TtQqNYsecOPrdezT4',authDomain:'rpg-typing-versus.firebaseapp.com',projectId:'rpg-typing-versus',storageBucket:'rpg-typing-versus.firebasestorage.app',messagingSenderId:'443758260403',appId:'1:443758260403:web:13185b826a257092adc0c6'};
const app=getApps().length?getApp():initializeApp(cfg);
const auth=getAuth(app),db=getFirestore(app);
const abc='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const codePattern=/^[A-HJ-NP-Z2-9]{16}$/;
export function normalizeCode(code){return String(code||'').toUpperCase().replace(/[^A-Z2-9]/g,'')}
export function formatCode(code){return String(code||'').replace(/(.{4})/g,'$1-').replace(/-$/,'')}
export async function ensureStudent(){
 await setPersistence(auth,browserLocalPersistence);
 await auth.authStateReady();
 return auth.currentUser||(await signInAnonymously(auth)).user;
}
// An explicit player switch clears Firebase Auth persistence for this browser.
// The previous player's Firestore session remains inaccessible to the new UID.
export async function forgetStudentSignIn(){
 await auth.authStateReady();
 if(auth.currentUser)await signOut(auth);
}
export async function googleTeacher(){
 await setPersistence(auth,browserLocalPersistence);
 const user=(await signInWithPopup(auth,new GoogleAuthProvider())).user;
 return {uid:user.uid,email:user.email||'',name:user.displayName||''};
}
export async function currentTeacher(){
 await setPersistence(auth,browserLocalPersistence);
 await auth.authStateReady();
 const user=auth.currentUser;
 return user&&!user.isAnonymous?{uid:user.uid,email:user.email||'',name:user.displayName||''}:null;
}
export async function teacherSignOut(){await signOut(auth)}
export async function readCard(code){
 const secret=normalizeCode(code);if(!codePattern.test(secret))throw Error('Enter a valid Adventure Card code.');
 await ensureStudent();
 const snap=await getDoc(doc(db,'cloudCards',secret));
 if(!snap.exists())throw Error('This card is not in the cloud registry. Ask your teacher to migrate it.');
 const data=snap.data();if(data.disabled||data.deleted)throw Error('This card is disabled.');
 return {code:secret,public_id:data.publicId,name:data.username||null,registered:!!data.username,character:data.character||'crimson_knight',disabled:!!data.disabled};
}
export async function registerCard(code,name,grade){
 const secret=normalizeCode(code);
 const n=String(name||'').trim().replace(/\s+/g,' ').slice(0,20);
 if(!codePattern.test(secret))throw Error('Invalid Adventure Card code.');
 if(!n)throw Error('Enter a username.');
 if(!['1','2','3'].includes(String(grade||'')))throw Error('Choose Grade 1, 2, or 3.');
 await ensureStudent();
 const ref=doc(db,'cloudCards',secret);
 await runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists()||snap.data().disabled)throw Error('Card not available.');
  if(snap.data().username)return;
  tx.update(ref,{username:n,...(snap.data().grade?{}:{grade}),registeredAt:serverTimestamp()});
 });
 return readCard(secret);
}
export async function listCards(){
 const docs=await getDocs(collection(db,'cloudCards'));
 return docs.docs.map(s=>({code:s.id,...s.data()})).sort((a,b)=>Number(a.publicId.slice(1))-Number(b.publicId.slice(1)));
}
function secretCode(){
 const random=new Uint32Array(16);crypto.getRandomValues(random);
 return Array.from(random,x=>abc[x%abc.length]).join('');
}
export async function createCards(count){
 const n=Number(count);if(!Number.isInteger(n)||n<1||n>50)throw Error('Create 1–50 cards at once.');
 const counter=doc(db,'cloudConfig','cardCounter');
 const known=await listCards();
 const high=known.reduce((v,c)=>Math.max(v,Number(c.publicId.slice(1))||0),0);
 const occupied=new Set(known.map(c=>c.code));
 const codes=[];for(let i=0;i<n;i++){let c;do{c=secretCode()}while(occupied.has(c));codes.push(c);occupied.add(c)}
 await runTransaction(db,async tx=>{
   const snap=await tx.get(counter),next=Math.max(high,Number(snap.exists()?snap.data().lastId:0)||0);
   tx.set(counter,{lastId:next+n,updatedAt:serverTimestamp()});
   for(let i=0;i<n;i++)tx.set(doc(db,'cloudCards',codes[i]),{publicId:`P${String(next+i+1).padStart(6,'0')}`,username:null,registeredAt:null,createdAt:serverTimestamp(),disabled:false,deleted:false,character:'crimson_knight',schemaVersion:1});
 });
 return n;
}
export async function importCards(rows){
 if(!Array.isArray(rows)||rows.length<1)throw Error('No cards to import.');
 const existing=await listCards();
 const byId=new Map(existing.map(c=>[c.publicId,c]));const byCode=new Set(existing.map(c=>c.code));
 const adds=[];
 for(const row of rows){
  const code=normalizeCode(row.code||row.secret),id=String(row.public_id||row.publicId||'');
  if(!codePattern.test(code)||!/^P\d{6,}$/.test(id))throw Error('Invalid card in import: '+id);
  const previous=byId.get(id);
  if(previous){if(previous.code!==code)throw Error('Card '+id+' already exists in cloud with a DIFFERENT code. Rotate or resolve before importing.');continue;}
  if(byCode.has(code))throw Error('Duplicate card credential in cloud.');
  adds.push({code,id,username:row.username||null,registered:!!(row.registered||row.registeredAt||row.registered_at),disabled:!!row.disabled,character:['crimson_knight','silver_knight'].includes(row.character)?row.character:'crimson_knight',created:row.created_at||null});
  byId.set(id,{code});byCode.add(code);
 }
 const maxId=Math.max(0,...[...byId.keys()].map(x=>Number(x.slice(1))||0));
 // Single transaction for <= 100 imports; subsequent batches resume safely.
 for(let i=0;i<adds.length;i+=80){
  const batch=writeBatch(db);
  for(const r of adds.slice(i,i+80))batch.set(doc(db,'cloudCards',r.code),{publicId:r.id,username:r.registered?r.username:null,registeredAt:r.registered?serverTimestamp():null,createdAt:r.created?Timestamp.fromMillis(Number(r.created)*1000):serverTimestamp(),disabled:r.disabled,deleted:false,character:r.character,schemaVersion:1});
  await batch.commit();
 }
 const cfgref=doc(db,'cloudConfig','cardCounter');
 await runTransaction(db,async tx=>{const d=await tx.get(cfgref);if(!d.exists()||Number(d.data().lastId||0)<maxId)tx.set(cfgref,{lastId:maxId,updatedAt:serverTimestamp()})});
 return {imported:adds.length,skipped:rows.length-adds.length};
}
export async function disableCard(code){return updateDoc(doc(db,'cloudCards',normalizeCode(code)),{disabled:true})}
export async function enableCard(code){return updateDoc(doc(db,'cloudCards',normalizeCode(code)),{disabled:false})}
export async function clearCard(code){return updateDoc(doc(db,'cloudCards',normalizeCode(code)),{username:null,registeredAt:null,character:'crimson_knight'})}
export async function revokeCard(code){return updateDoc(doc(db,'cloudCards',normalizeCode(code)),{username:null,registeredAt:null,disabled:true,deleted:true})}
export async function rotateCard(code){
 const old=normalizeCode(code),fresh=secretCode();
 await runTransaction(db,async tx=>{
  const source=doc(db,'cloudCards',old),dest=doc(db,'cloudCards',fresh);
  const oldsnap=await tx.get(source),destSnap=await tx.get(dest);
  if(!oldsnap.exists()||oldsnap.data().deleted)throw Error('Card not found.');
  if(destSnap.exists())throw Error('Code collision, retry.');
  tx.set(dest,{...oldsnap.data(),rotatedAt:serverTimestamp()});tx.delete(source);
 });
 return fresh;
}
export function errorMessage(e){
 const code=String(e?.code||''),s=String(e?.message||e||'Connection failed');
 if(code.includes('permission-denied')||s.includes('Missing or insufficient permissions'))return 'Firestore rules not installed, or this Google account is not the authorized teacher.';
 if(code.includes('popup-blocked'))return 'Allow the Google sign-in popup and try again.';
 if(code.includes('operation-not-allowed'))return 'Enable Google sign-in in Firebase Authentication first.';
 if(code.includes('unauthorized-domain'))return 'Add this website domain under Firebase Authentication → Settings → Authorized domains.';
 return s.slice(0,240);
}

// The card secret acts as the key. This record contains cosmetic preferences ONLY.
export async function readProfileCosmetics(code){
 const secret=normalizeCode(code);if(!codePattern.test(secret))throw Error('Invalid Adventure Card.');
 await ensureStudent();const snap=await getDoc(doc(db,'cloudProfileCosmetics',secret));
 return snap.exists()?snap.data():null;
}
export async function writeProfileCosmetics(code,value){
 const secret=normalizeCode(code);if(!codePattern.test(secret))throw Error('Invalid Adventure Card.');
 await ensureStudent();
 const payload={nickname:String(value.nickname||'').trim().slice(0,20),motto:String(value.motto||'').trim().slice(0,80),
  theme:value.theme||'signal',background:'default',featured:value.featured||'crimson_knight',
  showcase:Array.isArray(value.showcase)?value.showcase:['crimson_knight','silver_knight'],updatedAt:serverTimestamp()};
 await setDoc(doc(db,'cloudProfileCosmetics',secret),payload);
 return payload;
}
