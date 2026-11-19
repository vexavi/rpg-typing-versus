/* Teacher Story Editor — local drafts; one transactional Firestore publish.
 * No Cloud Storage, no polling, no function or Blaze dependencies.
 */
import {currentTeacher,googleTeacher,teacherSignOut,errorMessage} from './cloud-api.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getFirestore,doc,runTransaction,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import {loadPublishedStory,missingStoryRule} from './story-content-cloud.js';
import {cleanStory,safeStoryImage} from './story-format.mjs';
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
const DRAFT_KEY='rpg_story_teacher_draft_v87';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=obj=>JSON.parse(JSON.stringify(obj));
const db=getFirestore(getApp());
let teacher=null,chapters=[],chapterIndex=0,stageIndex=0,loadedRevision=0,publishedOrder=[],retiredStages=new Set(),retiredChapters=new Set(),dirty=false,busy=false;
function status(message,bad=false,success=false){$('status').textContent=message;$('status').className=bad?'error':success?'success':'';}
function checkAuth(){return Boolean(teacher&&teacher.uid===TEACHER_UID);}
function updateAuth(){
 $('google').hidden=!!teacher;$('signout').hidden=!teacher;
 $('publish').disabled=busy||!checkAuth()||!chapters.length;
 $('saveDraft').disabled=busy||!chapters.length;
 $('reload').disabled=busy;$('import').disabled=busy;
}
function markDirty(){dirty=true;status('Changes are not published. Save Draft or Publish when ready.');}
function currentChapter(){return chapters[chapterIndex]||null;}
function currentStage(){return currentChapter()?.stages[stageIndex]||null;}
function generateNumber(numbers){const set=new Set(numbers.map(String));for(let i=1;i<=9999;i++)if(!set.has(String(i)))return String(i);throw Error('No available IDs.');}
function nextChapterId(){return generateNumber([...chapters.map(c=>c.id),...retiredChapters]);}
function nextStageId(ch){const prefix=ch.id+'-';const used=[...ch.stages.map(s=>s.id),...retiredStages].filter(s=>s.startsWith(prefix)).map(s=>s.slice(prefix.length));return prefix+generateNumber(used);}
function newStage(ch){const id=nextStageId(ch);return {id,title:`Stage ${id}`,description:'',type:'story-battle',battle:{template:1,bossName:'Story Boss',bossHp:20},stars:{damageMax:[0,1,2,3]},unlock:{stageId:'',minStars:0},intro:[],outro:[]};}
function currentOrder(){return chapters.flatMap(ch=>ch.stages.map(st=>st.id));}
function writeDraft(){
 const payload={version:1,chapters,revision:loadedRevision,retiredStageIds:[...retiredStages],retiredChapterIds:[...retiredChapters]};
 localStorage.setItem(DRAFT_KEY,JSON.stringify(payload));dirty=false;status('Draft saved in this browser. Students have not received these changes.',false,true);
}
function swap(arr,i,j){if(j<0||j>=arr.length)return false;[arr[i],arr[j]]=[arr[j],arr[i]];return true;}
function renderNav(){
 $('chapterList').innerHTML=chapters.map((c,i)=>`<div class="navrow"><button class="navitem" data-action="select-chapter" data-i="${i}" aria-current="${i===chapterIndex}">${esc(c.id)} · ${esc(c.title)}</button><div class="navcontrols"><button data-action="chapter-up" data-i="${i}" ${i===0?'disabled':''} aria-label="Move chapter up">▲</button><button data-action="chapter-down" data-i="${i}" ${i===chapters.length-1?'disabled':''} aria-label="Move chapter down">▼</button></div></div>`).join('');
 const ch=currentChapter();
 $('stageList').innerHTML=(ch?.stages||[]).map((st,i)=>`<div class="navrow"><button class="navitem" data-action="select-stage" data-i="${i}" aria-current="${i===stageIndex}">${esc(st.id)} · ${esc(st.title)}</button><div class="navcontrols"><button data-action="stage-up" data-i="${i}" ${i===0?'disabled':''} aria-label="Move stage up">▲</button><button data-action="stage-down" data-i="${i}" ${i===ch.stages.length-1?'disabled':''} aria-label="Move stage down">▼</button></div></div>`).join('');
 $('addStage').disabled=!ch||busy;$('addChapter').disabled=busy;
}
function slideMarkup(st,phase){const items=st[phase];return `<section class="section"><div class="editheading"><h3>${phase==='intro'?'Before Battle / Intro':'After Battle / Outro'} · ${items.length} slides</h3><button data-action="add-slide" data-phase="${phase}" ${items.length>=50?'disabled':''}>+ Slide</button></div><div class="slides">${items.map((scene,i)=>`<div class="slide"><div><img data-scene-preview="${phase}:${i}" alt="Slide preview" src="${safeStoryImage(scene.image)?esc(scene.image):'story/images/placeholder-01.svg'}"><div class="tag">Slide ${i+1}</div></div><div class="fields"><div class="field"><label>Image path</label><input data-scene-phase="${phase}" data-scene-index="${i}" data-scene-key="image" value="${esc(scene.image)}" placeholder="story/images/scene.webp" maxlength="180"></div><div class="field"><label>Caption / dialogue</label><textarea data-scene-phase="${phase}" data-scene-index="${i}" data-scene-key="caption" maxlength="300" rows="2">${esc(scene.caption)}</textarea></div><div class="slide-actions"><button class="small" data-action="slide-up" data-phase="${phase}" data-i="${i}" ${i===0?'disabled':''}>Move up</button><button class="small" data-action="slide-down" data-phase="${phase}" data-i="${i}" ${i===items.length-1?'disabled':''}>Move down</button><button class="small danger" data-action="delete-slide" data-phase="${phase}" data-i="${i}">Delete</button></div></div></div>`).join('')}</div></section>`;}
function renderFields(){
 const ch=currentChapter(),st=currentStage();
 if(!ch||!st){$('chapterFields').textContent='Select a chapter and stage.';$('stageFields').textContent='';$('slidesEditor').textContent='';return;}
 $('chapterFields').innerHTML=`<div class="editheading"><h2>Chapter ${esc(ch.id)}</h2><button class="danger" data-action="delete-chapter">Delete Chapter</button></div><div class="grid"><div class="field"><label for="ch-title">Chapter title</label><input id="ch-title" data-chapter-field="title" maxlength="80" value="${esc(ch.title)}"></div><div class="field"><label for="ch-subtitle">Subtitle</label><input id="ch-subtitle" data-chapter-field="subtitle" maxlength="150" value="${esc(ch.subtitle||'')}"></div></div>`;
 $('stageFields').innerHTML=`<section class="section"><div class="editheading"><h2>Stage ${esc(st.id)}</h2><div class="row"><a href="game-settings.html?mode=story&amp;stage=${encodeURIComponent(st.id)}">Stage difficulty / mechanics</a><button class="danger" data-action="delete-stage">Delete Stage</button></div></div><div class="grid"><div class="field"><label for="st-title">Stage title</label><input id="st-title" data-stage-field="title" maxlength="85" value="${esc(st.title)}"></div><div class="field"><label for="st-type">Stage type</label><select id="st-type" data-stage-field="type"><option value="story-battle" ${st.type==='story-battle'?'selected':''}>Story + Battle</option><option value="story-only" ${st.type==='story-only'?'selected':''}>Story Only</option><option value="battle-only" ${st.type==='battle-only'?'selected':''}>Battle Only</option></select></div></div><div class="field"><label for="st-desc">Stage description</label><textarea id="st-desc" data-stage-field="description" maxlength="600" rows="2">${esc(st.description||'')}</textarea></div><div class="grid"><div class="field"><label for="st-template">Battle template (1–5)</label><input id="st-template" type="number" min="1" max="5" step="1" data-battle-field="template" value="${esc(st.battle?.template??1)}"></div><div class="field"><label for="st-bossname">Boss name</label><input id="st-bossname" data-battle-field="bossName" maxlength="40" value="${esc(st.battle?.bossName||'')}"></div><div class="field"><label for="st-hp">Boss HP (1–999)</label><input id="st-hp" type="number" min="1" max="999" step="1" data-battle-field="bossHp" value="${esc(st.battle?.bossHp??20)}"></div></div><p class="muted">Advanced falling speed, spawn rate, and mechanics are in Game Settings. Stage ID ${esc(st.id)} cannot be edited because it identifies existing player progress.</p></section>`;
 const preceding=chapters.flatMap(x=>x.stages).slice(0,chapters.flatMap(x=>x.stages).findIndex(x=>x.id===st.id));
 const unlock=st.unlock||{stageId:'',minStars:0},limits=st.stars?.damageMax||[0,1,2,3];
 const choices=preceding.map(x=>`<option value="${esc(x.id)}" ${unlock.stageId===x.id?'selected':''}>${esc(x.id)} — ${esc(x.title)}</option>`).join('');
 $('stageFields').insertAdjacentHTML('beforeend',`<section class="section"><h3>Stage Conditions</h3><div class="grid"><div class="field"><label for="unlockStage">Unlock after</label><select id="unlockStage" data-unlock-field="stageId"><option value="" ${!unlock.stageId?'selected':''}>Previous stage (default)</option>${choices}</select></div><div class="field"><label for="unlockStars">Stars needed on prerequisite</label><select id="unlockStars" data-unlock-field="minStars">${[0,1,2,3,4].map(n=>`<option value="${n}" ${Number(unlock.minStars)===n?'selected':''}>${n===0?'Clear only':n+' stars'}</option>`).join('')}</select></div></div><h3>Star Rating · Maximum Damage Taken</h3><div class="grid">${limits.map((n,i)=>`<div class="field"><label>${4-i}★ maximum damage</label><input type="number" min="0" max="99" step="1" data-star-index="${i}" value="${esc(n)}"></div>`).join('')}</div><p class="muted">Defaults: 4★ ≤0, 3★ ≤1, 2★ ≤2, 1★ ≤3. Lower ratings require larger damage limits. Star-gated stages must follow a battle stage.</p></section>`);
 $('slidesEditor').innerHTML=slideMarkup(st,'intro')+slideMarkup(st,'outro');
 for(const img of $('slidesEditor').querySelectorAll('img[data-scene-preview]'))img.addEventListener('error',()=>{img.removeAttribute('src');img.alt='Image not found. Add it to docs/story/images/ first.';});
}
function render(){renderNav();renderFields();updateAuth();}
function moveSelection(kind,index,d){const arr=kind==='chapter'?chapters:currentChapter()?.stages;if(!arr||!swap(arr,index,index+d))return;if(kind==='chapter')chapterIndex=index+d;else stageIndex=index+d;markDirty();render();}
function handleNavClick(event){const btn=event.target.closest('button[data-action]');if(!btn||busy)return;const a=btn.dataset.action,i=Number(btn.dataset.i);
 if(a==='select-chapter'){chapterIndex=i;stageIndex=0;render();return;}
 if(a==='select-stage'){stageIndex=i;renderFields();renderNav();return;}
 if(a==='chapter-up')moveSelection('chapter',i,-1);
 if(a==='chapter-down')moveSelection('chapter',i,1);
 if(a==='stage-up')moveSelection('stage',i,-1);
 if(a==='stage-down')moveSelection('stage',i,1);
}
function handleEditorInput(event){const t=event.target,st=currentStage(),ch=currentChapter();if(!ch||!st)return;
 if(t.dataset.chapterField)ch[t.dataset.chapterField]=t.value;
 else if(t.dataset.stageField)st[t.dataset.stageField]=t.value;
 else if(t.dataset.battleField)st.battle[t.dataset.battleField]=t.type==='number'?(t.value===''?null:Number(t.value)):t.value;
 else if(t.dataset.unlockField){st.unlock ||= {stageId:'',minStars:0};st.unlock[t.dataset.unlockField]=t.dataset.unlockField==='minStars'?Number(t.value):t.value;
 }else if(t.dataset.starIndex!==undefined){st.stars ||= {damageMax:[0,1,2,3]};st.stars.damageMax[Number(t.dataset.starIndex)]=t.value===''?null:Number(t.value);
 }else if(t.dataset.scenePhase){const scene=st[t.dataset.scenePhase]?.[Number(t.dataset.sceneIndex)];if(!scene)return;scene[t.dataset.sceneKey]=t.value;
  if(t.dataset.sceneKey==='image'){const img=$('slidesEditor').querySelector(`img[data-scene-preview="${t.dataset.scenePhase}:${t.dataset.sceneIndex}"]`);if(img){if(safeStoryImage(t.value)){img.src=t.value;}else img.removeAttribute('src');}}
 }else return;
 markDirty();
 if(t.dataset.chapterField==='title'||t.dataset.stageField==='title')renderNav();
}
function editorAction(event){const btn=event.target.closest('button[data-action]');if(!btn||busy)return;const a=btn.dataset.action,ch=currentChapter(),st=currentStage(),phase=btn.dataset.phase,i=Number(btn.dataset.i);
 if(a==='delete-chapter'){
  if(chapters.length===1){status('At least one chapter must remain.',true);return;}
  if(!confirm(`Delete Chapter ${ch.id} and all its stages from the next publication?`))return;
  retiredChapters.add(ch.id);ch.stages.forEach(s=>retiredStages.add(s.id));chapters.splice(chapterIndex,1);chapterIndex=Math.min(chapterIndex,chapters.length-1);stageIndex=0;
 }else if(a==='delete-stage'){
  if(ch.stages.length===1){status('Every chapter needs at least one stage.',true);return;}
  if(!confirm(`Delete stage ${st.id} from the next publication? Existing progress for this stage will remain in student records.`))return;
  retiredStages.add(st.id);ch.stages.splice(stageIndex,1);stageIndex=Math.min(stageIndex,ch.stages.length-1);
 }else if(a==='add-slide'){st[phase].push({image:'',caption:''});
 }else if(a==='delete-slide'){st[phase].splice(i,1);
 }else if(a==='slide-up'){if(!swap(st[phase],i,i-1))return;
 }else if(a==='slide-down'){if(!swap(st[phase],i,i+1))return;
 }else return;
 markDirty();render();
}
function setLoaded(manifest,revision=0){const normalized=cleanStory(manifest);chapters=normalized.chapters;loadedRevision=revision;chapterIndex=0;stageIndex=0;dirty=false;}
function restoreRetired(source){retiredStages=new Set((source.retiredStageIds||[]).filter(s=>/^[1-9]\d{0,3}-[1-9]\d{0,3}$/.test(String(s))));retiredChapters=new Set((source.retiredChapterIds||[]).filter(s=>/^[1-9]\d{0,3}$/.test(String(s))));}
async function loadRemote(useDraft=false){
 busy=true;updateAuth();status('Loading Story chapters…');
 try{
  let remote=null,missingRule=false;
  try{remote=await loadPublishedStory();}
  catch(error){if(!missingStoryRule(error))throw error;missingRule=true;}
  const source=remote||await fetch('story/chapters.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Built-in Story chapters not found.');return r.json();});
  setLoaded(source,Number(remote?.revision)||0);restoreRetired(remote||{});publishedOrder=currentOrder();
  let draftRecovered=false;
  if(useDraft){try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(draft&&Array.isArray(draft.chapters)){
   if(draft.chapters.length>0&&draft.chapters.length<=40&&draft.chapters.every(c=>c&&Array.isArray(c.stages)&&c.stages.length>0&&c.stages.every(st=>st&&st.battle&&Array.isArray(st.intro)&&Array.isArray(st.outro)))){
    chapters=clone(draft.chapters);restoreRetired(draft);loadedRevision=Number(draft.revision)||0;draftRecovered=true;
   }
  }}catch(e){status('Saved draft could not be recovered: '+e.message,true);}}
  if(!draftRecovered)status(remote?`Published Story loaded (revision ${loadedRevision}).`:'Loaded initial Chapter 1 from the game files. No cloud Story published yet.',false,true);
  else status('Local draft restored. Students still see the published version.',false,true);
  if(missingRule)status('The new Firestore Story rule is not deployed yet. You can edit or save a draft, but publishing will fail until it is added.',true);
  render();
 }catch(e){status('Story failed to load: '+errorMessage(e),true);}
 finally{busy=false;updateAuth();}
}
async function signIn(){try{teacher=await googleTeacher();if(!checkAuth())throw Error('This Google account is not the authorized teacher.');status('Authorized teacher signed in.',false,true);updateAuth();}
 catch(e){status(errorMessage(e),true);teacher=await currentTeacher();updateAuth();}}
