/* Story image naming and repair helpers. Pure functions for tests.
 * Existing deployed files can be matched without re-exporting or renaming them.
 */
const safeName=/^[a-zA-Z0-9_.-]+\.(?:png|webp|jpg|jpeg|svg)$/i;
export const imageSlots = chapters => chapters.flatMap(ch => ch.stages.flatMap(st => {
 const stem=`ch${ch.id}-st${st.id.replace(/-/g,'_')}-`;
 const slides=['intro','outro'].flatMap(phase=>(st[phase]||[]).map((scene,index)=>({
  stage:st,kind:phase,index,from:scene.image||'',stem:`${stem}${phase}-${index+1}-`,label:`Stage ${st.id} · ${phase} ${index+1}`
 })));
 if(st.battle?.bossSprite)slides.push({stage:st,kind:'boss',index:0,from:st.battle.bossSprite,stem:`${stem}boss-1-`,label:`Stage ${st.id} · boss`});
 if(st.battle?.battleBackground)slides.push({stage:st,kind:'bg',index:0,from:st.battle.battleBackground,stem:`${stem}bg-1-`,label:`Stage ${st.id} · background`});
 return slides;
}));
export function planImageRepairs(chapters, filenames, skipPaths=[]){
 const names=[...new Set(filenames.map(n=>String(n||'').split(/[\\/]/).at(-1)).filter(n=>safeName.test(n)))];
 const nameSet=new Set(names), skipped=new Set(skipPaths),repairs=[], ambiguous=[], missing=[], unchanged=[];
 for(const slot of imageSlots(chapters)){
  if(!slot.from||skipped.has(slot.from))continue;
  const basename=slot.from.split('/').at(-1);
  if(nameSet.has(basename)){unchanged.push(slot);continue;}
  const candidates=names.filter(n=>n.startsWith(slot.stem));
  if(candidates.length===1)repairs.push({...slot,to:'story/images/'+candidates[0]});
  else if(candidates.length>1)ambiguous.push({...slot,candidates});
  else missing.push(slot);
 }
 return {repairs,ambiguous,missing,unchanged};
}
export function applyImageRepairs(plan){
 for(const fix of plan.repairs){
  if(fix.kind==='boss')fix.stage.battle.bossSprite=fix.to;
  else if(fix.kind==='bg')fix.stage.battle.battleBackground=fix.to;
  else fix.stage[fix.kind][fix.index].image=fix.to;
 }
 return plan.repairs.length;
}
export async function stablePhotoName(chapterId,stageId,phase,index,blob){
 if(!blob||typeof blob.arrayBuffer!=='function')throw Error('Image file is missing.');
 const bytes=await blob.arrayBuffer();let hash;
 if(globalThis.crypto?.subtle){
  const digest=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  hash=[...digest.slice(0,8)].map(n=>n.toString(16).padStart(2,'0')).join('');
 }else{
  // Deterministic fallback for older browsers, still no timestamp or filename stacking.
  let a=2166136261;for(const n of new Uint8Array(bytes)){a=Math.imul(a^n,16777619)>>>0;}
  hash=a.toString(16).padStart(8,'0');
 }
 const ext=blob.type==='image/webp'?'webp':blob.type==='image/jpeg'?'jpg':blob.type==='image/png'?'png':null;
 if(!ext)throw Error('Unsupported image format.');
 return `ch${chapterId}-st${String(stageId).replace(/-/g,'_')}-${phase}-${index+1}-${hash}.${ext}`;
}
export function githubRepoGuess(loc){
 const host=String(loc?.hostname||'').toLowerCase();
 const match=host.match(/^([a-z0-9-]+)\.github\.io$/);
 if(!match)return '';
 const parts=String(loc?.pathname||'').split('/').filter(Boolean);
 return `${match[1]}/${parts[0]&&!/\.html?$/i.test(parts[0])?parts[0]:match[1]+'.github.io'}`;
}
export function validGithubRepo(value){return /^[-\w.]{1,100}\/[-\w.]{1,100}$/.test(String(value||'').trim());}
