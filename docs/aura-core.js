/* v74 Aura progression — pure rules shared by Workshop and tests.
 * Shards are NOT Guild Coins. Purchases must also pass Firestore validation.
 * Cumulative: 0, 10, 30, 70, 150; incremental: 10, 20, 40, 80. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RPG_AURA_CORE=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const totals=Object.freeze([0,10,30,70,150]);
 const names=Object.freeze(['NONE','WHITE','AZURE','VIOLET','GOLD']);
 const colors=Object.freeze(['#98999d','#f5faff','#42c7ff','#c384ff','#ffc75d']);
 const duplicateRewards=Object.freeze({4:1,5:3,6:8});
 function validLevel(x){return Number.isInteger(x)&&x>=0&&x<totals.length;}
 function state(raw){const level=validLevel(raw?.level)?raw.level:0;return {level,equipped:validLevel(raw?.equipped)?Math.min(level,raw.equipped):0};}
 function change(action,raw,shards,target){const s=state(raw);if(!Number.isSafeInteger(shards)||shards<0)throw Error('Invalid shard balance.');
  if(action==='upgrade'){
   if(s.level===4)throw Error('Gold Aura is already unlocked.');
   const next=s.level+1,cost=totals[next]-totals[s.level];
   if(shards<cost)throw Error(`Need ${cost-shards} more Character Shards.`);
   return {shards:shards-cost,spent:cost,level:next,equipped:next};
  }
  if(action==='equip'){
   if(!validLevel(target)||target>s.level)throw Error('That aura is not unlocked.');
   if(target===s.equipped)throw Error('That aura is already equipped.');
   return {shards,spent:0,level:s.level,equipped:target};
  }
  throw Error('Unknown aura action.');
 }
 return Object.freeze({totals,names,colors,duplicateRewards,state,change,validLevel});
});
