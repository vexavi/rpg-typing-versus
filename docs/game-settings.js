import {currentTeacher,googleTeacher,teacherSignOut,errorMessage} from './cloud-api.js';
import {getFirestore,doc,getDocFromServer,serverTimestamp,runTransaction} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {nextModeConfig} from './dashboard-revisions.mjs?v=147.0';
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
const el=id=>document.getElementById(id);let teacher=null,db=null,chapters=[],ready=false,reading=0,loading=false,saving=false,dirty=false,loadedScope=null,loadedData=null,selected=null;
// Built-in values from adventure_engine.js (Normal stages 1–5; Practice is derived from Normal stage 1).
const BUILTIN={normal:[{fallSpeedPxPerSec:41,spawnEveryMs:2950,bossMaxHp:22,hitDamage:1},{fallSpeedPxPerSec:44,spawnEveryMs:2850,bossMaxHp:25,hitDamage:1},{fallSpeedPxPerSec:49,spawnEveryMs:2750,bossMaxHp:30,hitDamage:1},{fallSpeedPxPerSec:51,spawnEveryMs:2850,bossMaxHp:34,hitDamage:1},{fallSpeedPxPerSec:58,spawnEveryMs:2550,bossMaxHp:28,hitDamage:1}],
 practice:[{fallSpeedPxPerSec:35,spawnEveryMs:6941}]};
