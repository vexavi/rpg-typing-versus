/* RPG Typing Versus v83 — classroom-grade recruitment RNG and state transitions.
 * Client-side RNG is not authoritative. No payments or real-world value.
 * Persistent state is committed by the Firebase bridge in one transaction. */
(function(global){
 'use strict';
 const RARITIES=Object.freeze({4:0.912,5:0.08,6:0.008});
 const ROSTER=Object.freeze([
  ['alden',4],['elise',4],['kade',4],['livia',4],['mira',4],['nora',4],['vern',4],['vex',4],
  ['aveline',5],['isolde',5],['anodyne',5],['seraphine',5],
  ['cassian',6],['hound',6],['tavi',6],['lupa',6]
 ]);
 const byRarity={4:ROSTER.filter(x=>x[1]===4).map(x=>x[0]),5:ROSTER.filter(x=>x[1]===5).map(x=>x[0]),6:ROSTER.filter(x=>x[1]===6).map(x=>x[0])};
 const rarityOf=Object.fromEntries(ROSTER);
 const reset=()=>({pity_six:0,pity_five:0,featured_guaranteed:false,owned:{},shards:0});
 function rng(){
  const a=new Uint32Array(1);global.crypto.getRandomValues(a);return a[0]/4294967296;
 }
 function jstDay(value=new Date()){
  const d=new Date(value.getTime()+9*3600000);
  return d.toISOString().slice(0,10);
 }
 function rateSix(pity){const number=Number(pity)||0;return number>=79?1:number>=65?Math.min(1,.008+(number-64)*.05):.008;}
 function choose(list,random){return list[Math.min(list.length-1,Math.floor(random()*list.length))];}
 function draw(previous,amount,featuredId='tavi',random=rng){
  if(![1,10].includes(amount))throw Error('Only single pulls and ten-pulls are supported.');
  if(!Object.prototype.hasOwnProperty.call(rarityOf,featuredId)||rarityOf[featuredId]!==6)throw Error('Featured 6-star character missing.');
  let state={...reset(),...previous,owned:{...(previous?.owned||{})}};
  state.pity_six=Number(state.pity_six)||0;
  state.pity_five=Number(state.pity_five)||0;
  state.shards=Number(state.shards)||0;
  const results=[];
  for(let i=0;i<amount;i++){
   const sixChance=rateSix(state.pity_six);
   const roll=random();
   let rarity=roll<sixChance?6:roll<sixChance+RARITIES[5]?5:4;
   // A 5★+ in every ten consecutive pulls; the 6★ probability is not inflated.
   if(state.pity_five>=9&&rarity===4)rarity=5;
   let id;
   if(rarity===6){
    const other=byRarity[6].filter(x=>x!==featuredId);
    const isFeatured=state.featured_guaranteed||random()<.5||!other.length;
    id=isFeatured?featuredId:choose(other,random);
    state.featured_guaranteed=!isFeatured;
    state.pity_six=0;
    state.pity_five=0;
   }else{
    id=choose(byRarity[rarity],random);
    state.pity_six=Math.min(79,state.pity_six+1);
    state.pity_five=rarity===5?0:state.pity_five+1;
   }
   const previousCount=Number(state.owned[id])||0;
   const duplicate=previousCount>0;
   const earned=duplicate?({4:1,5:3,6:8})[rarity]:0;
   state.shards+=earned;
   state.owned[id]=previousCount+1;
   results.push({id,rarity,duplicate,shards:earned});
  }
  return {results,state};
 }
 const core={RARITIES,ROSTER,rarityOf,reset,rateSix,jstDay,draw};
 global.RPG_RECRUIT_CORE=core;
 if(typeof module!=='undefined'&&module.exports)module.exports=core;
})(typeof window!=='undefined'?window:globalThis);
