/* Global, synchronous cache + resolution for the active Adventure mode/stage.
 * Saved server settings are read-only for offline UNRANKED play. */
(function(){
 'use strict';
 const allowed=['normal','extra','story','practice','challenge'];
 const cache=new Map();let effective=null;let storyOverride=null;let active={mode:'normal',stage:'1',chapter:null};
 const STORAGE='rpgTeacherBalance_v869';
 const saved=(()=>{try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');return x?.v===1&&Number.isFinite(x.updatedAt)&&x.updatedAt<=Date.now()+60000&&Date.now()-x.updatedAt<30*86400000&&Array.isArray(x.items)?x.items:[]}catch{return []}})();
 // Firestore data is never restored as proof that a run can be ranked.
 const cachedScopes=new Set();
 function persist(){
  try{localStorage.setItem(STORAGE,JSON.stringify({v:1,updatedAt:Date.now(),items:[...cache.entries()].slice(0,150)}))}catch(_){}
 }

 const numeric={fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],bossMaxHp:[1,2000],hitDamage:[1,100]};
 function scopeList(a){return [`mode:${a.mode}`,...(a.chapter?[`chapter:${a.chapter}`]:[]),`stage:${a.mode}:${a.stage}`];}
 function setActive(mode,stage,chapter){
  if(!allowed.includes(mode))return;
  const next={mode,stage:String(stage||'1'),chapter:chapter?String(chapter):null};
  if(scopeList(next).join('|')===scopeList(active).join('|'))return;
  active=next;effective=null;
  if(next.mode!=='story'||(storyOverride&&storyOverride.stage!==next.stage))storyOverride=null;
  window.dispatchEvent(new CustomEvent('rpg-balance-scopes',{detail:scopeList(active)}));
  window.dispatchEvent(new Event('rpg-balance-update'));
 }
 function clean(data){
  const out={values:{},mechanics:{}};
  for(const [key,value] of Object.entries(data?.values||{})){
   const r=numeric[key],v=Number(value);
   if(r&&Number.isFinite(v)&&v>=r[0]&&v<=r[1])out.values[key]=v;
  }
  const catalog=window.RPG_MECHANICS?.list()||[];
  for(const item of catalog){
   const input=data?.mechanics?.[item.id];if(!input||typeof input!=='object')continue;
   const row={};
   for(const field of item.fields){
    const v=input[field.key];
    if(field.type==='boolean'&&typeof v==='boolean')row[field.key]=v;
    else if(field.type==='number'&&typeof v==='number'&&Number.isFinite(v)&&v>=field.min&&v<=field.max)row[field.key]=v;
   }
   if(Object.keys(row).length)out.mechanics[item.id]=row;
  }
  return out;
 }
 function apply(scope,data,source='local'){
  if(!/^((mode:(normal|extra|story|practice|challenge))|(chapter:[a-zA-Z0-9_-]+)|(stage:(normal|extra|story|practice|challenge):[a-zA-Z0-9_-]+))$/.test(scope))return;
  cache.set(scope,clean(data||{}));effective=null;
  if(source==='server'){cachedScopes.add(scope);persist();}
  if(scopeList(active).includes(scope))window.dispatchEvent(new Event('rpg-balance-update'));
 }
 function merged(){
  if(effective)return effective;
  const out={values:{},mechanics:{}};
  for(const scope of scopeList(active)){
   const v=cache.get(scope);if(!v)continue;
   Object.assign(out.values,v.values);
   for(const [key,fields] of Object.entries(v.mechanics))out.mechanics[key]={...(out.mechanics[key]||{}),...fields};
  }
  if(active.mode==='story'&&storyOverride&&storyOverride.stage===active.stage){
   Object.assign(out.values,storyOverride.values);
   for(const [key,fields] of Object.entries(storyOverride.mechanics))out.mechanics[key]={...(out.mechanics[key]||{}),...fields};
  }
  effective=out;return effective;
 }
 // Load the last known validated teacher values without generating a cloud read.
 for(const item of saved){if(Array.isArray(item)&&item.length===2&&typeof item[0]==='string')apply(item[0],item[1]);}
 function setStoryOverrides(stage,values={},mechanics={}){
  if(active.mode!=='story'||active.stage!==String(stage))return;
  const settings=clean({values,mechanics});
  storyOverride={stage:String(stage),...settings};effective=null;
  window.dispatchEvent(new Event('rpg-balance-update'));
 }
 const api={setActive,setStoryOverrides,apply,get:(key,fallback)=>merged().values[key]??fallback,
  mechanic:(id,key,fallback)=>merged().mechanics?.[id]?.[key]??fallback,
  configSnapshot:()=>JSON.parse(JSON.stringify(merged())),
  scopes:()=>scopeList(active),snapshot:()=>({...active}),clear:scope=>{cache.delete(scope);effective=null;persist();window.dispatchEvent(new Event('rpg-balance-update'))}};
 window.RPG_BALANCE=Object.freeze(api);
 window.dispatchEvent(new CustomEvent('rpg-balance-scopes',{detail:api.scopes()}));
})();
