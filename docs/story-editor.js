/* Teacher Conquest Editor — local drafts; one transactional Firestore publish.
 * No Cloud Storage, no polling, no function or Blaze dependencies.
 */
// Firebase is loaded separately AFTER local chapters are displayed.
// Static Firebase imports blocked the entire editor if the CDN was unavailable.
import './conquest-map.js?v=135.0';
import './conquest-core.js?v=136.0';
import {cleanStory,safeStoryImage,safeStoryAudio} from './story-format.mjs?v=136.0';
import {optimizePhoto,photoPackZip} from './story-photo-pack.mjs';
import {planImageRepairs,applyImageRepairs,githubRepoGuess,validGithubRepo,imageSlots} from './story-image-repair.mjs';
import {imageExt,shortSlideName,nextSharedName,sharedOptions,referencedImages,shortRenamePlan,applyShortRename,storyPath,storyAudioPath,nextBgmName,referencedMusic,musicOptions} from './story-asset-names.mjs?v=131.0';
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
const DRAFT_KEY='rpg_story_teacher_draft_v87';
const CHAPTER_1_BATTLE_THEME='story/audio/ch1-battle.webm';
const STAGE_BASE=[{fallSpeedPxPerSec:41,spawnEveryMs:2950,hitDamage:1},{fallSpeedPxPerSec:44,spawnEveryMs:2850,hitDamage:1},{fallSpeedPxPerSec:49,spawnEveryMs:2750,hitDamage:1},{fallSpeedPxPerSec:51,spawnEveryMs:2850,hitDamage:1},{fallSpeedPxPerSec:58,spawnEveryMs:2550,hitDamage:1}];
const STAGE_FIELDS={fallSpeedPxPerSec:['Falling speed (px/s)',5,250,1],spawnEveryMs:['Word spawn interval (ms)',180,15000,1],hitDamage:['Base attack multiplier (Conquest)',1,100,1],missDamage:['Incorrect answer damage',1,10,1],overflowDamage:['Overflow damage per second',1,10,1],cometDamage:['Comet impact damage',1,10,1],shootingStarDamage:['Shooting Star damage',1,10,1]};
const CQ=window.RPG_CONQUEST;
const damageScale=key=>['bossHp','missDamage','overflowDamage','cometDamage','shootingStarDamage'].includes(key)?10:1;
const showDamage=(key,value)=>value*damageScale(key);
const DAMAGE_DEFAULTS={hitDamage:1,missDamage:1,overflowDamage:1,cometDamage:2,shootingStarDamage:2};
const stagedPhotos=new Map(),stagedAudio=new Map();let liveBalance={},liveRequestId=0;const balanceCache=new Map();let draftTimer=null,activeTab="encounters";
const REPO_KEY='rpg_story_github_repo_v90';
let onlineImageNames=[],selectedLocalFiles=new Map(),onlineAudioNames=[];
let repairChoices=[];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=obj=>JSON.parse(JSON.stringify(obj));
let db=null,cloud=null,cloudTask=null;
function errorMessage(e){
 const code=String(e?.code||''),s=String(e?.message||e||'Connection failed');
 if(code.includes('permission-denied')||s.includes('Missing or insufficient permissions'))return 'Firestore Story rules missing or the teacher account is not authorized.';
 if(code.includes('popup-blocked'))return 'Allow Google sign-in popups and try again.';
 if(code.includes('unauthorized-domain'))return 'This site is not authorized for Firebase sign-in.';
 return s.slice(0,240);
}
function missingStoryRule(e){return String(e?.code||'').includes('permission-denied')||String(e?.message||'').includes('Missing or insufficient permissions');}
async function connectFirebase(){
 if(cloud)return cloud;
 if(!cloudTask)cloudTask=(async()=>{
  const [api,firestore,story,app]=await Promise.all([
   import('./cloud-api.js'),
   import('https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js'),
   import('./story-content-cloud.js'),
   import('https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js')
  ]);
  db=firestore.getFirestore(app.getApp());
  cloud={api,firestore,story};return cloud;
 })().catch(error=>{cloudTask=null;throw error;});
 return cloudTask;
}
const currentTeacher=async()=> (await connectFirebase()).api.currentTeacher();
const googleTeacher=async()=> (await connectFirebase()).api.googleTeacher();
const teacherSignOut=async()=> (await connectFirebase()).api.teacherSignOut();
const loadPublishedStory=async()=> (await connectFirebase()).story.loadPublishedStory();
function cloudMethod(name,...args){if(!cloud)throw Error('Firebase is not connected. Use Reload Published to reconnect.');return cloud.firestore[name](...args);}
const doc=(...args)=>cloudMethod('doc',...args);
const getDocFromServer=(...args)=>cloudMethod('getDocFromServer',...args);
const runTransaction=(...args)=>cloudMethod('runTransaction',...args);
const serverTimestamp=(...args)=>cloudMethod('serverTimestamp',...args);

let teacher=null,chapters=[],chapterIndex=0,stageIndex=0,loadedRevision=0,publishedOrder=[],retiredStages=new Set(),retiredChapters=new Set(),dirty=false,busy=false,cloudAvailable=false,authReadId=0;
function status(message,bad=false,success=false){$('status').textContent=message;$('status').className=bad?'error':success?'success':'';}
function checkAuth(){return Boolean(teacher&&teacher.uid===TEACHER_UID);}
function updateAuth(){
 $('google').hidden=!!teacher;$('signout').hidden=!teacher;
 $('publish').disabled=busy||!checkAuth()||!chapters.length||!cloudAvailable;
 $('saveDraft').disabled=busy||!chapters.length;
 $('reload').disabled=busy;$('import').disabled=busy;document.querySelector('.layout').inert=busy;$('operatorFields').inert=busy;
 $('downloadPhotos').disabled=busy||stagedPhotos.size===0;$('downloadPhotos').textContent=`Download Photo Pack (${stagedPhotos.size})`;
 $('downloadAudio').disabled=busy||stagedAudio.size===0;$('downloadAudio').textContent=`Download Music Pack (${stagedAudio.size})`;
}
function markDirty(){dirty=true;status('Unpublished changes.');clearTimeout(draftTimer);draftTimer=setTimeout(()=>{if(!dirty)return;try{writeDraft(true);}catch(e){status('Draft not saved: '+e.message,true);}},650);}
window.addEventListener('beforeunload',event=>{if(dirty){try{writeDraft(true);}catch{}}if(dirty||busy||stagedPhotos.size||stagedAudio.size){event.preventDefault();event.returnValue='';}});

