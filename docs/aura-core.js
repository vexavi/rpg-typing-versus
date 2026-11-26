/* Aura progression rules (v148.6) — shared by the Workshop, the Firebase bridge and tests.
 * Character Shards are split by rarity: a duplicate 4★ gives one 4★ shard, a duplicate 5★
 * one 5★ shard, a duplicate 6★ one 6★ shard, and each pool only buys auras for operators of
 * that rarity. Because higher rarities are much harder to duplicate, their auras cost fewer shards.
 * The 4★ pool is the existing `recruitment.shards` field, so earlier balances carry over.
 * Shards are NOT Guild Coins. Purchases must also pass Firestore validation.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RPG_AURA_CORE=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const names=Object.freeze(['NONE','WHITE','AZURE','VIOLET','GOLD']);
 const colors=Object.freeze(['#98999d','#f5faff','#42c7ff','#c384ff','#ffc75d']);
 // Cost of each tier (index = tier). Tier 0 is free.
 const costs=Object.freeze({4:Object.freeze([0,3,6,12,24]),5:Object.freeze([0,1,2,2,3]),6:Object.freeze([0,1,1,1,2])});
 const fields=Object.freeze({4:'shards',5:'shards5',6:'shards6'});
 const duplicateRewards=Object.freeze({4:1,5:1,6:1});
 const rarityOf=r=>[4,5,6].includes(Number(r))?Number(r):4;
 const totalsFor=r=>{const c=costs[rarityOf(r)];let t=0;return Object.freeze(c.map(x=>t+=x));};
 const totals=totalsFor(4); // kept for older callers
 function validLevel(x){return Number.isInteger(x)&&x>=0&&x<names.length;}
 function state(raw){const level=validLevel(raw?.level)?raw.level:0;return {level,equipped:validLevel(raw?.equipped)?Math.min(level,raw.equipped):0};}
 function cost(rarity,level){return costs[rarityOf(rarity)][level]??-1;}
 function balance(recruitment,rarity){const v=Number(recruitment?.[fields[rarityOf(rarity)]]);return Number.isSafeInteger(v)&&v>0?v:0;}
 function change(action,raw,shards,target,rarity=4){const s=state(raw),r=rarityOf(rarity);
  if(!Number.isSafeInteger(shards)||shards<0)throw Error('Invalid shard balance.');
  if(action==='upgrade'){
   if(s.level===4)throw Error('Gold Aura is already unlocked.');
   const next=s.level+1,price=cost(r,next);
   if(shards<price)throw Error(`Need ${price-shards} more ${r}★ shard${price-shards===1?'':'s'}.`);
   return {shards:shards-price,spent:price,level:next,equipped:next,field:fields[r]};
  }
  if(action==='equip'){
   if(!validLevel(target)||target>s.level)throw Error('That aura is not unlocked.');
   if(target===s.equipped)throw Error('That aura is already equipped.');
   return {shards,spent:0,level:s.level,equipped:target,field:fields[r]};
  }
  throw Error('Unknown aura action.');
 }
 return Object.freeze({totals,totalsFor,names,colors,costs,fields,cost,balance,rarityOf,duplicateRewards,state,change,validLevel});
});
