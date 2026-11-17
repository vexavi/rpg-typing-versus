import {currentTeacher,googleTeacher,teacherSignOut,errorMessage} from './cloud-api.js';
import {getFirestore,doc,getDoc,setDoc,deleteDoc,serverTimestamp,runTransaction} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
const el=id=>document.getElementById(id);let teacher=null,db=null,chapters=[],ready=false,reading=0;
const fields={fallSpeedPxPerSec:['Falling speed (px/s)',5,250,1],spawnEveryMs:['Word spawn interval (ms)',180,15000,20],bossMaxHp:['Boss HP',1,2000,1],hitDamage:['Damage / word',1,100,1]};
const options=list=>list.map(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=label;return o});
function message(s,bad=false){el('status').textContent=s;el('status').className=bad?'bad':'good'}
function selectedScope(){const mode=el('mode').value,level=el('scope').value;
 return level==='mode'?`mode:${mode}`:level==='chapter'?`chapter:${el('chapter').value}`:`stage:${mode}:${el('stage').value}`;
}
function setOptions(select,entries){select.replaceChildren(...options(entries));}
function refreshChoices(){
 const mode=el('mode').value;
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
   w.append(l,input);if(f.help){const p=document.createElement('p');p.className='tip';p.textContent=f.help;w.append(p)}grid.appendChild(w);
  }box.appendChild(grid);el('mechanics').appendChild(box);
 }
}
function initInputs(){
 const dest=el('difficulty');dest.replaceChildren();
 for(const [key,[label,min,max,step]] of Object.entries(fields)){
  const w=document.createElement('div');w.className='field';const l=document.createElement('label');l.textContent=label;l.htmlFor='fld-'+key;
  const n=document.createElement('input');Object.assign(n,{type:'number',id:'fld-'+key,min:String(min),max:String(max),step:String(step),placeholder:'Inherit'});
  n.dataset.balance=key;w.append(l,n);dest.appendChild(w);
 }
}
async function bumpVersion(){
 const ref=doc(db,'systemConfig','current');
 await runTransaction(db,async tx=>{const doc=await tx.get(ref);tx.set(ref,{revision:(Number(doc.data()?.revision)||0)+1,updatedAt:serverTimestamp()});});
}
async function load(){
 const seq=++reading;refreshChoices();
 for(const input of document.querySelectorAll('[data-balance],[data-mechanic]'))input.value='';
 if(!teacher){message('Sign in to edit live settings.',true);return;}
 const scope=selectedScope();if(!scope||scope.endsWith(':')){message('Select a stage.',true);return;}
 try{
  const snap=await getDoc(doc(db,'gameBalance',scope));if(seq!==reading)return;
  const data=snap.exists()?snap.data():{};
  for(const input of document.querySelectorAll('[data-balance]'))input.value=data.values?.[input.dataset.balance]??'';
  for(const input of document.querySelectorAll('[data-mechanic]')){
   const value=data.mechanics?.[input.dataset.mechanic]?.[input.dataset.field];
   input.value=value===true?'true':value===false?'false':value??'';
  }
  message(snap.exists()?`Loaded ${scope}`:`No override for ${scope}`);
 }catch(e){message(errorMessage(e),true)}
}
function collect(){
 const values={},mechanics={};
 for(const input of document.querySelectorAll('[data-balance]')){
  if(input.value.trim()==='')continue;
  const key=input.dataset.balance,[,min,max]=fields[key],number=Number(input.value);
  if(!Number.isFinite(number)||number<min||number>max)throw Error(`${key} must be between ${min} and ${max}`);
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
async function save(){if(!teacher||!ready){message('Sign in with the authorized teacher Google account.',true);return;}
 try{const scope=selectedScope();if(!scope||scope.endsWith(':'))throw Error('Select a stage.');const data=collect();el('save').disabled=true;
 await setDoc(doc(db,'gameBalance',scope),{...data,updatedAt:serverTimestamp()});await bumpVersion();message('Published live: '+scope);
 }catch(e){message(errorMessage(e),true)}finally{el('save').disabled=false}}
async function clear(){if(!teacher)return;
 if(!selectedScope()||selectedScope().endsWith(':')){message('Select a stage.',true);return;}
 if(!confirm(`Clear ALL overrides in ${selectedScope()}?`))return;
 try{await deleteDoc(doc(db,'gameBalance',selectedScope()));await bumpVersion();await load();message('Overrides cleared. Inherited settings restored.');}
 catch(e){message(errorMessage(e),true)}}
async function signIn(){try{teacher=await googleTeacher();db=getFirestore(getApp());ready=true;syncAuth();await load()}catch(e){message(errorMessage(e),true)}}
function syncAuth(){el('google').classList.toggle('hidden',!!teacher);el('signout').classList.toggle('hidden',!teacher)}
async function boot(){initInputs();
 try{const manifest=await fetch('story/chapters.json',{cache:'no-store'}).then(r=>r.json());chapters=manifest.chapters||[];}catch(_){chapters=[{id:'1',title:'Chapter 1',stages:[{id:'1-1',title:'Stage 1-1'}]}]}
 for(const name of ['mode','scope','chapter','stage'])el(name).addEventListener('change',()=>{
  if(name==='mode'||name==='chapter')refreshChoices();void load();
 });
 el('google').onclick=signIn;el('signout').onclick=async()=>{await teacherSignOut();teacher=null;syncAuth();await load()};
 el('save').onclick=save;el('reset').onclick=clear;
 try{teacher=await currentTeacher();db=getFirestore(getApp());ready=true;}catch(e){message(errorMessage(e),true)}
 syncAuth();await load();
}
void boot();
