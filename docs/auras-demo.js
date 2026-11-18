/* Local design/test preview; NEVER reads/writes Firebase or real student balances. */
window.RPG_AURA_DEMO=true;
// Pull the demo-owned list from the same catalog as Recruitment and Profile.
// New operators appear here automatically (including Lupa); real saves are never touched.
const demoOwned=Object.fromEntries((window.RPG_GACHA_CATALOG?.characters||[]).filter(c=>/^[a-z][a-z0-9_]{0,39}$/.test(c.id)).map(c=>[c.id,1]));
const example={ok:true,public_id:'DEMO',name:'Preview',collection:{owned:['mc']},recruitment:{shards:160,auras:{},owned:demoOwned}};
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
