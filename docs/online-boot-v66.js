/* v86.22 Adventure Card login. QR/manual entry links the Firebase Auth UID once;
 * next time on the same browser the saved Firebase UID restores the card session.
 * No bearer card credentials are persisted in localStorage.
 */
import {offlineCardCache} from './offline-session.js?v=86.11';

const gate=document.createElement('div');
gate.id='adventureGate';
gate.setAttribute('role','region');
gate.setAttribute('aria-label','Adventure Card sign in');
gate.innerHTML=`
  <div class="ag-background" aria-hidden="true"></div>
  <img class="ag-mc" src="assets/characters/mc.webp" alt="" aria-hidden="true" />
  <div class="ag-line" aria-hidden="true"></div>
  <div class="ag-brand"><span>RPG TYPING VERSUS</span><strong>ADVENTURE</strong></div>
  <main class="ag-card">
    <div class="ag-kicker" id="ag-kicker">ADVENTURE CARD</div>
    <h1 id="ag-title">CONNECTING</h1>
    <p class="ag-message" id="ag-status" role="status" aria-live="polite">Checking your Adventure Card…</p>
    <form id="ag-register" hidden>
      <label for="ag-name">What is your name?</label>
      <input id="ag-name" name="name" maxlength="20" autocomplete="off" spellcheck="false" placeholder="Your name" required />
      <label for="ag-grade">What grade are you in?</label>
      <select id="ag-grade" name="grade" required>
        <option value="" selected disabled>Select your grade</option>
        <option value="1">1年生 · Grade 1</option>
        <option value="2">2年生 · Grade 2</option>
        <option value="3">3年生 · Grade 3</option>
      </select>
      <p id="ag-assigned-grade" class="ag-assigned-grade" hidden></p>
      <button class="ag-primary" type="submit">Ready <span aria-hidden="true">▶</span></button>
    </form>
    <form id="ag-manual" hidden>
      <label for="ag-code">ADVENTURE CARD CODE</label>
      <input id="ag-code" name="card" maxlength="19" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required />
      <button class="ag-primary" type="submit">CONTINUE <span aria-hidden="true">▶</span></button>
    </form>
    <button class="ag-secondary" id="ag-retry" type="button" hidden>RETRY</button>
  </main>
  <div class="ag-footer">RPG TYPING VERSUS <span>·</span> ADVENTURE</div>`;
