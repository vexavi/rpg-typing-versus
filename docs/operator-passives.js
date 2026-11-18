/* v86.31 — Passive-only 4★ operators. No direct score, XP, or currency bonuses. */
(() => {
  'use strict';
  const RULES = Object.freeze({
    alden: Object.freeze({id:'alden',name:'Alden',rarity:4,title:'Second Wind',triggerHp:1,durationSec:5,slowPct:15,oncePerStage:true,
      description:'Once per stage, reaching 1 HP slows falling words by 15% for 5 seconds.'}),
    livia: Object.freeze({id:'livia',name:'Livia',rarity:4,title:'Gentle Pace',fallMultiplier:0.95,
      description:'Falling words move 5% slower throughout the stage.'}),
    elise: Object.freeze({id:'elise',name:'Elise',rarity:4,title:'Quick Recovery',durationSec:3,slowPct:10,cooldownSec:20,
      description:'After a typing mistake, your next correct word slows falling words by 10% for 3 seconds. 20-second cooldown.'}),
    vern: Object.freeze({id:'vern',name:'Vern',rarity:4,title:'Toughness',maxHpBonus:1,
      description:'Start each stage with 1 extra maximum HP.'}),
    kade: Object.freeze({id:'kade',name:'Kade',rarity:4,title:'Trickster',oncePerStage:true,
      description:'The first wrong answer each stage does not cost HP.'}),
    nora: Object.freeze({id:'nora',name:'Nora',rarity:4,title:'Shadow Hold',every:6,durationSec:1.5,
      description:'Every 6 correct words, freeze the lowest falling word for 1.5 seconds.'}),
    mira: Object.freeze({id:'mira',name:'Mira',rarity:4,title:'Breathing Room',every:7,durationSec:2,
      description:'Every 7 correct words, pause new word spawns for 2 seconds.'}),
    vex: Object.freeze({id:'vex',name:'Vex',rarity:4,title:'Endurance',every:8,heal:1,oncePerStage:true,
      description:'After 8 correct words, restore 1 missing HP once per stage.'})
  });
  const ALLOWED_MODES = new Set(['normal','extra','practice','story','challenge','shared']);
  const validTime=t=>Number.isFinite(t)&&t>=0?t:0;
  const fallingWord=w=>w&&w.state==='falling'&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&Number.isFinite(w.y);
  function create(characterId,mode){
    const rule=ALLOWED_MODES.has(mode)?RULES[characterId]||null:null;
    let correct=0,activations=0,spawnPauseUntil=0,slowUntil=0,lastSlowAt=-Infinity;
    let frozen=null,freezeUntil=0,mistakeArmed=false,used=false;
    function releaseFrozen(){
      if(frozen?.el?.classList)frozen.el.classList.remove('operator-shadow-hold');
      frozen=null;freezeUntil=0;
    }
    function reset(){
      releaseFrozen();correct=0;activations=0;spawnPauseUntil=0;slowUntil=0;
      lastSlowAt=-Infinity;mistakeArmed=false;used=false;
    }
    function tick(time){
      const t=validTime(time);
      if(frozen&&(t>=freezeUntil||frozen.state!=='falling'))releaseFrozen();
      if(spawnPauseUntil&&t>=spawnPauseUntil)spawnPauseUntil=0;
      if(slowUntil&&t>=slowUntil)slowUntil=0;
    }
    function isSpawnPaused(time){return rule?.id==='mira'&&validTime(time)<spawnPauseUntil;}
    function isWordFrozen(word,time){return rule?.id==='nora'&&word===frozen&&validTime(time)<freezeUntil&&word.state==='falling';}
    function getFallMultiplier(time){
      if(!rule)return 1;
      const t=validTime(time);
      if(rule.id==='livia')return rule.fallMultiplier;
      if((rule.id==='alden'||rule.id==='elise')&&t<slowUntil)return 1-rule.slowPct/100;
      return 1;
    }
    function getMaxHpBonus(){return rule?.id==='vern'?rule.maxHpBonus:0;}
    function onMistake(time){
      if(!rule)return null;
      const t=validTime(time);
      if(rule.id==='elise'){
        if(t>=lastSlowAt+rule.cooldownSec)mistakeArmed=true;
        return null;
      }
      if(rule.id==='kade'&&!used){
        used=true;activations++;
        return {type:'mistake-guard',preventHpLoss:true,characterId:rule.id};
      }
      return null;
    }
    function onPlayerDamage(previousHp,nextHp,time){
      if(rule?.id!=='alden'||used||previousHp<=1||nextHp!==1)return null;
      used=true;activations++;slowUntil=validTime(time)+rule.durationSec;
      return {type:'slowdown',seconds:rule.durationSec,percent:rule.slowPct,characterId:rule.id};
    }
    function onCorrect(words,time,context={}){
      if(!rule)return null;
      correct++;
      const t=validTime(time);
      tick(t);
      if(rule.id==='elise'){
        if(!mistakeArmed||t<lastSlowAt+rule.cooldownSec)return null;
        mistakeArmed=false;lastSlowAt=t;slowUntil=t+rule.durationSec;activations++;
        return {type:'slowdown',seconds:rule.durationSec,percent:rule.slowPct,characterId:rule.id};
      }
      if(rule.id==='vex'){
        if(used||correct<rule.every||!(Number(context.hp)<Number(context.maxHp)))return null;
        used=true;activations++;
        return {type:'heal',hp:rule.heal,characterId:rule.id};
      }
      if(rule.id==='mira'){
        if(correct%rule.every!==0||isSpawnPaused(t))return null;
        spawnPauseUntil=t+rule.durationSec;activations++;
        return {type:'spawn-pause',seconds:rule.durationSec,characterId:rule.id};
      }
      if(rule.id==='nora'){
        if(correct%rule.every!==0||frozen)return null;
        const candidates=(Array.isArray(words)?words:[]).filter(fallingWord);
        if(!candidates.length)return null;
        frozen=candidates.reduce((best,w)=>!best||w.y>best.y?w:best,null);
        freezeUntil=t+rule.durationSec;
        frozen.el?.classList?.add('operator-shadow-hold');activations++;
        return {type:'word-freeze',seconds:rule.durationSec,wordId:frozen.id,characterId:rule.id};
      }
      return null;
    }
    function debug(){return {id:rule?.id||null,correct,activations,spawnPauseUntil,slowUntil,freezeUntil,frozenWordId:frozen?.id??null,mistakeArmed,used};}
    return Object.freeze({rule,reset,tick,onCorrect,onMistake,onPlayerDamage,isSpawnPaused,isWordFrozen,getFallMultiplier,getMaxHpBonus,debug});
  }
  window.RPG_OPERATOR_PASSIVES=Object.freeze({RULES,ALLOWED_MODES,create});
})();
