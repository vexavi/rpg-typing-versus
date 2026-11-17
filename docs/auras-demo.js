/* Local design/test preview; NEVER reads/writes Firebase or real student balances. */
window.RPG_AURA_DEMO=true;
const example={ok:true,public_id:'DEMO',name:'Preview',collection:{owned:['crimson_knight','silver_knight']},recruitment:{shards:160,auras:{},owned:{alden:1,elise:1,kade:1,livia:1,mira:1,nora:1,vern:1,vex:1,aveline:1,isolde:1,seraphine:1,cassian:1,hound:1,tavi:1}}};
window.RPG_V66={ready:Promise.resolve(true),call:async(path,data)=>{
 if(path==='/api/profile')return structuredClone(example);
 if(path==='/api/aura/change'){
  const id=data.character_id,raw=example.recruitment.auras[id]||{level:0,equipped:0};
  const v=window.RPG_AURA_CORE.change(data.action,raw,example.recruitment.shards,Number(data.target));
  example.recruitment.shards=v.shards;example.recruitment.auras[id]={level:v.level,equipped:v.equipped};
  return {ok:true,...v,auras:structuredClone(example.recruitment.auras)};
 }
 throw Error('Demo route unavailable');
}};