const style=document.createElement('style');
style.textContent=`
  #adventureGate{position:fixed;inset:0;z-index:99999;overflow:auto;background:#f3f4f5;color:#141518;display:flex;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;padding:24px;isolation:isolate}
  #adventureGate [hidden]{display:none!important}
  #adventureGate .ag-background{position:absolute;inset:0;z-index:-3;background:repeating-linear-gradient(0deg,rgba(20,25,32,.035) 0 1px,transparent 1px 4px),radial-gradient(ellipse at 50% 38%,#fff 5%,#e8ecf0 95%)}
  #adventureGate .ag-background:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 96%,rgba(0,0,0,.085) 1px,transparent 2px) 0 0/34px 34px;mask-image:linear-gradient(transparent 40%,black 100%);opacity:.5}
  #adventureGate .ag-mc{position:absolute;z-index:-2;pointer-events:none;bottom:-7%;left:50%;width:min(460px,55vw);max-height:110vh;object-fit:contain;transform:translateX(-50%);filter:grayscale(1) contrast(1.12) brightness(.85);opacity:.17}
  #adventureGate .ag-line{position:absolute;z-index:-1;left:0;right:0;top:53%;height:16px;background:#e7d915;opacity:.93}
  #adventureGate .ag-brand{position:absolute;top:max(18px,4vh);left:30px;display:flex;flex-direction:column;gap:6px;line-height:1}
  #adventureGate .ag-brand span{font-size:12px;letter-spacing:.36em;font-weight:900;color:#565d65}
  #adventureGate .ag-brand strong{font-size:clamp(27px,4.3vw,55px);letter-spacing:.04em;font-weight:1000}
  #adventureGate .ag-card{position:relative;max-width:440px;width:100%;margin:75px 0 0;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.25);box-shadow:0 18px 44px rgba(21,24,31,.16);padding:32px 34px 30px;backdrop-filter:blur(10px)}
  #adventureGate .ag-card:before{content:"";position:absolute;left:0;top:0;bottom:0;width:7px;background:#e7d915}
  #adventureGate .ag-kicker:empty,#adventureGate .ag-message:empty{display:none}
  #adventureGate .ag-kicker{color:#69707a;font-size:12px;font-weight:900;letter-spacing:.28em;margin-bottom:12px}
  #adventureGate h1{font-size:clamp(26px,4vw,36px);margin:0 0 10px;letter-spacing:.01em;font-weight:1000;line-height:1.05}
  #adventureGate .ag-message{margin:0 0 24px;min-height:24px;color:#555b65;font-size:14px;line-height:1.45}
  #adventureGate form{display:grid;gap:11px}
  #adventureGate label{font-size:11px;letter-spacing:.15em;font-weight:900;color:#555a64}
  #adventureGate input,#adventureGate select{box-sizing:border-box;display:block;width:100%;height:52px;background:#f9fafb;border:1px solid #7f858e;border-radius:0;padding:0 14px;font-size:17px;letter-spacing:.02em;color:#151515;outline-offset:2px}
  #adventureGate input:focus,#adventureGate select:focus{outline:2px solid #d7bd00;border-color:#222}
  #adventureGate select{cursor:pointer}
  #adventureGate .ag-assigned-grade{font-weight:800;font-size:14px;margin:0;color:#34393f}
  #adventureGate button{font-family:inherit;font-weight:900;cursor:pointer;border-radius:0;transition:filter .15s}
  #adventureGate button:hover{filter:brightness(.93)}
  #adventureGate .ag-primary{border:0;background:#e7d915;color:#0c0c0d;min-height:51px;padding:12px 16px;font-size:14px;display:flex;align-items:center;justify-content:space-between;margin-top:3px}
  #adventureGate .ag-secondary{border:1px solid #555;background:#fff;color:#171717;min-height:43px;padding:10px 18px;font-size:13px}
  #adventureGate .ag-footer{position:absolute;bottom:24px;font-size:11px;letter-spacing:.2em;font-weight:700;color:#71757c;text-align:center}
  #adventureGate .ag-footer span{color:#d2bd00;padding:0 8px}
  @media(max-width:580px){#adventureGate{padding:14px}#adventureGate .ag-brand{left:17px;top:22px}#adventureGate .ag-brand strong{font-size:30px}#adventureGate .ag-brand span{font-size:9px}#adventureGate .ag-mc{width:92vw;bottom:1%;max-height:75vh}#adventureGate .ag-card{padding:24px 23px 22px;margin-top:60px}#adventureGate .ag-line{top:54%}#adventureGate .ag-footer{font-size:9px;bottom:13px}}
`;
document.head.append(style);
document.body.append(gate);
// Startup screen used to wait for Firebase before showing any UI.
document.getElementById('v66Startup')?.remove();

const $=id=>document.getElementById(id);
const cached=(()=>{try{return JSON.parse(sessionStorage.getItem('rpgAdventureContext')||'null')}catch{return null}})();
const params=new URLSearchParams(location.search);
const clean=s=>String(s||'').toUpperCase().replace(/[^A-Z2-9]/g,'');
const cardPattern=/^[A-HJ-NP-Z2-9]{16}$/;
const qrCode=clean(params.get('card'));
const switchPlayer=params.get('switch')==='1' && !qrCode;
const resume=sessionStorage.getItem('rpgReturnToAdventureModeSelect')==='1';
let code=qrCode||(!switchPlayer&&resume?clean(cached?.card_code):'');
let busy=false;
let teacherAssignedGrade=null;
let readyPromise=null;
let scriptsStarted=false;
function installOfflineBridge(){
 window.RPG_V66_DISCONNECTED=true;
 window.RPG_OFFLINE_SESSION=true;
 // Never allow a stale full-screen cloud error to obscure local practice.
 document.getElementById('v66OnlineGate')?.remove();
 document.getElementById('v66Startup')?.remove();
 sessionStorage.setItem('rpgV66Interrupted','1');
 window.RPG_V66={ready:Promise.resolve(false),
  call:async()=>{throw Error('Online Firebase required for this operation.');},
  prepareBalanceRun:async()=>{throw Error('Ranked runs require Firebase.');},
  watchRankings:()=>()=>{},ping:async()=>{throw Error('Offline session.');}};
 window.RPG_V68_CONNECTION={get connected(){return false;},get blocked(){return true;}};
}
const isTransportFailure=e=>!navigator.onLine||Boolean(window.RPG_V66_DISCONNECTED)||
  /online firebase connection required|network|offline|unavailable|timeout|connection interrupted|could not connect|failed to fetch|importing a module script|dynamically imported module/i.test(String(e?.message||e));
