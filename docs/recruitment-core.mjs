/* Classroom-grade recruitment RNG. The browser chooses outcomes; results are NOT cheat-proof.
   Keep the teacher's 4/5/6-star rates, 80 pity, and featured guarantee deterministic. */
export const RATES=Object.freeze({four:0.912,five:0.08,six:0.008,softStart:66,hard:80});
export const SHARDS=Object.freeze({4:1,5:3,6:8});
const choose=(xs,rng)=>xs[Math.min(xs.length-1,Math.floor(rng()*xs.length))];
export function getJstDate(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now).replaceAll('/','-');
}
export function chanceSix(pity){const next=pity+1;return next>=80?1:next>=66?Math.min(1,0.008+(next-65)*0.05):0.008;}
export function makePull({count,owned={},pitySix=0,pityFive=0,featuredGuarantee=false,featuredId='tavi',catalog,rng=Math.random}){
 if(![1,10].includes(count))throw Error('Only 1 or 10 pulls are supported.');
 if(!Array.isArray(catalog)||!catalog.length)throw Error('Recruitment catalog missing.');
 const groups={4:catalog.filter(c=>c.rarity===4),5:catalog.filter(c=>c.rarity===5),6:catalog.filter(c=>c.rarity===6)};
 if(Object.values(groups).some(a=>!a.length)||!groups[6].some(c=>c.id===featuredId))throw Error('Recruitment roster incomplete.');
 let six=Math.max(0,Math.min(79,Math.trunc(pitySix))),five=Math.max(0,Math.min(9,Math.trunc(pityFive))),guarantee=!!featuredGuarantee;
 const nextOwned={...owned},results=[];let shards=0;
 for(let i=0;i<count;i++){
  const p6=chanceSix(six),roll=rng();
  let rarity=roll<p6?6:(five>=9?5:roll<p6+RATES.five?5:4);
  let selection;
  if(rarity===6){
   if(guarantee||rng()<0.5){selection=groups[6].find(c=>c.id===featuredId);guarantee=false;}
   else{const other=groups[6].filter(c=>c.id!==featuredId);selection=other.length?choose(other,rng):groups[6].find(c=>c.id===featuredId);guarantee=selection.id!==featuredId;}
   six=0;five=0;
  }else{six++;if(rarity===5)five=0;else five++;selection=choose(groups[rarity],rng);}
  const duplicate=(Number(nextOwned[selection.id])||0)>0;
  nextOwned[selection.id]=(Number(nextOwned[selection.id])||0)+1;
  const gained=duplicate?SHARDS[rarity]:0;shards+=gained;
  results.push({id:selection.id,name:selection.name,art:selection.art,rarity,duplicate,shards:gained,featured:rarity===6&&selection.id===featuredId});
 }
 return {results,owned:nextOwned,pitySix:six,pityFive:five,featuredGuarantee:guarantee,shardsEarned:shards};
}