function builtinHint(mode,stage,key){const list=BUILTIN[mode]||[];if(stage){const v=list[Number(stage)-1]?.[key];return v==null?'':String(v);}const vals=list.map(x=>x[key]).filter(v=>v!=null);if(!vals.length)return '';const lo=Math.min(...vals),hi=Math.max(...vals);return lo===hi?String(lo):`${lo}–${hi} (by stage)`;}
const fields={fallSpeedPxPerSec:['Falling speed (px/s)',5,250,1],spawnEveryMs:['Word spawn interval (ms)',180,15000,20],bossMaxHp:['Boss HP',1,2000,1],hitDamage:['Damage / word',1,100,1]};
const options=list=>list.map(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=label;return o});
function message(s,bad=false){el('status').textContent=s;el('status').className=bad?'bad':'good'}
function selectedScope(){const mode=el('mode').value,level=el('scope').value;
 return level==='mode'?`mode:${mode}`:level==='chapter'?`chapter:${el('chapter').value}`:`stage:${mode}:${el('stage').value}`;
}
function setOptions(select,entries){select.replaceChildren(...options(entries));}
function refreshChoices(){
 const mode=el('mode').value;
 for(const key of ['bossMaxHp','hitDamage']){const input=el('fld-'+key);if(input)input.closest('.field').classList.toggle('hidden',['practice','challenge'].includes(mode));}
 const isStory=mode==='story';
 el('scope').querySelector('[value=chapter]').hidden=!isStory;
 if(!isStory&&el('scope').value==='chapter')el('scope').value='mode';
 el('chapter-row').classList.toggle('hidden',!isStory);
 el('stage-row').classList.toggle('hidden',el('scope').value!=='stage');
 const prevStage=el('stage').value;
 const chapter=el('chapter').value||chapters[0]?.id||'1';
 setOptions(el('chapter'),chapters.map(ch=>[String(ch.id),`${ch.id} — ${ch.title||'Chapter'}`]));
 if(chapters.some(ch=>String(ch.id)===chapter))el('chapter').value=chapter;
 const currentChapter=chapters.find(ch=>String(ch.id)===el('chapter').value);
 const stageEntries=isStory?(currentChapter?.stages||[]).map(st=>[String(st.id),`${st.id} — ${st.title||'Stage'}`]):
  Array.from({length:mode==='practice'||mode==='challenge'?1:5},(_,i)=>[String(i+1),`Stage ${i+1}`]);
 setOptions(el('stage'),stageEntries);
 if(stageEntries.some(([id])=>id===prevStage))el('stage').value=prevStage;
 const catalogue=window.RPG_MECHANICS?.list()||[];
 el('mechanics').replaceChildren();
 for(const m of catalogue){if(m.modes.length&&!m.modes.includes(mode))continue;
  const box=document.createElement('div');box.className='mechanic';const h=document.createElement('h3');h.textContent=m.label;box.appendChild(h);
  const grid=document.createElement('div');grid.className='grid';
  for(const f of m.fields){const w=document.createElement('div');w.className='field';const l=document.createElement('label');l.textContent=f.label;const input=f.type==='boolean'?document.createElement('select'):document.createElement('input');
   input.dataset.mechanic=m.id;input.dataset.field=f.key;input.id=`mech-${m.id}-${f.key}`;l.htmlFor=input.id;
   if(f.type==='boolean')setOptions(input,[['','Inherit'],['true','Enabled'],['false','Disabled']]);
   else {input.type='number';input.min=String(f.min);input.max=String(f.max);input.step=String(f.step||1);input.placeholder='Inherit';}
   w.append(l,input);if(f.help)input.title=f.help;grid.appendChild(w);
  }box.appendChild(grid);el('mechanics').appendChild(box);
 }
 el('mechanics-panel').hidden=!el('mechanics').children.length; // Adventure stage effects live in the Adventure Editor
}
function initInputs(){
 const dest=el('difficulty');dest.replaceChildren();
 for(const [key,[label,min,max,step]] of Object.entries(fields)){
  const w=document.createElement('div');w.className='field';const l=document.createElement('label');l.textContent=label;l.htmlFor='fld-'+key;
  const n=document.createElement('input');Object.assign(n,{type:'number',id:'fld-'+key,min:String(min),max:String(max),step:String(step),placeholder:'Inherit'});
  n.dataset.balance=key;w.append(l,n);dest.appendChild(w);
 }
}
function lock(){const blocked=loading||saving;for(const id of ['mode','scope','stage','google','signout','reload-settings'])el(id).disabled=blocked;for(const input of document.querySelectorAll('[data-balance],[data-mechanic]'))input.disabled=blocked||!teacher||!loadedScope;el('save').disabled=blocked||!teacher||!loadedScope;el('reset').disabled=el('save').disabled;}
function selection(){return Object.fromEntries(['mode','scope','stage'].map(k=>[k,el(k).value]));}
function restoreSelection(){if(!selected)return;for(const k of ['mode','scope','stage'])el(k).value=selected[k];}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
function stamp(data){return JSON.stringify(stable({values:data?.values||{},mechanics:data?.mechanics||{},updatedAt:data?.updatedAt?.toMillis?.()??null}));}
async function commit(scope,data,remove=false){
 const mode=scope.split(':')[1],target=doc(db,'gameBalance',scope),config=doc(db,'systemConfig','current');
 const ranked=['normal','challenge'].includes(mode);
 await runTransaction(db,async tx=>{const old=await tx.get(target);const cfg=ranked?await tx.get(config):null;
 if(stamp(old.data())!==stamp(loadedData))throw Error('Settings changed in another tab. Reload before publishing.');
 if(!old.exists()&&remove)return;
 if(!remove&&JSON.stringify(stable(old.data()?.values||{}))===JSON.stringify(stable(data.values))&&JSON.stringify(stable(old.data()?.mechanics||{}))===JSON.stringify(stable(data.mechanics)))return;
 if(ranked&&!cfg.exists())throw Error('Run Firebase Setup first.');
 if(remove)tx.delete(target);else tx.set(target,{...data,updatedAt:serverTimestamp()});
 if(ranked)tx.set(config,{...nextModeConfig(cfg.data(),mode),updatedAt:serverTimestamp()});
 });
}
async function load(){
 const seq=++reading;refreshChoices();selected=selection();loadedScope=null;loadedData=null;dirty=false;loading=true;lock();
 for(const input of document.querySelectorAll('[data-balance],[data-mechanic]'))input.value='';
 if(!teacher){loading=false;lock();message('Sign in to edit settings.',true);return;}
 const scope=selectedScope();if(!scope||scope.endsWith(':')){loading=false;lock();message('Select a stage.',true);return;}
 try{
  const mode=el('mode').value,stage=scope.startsWith('stage:')?el('stage').value:'';
  const [snap,modeSnap]=await Promise.all([getDocFromServer(doc(db,'gameBalance',scope)),stage?getDocFromServer(doc(db,'gameBalance','mode:'+mode)).catch(()=>null):null]);if(seq!==reading)return;
  const data=snap.exists()?snap.data():{};loadedData=data;loadedScope=scope;
  const modeValues=modeSnap?.exists?.()?modeSnap.data().values||{}:{};
  for(const input of document.querySelectorAll('[data-balance]')){
   const key=input.dataset.balance;input.value=data.values?.[key]??'';
   const inherited=modeValues[key]!=null?`${modeValues[key]} (all-stages setting)`:builtinHint(mode,stage,key);
   input.placeholder=inherited?`${inherited}`:'Built-in';input.title=inherited?`Now: ${inherited}`:'';input.classList.toggle('is-custom',input.value!=='');
  }
  for(const input of document.querySelectorAll('[data-mechanic]')){
   const value=data.mechanics?.[input.dataset.mechanic]?.[input.dataset.field];
   input.value=value===true?'true':value===false?'false':value??'';
  }
  const where=stage?`${mode==='normal'?'Normal':'Practice'} stage ${stage}`:`all ${mode==='normal'?'Normal':'Practice'} stages`;
  message(snap.exists()?`Custom values are set for ${where} (blue boxes).`:`Using built-in values for ${where}.`);
 }catch(e){if(seq===reading)message(errorMessage(e),true)}finally{if(seq===reading){loading=false;lock();}}
}
function collect(){
 const values={},mechanics={};
 if(['practice','challenge'].includes(el('mode').value))for(const key of ['bossMaxHp','hitDamage'])if(loadedData?.values?.[key]!==undefined)values[key]=loadedData.values[key];
 for(const input of document.querySelectorAll('[data-balance]')){
  if(input.closest('.field')?.classList.contains('hidden')||input.value.trim()==='')continue;
  const key=input.dataset.balance,[,min,max]=fields[key],number=Number(input.value);
  if(!Number.isFinite(number)||number<min||number>max)throw Error(`${fields[key][0]} must be between ${min} and ${max}.`);
  values[key]=number;
 }
 for(const input of document.querySelectorAll('[data-mechanic]')){
  const id=input.dataset.mechanic,key=input.dataset.field;
  if(input.value==='')continue;
  const spec=(window.RPG_MECHANICS?.list()||[]).find(m=>m.id===id)?.fields.find(f=>f.key===key);
  if(!spec)throw Error('Invalid mechanic setting');
  let value;
  if(spec.type==='boolean'){value=input.value==='true'}
  else {value=Number(input.value);if(!Number.isFinite(value)||value<spec.min||value>spec.max)throw Error(`${spec.label} out of range`)}
  (mechanics[id] ||= {})[key]=value;
 }
 return {values,mechanics};
}
async function save(){if(!teacher||!ready||loading||saving||loadedScope!==selectedScope())return;
 try{const data=collect();saving=true;lock();await commit(loadedScope,data);await load();message('Published. Students get the new difficulty from their next run.');}
 catch(e){message(errorMessage(e),true)}finally{saving=false;lock();}}