async function offlineResume(problem){
 const record=await offlineCardCache.get(code);
 if(!record || !record.vocabularyAvailable)return false;
 installOfflineBridge();
 const identity={...record.identity,card_code:code,online:false,cloud:false,offline:true,
  recruitment:null,
  // Offline entry only permitted after the authoritative tutorial was completed.
  tutorial:record.identity.tutorial};
 sessionStorage.setItem('rpgAdventureContext',JSON.stringify(identity));
 view('checking','LOCAL PRACTICE','Offline Adventure Card · saved vocabulary · no rankings or rewards.');
 await load(identity,record.progress,{offline:true});
 return true;
}


function status(message){$('ag-status').textContent=String(message||'').slice(0,190)}
function view(mode,title,message){
 $('ag-title').textContent=title;
 $('ag-register').hidden=mode!=='register';
 $('ag-manual').hidden=mode!=='manual';
 $('ag-retry').hidden=mode!=='error';
 $('ag-kicker').textContent=mode==='register'?'':mode==='manual'?'MANUAL CARD ENTRY':mode==='error'?'CONNECTION ERROR':'ADVENTURE CARD';
 status(message);
}
async function onlineReady(){
 if(!navigator.onLine)throw Error('Offline: Firebase unavailable.');
 if(!readyPromise){readyPromise=(async()=>{
   window.RPG_PERF?.begin('Firebase connection');
   // Never import Firebase on the offline path: the SDK is hosted on a different origin.
   await import('./online-spark.js?v=137.0');
   const connected=await window.RPG_V66.ready;
   window.RPG_PERF?.end('Firebase connection');
   if(!connected)throw Error('Online Firebase connection required.');
 })();}
 // Prevent a broken RTDB handshake from blocking an already-verified card indefinitely.
 let timer;try{return await Promise.race([readyPromise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Firebase connection timeout')),9000);})]);}finally{clearTimeout(timer);}
}
async function load(identity,progress,{offline=false}={}){
 window.ADVENTURE_PLAYER=identity;
 window.RPG_LOCAL_PRACTICE={record:entry=>offlineCardCache.recordLocalResult(identity.public_id,entry),confirmedProgress:progress=>offlineCardCache.updateConfirmedProgress(code,progress)};
 window.RPG_RESUME_MODE_SELECT=resume||offline;
 sessionStorage.removeItem('rpgReturnToAdventureModeSelect');
 const scope=String(identity.public_id).replace(/[^A-Z0-9_-]/gi,'').slice(0,32),key=k=>`${k}__${scope}`;
 const playerKey=key('bossTyping_profile_v1');let profile={};
 try{profile=JSON.parse(localStorage.getItem(playerKey)||'{}')}catch{}
 profile.xp=Number(progress?.xp)||0;
 profile.achievements=progress?.achievements||[];
 profile.name=identity.name;
 localStorage.setItem(playerKey,JSON.stringify(profile));
 for(const [k,val] of [['bossTyping_hiScore_normal_v1',progress?.best_normal],['bossTyping_hiScore_extra_v1',progress?.best_extra]])localStorage.setItem(key(k),String(Number(val)||0));
 for(const [k,val] of [['bossTyping_normalCleared_v1',progress?.normal_clear],['bossTyping_extraCleared_v1',progress?.extra_clear]])localStorage.setItem(key(k),val?'1':'0');
 window.RPG_PERF?.begin('Game scripts');
 if(scriptsStarted)throw Error('Game startup interrupted. Reload to retry.');scriptsStarted=true;
 // Preload all required files together, then execute in dependency order. Preloads
 // have the exact same URLs as the injected scripts and use the HTTP cache.
 const scripts=['conquest-map.js','conquest-core.js','story-mode.js','adventure_rewards.js','guild-coins.js','squad-tutorial.js','adventure_engine.js'].map(file=>({file,url:file+'?v='+(file==='adventure_engine.js'?'141.0':file==='conquest-map.js'?'135.0':file==='story-mode.js'?'137.0':file==='conquest-core.js'?'136.0':file==='squad-tutorial.js'?'131.0':'81')}));
 for(const {url} of scripts){if(!Array.from(document.querySelectorAll('link[rel=preload]')).some(link=>link.href===new URL(url,document.baseURI).href)){const link=document.createElement('link');link.rel='preload';link.as='script';link.href=url;document.head.append(link);}}
 for(const {file,url} of scripts)await new Promise((resolve,reject)=>{
   const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error(file+' not loaded. Reload to retry.'));document.body.appendChild(s);
 });
 window.RPG_PERF?.end('Game scripts');
 gate.remove();
}
async function finish(card){
 status('Loading your saved progress…');
 const {progress,profile,vocab}=await window.RPG_V66.call('/api/adventure/bootstrap',{card_code:code});
 // A failed profile read must not bypass onboarding or overwrite the local identity.
 if(!progress?.ok||!profile?.ok||profile.public_id!==card.public_id)throw Error('Player profile unavailable. Retry sign-in.');
 const selectedCharacter=String(profile?.selected_character||profile?.cosmetics?.featured||'mc');
 const identity={public_id:card.public_id,name:card.name,grade:card.grade||null,card_code:code,online:true,cloud:true,selected_character:selectedCharacter,cosmetics:profile?.cosmetics||null,recruitment:profile?.recruitment||null,tutorial:profile.tutorial};
 sessionStorage.setItem('rpgAdventureContext',JSON.stringify(identity));
 // A verified online visit saves ONLY read-only progress identity + the class word list.
 // Never persist the bearer code in localStorage or any queued cloud write.
 await offlineCardCache.save(code,identity,progress);
 if(vocab && offlineCardCache.saveVocabulary(identity.public_id,vocab) && Array.isArray(vocab.words) && vocab.words.some(w=>w.active!==false&&String(w.answer||'').trim()&&String(w.prompt||'').trim()))window.RPG_VERIFIED_VOCAB_SYNC_AT=Date.now();
 await load(identity,progress);
}
// Recover the card through Firestore using the browser's persisted Firebase Auth UID.
// Never use a locally cached display name as authority to enter someone else's account.
async function resumeRememberedCard(){
 if(busy)return;
 busy=true;view('checking','WELCOME BACK','Restoring this browser’s Adventure Card…');
 try{
  await onlineReady();
  const saved=await window.RPG_V66.call('/api/adventure/resume',{});
  const verified=clean(saved?.card_code);
  if(!cardPattern.test(verified)||!saved?.public_id)throw Error('Saved card session unavailable.');
  code=verified;
  await finish(saved);
 }catch(e){
  console.info('Adventure Card auto-resume unavailable:',String(e?.message||e));
  // No remembered Firebase session, cleared browser storage, disabled card, or network issue.
  // Fall back to manual entry, not a local-only identity that bypasses account validation.
  const message=isTransportFailure(e)?
   'Could not restore this browser’s sign-in. Connect to the internet, or enter your card code for offline practice.':
   'Scan your Adventure Card or enter its code below.';
  view('manual','SCAN YOUR CARD',message);
 }finally{busy=false;}
}
// Explicit switching is safe on shared school computers: sign out of persisted Auth
// before opening a different student's card. Does not require Firestore rule changes.
async function beginSwitchPlayer(){
 sessionStorage.removeItem('rpgAdventureContext');
 sessionStorage.removeItem('rpgReturnToAdventureModeSelect');
 view('checking','SWITCH PLAYER','Clearing this browser’s previous sign-in…');
 try{
  const cloud=await import('./cloud-api.js?v=86.30');
  await cloud.forgetStudentSignIn();
  // A one-time URL flag must not linger after a successful sign-out.
  const next=new URL(location.href);next.searchParams.delete('switch');
  history.replaceState(null,'',next.pathname+next.search+next.hash);
  code='';
  view('manual','SCAN YOUR CARD','Enter the Adventure Card code for the player using this computer.');
 }catch(e){view('error','COULD NOT SWITCH',String(e?.message||e).slice(0,150));}
}
async function resolveCard(){
 if(busy)return;
 if(!cardPattern.test(code)){view('manual','ENTER CARD CODE','Scan your Adventure Card QR code or enter the code printed on it.');return;}
 busy=true;view('checking','CONNECTING','Checking your Adventure Card…');
 try{
   await onlineReady();
   // Probe mode never registers an unclaimed card without a student-chosen name.
   const card=await window.RPG_V66.call('/api/adventure/card',{card_code:code,name:'',probe:true});
   if(card.registration_required){
    teacherAssignedGrade=card.assigned_grade||null;
    const select=$('ag-grade'),assigned=$('ag-assigned-grade');
    select.hidden=Boolean(teacherAssignedGrade);
    select.required=!teacherAssignedGrade;
    // If teacher already assigned a grade, students cannot change it at registration.
    $('ag-grade').previousElementSibling.hidden=Boolean(teacherAssignedGrade);
    assigned.hidden=!teacherAssignedGrade;
    assigned.textContent=teacherAssignedGrade?'Grade assigned by teacher: '+teacherAssignedGrade.toUpperCase():'';
    view('register','WELCOME, ADVENTURER','');
   }
   else await finish(card);
 }catch(e){
   // A revoked/unregistered card must NEVER fall back to saved local identity.
   if(isTransportFailure(e)){
     try{if(await offlineResume(e))return;}catch(error){console.warn('Local practice not available:',error);}
   }
   view('error','COULD NOT CONNECT',e?.message||'Card verification failed.');
 }
 finally{busy=false;}
}
async function registerCard(e){
 e?.preventDefault();if(busy)return;
 const name=$('ag-name').value.trim().replace(/\s+/g,' ');
 const grade=$('ag-grade').value;
 if(name.length<1||name.length>20){status('Enter a username (1–20 characters).');return;}
 if(!teacherAssignedGrade&&!['1','2','3'].includes(grade)){status('Choose Grade 1, 2, or 3.');$('ag-grade').focus();return;}
 busy=true;$('ag-register').querySelector('button').disabled=true;
 status('Registering your Adventure Card…');
 try{
   await onlineReady();
   const card=await window.RPG_V66.call('/api/adventure/card',{card_code:code,name,grade,probe:true});
   if(card.registration_required){status('Please enter a username.');return;}
   await finish(card);
 }catch(e){status(e?.message||'Registration failed. Please retry.');}
 finally{busy=false;const button=$('ag-register')?.querySelector('button');if(button)button.disabled=false;}
}
$('ag-register').addEventListener('submit',registerCard);
$('ag-manual').addEventListener('submit',e=>{e.preventDefault();if(busy)return;code=clean($('ag-code').value);void resolveCard();});
$('ag-retry').addEventListener('click',()=>{if(scriptsStarted||(window.RPG_V68_CONNECTION?.blocked&&!window.RPG_OFFLINE_SESSION)){location.reload();return;}readyPromise=null;if(switchPlayer)void beginSwitchPlayer();else if(code)void resolveCard();else void resumeRememberedCard();});
// Switch Player is available on the already-logged-in start screen.
document.getElementById('introSwitchPlayer')?.addEventListener('click',()=>{
 window.location.assign('adventure.html?switch=1');
});

// Explicit QR entry always wins; otherwise first try a verified remembered Firebase session.
if(switchPlayer)void beginSwitchPlayer();
else if(code)void resolveCard();
else void resumeRememberedCard();
