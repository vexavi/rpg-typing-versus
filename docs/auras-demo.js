/* Local design/test preview; NEVER reads/writes Firebase or real student balances. */
window.RPG_AURA_DEMO=true;
// Pull the demo-owned list from the same catalog as Recruitment and Profile.
// New operators appear here automatically (including Lupa); real saves are never touched.
const demoOwned=Object.fromEntries((window.RPG_GACHA_CATALOG?.characters||[]).filter(c=>/^[a-z][a-z0-9_]{0,39}$/.test(c.id)).map(c=>[c.id,1]));
const example={ok:true,public_id:'DEMO',name:'Preview',collection:{owned:['mc']},recruitment:{shards:60,shards5:8,shards6:5,auras:{},owned:demoOwned}};
window.RPG_V66={ready:Promise.resolve(true),call:async(path,data)=>{
 if(path==='/api/profile')return structuredClone(example);
 if(path==='/api/aura/change'){
  const id=data.character_id,raw=example.recruitment.auras[id]||{level:0,equipped:0};
  const rarity=(window.RPG_GACHA_CATALOG?.characters||[]).find(c=>c.id===id)?.rarity||4,core=window.RPG_AURA_CORE,field=core.fields[core.rarityOf(rarity)];
  const v=core.change(data.action,raw,example.recruitment[field]||0,Number(data.target),rarity);
  example.recruitment[field]=v.shards;example.recruitment.auras[id]={level:v.level,equipped:v.equipped};
  return {ok:true,shards:example.recruitment.shards,shards5:example.recruitment.shards5,shards6:example.recruitment.shards6,rarity,level:v.level,equipped:v.equipped,spent:v.spent,auras:structuredClone(example.recruitment.auras)};
 }
 throw Error('Demo route unavailable');
}};
