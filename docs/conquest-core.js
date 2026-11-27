/* Conquest v128. Legacy battle units are tenths of displayed HP/damage.
   Keep the existing ability engine in its native units; round once at each hit. */
(function(root){
'use strict';
const q=n=>Math.round((Number(n)||0)*10)/10;
const displayed=n=>Math.round((Number(n)||0)*10);
const letters=answer=>(String(answer||'').match(/[a-z]/gi)||[]).length;
const roles=Object.freeze({
  mc:[0,1,0],alden:[0,1,0],livia:[0,1,0],elise:[0,1,0],vern:[0,1,0],kade:[0,1,0],nora:[0,1,0],mira:[0,1,0],vex:[0,1,0],
  aveline:[0,1.1,0],isolde:[0,1,.05],shield:[0,.9,.10],hexaxe:[0,1.1,0],crossbow:[-1,1.2,0],anodyne:[1,.9,.05],seraphine:[0,1.1,0],
  tavi:[0,1.05,.05],lupa:[0,1.15,0],nitrate:[2,1,.15],hound:[0,1.15,0],cassian:[1,1.2,.05],kurone:[0,1.1,0]
});
const pool=Object.freeze([
 {id:'hp',name:'Vitality',label:'MAX HP',values:[2,4,6],format:v=>`+${displayed(v)}`},
 {id:'atk',name:'Strength',label:'ATK',values:[.1,.2,.3],format:v=>`+${Math.round(v*100)}%`},
 {id:'def',name:'Defense',label:'DEF',values:[.1,.2,.3],format:v=>`+${Math.round(v*100)}%`},
 {id:'crit',name:'Precision',label:'CRIT RATE',values:[.05,.1,.15],format:v=>`+${Math.round(v*100)}%`},
 {id:'critDmg',name:'Critical Power',label:'CRIT DMG',values:[.25,.5,.75],format:v=>`+${Math.round(v*100)}%`},
 {id:'recovery',name:'Recovery',label:'HEAL AFTER VICTORY',values:[1,2,3],format:v=>`+${displayed(v)}`}
]);
const caps={hp:12,atk:1,def:.6,crit:.55,critDmg:2,recovery:6};
const names={mc:'Main Character',alden:'Alden',livia:'Livia',elise:'Elise',vern:'Vern',kade:'Kade',nora:'Nora',mira:'Mira',vex:'Vex',aveline:'Aveline',isolde:'Isolde',shield:'Mara',hexaxe:'Nyx',crossbow:'Fletcher',anodyne:'Anodyne',seraphine:'Seraphine',tavi:'Tavi',lupa:'Lupa',nitrate:'Nitrate',hound:'Hound',cassian:'Cassian',kurone:'Kurone'};
const rewardScale=id=>id==='hp'||id==='recovery'?10:100;
const defaultRewardValues=id=>pool.find(e=>e.id===id)?.values.map(n=>Math.round(n*rewardScale(id)));
const rewardMax=id=>Math.round(caps[id]*rewardScale(id));
const passiveHP={vern:1,shield:3};
const defaultOperator=id=>{const [hp,atk,def]=roles[id]||roles.mc;return {hp:displayed(10+hp+(passiveHP[id]||0)),atk:Math.round(atk*100),def:Math.round(def*100),crit:5,critDmg:200};};
const operatorRanges={hp:[10,500],atk:[10,300],def:[0,60],crit:[0,60],critDmg:[100,400]};
const visibilityValues=Object.freeze(['enabled','soon','hidden']);
// Legacy v135 content has no visibility field. The six unfinished stock
// territories default to hidden; existing first-three disabled flags stay visible.
function visibility(ch){
 const c=ch?.conquest;
 if(visibilityValues.includes(c?.visibility))return c.visibility;
 if(/^[4-9]$/.test(String(ch?.id??'')))return 'hidden';
 return c?.enabled===false?'soon':'enabled';
}
function normalizeConfig(input,strict=false,territoryId=null){
 const fail=msg=>{if(strict)throw Error('Conquest settings: '+msg);};
 const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
 const initial=visibility({id:territoryId,conquest:input});
 const out={enabled:initial==='enabled',visibility:initial,rewards:{max:6,weights:[70,25,5],types:pool.map(e=>e.id),values:{}},operators:{},banner:{color:'',icon:'',art:'',animate:true}};
 if(input===undefined)return out;
 if(!isObject(input)){fail('invalid configuration');return out;}
 if(input.enabled!==undefined&&typeof input.enabled!=='boolean')fail('territory enabled must be true or false');
 if(input.visibility!==undefined&&!visibilityValues.includes(input.visibility))fail('invalid territory visibility');
 const b=input.banner;
 if(b!==undefined){if(!isObject(b))fail('invalid banner settings');else{
  if(b.color!==undefined){if(typeof b.color==='string'&&(!b.color||/^#[0-9a-f]{6}$/i.test(b.color)))out.banner.color=b.color;else fail('invalid banner color');}
  if(b.icon!==undefined){if(['','rift','crown','star','gear','dna','leaf','waves','sun','snow'].includes(b.icon))out.banner.icon=b.icon;else fail('invalid banner emblem');}
  if(b.art!==undefined){if(typeof b.art==='string'&&(!b.art||/^story\/images\/[\w.-]+\.(?:webp|png|jpg|jpeg|svg)$/i.test(b.art)))out.banner.art=b.art;else fail('invalid banner image');}
  if(b.animate!==undefined){if(typeof b.animate==='boolean')out.banner.animate=b.animate;else fail('invalid banner animation');}
 }}
 const r=input.rewards;
 if(r!==undefined){if(!isObject(r))fail('invalid enhancement settings');else{
  if(r.max!==undefined){if(Number.isInteger(r.max)&&r.max>=0&&r.max<=6)out.rewards.max=r.max;else fail('maximum rewards must be 0–6');}
  if(r.weights!==undefined){if(Array.isArray(r.weights)&&r.weights.length===3&&r.weights.every(n=>Number.isInteger(n)&&n>=0&&n<=100)&&r.weights.reduce((a,b)=>a+b,0)===100)out.rewards.weights=r.weights.slice();else fail('rarity chances must be whole percentages totaling 100');}
  if(r.values!==undefined){if(!isObject(r.values))fail('invalid enhancement amounts');else for(const [id,values] of Object.entries(r.values)){
   if(pool.some(e=>e.id===id)&&Array.isArray(values)&&values.length===3&&values.every(n=>Number.isInteger(n)&&n>=1&&n<=rewardMax(id)))out.rewards.values[id]=values.slice();else fail('invalid '+id+' reward amount');
  }}
  if(r.types!==undefined){if(Array.isArray(r.types)&&r.types.every(id=>pool.some(e=>e.id===id))&&new Set(r.types).size===r.types.length)out.rewards.types=r.types.slice();else fail('invalid enhancement pool');}
 }}
 if(input.operators!==undefined){if(!isObject(input.operators))fail('invalid operator stats');else for(const [id,row] of Object.entries(input.operators)){
  if(!Object.hasOwn(roles,id)||!isObject(row)){fail('invalid operator '+id);continue;}
  const result={};for(const [key,value] of Object.entries(row)){const range=operatorRanges[key];if(range&&Number.isInteger(value)&&value>=range[0]&&value<=range[1])result[key]=value;else fail(names[id]+' '+key+' is out of range');}
  if(Object.keys(result).length)out.operators[id]=result;
 }}
 return out;
}
function rewardLimit(ch){const c=normalizeConfig(ch?.conquest);return c.rewards.types.length?Math.min(c.rewards.max,Math.max(0,(ch?.stages||[]).filter(s=>s.type!=='story-only').length-1)):0;}
let run=null;
function stats(id,passiveHp=0,bonuses=run?.bonuses||{},config=run?.config){
 const [hp,atk,def]=roles[id]||roles.mc;
 const override=config?.operators?.[id]||{};
 const startingHp=override.hp!==undefined?override.hp/10:10+hp+passiveHp;
 return {hp:q(startingHp+(bonuses.hp||0)),atk:(override.atk===undefined?atk:override.atk/100)*(1+(bonuses.atk||0)),def:Math.min(.6,(override.def===undefined?def:override.def/100)+(bonuses.def||0)),crit:Math.min(.6,(override.crit===undefined?.05:override.crit/100)+(bonuses.crit||0)),critDmg:(override.critDmg===undefined?2:override.critDmg/100)+(bonuses.critDmg||0),recovery:bonuses.recovery||0};
}
function manualDamage(answer,baseHit,bonus,st,random=Math.random){
 const raw=(5+letters(answer))*Math.max(0,Number(baseHit)||0)*st.atk;
 const crit=random()<st.crit;
 // Ability bonuses are flat in legacy units; no ATK or crit amplification.
 const normal=Math.round(raw);
 return {amount:q(Math.round(normal*(crit?st.critDmg:1))/10+(Number(bonus)||0)),crit};
}
function incomingDamage(amount,st){return Math.max(.1,q(amount*(1-st.def)));}
function begin(ch,ids){
 const encounters=ch.stages.filter(s=>s.type!=='story-only');
 if(visibility(ch)!=='enabled'||!encounters.length||ids.length!==3||new Set(ids).size!==3)throw Error('Invalid operation or squad');
 run={chapter:ch,config:normalizeConfig(ch.conquest,false,ch.id),encounters,position:0,ids:ids.slice(),index:0,knockedOut:[],hp:null,bonuses:{},rewards:[],records:[],unranked:false};
 return run;
}
function award(random=Math.random){
 if(!run||run.rewards.length>=run.config.rewards.max)return null;
 const candidates=pool.filter(e=>run.config.rewards.types.includes(e.id)&&(run.bonuses[e.id]||0)<caps[e.id]-1e-8);
 if(!candidates.length)return null;
 const e=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
 const roll=random()*100,[four,five]=run.config.rewards.weights,tier=roll<four?0:roll<four+five?1:2;
 const old=run.bonuses[e.id]||0;
 const configured=run.config.rewards.values[e.id]?.[tier];
 const value=Math.min(configured===undefined?e.values[tier]:configured/rewardScale(e.id),caps[e.id]-old);
 run.bonuses[e.id]=Math.round((old+value)*10000)/10000;
 const reward={id:e.id,name:e.name,label:e.label,rarity:4+tier,value,display:e.format(value)};
 run.rewards.push(reward);return reward;
}
function finishEncounter(state,random=Math.random){
 if(!run||run.position>=run.encounters.length||run.records.length!==run.position)return null;
 run.records.push({...state,stageId:run.encounters[run.position].id});
 run.unranked ||= Boolean(state.unranked);
 run.index=state.index;run.knockedOut=state.knockedOut.slice();run.hp=q(state.hp);
 const final=run.position===run.encounters.length-1;
 if(final)return {final:true,reward:null,hp:run.hp};
 const before=stats(run.ids[run.index],state.passiveHp);
 const reward=award(random);
 const after=stats(run.ids[run.index],state.passiveHp);
 // Max HP upgrades give living members the added capacity immediately.
 // Recovery cannot revive a KO or erase existing overheal.
 run.hp=q(run.hp+Math.max(0,after.hp-before.hp));
 const heal=Math.min(after.recovery,Math.max(0,after.hp-run.hp));
 run.hp=q(run.hp+heal);
 run.position++;
 return {final:false,reward,hp:run.hp,next:run.encounters[run.position],healed:displayed(heal)};
}
root.RPG_CONQUEST=Object.freeze({q,displayed,letters,visibility,visibilityValues,normalizeConfig,defaultRewardValues,rewardMax,defaultOperator,operatorRanges,names,rewardLimit,stats,manualDamage,incomingDamage,begin,award,finishEncounter,abort:()=>{run=null;},get run(){return run;},get pool(){return pool;}});
})(typeof window!=='undefined'?window:globalThis);