function currentChapter(){return chapters[chapterIndex]||null;}
function currentStage(){return currentChapter()?.stages[stageIndex]||null;}
function generateNumber(numbers){const set=new Set(numbers.map(String));for(let i=1;i<=9999;i++)if(!set.has(String(i)))return String(i);throw Error('No available IDs.');}
function nextChapterId(){return generateNumber([...chapters.map(c=>c.id),...retiredChapters]);}
function nextStageId(ch){const prefix=ch.id+'-';const used=[...ch.stages.map(s=>s.id),...retiredStages].filter(s=>s.startsWith(prefix)).map(s=>s.slice(prefix.length));return prefix+generateNumber(used);}
function newStage(ch){const id=nextStageId(ch);return {id,title:`Encounter ${id}`,description:'',type:'battle-only',battle:{template:1,bossName:'Enemy',bossHp:20},stars:{damageMax:[0,1,2,3]},unlock:{stageId:'',minStars:0},intro:[],outro:[]};}
function currentOrder(){return chapters.flatMap(ch=>ch.stages.map(st=>st.id));}
function writeDraft(automatic=false){
 clearTimeout(draftTimer);
 const payload={...cleanStory({chapters}),revision:loadedRevision,retiredStageIds:[...retiredStages],retiredChapterIds:[...retiredChapters]};
 localStorage.setItem(DRAFT_KEY,JSON.stringify(payload));dirty=false;status(automatic?'Draft autosaved · unpublished':'Draft saved · unpublished',false,true);
}
function swap(arr,i,j){if(j<0||j>=arr.length)return false;[arr[i],arr[j]]=[arr[j],arr[i]];return true;}
function scenePreview(scene){return stagedPhotos.get(scene.image)?.url||(safeStoryImage(scene.image)?scene.image:'story/images/placeholder-01.svg');}
function assetOptions(current=''){const options=sharedOptions(chapters,[...onlineImageNames,...Object.values(window.RPG_CONQUEST_MAP.defaultArt)],[...stagedPhotos.keys()]);if(current&&!options.includes(current)&&safeStoryImage(current))options.unshift(current);return options;}
function optionMarkup(selected=''){return `<option value="">None</option>`+assetOptions(selected).map(path=>`<option value="${esc(path)}" ${path===selected?'selected':''}>${esc(path.slice('story/images/'.length))}</option>`).join('');}
function stageArtPath(key){return currentStage()?.battle?.[key]||'';}
function assetPreview(path){return stagedPhotos.get(path)?.url||(safeStoryImage(path)?path:'');}
function updateStaged(path,blob){const old=stagedPhotos.get(path);if(old)URL.revokeObjectURL(old.url);stagedPhotos.set(path,{blob,url:URL.createObjectURL(blob)});}
function audioPaths(){return referencedMusic(chapters);}
function audioOptions(selected=''){const paths=musicOptions(chapters,[...onlineAudioNames,CHAPTER_1_BATTLE_THEME],[...stagedAudio.keys()]);if(selected&&safeStoryAudio(selected)&&!paths.includes(selected))paths.unshift(selected);return paths;}
function audioPreview(path){return stagedAudio.get(path)?.url||(safeStoryAudio(path)?path:'');}
function dropUnusedAudio(){const used=new Set(audioPaths());for(const [path,item] of stagedAudio)if(!used.has(path)){URL.revokeObjectURL(item.url);stagedAudio.delete(path);}updateAuth();}
function clearAudioSelection(){for(const item of stagedAudio.values())URL.revokeObjectURL(item.url);stagedAudio.clear();updateAuth();}
function audioOptionsMarkup(selected=''){return `<option value="">${String(currentChapter()?.id)==='1'?'The Rift theme (default)':'None (silent)'}</option>`+audioOptions(selected).map(path=>`<option value="${esc(path)}" ${path===selected?'selected':''}>${esc(path.split('/').at(-1))}</option>`).join('');}
function catalog(){return (window.RPG_MECHANICS?.list()||[]).filter(m=>!m.modes?.length||m.modes.includes('story'));}
function inherited(key,st=currentStage()){
 const base=STAGE_BASE[Math.min(4,Math.max(0,(Number(st?.battle?.template)||1)-1))]||STAGE_BASE[0];
 if(key in DAMAGE_DEFAULTS&&key!=='hitDamage')return {value:DAMAGE_DEFAULTS[key],source:'built-in'};
 let value=base[key],source='built-in';
 for(const scope of [`mode:story`,`chapter:${currentChapter()?.id}`,`stage:story:${st?.id}`]){
  if(liveBalance[scope]?.values?.[key]!==undefined){value=liveBalance[scope].values[key];source=scope}
 }
 return {value,source};
}
function fillLiveValues(){
 const st=currentStage();if(!st)return;
 for(const key of Object.keys(STAGE_FIELDS)){
  const input=$('stageFields').querySelector(`[data-battle-field="${key}"]`);
  const label=$('stageFields').querySelector(`[data-current-field="${key}"]`);
  if(!input||!label)continue;
  const data=inherited(key,st),own=st.battle[key];
  if(own===undefined||own===null){if(document.activeElement!==input)input.value=String(showDamage(key,data.value))}
  label.textContent=`Current: ${showDamage(key,own??data.value)} · ${own!==undefined&&own!==null?'Encounter override':data.source}`;
 }
 const panicInput=$('stageFields').querySelector('[data-damage-panic]');
 if(panicInput&&document.activeElement!==panicInput)panicInput.value=String(panicDamageValue(st)*10);
 const info=$('current-status');if(info)info.textContent=checkAuth()?'Encounter values override legacy inherited settings.':'Sign in to read legacy inherited settings.';
}
async function loadLiveValues(){
 const st=currentStage();if(!st)return;
 const stage=st.id,chapter=currentChapter().id,token=++liveRequestId;
 liveBalance={};fillLiveValues();
 if(!checkAuth())return;
 try{
  const scopes=[`mode:story`,`chapter:${chapter}`,`stage:story:${stage}`];
  const snaps=await Promise.all(scopes.map(id=>{if(!balanceCache.has(id)){const pending=getDocFromServer(doc(db,'gameBalance',id)).catch(e=>{balanceCache.delete(id);throw e;});balanceCache.set(id,pending);}return balanceCache.get(id);}));
  if(token!==liveRequestId||currentStage()?.id!==stage)return;
  liveBalance=Object.fromEntries(scopes.map((id,i)=>[id,snaps[i].exists()?snaps[i].data():{}]));
  fillLiveValues();
  for(const input of $('stageFields').querySelectorAll('[data-mechanic-id]')){const m=input.dataset.mechanicId,k=input.dataset.mechanicKey;if(st.battle?.mechanics?.[m]?.[k]!==undefined||document.activeElement===input)continue;let value;for(const scope of scopes)if(liveBalance[scope]?.mechanics?.[m]?.[k]!==undefined)value=liveBalance[scope].mechanics[m][k];if(value===undefined){const field=catalog().find(x=>x.id===m)?.fields.find(x=>x.key===k);value=field?.default??(field?.type==='boolean'?false:field?.min);}if(value!==undefined)input.value=String(value);}
 }catch(error){if(token===liveRequestId)status('Could not read existing Game Settings: '+errorMessage(error),true)}
}
function panicDamageValue(st){
 let value=1;
 for(const scope of ['mode:story',`chapter:${currentChapter()?.id}`,`stage:story:${st.id}`]){
  const v=liveBalance[scope]?.mechanics?.panic?.damage;if(typeof v==='number'&&v>=1&&v<=10)value=v;
 }
 return st.battle?.mechanics?.panic?.damage??value;
}
function damageSettings(st){
 const fields=Object.keys(DAMAGE_DEFAULTS).map(key=>{
  const [label,min,max,step]=STAGE_FIELDS[key],actual=st.battle?.[key]??inherited(key,st).value;
  return `<div class="field"><label for="battle-${key}">${esc(label)}</label><input id="battle-${key}" data-battle-field="${key}" type="number" min="${showDamage(key,min)}" max="${showDamage(key,max)}" step="${showDamage(key,step)}" value="${esc(showDamage(key,actual))}"><span class="muted" data-current-field="${key}">Current: ${esc(showDamage(key,actual))}</span></div>`;
 }).join('');
 const panic=String(currentChapter()?.id)==='1'?`<div class="field"><label for="battle-panicDamage">Panic word damage</label><input id="battle-panicDamage" data-damage-panic="true" type="number" min="10" max="100" step="10" value="${esc(panicDamageValue(st)*10)}"><span class="muted">When Panic is enabled in The Rift.</span></div>`:'';
 return `<section class="section damage-settings"><div class="editheading"><h3>Damage Settings</h3></div><div class="grid">${fields}${panic}</div><div class="grid"><label><input type="checkbox" data-battle-field="cometEnabled" ${st.battle?.cometEnabled===true?'checked':''}> Enable Comet (every 4th spawn, starting with the first)</label><label><input type="checkbox" data-battle-field="shootingStarEnabled" ${st.battle?.shootingStarEnabled===true?'checked':''}> Enable Shooting Star (every 3rd spawn, 4-second countdown after landing)</label></div><div class="boss-sprite-actions"><button type="button" data-action="copy-damage">Copy damage to territory</button><button type="button" data-action="reset-damage">Reset damage defaults</button></div><p class="muted">HP and mechanics are unchanged.</p></section>`;
}
function mechanicMarkup(st,onlyChapter1=false){
 const plugins=catalog().filter(m=>onlyChapter1?['sleepy','delirium','panic'].includes(m.id):!['sleepy','delirium','panic'].includes(m.id));if(!plugins.length)return '<p class="muted">No additional mechanics.</p>';
 return plugins.map(m=>{
  const settings=st.battle?.mechanics?.[m.id]||{};
  const controls=m.fields.filter(field=>!(m.id==='panic'&&field.key==='damage')).map(field=>{
   let inheritedValue=field.default??(field.type==='boolean'?false:field.min);for(const scope of ['mode:story',`chapter:${currentChapter()?.id}`,`stage:story:${st.id}`])if(liveBalance[scope]?.mechanics?.[m.id]?.[field.key]!==undefined)inheritedValue=liveBalance[scope].mechanics[m.id][field.key];const current=settings[field.key]??inheritedValue;
   const attr=`data-mechanic-id="${esc(m.id)}" data-mechanic-key="${esc(field.key)}"`;
   const input=field.type==='boolean'?`<select ${attr}><option value="true" ${current===true?'selected':''}>Enabled</option><option value="false" ${current!==true?'selected':''}>Disabled</option></select>`:`<input type="number" ${attr} min="${field.min}" max="${field.max}" step="${field.step||1}" value="${esc(current)}">`;
   return `<div class="field"><label>${esc(field.label)}</label>${input}</div>`;
  }).join('');
  return `<div class="mechanicgroup"><h4>${esc(m.label)}</h4><p class="muted">${esc(m.description||'')}</p><div class="grid">${controls}</div></div>`;
 }).join('');
}
function clearPhotoSelection(){for(const data of stagedPhotos.values())URL.revokeObjectURL(data.url);stagedPhotos.clear();updateAuth()}
function dropUnusedPhotos(){const names=new Set(referencedImages(chapters));for(const [key,item] of stagedPhotos)if(!names.has(key)){URL.revokeObjectURL(item.url);stagedPhotos.delete(key)}updateAuth()}
async function addPhoto(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 const st=currentStage(),phase=event.target.dataset.photoPhase,i=Number(event.target.dataset.photoIndex);
 const scene=st?.[phase]?.[i];if(!scene)return;
 try{
  status('Optimizing photo…');const blob=await optimizePhoto(file);
  if(!currentStage()||currentStage().id!==st.id||st[phase]?.[i]!==scene)throw Error('Slide changed. Select the photo again.');
  if(stagedPhotos.size>=250)throw Error('At most 250 photos can be staged. Download your current pack first.');
  const ext=blob.type==='image/webp'?'webp':blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':null;
  if(!ext)throw Error('Browser could not make a compatible photo.');
  const name=shortSlideName(st.id,phase,i,ext);
  scene.image=storyPath(name);
  updateStaged(scene.image,blob);dropUnusedPhotos();markDirty();renderFields();
  status(`Photo ready as ${name}. Download Photo Pack once, push to GitHub, then publish.`,false,true);
 }catch(error){status('Photo failed: '+error.message,true)}
}
// Uploaded boss/background images are shared assets, never stage-owned files.
// Select "Use Existing" in another stage to reference exactly the same path.
async function addSharedArt(event,kind){
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 const st=currentStage();if(!st)return;
 const key=kind==='boss'?'bossSprite':'battleBackground';
 try{
  status('Optimizing image…');const blob=await optimizePhoto(file);
  if(currentStage()!==st)throw Error('Stage changed while selecting artwork.');
  if(stagedPhotos.size>=250)throw Error('Photo pack limit reached. Download the current pack first.');
  const ext=imageExt(blob);if(!ext)throw Error('Unsupported image format.');
  const name=nextSharedName(kind,assetOptions().concat(onlineImageNames),ext);
  const path=storyPath(name);st.battle[key]=path;
  updateStaged(path,blob);dropUnusedPhotos();markDirty();renderFields();
  status(`${name} added as shared artwork. Other stages can choose it under Use Existing, with no second upload.`,false,true);
 }catch(error){status('Image failed: '+error.message,true)}
}
async function addBossSprite(event){return addSharedArt(event,'boss');}
async function addBattleBackground(event){return addSharedArt(event,'bg');}
async function addMusic(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return;
 const st=currentStage();if(!st)return;
 try{
  const ext=file.name.split('.').at(-1).toLowerCase();
  if(!['mp3','m4a','webm','opus','ogg','wav'].includes(ext))throw Error('Choose MP3, M4A, WEBM, OPUS, OGG or WAV.');
  if(!file.size||file.size>25*1024*1024)throw Error('Music must be 1 byte to 25 MB. Use compressed audio for smaller downloads.');
  if(file.type&&!/^(audio\/|video\/webm|application\/octet-stream)/i.test(file.type))throw Error('The selected file is not an audio file.');
  if(stagedAudio.size>=40)throw Error('Maximum 40 staged music tracks. Download the Music Pack first.');
  if(currentStage()!==st)throw Error('Stage selection changed.');
  // Reserve names already on GitHub, even if a song is not assigned to any stage.
  // Never rename or overwrite previously uploaded tracks just to use a new one.
  const repo=$('repoName').value.trim();
  if(validGithubRepo(repo)){
   try{
    const r=await fetch(`https://api.github.com/repos/${repo}/contents/docs/story/audio`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
    if(r.ok){const files=await r.json();if(Array.isArray(files))onlineAudioNames=[...new Set([...onlineAudioNames,...files.filter(x=>x.type==='file'&&safeStoryAudio(storyAudioPath(x.name))).map(x=>x.name)])];}
   }catch(error){console.info('Music directory scan unavailable:',error)}
  }
  if(currentStage()!==st)throw Error('Stage selection changed while checking music names.');
  const name=nextBgmName(audioOptions().concat(onlineAudioNames),ext),path=storyAudioPath(name);
  const old=stagedAudio.get(path);if(old)URL.revokeObjectURL(old.url);
  stagedAudio.set(path,{blob:file,url:URL.createObjectURL(file)});
  st.battle.bgmFile=path;dropUnusedAudio();markDirty();renderFields();
  status(`${name} selected. Download Music Pack, upload to GitHub, then Publish. You can reuse this track on other stages.`,false,true);
 }catch(error){status('Music failed: '+error.message,true)}
}
async function downloadMusic(){
 if(!stagedAudio.size||busy)return;
 busy=true;updateAuth();status('Building Music Pack…');
 try{const zip=await photoPackZip([...stagedAudio].map(([path,item])=>({name:'docs/'+path,blob:item.blob})),{kind:'audio'});
  const url=URL.createObjectURL(zip),link=document.createElement('a');link.href=url;link.download='RPG_Story_Music.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  status('Music Pack downloaded. Extract it into the GitHub repository root, commit/push, then Check Music and Publish.',false,true);
 }catch(error){status('Music Pack failed: '+error.message,true)}finally{busy=false;updateAuth()}
}
async function checkMusicOnline(path){
 try{const url=new URL(path,document.baseURI);url.searchParams.set('check',String(Date.now()));
  const response=await fetch(url.href,{method:'HEAD',cache:'no-store'});
  if(response.status===405||response.status===501){const get=await fetch(url.href,{cache:'no-store'});return get.ok&&!/text\/html/i.test(get.headers.get('content-type')||'');}
  return response.ok&&!/text\/html/i.test(response.headers.get('content-type')||'');
 }catch{return false}
}
function showMusicReport(rows){const report=$('musicReport');report.innerHTML=rows.map(r=>`<li class="${r.ok?'photo-ok':'photo-bad'}">${esc(r.path.split('/').at(-1))} — ${esc(r.text)}</li>`).join('');$('musicReportPanel').hidden=!rows.length;}
async function checkMusic(){
 verifiedAssets.clear();
 if(busy)return;busy=true;updateAuth();status('Checking music on the published website…');
 try{const paths=audioPaths(),rows=[];
  for(let i=0;i<paths.length;i+=6){const result=await Promise.all(paths.slice(i,i+6).map(async path=>({path,ok:await checkMusicOnline(path)})));for(const r of result)rows.push({...r,text:r.ok?'Online ✓':stagedAudio.has(r.path)?'Only selected in browser — upload the Music Pack first':'Not found on GitHub Pages'});}
  showMusicReport(rows);const count=rows.filter(r=>r.ok).length;
  status(rows.length===count?`All ${count} music tracks are online. You may publish.`:`${count}/${rows.length} music tracks online. Upload the missing music files before publishing.`,rows.length!==count,rows.length===count);
 }catch(error){status('Music check failed: '+error.message,true)}finally{busy=false;updateAuth()}
}
async function findExistingMusic(){
 const repo=$('repoName').value.trim();if(!validGithubRepo(repo)){status('Enter your GitHub username/repository under Chapter Images first.',true);return;}
 if(busy)return;busy=true;updateAuth();status('Finding music on GitHub…');
 try{const r=await fetch(`https://api.github.com/repos/${repo}/contents/docs/story/audio`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  if(!r.ok)throw Error(r.status===404?'No docs/story/audio folder was found yet. Upload a Music Pack or create that folder first.':`GitHub returned ${r.status}.`);
  const files=await r.json();if(!Array.isArray(files))throw Error('GitHub did not return the music folder.');
  onlineAudioNames=files.filter(x=>x.type==='file'&&safeStoryAudio(storyAudioPath(x.name))).map(x=>x.name);renderFields();
  status(`Found ${onlineAudioNames.length} music files. Choose any of them in Battle Settings → Music.`,false,true);
 }catch(error){status('Could not find existing music: '+error.message,true)}finally{busy=false;updateAuth()}
}
async function downloadPhotos(){
 if(!stagedPhotos.size)return;
 try{busy=true;updateAuth();status('Building photo ZIP…');
  const zip=await photoPackZip([...stagedPhotos].map(([name,item])=>({name:'docs/'+name,blob:item.blob})));
  const url=URL.createObjectURL(zip),link=document.createElement('a');link.href=url;link.download='RPG_Story_Chapter_Photos.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  status('Photo Pack downloaded. Extract into the GitHub repository root, commit and push, then Publish to Students.',false,true);
 }catch(error){status(error.message,true)}finally{busy=false;updateAuth()}
}
// A missing photo can be repaired from the filenames already in the GitHub repository.
// This only edits the local draft; Firestore is never written by a repair operation.
function battleAssetChapters(items){return items.map(c=>({...c,stages:c.stages.filter(s=>s.type!=='story-only').map(s=>({...s,intro:[],outro:[]}))}));}
function photoPaths(){return referencedImages(battleAssetChapters(chapters));}
async function photoOnline(path){
 try{
  const url=new URL(path,document.baseURI);
  url.searchParams.set('check',String(Date.now()));
  const response=await fetch(url.href,{method:'HEAD',cache:'no-store'});
  if(response.ok && /^image\//i.test(response.headers.get('content-type')||''))return true;
  // Some static hosts refuse HEAD, so use GET only in that case.
  if(response.status!==405 && response.status!==501)return false;
  const fallback=await fetch(url.href,{cache:'no-store'});
  return fallback.ok && /^image\//i.test(fallback.headers.get('content-type')||'');
 }catch{return false;}
}
function photoReport(rows){
 const list=$('photoReport');if(!list)return;
 list.innerHTML=rows.map(item=>`<li class="${item.ok?'photo-ok':'photo-bad'}">${esc(item.label)} — ${esc(item.text)}</li>`).join('');
 $('photoReportPanel').hidden=rows.length===0;
}
async function checkPhotos(){
 verifiedAssets.clear();
 if(busy)return;busy=true;updateAuth();status('Checking chapter images on the published website…');
 try{
  const paths=photoPaths();let present=0,local=0;const rows=[];
  for(let i=0;i<paths.length;i+=6){
   const batch=await Promise.all(paths.slice(i,i+6).map(async path=>({path,ok:await photoOnline(path)})));
   for(const item of batch){
    if(item.ok)present++;
    else if(stagedPhotos.has(item.path))local++;
    rows.push({ok:item.ok,label:item.path.split('/').at(-1),text:item.ok?'Online ✓':stagedPhotos.has(item.path)?'Selected locally — needs GitHub upload':'Not found on published website'});
   }
  }
  photoReport(rows);
  const missing=paths.length-present;
  status(missing?`${present}/${paths.length} images online. ${missing} unavailable (${local} still staged locally). Use Find Existing Images to fix wrong paths, or upload the missing files.`:`All ${present} chapter images are online. You can Publish to Students.`,missing>0,missing===0);
 }finally{busy=false;updateAuth();}
}
function repairUsingNames(filenames,source){
 const plan=planImageRepairs(chapters,filenames,[]); // Explicit repair must include previously selected images (v89's double-prefix bug).
 if(plan.repairs.length){applyImageRepairs(plan);dropUnusedPhotos();dropUnusedAudio();markDirty();render();}
 const extra=plan.ambiguous.length?` ${plan.ambiguous.length} entries have multiple candidate filenames and were not changed.`:'';
 const other=plan.missing.length?` ${plan.missing.length} paths had no matching filename.`:'';
 status(`${source}: corrected ${plan.repairs.length} image paths in your draft.${extra}${other} Click Check Images to verify the actual website before publishing.`,plan.ambiguous.length>0||plan.missing.length>0,false);
 if(plan.ambiguous.length){
  repairChoices=plan.ambiguous;
  const panel=$('photoReport');
  $('photoReportPanel').hidden=false;
  panel.innerHTML=plan.ambiguous.map((item,index)=>`<li class="photo-bad photo-choice"><strong>${esc(item.label)}</strong><div class="choice-row"><img class="choice-preview" src="${esc('story/images/'+item.candidates[0])}" alt="Image candidate preview"><select data-repair-index="${index}" aria-label="Select correct photo">${item.candidates.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select><button data-action="apply-photo-fix" data-fix-index="${index}" type="button">Use this image</button></div></li>`).join('');
 }else repairChoices=[];
 return plan;
}
async function repairFromGithub(){
 if(busy)return;
 const repo=$('repoName').value.trim();
 if(!validGithubRepo(repo)){status('Enter your GitHub repository as username/repository, or use Choose Local Images Folder.',true);return;}
 localStorage.setItem(REPO_KEY,repo);
 busy=true;updateAuth();status('Finding existing images in GitHub…');
 try{
  const response=await fetch(`https://api.github.com/repos/${repo}/contents/docs/story/images`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  if(!response.ok)throw Error(response.status===404?'Cannot find a public docs/story/images folder in this repository. Check the repository name, or choose the local folder.':`GitHub returned HTTP ${response.status}. Choose the local image folder instead.`);
  const data=await response.json();if(!Array.isArray(data))throw Error('GitHub did not return an image directory.');
  onlineImageNames=data.filter(x=>x.type==='file').map(x=>x.name);
  repairUsingNames(onlineImageNames,'GitHub scan');
  renderFields();
 }catch(error){status('Could not scan GitHub: '+error.message+' You can use Choose Local Images Folder below.',true);}
 finally{busy=false;updateAuth();}
}
function repairFromLocalFolder(event){
 const files=[...(event.target.files||[])];event.target.value='';
 if(!files.length)return;
 const candidates=files.filter(f=>/\.(?:png|webp|jpg|jpeg|svg)$/i.test(f.name));
 selectedLocalFiles=new Map(candidates.map(f=>[f.name,f]));onlineImageNames=[...new Set([...onlineImageNames,...selectedLocalFiles.keys()])];
 const plan=repairUsingNames(candidates.map(f=>f.name),'Local folder scan');renderFields();
 // Do not stage or rename these files; they already have their existing filename.
 // If a candidate isn't on GitHub Pages, the checker will clearly report it.
 if(!plan.repairs.length && !plan.unchanged.length && !plan.ambiguous.length)status('No matching photos found in that folder. Please select your actual docs/story/images folder.',true);
}
// Repackage the existing photos with short names and update the draft only after
// every source image has been acquired successfully. Shared sprites remain shared.
async function shortenExistingImages(){
 if(busy)return;
 // Look up files already on GitHub when the teacher starts with this button.
 // A failed scan does not discard any draft or prevent local-folder fallback.
 if(!onlineImageNames.length){
  const repo=$('repoName').value.trim();
  if(validGithubRepo(repo)){
   try{const r=await fetch(`https://api.github.com/repos/${repo}/contents/docs/story/images`,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
    if(r.ok){const files=await r.json();if(Array.isArray(files))onlineImageNames=files.filter(x=>x.type==='file').map(x=>x.name);}
   }catch{}
  }
 }
 const plan=shortRenamePlan(chapters,[...onlineImageNames,...selectedLocalFiles.keys()]);
 if(!plan.length){status('Your chapter images already have short names.',false,true);return;}
 if(!confirm(`Prepare ${plan.length} short filenames from the pictures already referenced? This creates one ZIP and changes your unpublished draft after the ZIP is ready.`))return;
 busy=true;updateAuth();status(`Preparing ${plan.length} short-name images…`);
 try{
  const entries=[];let failures=[];
  const candidates=[...new Set([...onlineImageNames,...selectedLocalFiles.keys()])];
  const repair=planImageRepairs(chapters,candidates,[]);
  const corrected=new Map(repair.repairs.map(item=>[item.from,item.to]));
  for(const item of plan){
   const sourcePath=corrected.get(item.from)||item.from;
   const basename=sourcePath.split('/').at(-1);
   let blob=stagedPhotos.get(item.from)?.blob||stagedPhotos.get(sourcePath)?.blob||selectedLocalFiles.get(basename);
   if(!blob){
    // Existing files already deployed to GitHub Pages can be copied without
    // reselecting them. Do not fetch from unknown external sites.
    try{
     if(!safeStoryImage(sourcePath))throw Error('Unsafe path');
     const url=new URL(sourcePath,document.baseURI);const res=await fetch(url.href,{cache:'no-store'});
     if(!res.ok||!/^image\//.test(res.headers.get('content-type')||''))throw Error(`HTTP ${res.status}`);
     blob=await res.blob();
    }catch{failures.push(basename);continue;}
   }
   entries.push({name:'docs/'+item.to,blob});
  }
  if(failures.length)throw Error(`${failures.length} pictures could not be read from GitHub (${failures.slice(0,3).join(', ')}). Click Choose Local Images Folder to select the images you already uploaded, then try again.`);
  const zip=await photoPackZip(entries);
  // Only update draft after a successful ZIP build; leave old references intact on failure.
  const url=URL.createObjectURL(zip),link=document.createElement('a');link.href=url;link.download='RPG_Story_Short_Images.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  applyShortRename(chapters,plan);
  for(const item of plan){
   const old=stagedPhotos.get(item.from);
   if(old){stagedPhotos.delete(item.from);updateStaged(item.to,old.blob);URL.revokeObjectURL(old.url);}
  }
  dropUnusedPhotos();dropUnusedAudio();markDirty();render();writeDraft();
  status(`${plan.length} images renamed in the draft and saved locally. Extract RPG_Story_Short_Images.zip into the GitHub repository root, push once, then Check Images and Publish. Keep your old files until publishing succeeds.`,false,true);
 }catch(error){status('Short-name export stopped without changing your draft: '+error.message,true)}
 finally{busy=false;updateAuth()}
}
const verifiedAssets=new Set();
async function verifyImageFiles(payload){
 const paths=referencedImages(battleAssetChapters(payload.chapters)).filter(path=>!verifiedAssets.has(path)||stagedPhotos.has(path));
 if(!paths.length)return;
 const missing=[];
 for(let i=0;i<paths.length;i+=6){
  const group=await Promise.all(paths.slice(i,i+6).map(async img=>({img,ok:await photoOnline(img)})));
  missing.push(...group.filter(x=>!x.ok).map(x=>x.img));for(const x of group)if(x.ok&&!stagedPhotos.has(x.img))verifiedAssets.add(x.img);
 }
 if(missing.length){
  photoReport(missing.map(path=>({ok:false,label:path.split('/').at(-1),text:stagedPhotos.has(path)?'Only stored in browser — upload photo pack':'Not on published website; use Find Existing Images'})));
  throw Error(`${missing.length} chapter images cannot be found online. See the Photo Report below. Click Find Existing Images to repair old filenames; do not reselect or rename the photos.`);
 }
}
function battleStages(ch){return (ch?.stages||[]).filter(s=>s.type!=='story-only');}
function territoryName(id){return window.RPG_CONQUEST_MAP.name(id);}
function globalOperators(){return chapters.find(ch=>Object.keys(ch.conquest?.operators||{}).length)?.conquest.operators||{};}
const visibilityLabel={enabled:'Enabled',soon:'Coming Soon',hidden:'Hidden'};
function ensureConfig(ch){return ch.conquest ||= CQ.normalizeConfig(undefined,false,ch.id);}
function renderNav(){
 const atlas=window.RPG_CONQUEST_MAP;
 const row=(c,i)=>{const region=atlas.byId(c.id),count=battleStages(c).length;return `<div class="navrow"><button class="navitem cq-territory-nav" data-action="select-chapter" data-i="${i}" aria-current="${i===chapterIndex}" style="--faction:${region?.color||'#888'}"><span class="cq-swatch"></span><span>${esc(territoryName(c.id))}<small>${count} encounter${count===1?'':'s'} · ${visibilityLabel[CQ.visibility(c)]}</small></span></button><div class="navcontrols"><button data-action="chapter-up" data-i="${i}" ${i===0?'disabled':''} aria-label="Move territory up">▲</button><button data-action="chapter-down" data-i="${i}" ${i===chapters.length-1?'disabled':''} aria-label="Move territory down">▼</button></div></div>`;};
 $('chapterList').innerHTML=chapters.map(row).join('')+atlas.regions.filter(r=>!chapters.some(ch=>ch.id===r.id)).map(r=>`<div class="navrow"><button class="navitem cq-territory-nav" data-action="create-territory" data-id="${r.id}" style="--faction:${r.color}" ${retiredChapters.has(r.id)?'disabled':''}><span class="cq-swatch"></span><span>${esc(r.name)}<small>${retiredChapters.has(r.id)?'Retired ID':'+ Create territory · '+(CQ.visibility(r)==='hidden'?'Hidden':'Coming Soon')}</small></span></button></div>`).join('');
 const ch=currentChapter(),battles=battleStages(ch);
 $('stageList').innerHTML=battles.map((st,i)=>{const idx=ch.stages.indexOf(st);return `<div class="navrow"><button class="navitem" data-action="select-stage" data-i="${idx}" aria-current="${idx===stageIndex}">${String(i+1).padStart(2,'0')} · ${esc(st.title)}${i===battles.length-1?'<small class="cq-final">FINAL BOSS</small>':''}</button><div class="navcontrols"><button data-action="stage-up" data-i="${idx}" ${i===0?'disabled':''} aria-label="Move encounter up">▲</button><button data-action="stage-down" data-i="${idx}" ${i===battles.length-1?'disabled':''} aria-label="Move encounter down">▼</button></div></div>`;}).join('');
 $('addStage').disabled=!ch||busy;$('addChapter').disabled=busy||!atlas.regions.some(r=>!chapters.some(ch=>ch.id===r.id)&&!retiredChapters.has(r.id));
}
function selectFirstEncounter(){const ch=currentChapter();stageIndex=ch?.stages.findIndex(st=>st.type!=='story-only')??-1;}
function createTerritory(id){if(busy||chapters.some(c=>c.id===id)||retiredChapters.has(id)||chapters.length>=40)return;const ch={id,title:territoryName(id),subtitle:'',stages:[],conquest:CQ.normalizeConfig({operators:globalOperators()},false,id)};ch.stages.push(newStage(ch));chapters.push(ch);chapterIndex=chapters.length-1;stageIndex=0;markDirty();render();}
function renderEnhancements(ch){const cfg=ensureConfig(ch),r=cfg.rewards;return `<details class="cq-settings cq-enhancements" ${activeTab==='enhancements'?'open':''}><summary>Enhancement rewards <span>${r.max} max · ${r.types.length} types</span></summary><div class="cq-config-body"><div class="grid cq-rewards-grid"><div class="field"><label>Maximum rewards per operation</label><input type="number" data-reward-max min="0" max="6" step="1" value="${r.max}"></div>${r.weights.map((n,i)=>`<div class="field"><label>${i+4}★ chance (%)</label><input type="number" min="0" max="100" step="1" data-weight="${i}" value="${n}"></div>`).join('')}</div><p class="muted" id="rarity-total">Total: ${r.weights.reduce((a,b)=>a+b,0)}% (must equal 100%)</p><div class="cq-reward-pool">${CQ.pool.map(e=>`<label><input type="checkbox" data-reward-type="${e.id}" ${r.types.includes(e.id)?'checked':''}> <span>${esc(e.name)}<small>${e.label}</small></span></label>`).join('')}</div><div class="cq-reward-amounts"><div class="cq-reward-amount-row"><strong>Reward amount</strong><b>4★</b><b>5★</b><b>6★</b></div>${CQ.pool.map(e=>`<div class="cq-reward-amount-row"><span>${esc(e.label)}${e.id==='hp'||e.id==='recovery'?'':' (%)'}</span>${(r.values[e.id]||CQ.defaultRewardValues(e.id)).map((n,i)=>`<input aria-label="${esc(e.name)} ${i+4} star amount" type="number" min="1" max="${CQ.rewardMax(e.id)}" step="1" data-amount-id="${e.id}" data-amount-tier="${i}" value="${n??''}">`).join('')}</div>`).join('')}</div><button data-action="reset-rewards" type="button">Reset enhancements</button></div></details>`;}
function renderOperatorSettings(){const overrides=globalOperators();$('operatorFields').innerHTML=`<div class="editheading"><h2>Operator Stats · All Territories</h2><button type="button" data-action="reset-all-operators">Reset all</button></div><p class="muted">Conquest only. Starting HP includes existing HP passives (Mara and Vern). Other passive mechanics stay unchanged.</p><div class="cq-operator-grid">${Object.entries(CQ.names).map(([id,name])=>{const values={...CQ.defaultOperator(id),...overrides[id]};return `<section class="cq-operator"><div class="cq-operator-head"><img src="assets/profile-icons/${id}.webp" alt=""><strong>${esc(name)}</strong><button type="button" class="small" data-action="reset-operator" data-id="${id}">Reset</button></div><div class="cq-stat-grid">${Object.entries({hp:'HP',atk:'ATK %',def:'DEF %',crit:'CRIT %',critDmg:'CRIT DMG %'}).map(([k,label])=>`<label>${label}<input type="number" data-op="${id}" data-stat="${k}" min="${CQ.operatorRanges[k][0]}" max="${CQ.operatorRanges[k][1]}" step="1" value="${values[k]}" aria-label="${esc(name)} ${label}"></label>`).join('')}</div></section>`;}).join('')}</div>`;}
function updateOperators(id,key,value,reset=false){const operators=clone(globalOperators());if(reset){if(id)delete operators[id];else for(const k of Object.keys(operators))delete operators[k];}else{operators[id] ||= {};operators[id][key]=value;}for(const ch of chapters)ensureConfig(ch).operators=clone(operators);markDirty();}
function slideMarkup(st,phase){const items=st[phase];return `<section class="section"><div class="editheading"><h3>${phase==='intro'?'Before Battle / Intro':'After Battle / Outro'} · ${items.length} slides</h3><button data-action="add-slide" data-phase="${phase}" ${items.length>=50?'disabled':''}>+ Slide</button></div><div class="slides">${items.map((scene,i)=>`<div class="slide"><div><img data-scene-preview="${phase}:${i}" alt="Slide preview" src="${esc(scenePreview(scene))}"><div class="tag">Slide ${i+1}</div></div><div class="fields"><div class="field"><label>Image file</label><details class="advanced-image-path"><summary>${esc(scene.image?.split('/').at(-1)||'No image selected')}</summary><input data-scene-phase="${phase}" data-scene-index="${i}" data-scene-key="image" value="${esc(scene.image)}" placeholder="story/images/scene.webp" maxlength="180"></details></div><div class="field"><label>Caption / dialogue</label><textarea data-scene-phase="${phase}" data-scene-index="${i}" data-scene-key="caption" maxlength="300" rows="2">${esc(scene.caption)}</textarea></div><div class="slide-actions"><label class="filebutton small">Select Photo<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" data-photo-phase="${phase}" data-photo-index="${i}" hidden></label><button class="small" data-action="slide-up" data-phase="${phase}" data-i="${i}" ${i===0?'disabled':''}>Move up</button><button class="small" data-action="slide-down" data-phase="${phase}" data-i="${i}" ${i===items.length-1?'disabled':''}>Move down</button><button class="small danger" data-action="delete-slide" data-phase="${phase}" data-i="${i}">Delete</button></div></div></div>`).join('')}</div></section>`;}
function musicEditor(st){
 const chapterOne=String(currentChapter()?.id)==='1';
 const selected=st.battle?.bgmFile||'',src=audioPreview(selected||(chapterOne?CHAPTER_1_BATTLE_THEME:''));
 const description=chapterOne?'The Rift automatically uses ch1-battle.webm during battles. Choose a track below only to override this stage. Other modes are unaffected.':'Choose a shared track for this stage. Short names: bgm-1.webm, bgm-2.mp3, etc.';
 return `<div class="boss-sprite-panel music-panel"><h4>Battle Music (BGM)</h4><p class="muted">${description}</p>
 <div class="field"><label>Use Existing Music (reusable)</label><select data-music-select="bgmFile">${audioOptionsMarkup(selected)}</select></div>
 <div class="field"><details class="advanced-image-path"><summary>Advanced music path</summary><input data-battle-field="bgmFile" aria-label="Music path" value="${esc(selected)}" placeholder="story/audio/bgm-1.webm" maxlength="180"></details></div>
 <label class="music-loop"><input type="checkbox" data-battle-field="bgmLoop" ${st.battle?.bgmLoop!==false?'checked':''}> Loop during battle</label>
 <audio id="stage-bgm-preview" controls preload="none" ${src?`src="${esc(src)}"`:''} aria-label="Preview stage BGM"></audio>
 <div class="boss-sprite-actions"><label class="filebutton">Upload New Music<input type="file" data-audio-file accept="audio/*,.mp3,.m4a,.webm,.opus,.ogg,.wav" hidden></label><button type="button" data-action="remove-music" class="danger" ${!selected?'disabled':''}>${chapterOne?'Use The Rift Theme':'Remove from Stage'}</button></div>
 <p class="muted">MP3, M4A, WEBM/Opus, OGG or WAV · max 25 MB per file. Download Music Pack once, add to GitHub, then publish. No paid Firebase storage.</p></div>`;
}
function artEditor(st,key,title,kind,help){
 const value=st.battle?.[key]||'';
 return `<div class="boss-sprite-panel"><h4>${esc(title)}</h4><p class="muted">${esc(help)}</p><div class="boss-sprite-row">
 <img id="${kind}-preview" ${value?`src="${esc(assetPreview(value))}"`:''} alt="${esc(title)} preview" class="${kind==='bg'?'background-preview':''}">
 <div class="boss-sprite-controls">
 <div class="field"><label>Use Existing Image (reusable across stages)</label><select data-asset-select="${key}">${optionMarkup(value)}</select></div>
 <div class="field"><details class="advanced-image-path"><summary>Advanced image path</summary><input aria-label="${esc(title)} image path" data-battle-field="${key}" value="${esc(value)}" placeholder="story/images/${kind}-1.webp" maxlength="180"></details></div>
 <div class="boss-sprite-actions"><label class="filebutton">Upload New ${esc(title)}<input type="file" data-art-photo="${kind}" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden></label><button type="button" data-action="remove-art" data-art-key="${key}" class="danger" ${!value?'disabled':''}>Remove from Stage</button></div>
 <p class="muted">Using an existing image does not upload, rename, or copy it. Removing it from this stage won't delete the shared file.</p></div></div></div>`;
}
function bannerPreview(ch){
 const total=Math.max(1,battleStages(ch).length),atlas=window.RPG_CONQUEST_MAP,art=atlas.artPath(ch),artUrl=assetPreview(art);
 return [[0,false,'INTACT'],[Math.max(1,Math.floor(total/2)),false,'DAMAGED'],[total,true,'CAPTURED']].map(([cleared,captured,label])=>`<div class="cq-art-preview">${atlas.banner(ch,{total,cleared,segmented:true,captured,artUrl})}<small>${label}</small></div>`).join('');
}
function renderBannerSettings(ch){
 const cfg=ensureConfig(ch);const b=cfg.banner ||= {color:'',icon:'',art:'',animate:true};const region=window.RPG_CONQUEST_MAP.byId(ch.id);
 return `<details class="cq-settings" id="cq-banner-settings" ${activeTab==='banners'?'open':''}><summary>Banner Settings</summary><div class="cq-banner-editor"><div class="cq-banner-preview" id="cq-banner-preview">${bannerPreview(ch)}</div><div class="cq-config-body"><div class="field"><label>Faction color</label><input type="color" data-banner="color" value="${b.color||region?.color||'#9ba9be'}"></div><div class="field"><label>Banner image</label><select data-banner="art"><option value="">Bundled artwork / none</option>${assetOptions(b.art).map(path=>`<option value="${esc(path)}" ${b.art===path?'selected':''}>${esc(path.split('/').at(-1))}</option>`).join('')}</select><label class="filebutton">Upload banner<input type="file" accept="image/png,image/jpeg,image/webp" data-banner-upload hidden></label></div><label><input type="checkbox" data-banner="animate" ${b.animate!==false?'checked':''}> Destruction animation</label><p class="muted">Download Photo Pack before publishing new uploads.</p></div></div></details>`;
}
async function addBannerArt(event){
 const file=event.target.files?.[0];event.target.value='';const ch=currentChapter();if(!file||!ch||busy)return;
 try{const blob=await optimizePhoto(file);if(currentChapter()!==ch)throw Error('Territory changed. Select artwork again.');if(stagedPhotos.size>=250)throw Error('Photo pack limit reached.');const ext=imageExt(blob);if(!ext)throw Error('Unsupported image format.');const path=storyPath(nextSharedName('banner',assetOptions().concat(onlineImageNames),ext));ensureConfig(ch).banner.art=path;updateStaged(path,blob);dropUnusedPhotos();markDirty();renderFields();$('cq-banner-settings').open=true;status('Banner artwork added. Download Photo Pack before publishing.',false,true);}catch(error){status(error.message,true);}
}
function renderFields(){
 const previousScope=liveBalance[`stage:story:${currentStage()?.id}`];if(!previousScope)liveBalance={};
 // A preview must stop when changing stages; detached audio elements can keep playing.
 const previousAudio=$('stage-bgm-preview');if(previousAudio){previousAudio.pause();previousAudio.removeAttribute('src');previousAudio.load();}
 const ch=currentChapter(),st=currentStage();
 if(!ch){$('chapterFields').textContent='Select a territory.';$('stageFields').textContent='';return;}
 const region=window.RPG_CONQUEST_MAP.byId(ch.id),cfg=ensureConfig(ch),battles=battleStages(ch);
 $('chapterFields').innerHTML=`<div class="cq-territory-heading" style="--faction:${region?.color||'#888'}"><div><div class="cq-kicker">TERRITORY ${esc(ch.id)} · ${battles.length} ENCOUNTERS</div><h2>${esc(territoryName(ch.id))}</h2></div><label class="cq-enable">Visibility <select data-territory-visibility aria-label="Territory visibility">${CQ.visibilityValues.map(v=>`<option value="${v}" ${CQ.visibility(ch)===v?'selected':''}>${visibilityLabel[v]}</option>`).join('')}</select></label></div>${renderEnhancements(ch)}${renderBannerSettings(ch)}`;
 if(!st||st.type==='story-only'){$('stageFields').innerHTML='<p class="muted">No battle encounter. Click + Encounter to add one.</p>';$('slidesEditor').textContent='';return;}
 const numericFields=Object.entries(STAGE_FIELDS).filter(([key])=>!(key in DAMAGE_DEFAULTS)).map(([key,[label,min,max,step]])=>{
  const own=st.battle?.[key];const actual=own??inherited(key,st).value;
  return `<div class="field"><label for="battle-${key}">${esc(label)}</label><input id="battle-${key}" data-battle-field="${key}" type="number" min="${showDamage(key,min)}" max="${showDamage(key,max)}" step="${showDamage(key,step)}" value="${esc(showDamage(key,actual))}"><span class="muted" data-current-field="${key}">Current: ${esc(showDamage(key,actual))}</span></div>`;
 }).join('');
 $('stageFields').innerHTML=`<section class="section"><div class="editheading"><h2>${battles.at(-1)===st?'Final Boss':'Encounter'} · ${esc(st.id)}</h2><button class="danger" data-action="delete-stage">Delete Encounter</button></div>
 <div class="grid"><div class="field"><label for="st-title">Encounter name</label><input id="st-title" data-stage-field="title" maxlength="85" value="${esc(st.title)}"></div><div class="field"><label for="st-template">Battle template</label><select id="st-template" data-battle-field="template">${[1,2,3,4,5].map(n=>`<option value="${n}" ${Number(st.battle?.template||1)===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
 <div class="section"><h3>Battle Settings</h3><p class="muted" id="current-status"></p>
 <div class="grid"><div class="field"><label for="st-bossname">Enemy name</label><input id="st-bossname" data-battle-field="bossName" maxlength="40" value="${esc(st.battle?.bossName||'')}"></div><div class="field"><label for="st-hp">Enemy HP</label><input id="st-hp" type="number" min="10" max="9990" step="10" data-battle-field="bossHp" value="${esc((st.battle?.bossHp??20)*10)}"><span class="muted">In-game HP · increments of 10</span></div>${numericFields}</div>
 ${damageSettings(st)}
 ${artEditor(st,'bossSprite','Boss Sprite','boss','Reusable boss art.')} 
 ${artEditor(st,'battleBackground','Battle Background','bg','Reusable background.')}
 ${musicEditor(st)} </div>
 ${String(ch.id)==='1'?`<div class="section chapter-special-editor"><div class="editheading"><h3>The Rift · Special Mechanics</h3><button type="button" data-action="copy-ch1-mechanics">Copy to all Rift encounters</button></div><p class="muted">Delirium requires Sleepy. Darkness pauses new spawns.</p>${mechanicMarkup(st,true)}</div>`:''}
 <div class="section"><div class="editheading"><h3>Word Mechanics</h3><span class="muted"></span></div>${mechanicMarkup(st)}<p class="muted">New mechanics require a code module.</p></div>
 <p class="muted">Encounter ID ${esc(st.id)} is permanent. Changes apply on the next Conquest map opening.</p></section>`;
 fillLiveValues()
 const limits=st.stars?.damageMax||[0,1,2,3];
 $('stageFields').insertAdjacentHTML('beforeend',`<details class="cq-settings"><summary>Star rating (optional)</summary><div class="grid cq-config-body">${limits.map((n,i)=>`<div class="field"><label>${4-i}★ maximum damage</label><input type="number" min="0" max="990" step="10" data-star-index="${i}" value="${esc(n*10)}"></div>`).join('')}</div></details>`);
 $('slidesEditor').textContent='';
 for(const [id,title] of [['boss-preview','Boss sprite'],['bg-preview','Battle background']]){const img=$(id);if(img)img.addEventListener('error',()=>{img.removeAttribute('src');img.alt=title+' not found on website.';});}
 for(const img of $('slidesEditor').querySelectorAll('img[data-scene-preview]'))img.addEventListener('error',()=>{img.removeAttribute('src');img.alt='Image not found. Add it to docs/story/images/ first.';});
}
function render(){if(currentStage()?.type==='story-only')selectFirstEncounter();renderNav();renderFields();if(activeTab==='operators')renderOperatorSettings();updateAuth();if(activeTab==='encounters')void loadLiveValues();}
function moveSelection(kind,index,d){const arr=kind==='chapter'?chapters:currentChapter()?.stages;if(!arr||!swap(arr,index,index+d))return;if(kind==='chapter')chapterIndex=index+d;else stageIndex=index+d;markDirty();render();}
function handleNavClick(event){const btn=event.target.closest('button[data-action]');if(!btn||busy)return;const a=btn.dataset.action,i=Number(btn.dataset.i);
 if(a==='create-territory'){createTerritory(btn.dataset.id);return;}
 if(a==='select-chapter'){chapterIndex=i;selectFirstEncounter();render();return;}
 if(a==='select-stage'){stageIndex=i;renderFields();renderNav();void loadLiveValues();return;}
 if(a==='chapter-up')moveSelection('chapter',i,-1);
 if(a==='chapter-down')moveSelection('chapter',i,1);
 if(a==='stage-up'||a==='stage-down'){const ch=currentChapter(),b=battleStages(ch),pos=b.indexOf(ch.stages[i]),other=b[pos+(a==='stage-up'?-1:1)];if(!other)return;const j=ch.stages.indexOf(other);[ch.stages[i],ch.stages[j]]=[ch.stages[j],ch.stages[i]];stageIndex=j;markDirty();render();}
}
function handleEditorInput(event){const t=event.target,st=currentStage(),ch=currentChapter();if(!ch||busy)return;
 if(t.dataset.banner){const b=ensureConfig(ch).banner;b[t.dataset.banner]=t.type==='checkbox'?t.checked:t.value;markDirty();if(t.dataset.banner==='art')dropUnusedPhotos();$('cq-banner-preview').innerHTML=bannerPreview(ch);return;}
 if(t.dataset.territoryVisibility!==undefined){if(!CQ.visibilityValues.includes(t.value))return;const config=ensureConfig(ch);config.visibility=t.value;config.enabled=t.value==='enabled';markDirty();renderNav();return;}
 if(t.dataset.amountId){const r=ensureConfig(ch).rewards;r.values[t.dataset.amountId] ||= CQ.defaultRewardValues(t.dataset.amountId);r.values[t.dataset.amountId][Number(t.dataset.amountTier)]=t.value===''?null:Number(t.value);markDirty();return;}
 if(t.dataset.rewardMax!==undefined||t.dataset.weight!==undefined||t.dataset.rewardType!==undefined){const r=ensureConfig(ch).rewards;if(t.dataset.rewardMax!==undefined)r.max=t.value===''?null:Number(t.value);else if(t.dataset.weight!==undefined){r.weights[Number(t.dataset.weight)]=t.value===''?null:Number(t.value);$('rarity-total').textContent=`Total: ${r.weights.reduce((a,b)=>a+(b||0),0)}% (must equal 100%)`;}else{r.types=t.checked?[...new Set([...r.types,t.dataset.rewardType])]:r.types.filter(id=>id!==t.dataset.rewardType);}markDirty();return;}
 if(t.dataset.op){updateOperators(t.dataset.op,t.dataset.stat,t.value===''?null:Number(t.value));return;}
 if(!st||st.type==='story-only')return;
 if(t.dataset.chapterField)ch[t.dataset.chapterField]=t.value;
 else if(t.dataset.stageField)st[t.dataset.stageField]=t.value;
 else if(t.dataset.musicSelect){st.battle.bgmFile=t.value;dropUnusedAudio();markDirty();renderFields();return;}
 else if(t.dataset.assetSelect){st.battle[t.dataset.assetSelect]=t.value;dropUnusedPhotos();markDirty();renderFields();return;}
 else if(t.dataset.battleField){st.battle[t.dataset.battleField]=t.type==='checkbox'?t.checked:t.type==='number'?(t.value===''?null:Number(t.value)/damageScale(t.dataset.battleField)):t.dataset.battleField==='template'?Number(t.value):t.value;if(t.dataset.battleField==='bgmFile'){dropUnusedAudio();const a=$('stage-bgm-preview');if(a){a.pause();if(safeStoryAudio(t.value))a.src=audioPreview(t.value);else if(!t.value&&String(currentChapter()?.id)==='1')a.src=audioPreview(CHAPTER_1_BATTLE_THEME);else a.removeAttribute('src');}}else if(['bossSprite','battleBackground'].includes(t.dataset.battleField)){dropUnusedPhotos();const img=$(t.dataset.battleField==='bossSprite'?'boss-preview':'bg-preview');if(img){if(safeStoryImage(t.value)){img.src=assetPreview(t.value)}else img.removeAttribute('src');}}else {fillLiveValues();if(t.dataset.battleField==='template')void loadLiveValues();}}
 else if(t.dataset.damagePanic){
  const value=t.value===''?null:Number(t.value)/10;
  st.battle.mechanics ||= {};st.battle.mechanics.panic ||= {};
  if(value===null)delete st.battle.mechanics.panic.damage;else st.battle.mechanics.panic.damage=value;
 }
 else if(t.dataset.mechanicId){
  const m=catalog().find(x=>x.id===t.dataset.mechanicId),field=m?.fields.find(x=>x.key===t.dataset.mechanicKey);if(!field)return;
  const value=field.type==='boolean'?t.value==='true':Number(t.value);
  if(field.type==='number'&&(!Number.isFinite(value)||value<field.min||value>field.max)){status('Mechanic field must be within its allowed range.',true);return}
  st.battle.mechanics ||= {};st.battle.mechanics[m.id] ||= {};st.battle.mechanics[m.id][field.key]=value;
 }
 else if(t.dataset.unlockField){st.unlock ||= {stageId:'',minStars:0};st.unlock[t.dataset.unlockField]=t.dataset.unlockField==='minStars'?Number(t.value):t.value;
 }else if(t.dataset.starIndex!==undefined){st.stars ||= {damageMax:[0,1,2,3]};st.stars.damageMax[Number(t.dataset.starIndex)]=t.value===''?null:Number(t.value)/10;
 }else if(t.dataset.scenePhase){const scene=st[t.dataset.scenePhase]?.[Number(t.dataset.sceneIndex)];if(!scene)return;scene[t.dataset.sceneKey]=t.value;
  if(t.dataset.sceneKey==='image'){dropUnusedPhotos();const img=$('slidesEditor').querySelector(`img[data-scene-preview="${t.dataset.scenePhase}:${t.dataset.sceneIndex}"]`);if(img){if(safeStoryImage(t.value)){img.src=t.value;}else img.removeAttribute('src');}}
 }else return;
 markDirty();
 if(t.dataset.chapterField==='title'||t.dataset.stageField==='title')renderNav();
}
function editorAction(event){const btn=event.target.closest('button[data-action]');if(!btn||busy)return;const a=btn.dataset.action,ch=currentChapter(),st=currentStage(),phase=btn.dataset.phase,i=Number(btn.dataset.i);
 if(a==='reset-rewards'){if(!ch)return;ensureConfig(ch).rewards=CQ.normalizeConfig(undefined).rewards;markDirty();renderFields();return;}
 if(a==='reset-all-operators'||a==='reset-operator'){if(a==='reset-all-operators'&&!confirm('Reset all Conquest operator stats?'))return;updateOperators(a==='reset-operator'?btn.dataset.id:null,null,null,true);renderOperatorSettings();return;}
 if(a==='copy-damage'||a==='reset-damage'){
  if(!st||!ch)return;
  const values={...DAMAGE_DEFAULTS};let panic=1;
  if(a==='copy-damage'){
   for(const key of Object.keys(values)){
    const input=$('stageFields').querySelector(`[data-battle-field="${key}"]`),v=Number(input?.value)/damageScale(key);
    const [,min,max]=STAGE_FIELDS[key];
    if(!input||!input.value||!Number.isInteger(v)||v<min||v>max){status(`Enter whole damage values within the allowed range before copying.`,true);return;}
    values[key]=v;
   }
   if(ch.id==='1'){
    const input=$('stageFields').querySelector('[data-damage-panic]');panic=Number(input?.value)/10;
    if(!input?.value||!Number.isInteger(panic)||panic<1||panic>10){status('Panic damage must be 10–100 in increments of 10.',true);return;}
   }
   if(!confirm(`Copy damage values from ${st.id} to all encounters in ${territoryName(ch.id)}?`))return;
  }
  const targets=a==='copy-damage'?ch.stages.filter(x=>x.type!=='story-only'):[st];
  for(const target of targets){
   Object.assign(target.battle,values);
   if(ch.id==='1'){target.battle.mechanics ||= {};target.battle.mechanics.panic ||= {};target.battle.mechanics.panic.damage=panic;}
  }
  markDirty();renderFields();status(a==='copy-damage'?`Damage copied to ${targets.length} battle stages. Save Draft or Publish.`:'Damage reset to defaults. Save Draft or Publish.',false,true);return;
 }
 if(a==='copy-ch1-mechanics'){
  if(ch.id!=='1'||!st)return;
  if(!confirm(`Copy Sleepy, Delirium and Panic from ${st.id} to the other Rift encounters? Existing settings for those three mechanics will be replaced.`))return;
  const ids=['sleepy','delirium','panic'];const defs=catalog();
  for(const target of battleStages(ch)){if(target===st)continue;target.battle.mechanics ||= {};
   for(const id of ids){const def=defs.find(x=>x.id===id);if(!def)continue;target.battle.mechanics[id]={};
    for(const field of def.fields)target.battle.mechanics[id][field.key]=st.battle.mechanics?.[id]?.[field.key]??field.default;
   }
  }markDirty();renderFields();status(`Chapter 1 mechanics copied from ${st.id} to ${ch.stages.length-1} other stages. Save Draft or Publish to apply.`,false,true);return;
 }
 if(a==='delete-chapter'){
  if(chapters.length===1){status('At least one chapter must remain.',true);return;}
  if(!confirm(`Delete Chapter ${ch.id} and all its stages from the next publication?`))return;
  retiredChapters.add(ch.id);ch.stages.forEach(s=>retiredStages.add(s.id));chapters.splice(chapterIndex,1);chapterIndex=Math.min(chapterIndex,chapters.length-1);stageIndex=0;
 }else if(a==='delete-stage'){
  if(battleStages(ch).length===1){status('Keep at least one encounter or disable this territory.',true);return;}
  if(!confirm(`Delete stage ${st.id} from the next publication? Existing progress for this stage will remain in student records.`))return;
  retiredStages.add(st.id);ch.stages.splice(stageIndex,1);selectFirstEncounter();
 }else if(a==='remove-art'&&['bossSprite','battleBackground'].includes(btn.dataset.artKey)){st.battle[btn.dataset.artKey]='';
 }else if(a==='remove-music'){st.battle.bgmFile='';
 }else if(a==='add-slide'){st[phase].push({image:'',caption:''});
 }else if(a==='delete-slide'){st[phase].splice(i,1);
 }else if(a==='slide-up'){if(!swap(st[phase],i,i-1))return;
 }else if(a==='slide-down'){if(!swap(st[phase],i,i+1))return;
 }else return;
 dropUnusedPhotos();dropUnusedAudio();markDirty();render();
}
function setLoaded(manifest,revision=0){const normalized=cleanStory(manifest);chapters=normalized.chapters;loadedRevision=revision;chapterIndex=0;stageIndex=0;dirty=false;}
function restoreRetired(source){retiredStages=new Set((source.retiredStageIds||[]).filter(s=>/^[1-9]\d{0,3}-[1-9]\d{0,3}$/.test(String(s))));retiredChapters=new Set((source.retiredChapterIds||[]).filter(s=>/^[1-9]\d{0,3}$/.test(String(s))));}
// Firebase is a publishing dependency, not a reason to block local Story editing.
// Never allow a disconnected fallback to publish over unknown cloud revisions.
// Opening the local editor must never wait for Firebase or Google authentication.
// Only a deliberate Publish request may write to Firestore.
let initialDraftRecovered=false;
async function loadLocalChapters(){
 let draft=null,manifest=null,source='built-in chapters';
 try{
  const raw=localStorage.getItem(DRAFT_KEY);
  if(raw){try{const candidate=JSON.parse(raw);cleanStory(candidate);draft=candidate;}catch(error){console.warn('Local Story draft invalid:',error);}}
 }catch(error){console.warn('Local Story draft unavailable:',error);}
 try{
  const response=await fetch('story/chapters.json',{cache:'no-store'});
  if(!response.ok)throw Error('Built-in Story chapters could not be downloaded (HTTP '+response.status+').');
  manifest=await response.json();
  cleanStory(manifest);
 }catch(error){
  if(!draft){status('Cannot open Story chapters: '+errorMessage(error)+'. Check that docs/story/chapters.json exists in GitHub.',true);return false;}
  console.warn('Using saved draft without built-in Story chapters:',error);
 }
 const chosen=draft||manifest;
 try{
  setLoaded(chosen,Number(draft?.revision)||0);
  restoreRetired(chosen);
  publishedOrder=currentOrder();
  const requested=new URLSearchParams(location.search).get('stage');const ci=chapters.findIndex(c=>c.stages.some(st=>st.id===requested));if(ci>=0){chapterIndex=ci;stageIndex=chapters[ci].stages.findIndex(st=>st.id===requested);}
  initialDraftRecovered=Boolean(draft);
  render();
  if(window.RPG_STORY_EDITOR_BOOT)window.RPG_STORY_EDITOR_BOOT.loaded=true;
  status(draft?'Saved draft loaded. Checking Firebase connection in the background…':'Territories loaded. Checking Firebase connection in the background…',false,true);
  return true;
 }catch(error){status('Could not display Story chapters: '+errorMessage(error),true);return false;}
}
async function syncInitialCloud(){
 try{
  const remote=await boundedCloudRead(9000);
  cloudAvailable=true;
  if(remote){
   // Do not replace a saved draft or edits made while connecting.
   if(!initialDraftRecovered&&!dirty&&!localStorage.getItem(DRAFT_KEY)){
    const chosenStage=currentStage()?.id;
    const cleaned=cleanStory(remote);
    setLoaded(cleaned,Number(remote.revision)||0);
    restoreRetired(remote);publishedOrder=currentOrder();
    if(chosenStage){
     const nextChapter=chapters.findIndex(ch=>ch.stages.some(st=>st.id===chosenStage));
     if(nextChapter>=0){chapterIndex=nextChapter;stageIndex=chapters[nextChapter].stages.findIndex(st=>st.id===chosenStage);}
    }
    render();
   }else{
    publishedOrder=remote.chapters.flatMap(ch=>ch.stages.map(st=>st.id));
   }
  }
  if(initialDraftRecovered||dirty||localStorage.getItem(DRAFT_KEY)){
   status('Firebase connected. Your local draft was kept. Review changes before publishing.',false,true);
  }else{
   status(remote?'Published Conquest loaded (revision '+loadedRevision+').':'Territories ready. No published Conquest exists yet.',false,true);
  }
 }catch(error){
  cloudAvailable=false;
  status('Territories ready for editing. Firebase could not connect: '+errorMessage(error)+'. Save Draft and Export JSON work; publishing will require Reload Published.',true);
 }finally{updateAuth();}
}
async function boundedCloudRead(timeoutMs=10000){
 let timer;
 try{
  return await Promise.race([
   loadPublishedStory(),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Firebase did not respond within 10 seconds.')),timeoutMs);})
  ]);
 }finally{clearTimeout(timer);}
}
async function loadRemote(useDraft=false,{requireCloud=false}={}){
 busy=true;updateAuth();status('Loading territories…');
 try{
  let remote=null,cloudIssue=null,missingRule=false,cloudOnline=false;
  try{remote=await boundedCloudRead();cloudOnline=true;}
  catch(error){cloudIssue=error;missingRule=missingStoryRule(error);}
  // "Reload Published" must never silently replace edits with built-in defaults
  // when the cloud read failed. Keep current data and any saved draft intact.
  if(requireCloud&&!cloudOnline){
   cloudAvailable=false;
   status('Could not reload published Conquest: '+errorMessage(cloudIssue)+'. Your current editor content and saved draft were kept.',true);
   return false;
  }
  let source=remote;
  if(!source){
   try{source=await fetch('story/chapters.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Built-in Story chapters not found.');return r.json();});}
   catch(error){
    // Offline users can still recover an existing local draft if the JSON
    // bootstrap is also unavailable. They cannot publish until cloud is back.
    if(!useDraft)throw error;
    try{const saved=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');if(!saved?.chapters?.length)throw error;source=saved;}
    catch{throw error;}
    cloudIssue ||= error;
   }
  }
  // Validate before changing the active editor state.
  const normalized=cleanStory(source);
  setLoaded(normalized,Number(remote?.revision)||0);
  restoreRetired(remote||{});publishedOrder=currentOrder();cloudAvailable=cloudOnline;
  let draftRecovered=false;
  if(useDraft){
   try{
    const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');
    if(draft&&Array.isArray(draft.chapters)&&draft.chapters.length){
     const cleaned=cleanStory(draft);
     chapters=cleaned.chapters;restoreRetired(draft);loadedRevision=Number(draft.revision)||0;draftRecovered=true;
    }
   }catch(e){console.warn('Story draft was not valid:',e);}
  }
  render();
  if(!cloudOnline){
   const reason=missingRule?'The Firestore Story rule is missing or access is denied.':errorMessage(cloudIssue||Error('Firebase unavailable'));
   status(`Offline editor: ${draftRecovered?'local draft':'built-in chapters'} loaded. Save Draft and Export JSON work. Publishing is disabled until you reconnect and use Reload Published. ${reason}`,true);
  }else if(draftRecovered)status('Local draft restored. Students still see the published version.',false,true);
  else status(remote?`Published Conquest loaded (revision ${loadedRevision}).`:'Loaded initial Chapter 1 from the game files. No cloud Story published yet.',false,true);
  if(window.RPG_STORY_EDITOR_BOOT)window.RPG_STORY_EDITOR_BOOT.loaded=true;
  return true;
 }catch(e){status('Story failed to load: '+errorMessage(e)+'. Try Import JSON if you have a backup.',true);return false;}
 finally{busy=false;updateAuth();}
}
async function signIn(){
 ++authReadId;
 try{teacher=await googleTeacher();if(!checkAuth())throw Error('This Google account is not the authorized teacher.');
  status(cloudAvailable?'Authorized teacher signed in.':'Authorized teacher signed in. Firebase Story is still disconnected; reload published data before publishing.',false,true);
  updateAuth();void loadLiveValues();
 }catch(e){status(errorMessage(e),true);try{teacher=await currentTeacher();}catch{teacher=null;}updateAuth();}
}
async function publish(){
 if(!cloudAvailable||!cloud||!db){status('Firebase is not connected. Use Reload Published before publishing.',true);return;}
 if(!checkAuth()){status('Sign in using the authorized teacher Google account.',true);return;}
 let payload;try{payload=cleanStory({chapters});}catch(e){status(e.message,true);return;}
 const previous=publishedOrder.join('|'),newOrder=currentOrder().join('|');
 if(previous!==newOrder&&loadedRevision>0&&!confirm('You changed or deleted published stage order. Unlock progression may change for existing students. Publish anyway?'))return;
 if(!confirm(`Publish ${chapters.length} territories / ${chapters.reduce((n,c)=>n+battleStages(c).length,0)} encounters to students?`))return;
 busy=true;updateAuth();status('Checking chapter photos and music…');
 try{
  await verifyImageFiles(payload);
  const missingMusic=[];const paths=referencedMusic(battleAssetChapters(payload.chapters)).filter(path=>!verifiedAssets.has(path)||stagedAudio.has(path));
  for(let i=0;i<paths.length;i+=6){const group=await Promise.all(paths.slice(i,i+6).map(async path=>({path,ok:await checkMusicOnline(path)})));missingMusic.push(...group.filter(item=>!item.ok).map(item=>item.path));for(const item of group)if(item.ok&&!stagedAudio.has(item.path))verifiedAssets.add(item.path);}
  if(missingMusic.length){showMusicReport(missingMusic.map(path=>({path,ok:false,text:stagedAudio.has(path)?'Only in browser — download and upload Music Pack':'Not found on GitHub Pages'})));throw Error(`${missingMusic.length} music file(s) are not yet online. Download Music Pack and push to GitHub first.`);}
  status('Publishing to Firebase…');
  const reference=doc(db,'storyContent','published');let next;
  if(currentOrder().some(id=>retiredStages.has(id)))throw Error('The story contains a retired stage ID. Change the imported file to use a new ID, or undo the deletion.');
  if(chapters.some(ch=>retiredChapters.has(ch.id)))throw Error('The story contains a retired chapter ID. Change the imported file to use a new ID.');
  const stageIds=[...retiredStages];
  const chapterIds=[...retiredChapters];
  if(stageIds.length>2000||chapterIds.length>1000)throw Error('Too many retired IDs.');
  await runTransaction(db,async tx=>{
   const snapshot=await tx.get(reference);const rev=snapshot.exists()?Number(snapshot.data().revision)||0:0;
   if(rev!==loadedRevision)throw Error('Published Conquest changed in another tab. Export your draft, reload published content, and review before trying again.');
   next=rev+1;
   tx.set(reference,{...payload,revision:next,retiredStageIds:stageIds,retiredChapterIds:chapterIds,updatedAt:serverTimestamp()});
  });
  loadedRevision=next;publishedOrder=currentOrder();dirty=false;clearTimeout(draftTimer);try{localStorage.removeItem(DRAFT_KEY);}catch{}
  status(`Published revision ${next}. Students receive it when they next open Conquest.`,false,true);
 }catch(e){status('Publish failed: '+errorMessage(e),true)}finally{busy=false;updateAuth();}
}
function exportFile(){try{const payload=cleanStory({chapters});const output={...payload,revision:loadedRevision,retiredStageIds:[...retiredStages],retiredChapterIds:[...retiredChapters]};const blob=new Blob([JSON.stringify(output,null,2)+'\n'],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='conquest-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status('JSON exported.',false,true);}catch(e){status(e.message,true);}}
async function importFile(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;
 try{if(file.size>750000)throw Error('JSON file exceeds 750 KB.');const incoming=JSON.parse(await file.text());const normalized=cleanStory(incoming);
  if(!confirm(`Replace the editor draft with ${normalized.chapters.length} imported chapters? Nothing is published yet.`))return;
  clearPhotoSelection();clearAudioSelection();chapters=normalized.chapters;restoreRetired(incoming);chapterIndex=0;stageIndex=0;markDirty();render();
 }catch(e){status('Import failed: '+e.message,true);}}
async function boot(){
 const tab=name=>{activeTab=name;document.body.dataset.editorTab=name;document.querySelector('.layout').hidden=['operators','assets'].includes(name);$('operatorFields').hidden=name!=='operators';document.querySelector('.photo-manager').hidden=name!=='assets';if(name==='operators')renderOperatorSettings();if(name==='encounters'&&chapters.length)void loadLiveValues();if(['enhancements','banners'].includes(name))for(const details of $('chapterFields').querySelectorAll('details'))details.open=true;if(name==='assets')document.querySelector('.photo-manager details').open=true;for(const btn of document.querySelectorAll('[data-editor-tab]'))btn.setAttribute('aria-pressed',String(btn.dataset.editorTab===name));};
 for(const btn of document.querySelectorAll('[data-editor-tab]'))btn.onclick=()=>tab(btn.dataset.editorTab);
 const initial=new URLSearchParams(location.search).get('tab');tab(['operators','assets','enhancements','banners'].includes(initial)?initial:'encounters');
 $('chapterList').addEventListener('click',handleNavClick);$('stageList').addEventListener('click',handleNavClick);
 $('chapterFields').addEventListener('input',handleEditorInput);$('chapterFields').addEventListener('change',e=>{if(e.target.matches('[data-banner-upload]'))void addBannerArt(e);});$('operatorFields').addEventListener('input',handleEditorInput);$('operatorFields').addEventListener('click',editorAction);$('stageFields').addEventListener('input',handleEditorInput);$('slidesEditor').addEventListener('input',handleEditorInput);
 $('stageFields').addEventListener('change',event=>{if(event.target.matches('input[type=file][data-art-photo]'))void addSharedArt(event,event.target.dataset.artPhoto);else if(event.target.matches('input[type=file][data-audio-file]'))void addMusic(event);else if(event.target.matches('select[data-asset-select],select[data-music-select],input[data-battle-field=bgmLoop],input[data-battle-field=cometEnabled],input[data-battle-field=shootingStarEnabled],select[data-battle-field=template]'))handleEditorInput(event);});
 $('slidesEditor').addEventListener('change',event=>{if(event.target.matches('input[type=file][data-photo-phase]'))void addPhoto(event);});
 $('chapterFields').addEventListener('click',editorAction);$('stageFields').addEventListener('click',editorAction);$('slidesEditor').addEventListener('click',editorAction);
 $('addChapter').onclick=()=>{const next=window.RPG_CONQUEST_MAP.regions.find(r=>!chapters.some(c=>c.id===r.id)&&!retiredChapters.has(r.id));if(next)createTerritory(next.id);};
 $('addStage').onclick=()=>{const ch=currentChapter();if(!ch||busy)return;if(ch.stages.length>=60){status('Maximum 60 encounters per territory.',true);return;}ch.stages.push(newStage(ch));stageIndex=ch.stages.length-1;markDirty();render();};
 $('saveDraft').onclick=()=>{try{writeDraft()}catch(e){status('Could not save local draft: '+e.message,true)}};
 $('downloadPhotos').onclick=downloadPhotos;
 $('downloadAudio').onclick=downloadMusic;$('checkMusic').onclick=()=>void checkMusic();$('findMusic').onclick=()=>void findExistingMusic();
 $('checkPhotos').onclick=()=>void checkPhotos();
 $('repairGithub').onclick=()=>void repairFromGithub();
 $('repairFolder').onchange=repairFromLocalFolder;
 $('shortenNames').onclick=()=>void shortenExistingImages();
 $('photoReport').addEventListener('change',e=>{
  if(e.target.matches('select[data-repair-index]')){
   const preview=e.target.closest('.choice-row')?.querySelector('img');
   if(preview)preview.src='story/images/'+e.target.value;
  }
 });
 $('photoReport').addEventListener('click',e=>{
  const btn=e.target.closest('button[data-action="apply-photo-fix"]');if(!btn)return;
  const item=repairChoices[Number(btn.dataset.fixIndex)];
  const select=btn.closest('.choice-row')?.querySelector('select');
  if(!item||!select||!item.candidates.includes(select.value))return;
  if(item.kind==='boss')item.stage.battle.bossSprite='story/images/'+select.value;
  else item.stage[item.kind][item.index].image='story/images/'+select.value;
  btn.closest('.photo-choice')?.remove();markDirty();render();
  status(`Assigned ${item.label} to ${select.value}. Click Check Images, then Publish to Students.`,false,true);
 });
 $('repoName').value=localStorage.getItem(REPO_KEY)||githubRepoGuess(location);
 $('repoName').addEventListener('change',()=>{if(validGithubRepo($('repoName').value))localStorage.setItem(REPO_KEY,$('repoName').value.trim());});
 $('export').onclick=exportFile;$('import').onchange=importFile;$('publish').onclick=publish;
 $('google').onclick=signIn;$('signout').onclick=async()=>{++authReadId;try{await teacherSignOut();teacher=null;++liveRequestId;balanceCache.clear();liveBalance={};updateAuth();fillLiveValues();status('Signed out.')}catch(e){status(errorMessage(e),true)}};
 $('reload').onclick=async()=>{balanceCache.clear();verifiedAssets.clear();if(dirty||localStorage.getItem(DRAFT_KEY)){if(!confirm('Discard draft and reload published territories?'))return;}if(await loadRemote(false,{requireCloud:true})){clearTimeout(draftTimer);localStorage.removeItem(DRAFT_KEY);clearPhotoSelection();clearAudioSelection();}};
 updateAuth();
 if(!await loadLocalChapters())return;
 // Both tasks are independent of local editing; failure of either is non-fatal.
 void syncInitialCloud();
 const authToken=++authReadId;
 void currentTeacher().then(account=>{
  if(authToken!==authReadId)return;
  teacher=account;updateAuth();if(teacher&&activeTab==='encounters')void loadLiveValues();
  if(teacher&&!checkAuth())status('The current Google account is not authorized to publish. Sign out, then use the teacher account.',true);
 }).catch(error=>{if(authToken===authReadId)console.warn('Teacher login status unavailable:',error);});
}
void boot();
