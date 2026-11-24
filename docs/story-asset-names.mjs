/* Short, readable story-art names and shared asset references.
 * One image path may be used by any number of stages: it is never copied or
 * renamed when selected from the existing-art picker.
 */
export const imageExt = blob => blob?.type==='image/webp'?'webp':blob?.type==='image/png'?'png':blob?.type==='image/jpeg'?'jpg':null;
export const storyPath = filename => 'story/images/'+filename;
export function shortSlideName(stageId,phase,index,ext='webp'){
 if(!/^[1-9]\d{0,3}-[1-9]\d{0,3}$/.test(String(stageId))||!['intro','outro'].includes(phase)||!Number.isInteger(index)||index<0||index>=50||!['webp','jpg','png'].includes(ext))throw Error('Invalid stage slide name.');
 return `${stageId}-${phase}-${index+1}.${ext}`;
}
export function nextSharedName(kind,paths,ext='webp'){
 if(!['boss','bg','banner'].includes(kind)||!['webp','jpg','png'].includes(ext))throw Error('Invalid shared asset name.');
 const names=new Set([...paths].map(x=>String(x||'').split('/').at(-1).toLowerCase()));
 for(let n=1;n<=9999;n++){
  const candidate=`${kind}-${n}.${ext}`;
  // A different format at same number still reserves the slot.
  if(![...names].some(name=>new RegExp(`^${kind}-${n}\\.(?:webp|png|jpg|jpeg)$`,'i').test(name)))return candidate;
 }
 throw Error('Too many shared images.');
}
export function referencedImages(chapters){
 const out=[];
 for(const ch of chapters||[])if(ch.conquest?.banner?.art)out.push(ch.conquest.banner.art);
 for(const ch of chapters||[])for(const st of ch.stages||[]){
  for(const phase of ['intro','outro'])for(const scene of st[phase]||[])if(scene.image)out.push(scene.image);
  for(const key of ['bossSprite','battleBackground'])if(st.battle?.[key])out.push(st.battle[key]);
 }
 return [...new Set(out)];
}
export function sharedOptions(chapters,knownNames=[],stagedPaths=[]){
 const names=new Set([...referencedImages(chapters),...knownNames.map(x=>String(x).startsWith('story/images/')?x:storyPath(x)),...stagedPaths]);
 return [...names].filter(x=>/^story\/images\/[\w.-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(x)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
export function shortRenamePlan(chapters,reservedPaths=[]){
 // Consistent original path -> same new path, even across different stages.
 const mapping=new Map(),used=new Set([...referencedImages(chapters),...reservedPaths].map(x=>String(x).split('/').at(-1)));
 const reserve=(path,name)=>{
  if(!path)return;
  if(mapping.has(path))return;
  if(path===storyPath(name)){mapping.set(path,path);return;}
  // Avoid collisions with names already referenced by a different image.
  if(used.has(name)&&!mapping.has(storyPath(name))){
   let n=2;const original=name.replace(/\.(webp|png|jpg|jpeg)$/i,'');const ext=name.split('.').at(-1);
   while(used.has(`${original}-${n}.${ext}`))n++;
   name=`${original}-${n}.${ext}`;
  }
  used.add(name);mapping.set(path,storyPath(name));
 };
 for(const ch of chapters||[])for(const st of ch.stages||[]){
  for(const phase of ['intro','outro'])for(const [i,scene] of (st[phase]||[]).entries()){
   const path=scene.image;if(!path||/placeholder|map-placeholder/.test(path))continue;
   const ext=path.split('.').at(-1).toLowerCase();
   if(['webp','jpg','jpeg','png'].includes(ext))reserve(path,shortSlideName(st.id,phase,i,ext==='jpeg'?'jpg':ext));
  }
  for(const [key,kind] of [['bossSprite','boss'],['battleBackground','bg']]){
   const path=st.battle?.[key];if(!path||/placeholder/.test(path))continue;
   const name=path.split('/').at(-1);
   if(new RegExp(`^${kind}-\\d+\\.(?:webp|png|jpg|jpeg)$`,'i').test(name)){reserve(path,name);continue;}
   const ext=path.split('.').at(-1).toLowerCase();
   if(!['webp','jpg','png','jpeg'].includes(ext))continue;
   reserve(path,nextSharedName(kind,used,ext==='jpeg'?'jpg':ext));
  }
 }
 return [...mapping].filter(([from,to])=>from!==to).map(([from,to])=>({from,to}));
}
export function applyShortRename(chapters,plan){
 const map=new Map(plan.map(x=>[x.from,x.to]));
 for(const ch of chapters)if(ch.conquest?.banner?.art)ch.conquest.banner.art=map.get(ch.conquest.banner.art)||ch.conquest.banner.art;
 for(const ch of chapters)for(const st of ch.stages){
  for(const phase of ['intro','outro'])for(const scene of st[phase])scene.image=map.get(scene.image)||scene.image;
  for(const key of ['bossSprite','battleBackground'])if(st.battle?.[key])st.battle[key]=map.get(st.battle[key])||st.battle[key];
 }
}

// Audio is a separate asset library; files can be shared by several stages.
export const storyAudioPath = filename => 'story/audio/'+filename;
export function nextBgmName(paths,ext='webm'){
 if(!['webm','mp3','m4a','opus','ogg','wav'].includes(ext))throw Error('Unsupported music extension.');
 const names=new Set([...paths].map(p=>String(p||'').split('/').at(-1).toLowerCase()));
 for(let n=1;n<=9999;n++){
  if(!['webm','mp3','m4a','opus','ogg','wav'].some(x=>names.has(`bgm-${n}.${x}`)))return `bgm-${n}.${ext}`;
 }
 throw Error('Too many music files.');
}
export function referencedMusic(chapters){
 return [...new Set((chapters||[]).flatMap(ch=>(ch.stages||[]).map(st=>st.battle?.bgmFile).filter(Boolean)))];
}
export function musicOptions(chapters,knownNames=[],stagedPaths=[]){
 return [...new Set([...referencedMusic(chapters),...knownNames.map(x=>String(x).startsWith('story/audio/')?x:storyAudioPath(x)),...stagedPaths])]
  .filter(x=>/^story\/audio\/[a-zA-Z0-9][\w.-]*\.(?:mp3|m4a|webm|opus|ogg|wav)$/i.test(x))
  .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
