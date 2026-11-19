/* v61 mechanics registry. Adding a NEW behavior requires registering a code module;
 * its declared controls then appear automatically in the settings editor.
 * Never execute code from Firestore; it stores numbers/booleans only. */
(function(){
 'use strict';
 const modules=new Map();
 const idPattern=/^[a-z][a-z0-9_]{0,47}$/;
 const fieldPattern=/^[A-Za-z][A-Za-z0-9_]{0,47}$/;
 function register(spec){
  if(!spec||!idPattern.test(spec.id)||modules.has(spec.id))throw Error('Invalid/duplicate mechanic ID');
  const fields=Array.isArray(spec.fields)?spec.fields:[];
  if(fields.length>32)throw Error('Too many mechanic fields');
  const uniqueKeys=new Set();
  for(const f of fields){
   if(!f||uniqueKeys.has(f.key))throw Error('Invalid/duplicate mechanic field');
   uniqueKeys.add(f.key);
   if(!fieldPattern.test(f.key)||!['boolean','number'].includes(f.type))throw Error('Invalid mechanic field');
   if(f.type==='number'&&(!Number.isFinite(f.min)||!Number.isFinite(f.max)||f.min>f.max))throw Error('Invalid mechanic range');
  }
  modules.set(spec.id,Object.freeze({...spec,fields:Object.freeze(fields.map(f=>Object.freeze({...f}))) }));
 }
 function list(){return [...modules.values()].map(m=>({id:m.id,label:m.label,description:m.description||'',modes:m.modes||[],defaultEnabled:m.defaultEnabled!==false,fields:m.fields.map(f=>({...f}))}));}
 function hasHook(kind){for(const m of modules.values())if(typeof m[kind]==='function')return true;return false;}
 function dispatch(kind,ctx){
  for(const m of modules.values()){
   if(typeof m[kind]!=='function')continue;
   if(Array.isArray(m.modes)&&!m.modes.includes(ctx.mode))continue;
   if((window.RPG_BALANCE?.mechanic(m.id,'enabled',m.defaultEnabled!==false)??(m.defaultEnabled!==false))===false)continue;
   try{m[kind](ctx,{
     get:(key,otherwise)=>window.RPG_BALANCE?.mechanic(m.id,key,otherwise)??otherwise,
     enabled:()=>(window.RPG_BALANCE?.mechanic(m.id,'enabled',m.defaultEnabled!==false)??(m.defaultEnabled!==false))!==false
   });}catch(error){console.warn('Mechanic failed:',m.id,error)}
  }
 }
 // Existing Challenge mechanics: enabled toggle and optional spawn chance override.
 // -1 uses the original deterministic 1-in-3 / 1-in-4 spawn cadence.
 register({id:'star_struck',label:'Star Struck',description:'Sunspot words in Challenge Mode',modes:['challenge','extra'],
  fields:[{key:'enabled',label:'Enabled',type:'boolean',default:true},{key:'chancePct',label:'Spawn chance override (%)',type:'number',min:-1,max:100,step:1,default:-1,help:'-1 preserves original cadence'}]});
 register({id:'comet',label:'Comet',description:'Passing comet words in Challenge Mode',modes:['challenge'],
  fields:[{key:'enabled',label:'Enabled',type:'boolean',default:true},{key:'chancePct',label:'Spawn chance override (%)',type:'number',min:-1,max:100,step:1,default:-1,help:'-1 preserves original cadence'}]});
 window.RPG_MECHANICS=Object.freeze({register,list,dispatch,hasHook,has:id=>modules.has(id)});
})();