async function clear(){if(!teacher||loading||saving||loadedScope!==selectedScope())return;
 if(!confirm('Remove the custom values here and go back to the built-in difficulty?'))return;
 try{saving=true;lock();await commit(loadedScope,null,true);await load();message('Back to built-in values.');}
 catch(e){message(errorMessage(e),true)}finally{saving=false;lock();}}
async function signIn(){try{teacher=await googleTeacher();if(teacher?.uid!==TEACHER_UID){await teacherSignOut();teacher=null;throw Error('Use the authorized teacher account.');}db=getFirestore(getApp());ready=true;syncAuth();await load()}catch(e){message(errorMessage(e),true)}}
function syncAuth(){el('google').classList.toggle('hidden',!!teacher);el('signout').classList.toggle('hidden',!teacher)}
async function boot(){initInputs();loading=true;lock();
 const direct=new URLSearchParams(location.search);
 if(direct.get('mode')==='story'){location.replace('story-editor.html'+(direct.get('stage')?'?stage='+encodeURIComponent(direct.get('stage')):''));return;}
 for(const name of ['mode','scope','stage'])el(name).addEventListener('change',()=>{
  if(dirty&&!confirm('Discard unsaved settings?')){restoreSelection();return;}
  void load();
 });
 document.addEventListener('input',e=>{if(e.target.matches('[data-balance],[data-mechanic]')){dirty=true;if(e.target.matches('[data-balance]'))e.target.classList.toggle('is-custom',e.target.value!=='');}});
 window.addEventListener('beforeunload',e=>{if(dirty||saving){e.preventDefault();e.returnValue='';}});
 el('google').onclick=signIn;el('signout').onclick=async()=>{if(dirty&&!confirm('Discard unsaved settings?'))return;await teacherSignOut();teacher=null;syncAuth();await load()};
 el('save').onclick=save;el('reset').onclick=clear;el('reload-settings').onclick=()=>{if(!dirty||confirm('Discard unsaved settings?'))void load();};
 try{teacher=await currentTeacher();if(teacher&&teacher.uid!==TEACHER_UID){teacher=null;throw Error('Use the authorized teacher account.');}db=getFirestore(getApp());ready=true;}catch(e){message(errorMessage(e),true)}
 syncAuth();await load();
}
void boot();
