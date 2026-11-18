/* v86.32 — 4★ and 5★ operator passives. Counters reset per stage.
 * Automatic word clears are never counted as manually typed answers. */
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
      description:'After 8 correct words, restore 1 missing HP once per stage.'}),
    aveline: Object.freeze({id:'aveline',name:'Aveline',rarity:5,title:'Weak Point Analysis',every:6,bonusDamage:2,
      description:'Every 6 correct words, charge the next manually typed word: +2 boss damage, or clear one extra falling word in survival stages (no extra rewards).'}),
    isolde: Object.freeze({id:'isolde',name:'Isolde',rarity:5,title:'Frozen Domain',every:6,freezeSec:2.5,slowSec:3,slowPct:15,
      description:'Every 6 consecutive correct words, freeze all falling words and spawns for 2.5 seconds, then slow falling words 15% for 3 seconds. Mistakes reset the streak.'}),
    seraphine: Object.freeze({id:'seraphine',name:'Seraphine',rarity:5,title:'Phantom Execution',every:5,pendingSec:3,
      description:'Every 5 manually typed words, mark the lowest falling word. Typing it eliminates another word for its minimum length-based score and normal boss damage.'})
  });
  const ALLOWED_MODES = new Set(['normal','extra','practice','story','challenge','shared']);
  const validTime=t=>Number.isFinite(t)&&t>=0?t:0;
  const fallingWord=w=>w&&w.state==='falling'&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost&&Number.isFinite(w.y);
  const lowestWord=words=>(Array.isArray(words)?words:[]).filter(fallingWord).reduce((best,w)=>!best||w.y>best.y?w:best,null);

  function create(characterId,mode){
    const rule=ALLOWED_MODES.has(mode)?RULES[characterId]||null:null;
    let correct=0,activations=0,spawnPauseUntil=0,slowUntil=0,lastSlowAt=-Infinity;
    let frozen=null,freezeUntil=0,mistakeArmed=false,used=false;
    let streak=0,domainFreezeUntil=0,charged=false,marked=null,awaitingMark=false,executionPendingUntil=0;
    function releaseFrozen(){
      if(frozen?.el?.classList)frozen.el.classList.remove('operator-shadow-hold');
      frozen=null;freezeUntil=0;
    }
    function releaseMark(){
      marked?.el?.classList?.remove('operator-phantom-mark');
      marked=null;
    }
    function applyMark(word){
      if(!fallingWord(word))return null;
      releaseMark();marked=word;awaitingMark=false;
      marked.el?.classList?.add('operator-phantom-mark');
      return {type:'mark-word',wordId:marked.id,characterId:rule.id};
    }
    function reset(){
      releaseFrozen();releaseMark();correct=0;activations=0;spawnPauseUntil=0;slowUntil=0;
      lastSlowAt=-Infinity;mistakeArmed=false;used=false;streak=0;domainFreezeUntil=0;
      charged=false;awaitingMark=false;executionPendingUntil=0;
    }
    function tick(time){
      const t=validTime(time);
      if(frozen&&(t>=freezeUntil||frozen.state!=='falling'))releaseFrozen();
      if(marked&&(marked.state!=='falling'||marked.el?.isConnected===false))releaseMark();
      if(spawnPauseUntil&&t>=spawnPauseUntil)spawnPauseUntil=0;
      if(slowUntil&&t>=slowUntil)slowUntil=0;
      if(domainFreezeUntil&&t>=domainFreezeUntil)domainFreezeUntil=0;
      if(executionPendingUntil&&t>=executionPendingUntil)executionPendingUntil=0;
    }
    function isFieldFrozen(time){return rule?.id==='isolde'&&validTime(time)<domainFreezeUntil;}
    function isSpawnPaused(time){
      const t=validTime(time);
      return (rule?.id==='mira'&&t<spawnPauseUntil)||(rule?.id==='isolde'&&t<domainFreezeUntil);
    }
    function isWordFrozen(word,time){
      return (rule?.id==='nora'&&word===frozen&&validTime(time)<freezeUntil&&word.state==='falling')||isFieldFrozen(time);
    }
    function getFallMultiplier(time){
      if(!rule)return 1;
      const t=validTime(time);
      if(rule.id==='livia')return rule.fallMultiplier;
      if((rule.id==='alden'||rule.id==='elise')&&t<slowUntil)return 1-rule.slowPct/100;
      if(rule.id==='isolde'){
        if(t<domainFreezeUntil)return 0;
        if(t<slowUntil)return 1-rule.slowPct/100;
      }
      return 1;
    }
    function getMaxHpBonus(){return rule?.id==='vern'?rule.maxHpBonus:0;}
    function onMistake(time){
      if(!rule)return null;
      const t=validTime(time);
      if(rule.id==='isolde'){streak=0;return null;}
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
      // Capture the marked-word hit before tick() removes DOM-disconnected marks.
      const wasMarkedHit=rule.id==='seraphine'&&!!marked&&!!context.clearedWord&&marked.id===context.clearedWord.id;
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
        frozen=lowestWord(words);
        if(!frozen)return null;
        freezeUntil=t+rule.durationSec;
        frozen.el?.classList?.add('operator-shadow-hold');activations++;
        return {type:'word-freeze',seconds:rule.durationSec,wordId:frozen.id,characterId:rule.id};
      }
      if(rule.id==='aveline'){
        // A charged attack is consumed by the NEXT real typed word, never by the trigger word.
        if(charged){
          charged=false;activations++;
          return context.nonBoss
            ? {type:'aveline-cleave',characterId:rule.id}
            : {type:'boss-bonus',damage:rule.bonusDamage,characterId:rule.id};
        }
        if(correct%rule.every===0){charged=true;return {type:'charge',characterId:rule.id};}
        return null;
      }
      if(rule.id==='isolde'){
        streak++;
        if(streak<rule.every||t<slowUntil)return null;
        streak=0;
        domainFreezeUntil=t+rule.freezeSec;
        slowUntil=domainFreezeUntil+rule.slowSec;
        activations++;
        return {type:'domain-freeze',seconds:rule.freezeSec,slowSeconds:rule.slowSec,characterId:rule.id};
      }
      if(rule.id==='seraphine'){
        if(wasMarkedHit){
          releaseMark();activations++;
          const next=lowestWord(words);
          if(next)return {type:'auto-eliminate',wordId:next.id,characterId:rule.id};
          executionPendingUntil=t+rule.pendingSec;
          return {type:'execution-pending',seconds:rule.pendingSec,characterId:rule.id};
        }
        if(marked&&!words.some(w=>w.id===marked.id))releaseMark();
        if(correct%rule.every===0&&!marked&&!awaitingMark){
          const next=lowestWord(words);
          if(next)return applyMark(next);
          awaitingMark=true;
          return {type:'mark-pending',characterId:rule.id};
        }
      }
      return null;
    }
    // Called once per gameplay frame, after spawns. Automatic clears never call onCorrect.
    function updateField(words,time){
      if(rule?.id!=='seraphine')return null;
      const t=validTime(time);
      tick(t);
      if(executionPendingUntil){
        const target=lowestWord(words);
        if(target){executionPendingUntil=0;return {type:'auto-eliminate',wordId:target.id,characterId:rule.id};}
      }
      if(awaitingMark&&!marked){
        const target=lowestWord(words);
        if(target)return applyMark(target);
      }
      return null;
    }
    function debug(){return {id:rule?.id||null,correct,activations,streak,charged,markedWordId:marked?.id??null,
      awaitingMark,executionPendingUntil,domainFreezeUntil,spawnPauseUntil,slowUntil,freezeUntil,
      frozenWordId:frozen?.id??null,mistakeArmed,used};}
    return Object.freeze({rule,reset,tick,onCorrect,onMistake,onPlayerDamage,updateField,
      isSpawnPaused,isWordFrozen,isFieldFrozen,getFallMultiplier,getMaxHpBonus,debug});
  }
  window.RPG_OPERATOR_PASSIVES=Object.freeze({RULES,ALLOWED_MODES,create});
})();