async function publish(){
 if(!checkAuth()){status('Sign in using the authorized teacher Google account.',true);return;}
 let payload;try{payload=cleanStory({chapters});}catch(e){status(e.message,true);return;}
 const previous=publishedOrder.join('|'),newOrder=currentOrder().join('|');
 if(previous!==newOrder&&loadedRevision>0&&!confirm('You changed or deleted published stage order. Unlock progression may change for existing students. Publish anyway?'))return;
 if(!confirm(`Publish ${chapters.length} chapters / ${newOrder.split('|').length} stages to students?`))return;
 busy=true;updateAuth();status('Publishing to Firebase…');
 try{
  const reference=doc(db,'storyContent','published');let next;
  if(currentOrder().some(id=>retiredStages.has(id)))throw Error('The story contains a retired stage ID. Change the imported file to use a new ID, or undo the deletion.');
  if(chapters.some(ch=>retiredChapters.has(ch.id)))throw Error('The story contains a retired chapter ID. Change the imported file to use a new ID.');
  const stageIds=[...retiredStages];
  const chapterIds=[...retiredChapters];
  if(stageIds.length>2000||chapterIds.length>1000)throw Error('Too many retired IDs.');
  await runTransaction(db,async tx=>{
   const snapshot=await tx.get(reference);const rev=snapshot.exists()?Number(snapshot.data().revision)||0:0;
   if(rev!==loadedRevision)throw Error('Published Story changed in another tab. Export your draft, reload published content, and review before trying again.');
   next=rev+1;
   tx.set(reference,{...payload,revision:next,retiredStageIds:stageIds,retiredChapterIds:chapterIds,updatedAt:serverTimestamp()});
  });
  loadedRevision=next;publishedOrder=currentOrder();dirty=false;localStorage.removeItem(DRAFT_KEY);
  status(`Published revision ${next}. Students receive it when they next open Story Mode.`,false,true);
 }catch(e){status('Publish failed: '+errorMessage(e),true)}finally{busy=false;updateAuth();}
}
function exportFile(){try{const payload=cleanStory({chapters});const output={...payload,revision:loadedRevision,retiredStageIds:[...retiredStages],retiredChapterIds:[...retiredChapters]};const blob=new Blob([JSON.stringify(output,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='story-chapters-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status('JSON exported.',false,true);}catch(e){status(e.message,true);}}
async function importFile(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{if(file.size>750000)throw Error('JSON file exceeds 750 KB.');const incoming=JSON.parse(await file.text());const normalized=cleanStory(incoming);
  if(!confirm(`Replace the editor draft with ${normalized.chapters.length} imported chapters? Nothing is published yet.`))return;
  chapters=normalized.chapters;restoreRetired(incoming);chapterIndex=0;stageIndex=0;markDirty();render();
 }catch(e){status('Import failed: '+e.message,true);}}
async function boot(){
 $('chapterList').addEventListener('click',handleNavClick);$('stageList').addEventListener('click',handleNavClick);
 $('chapterFields').addEventListener('input',handleEditorInput);$('stageFields').addEventListener('input',handleEditorInput);$('slidesEditor').addEventListener('input',handleEditorInput);
 $('chapterFields').addEventListener('click',editorAction);$('stageFields').addEventListener('click',editorAction);$('slidesEditor').addEventListener('click',editorAction);
 $('addChapter').onclick=()=>{const id=nextChapterId(),ch={id,title:`Chapter ${id}`,subtitle:'',stages:[]};ch.stages.push(newStage(ch));chapters.push(ch);chapterIndex=chapters.length-1;stageIndex=0;markDirty();render();};
 $('addStage').onclick=()=>{const ch=currentChapter();if(!ch)return;if(ch.stages.length>=60){status('Maximum 60 stages per chapter.',true);return;}ch.stages.push(newStage(ch));stageIndex=ch.stages.length-1;markDirty();render();};
 $('saveDraft').onclick=()=>{try{writeDraft()}catch(e){status('Could not save local draft: '+e.message,true)}};
 $('export').onclick=exportFile;$('import').onchange=importFile;$('publish').onclick=publish;
 $('google').onclick=signIn;$('signout').onclick=async()=>{try{await teacherSignOut();teacher=null;updateAuth();status('Signed out.')}catch(e){status(errorMessage(e),true)}};
 $('reload').onclick=async()=>{if(dirty||localStorage.getItem(DRAFT_KEY)){if(!confirm('Discard local edits and the saved draft, then reload published chapters?'))return;}localStorage.removeItem(DRAFT_KEY);await loadRemote(false);};
 try{teacher=await currentTeacher();}catch(e){status(errorMessage(e),true)}
 updateAuth();await loadRemote(true);
 if(teacher&&!checkAuth())status('The current Google account is not authorized to publish. Sign out, then use the teacher account.',true);
}
void boot();
