/* Global, synchronous cache + resolution for the active Adventure mode/stage.
 * Firebase is required: never read cached teacher settings offline. */
(function(){
 'use strict';
 const allowed=['normal','extra','story','practice','challenge'];
 const cache=new Map();let effective=null;let active={mode:'normal',stage:'1',chapter:null};
 const numeric={fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],bossMaxHp:[1,2000],hitDamage:[1,100]};
 function scopeList(a){return [`mode:${a.mode}`,...(a.chapter?[`chapter:${a.chapter}`]:[]),`stage:${a.mode}:${a.stage}`];}
 function setActive(mode,stage,chapter){
  if(!allowed.includes(mode))return;
  const next={mode,stage:String(stage||'1'),chapter:chapter?String(chapter):null};
  if(scopeList(next).join('|')===scopeList(active).join('|'))return;
  active=next;effective=null;
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
 function apply(scope,data){
  if(!/^((mode:(normal|extra|story|practice|challenge))|(chapter:[a-zA-Z0-9_-]+)|(stage:(normal|extra|story|practice|challenge):[a-zA-Z0-9_-]+))$/.test(scope))return;
  cache.set(scope,clean(data||{}));effective=null;
  // No persistent offline balance cache in v66.
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
  effective=out;return effective;
 }
 const api={setActive,apply,get:(key,fallback)=>merged().values[key]??fallback,
  mechanic:(id,key,fallback)=>merged().mechanics?.[id]?.[key]??fallback,
  configSnapshot:()=>JSON.parse(JSON.stringify(merged())),
  scopes:()=>scopeList(active),snapshot:()=>({...active}),clear:scope=>{cache.delete(scope);effective=null;window.dispatchEvent(new Event('rpg-balance-update'))}};
 window.RPG_BALANCE=Object.freeze(api);
 window.dispatchEvent(new CustomEvent('rpg-balance-scopes',{detail:api.scopes()}));
})();
