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
  tavi:[0,1.05,.05],lupa:[0,1.15,0],nitrate:[2,1,.15],hound:[0,1.15,0],cassian:[1,1.2,.05]
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
let run=null;
function stats(id,passiveHp=0,bonuses=run?.bonuses||{}){
 const [hp,atk,def]=roles[id]||roles.mc;
 return {hp:q(10+hp+passiveHp+(bonuses.hp||0)),atk:atk*(1+(bonuses.atk||0)),def:Math.min(.6,def+(bonuses.def||0)),crit:Math.min(.6,.05+(bonuses.crit||0)),critDmg:2+(bonuses.critDmg||0),recovery:bonuses.recovery||0};
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
 if(!encounters.length||ids.length!==3||new Set(ids).size!==3)throw Error('Invalid operation or squad');
 run={chapter:ch,encounters,position:0,ids:ids.slice(),index:0,knockedOut:[],hp:null,bonuses:{},rewards:[],records:[],unranked:false};
 return run;
}
function award(random=Math.random){
 if(!run||run.rewards.length>=6)return null;
 const candidates=pool.filter(e=>(run.bonuses[e.id]||0)<caps[e.id]-1e-8);
 if(!candidates.length)return null;
 const e=candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
 const roll=random(),tier=roll<.70?0:roll<.95?1:2;
 const old=run.bonuses[e.id]||0;
 const value=Math.min(e.values[tier],caps[e.id]-old);
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
root.RPG_CONQUEST=Object.freeze({q,displayed,letters,stats,manualDamage,incomingDamage,begin,award,finishEncounter,abort:()=>{run=null;},get run(){return run;},get pool(){return pool;}});
})(typeof window!=='undefined'?window:globalThis);
