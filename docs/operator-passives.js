/* v86.45 — 4★, 5★ and 6★ operator passives. Counters reset per stage.
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
    shield: Object.freeze({id:'shield',name:'Mara',rarity:5,title:'Reinforced Vitality / Shield Advance',maxHpBonus:3,upperHp:10,lowerHp:3,upperPushPct:10,lowerPushPct:35,freezeSec:4,emergencyDepthPct:40,
      description:'Passive 1: +3 maximum HP. Passive 2: below 10 HP, push falling words up 10%; below 3 HP, push them up 35% and freeze affected words for 4 seconds. Stage-start low HP prepares the strongest available push until a falling word reaches 40% depth. Empty fields do not consume a charge. Continue does not recharge used thresholds. Stacked words and spawn pacing are unchanged.'}),
    hexaxe: Object.freeze({id:'hexaxe',name:'Nyx',rarity:5,title:'Chain Cleave',every:6,durationSec:4,extraWords:4,maxExisting:2,
      description:'Every 6 non-hex manually typed correct words, all current and newly spawned words are hexed for 4 seconds, temporarily changing to the shortest vocabulary word. If 2 or fewer words remain, summon 4 additional hexed words. Manual hex clears earn maximum points for their original word length; summoned untyped words vanish at expiry. Hexed clears cannot charge Chain Cleave.'}),
    crossbow: Object.freeze({id:'crossbow',name:'Fletcher',rarity:5,title:'Show-Off / Adrenaline Rush',every:5,showOffDamage:1,adrenalineHp:1,adrenalineDamage:1,momentumWords:3,
      lastStandSeconds:3,lastStandSpeedMultiplier:0.1,lastStandSpawnFrequency:0.1,overdriveSpeedMultiplier:1.25,overdriveSpawnFrequency:1.2,
      description:'Show-Off: every 5 consecutive correct words mark the longest typeable word (+1 boss damage if typed). Adrenaline Rush: at 1 HP, gain 3 seconds of invulnerability with 90% slower falling and 90% fewer spawns. Afterward, while at 1 HP, falling speed increases by 25% and spawning frequency by 20%; type 3 consecutive correct words while vulnerable to unlock +1 boss damage on subsequent correctly typed words, stacking with Show-Off; mistakes reset progress. Last Stand never grants this damage. A fresh Last Stand activates at stage start if already at 1 HP. Last Stand triggers once per stage.'}),
    anodyne: Object.freeze({id:'anodyne',name:'Anodyne',rarity:5,title:'Experimental Medicine',every:6,heal:2,slowPct:30,slowSec:5,suppressSec:4,
      description:'Every 6 correct words, administer one of three random medicines: Recovery Serum (+2 HP, can overheal), Cryogenic Solution (30% slower falling for 5 seconds), or Suppression Formula (no new spawns for up to 4 seconds; ends when no falling or stacked words remain).'}),
    seraphine: Object.freeze({id:'seraphine',name:'Seraphine',rarity:5,title:'Phantom Execution',every:5,pendingSec:3,
      description:'Every 5 manually typed words, mark the lowest falling word. Typing it eliminates another word for its minimum length-based score and normal boss damage.'}),
    tavi: Object.freeze({id:'tavi',name:'Tavi',rarity:6,title:'Foxfire Rewind',every:6,
      description:'After 6 consecutive correct words, rewind and hide falling and stacked words, then release them one at a time from shortest to longest. Mistakes reset the combo; rewound words cannot recharge it.'}),
    lupa: Object.freeze({id:'lupa',name:'Lupa',rarity:6,title:'Moonlit Ambush',every:6,weakpointCount:3,weakpointSec:6,bonusDamage:2,fullClearBonus:3,selfDamage:2,
      description:'After 6 consecutive correct words without error, mark 3 stacked Weak Point words for 6 seconds. Each cleared Weak Point deals +2 boss damage; clearing all 3 in time deals +3 more. Any remaining Weak Point deals 2 damage to the player when time expires.'}),
    hound: Object.freeze({id:'hound',name:'Hound',rarity:6,title:'Blood Hunt',every:4,preySec:6,chainSec:3,maxChain:3,bonusDamage:2,
      description:'After 4 consecutive correct words, type the marked Prey within 6 seconds to start Blood Hunt: complete up to 3 timed Prey (3 seconds each) for +2 boss damage apiece.'}),
    cassian: Object.freeze({id:'cassian',name:'Cassian',rarity:6,title:"Sovereign’s Decree",every:6,maxEliminations:3,invulnerableSec:5,
      description:'Every 6 correct words, instantly eliminate up to 3 falling words. Missing eliminations deal 1 boss damage each; 4+ available words grant 5 seconds of invulnerability.'})
  });
  const ALLOWED_MODES = new Set(['normal','extra','practice','story','challenge','shared']);
  const validTime=t=>Number.isFinite(t)&&t>=0?t:0;
  const fallingWord=w=>w&&w.state==='falling'&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost&&Number.isFinite(w.y);
  const rewindableWord=w=>w&&(w.state==='falling'||w.state==='landed')&&!w.ex3ExpiredGhost&&!w.s5Permafrost&&Number.isFinite(w.y);
  const lowestWord=words=>(Array.isArray(words)?words:[]).filter(fallingWord).reduce((best,w)=>!best||w.y>best.y?w:best,null);

  function create(characterId,mode,random=Math.random){
    const rule=ALLOWED_MODES.has(mode)?RULES[characterId]||null:null;
    let correct=0,activations=0,spawnPauseUntil=0,slowUntil=0,lastSlowAt=-Infinity;
    let frozen=null,freezeUntil=0,mistakeArmed=false,used=false;
    let streak=0,domainFreezeUntil=0,charged=false,marked=null,awaitingMark=false,executionPendingUntil=0;
    // 6★ state. Only one operator runs per game, so no inter-operator effect stacking.
    let foxfireProgress=0,foxfirePrimed=false,foxfireActive=false,foxfireQueue=[],foxfireCurrentId=null;
    let lupaProgress=0,lupaActive=false,lupaDeadline=0,lupaTargets=[];
    let houndProgress=0,houndPhase='none',houndMarked=null,houndDeadline=0,houndChainHits=0,houndNeedSpawn=false;
    let cassianProgress=0,cassianGuardUntil=0;
    let anodyneProgress=0;
    let chainCleaveProgress=0,chainCleaveUntil=0;
    let crossbowCombo=0,crossbowTarget=null,adrenalineActive=false,adrenalineTriggered=false,adrenalineLastStandUntil=0;
    let adrenalineMomentumStreak=0,adrenalineMomentumUnlocked=false;
    const crossbowTypeable=w=>w&&(w.state==='falling'||w.state==='landed')&&!w.ex2Hacked&&!w.ex3ExpiredGhost&&!w.s5Permafrost&&!w.foxfireHidden&&Number.isFinite(w.y);
    function releaseCrossbowTarget(){
      crossbowTarget?.el?.classList?.remove('operator-crossbow-bullseye');crossbowTarget=null;
    }
    function markCrossbowWord(word){
      if(rule?.id!=='crossbow'||!crossbowTypeable(word))return false;
      releaseCrossbowTarget();crossbowTarget=word;
      word.el?.classList?.add('operator-crossbow-bullseye');
      return true;
    }
    // Adrenaline's orange word glow means the +1 damage bonus is EARNED,
    // not merely that Fletcher is at 1 HP or temporarily invulnerable.
    function refreshAdrenalineWords(words){
      const glowing=adrenalineActive&&adrenalineMomentumUnlocked;
      for(const word of (Array.isArray(words)?words:[])){
        if(crossbowTypeable(word))word.el?.classList?.toggle('operator-crossbow-adrenaline',glowing);
      }
    }
    function syncAdrenaline(words,hp){
      if(rule?.id!=='crossbow')return false;
      const active=Number(hp)===rule.adrenalineHp;
      // Leaving 1 HP cancels both the temporary shield and earned momentum.
      // The once-per-stage activation flag remains spent until stage reset.
      if(!active&&adrenalineActive){
        adrenalineLastStandUntil=0;
        adrenalineMomentumStreak=0;
        adrenalineMomentumUnlocked=false;
      }
      if(adrenalineActive===active)return active;
      adrenalineActive=active;
      refreshAdrenalineWords(words);
      return active;
    }
    // The emergency invulnerability can occur just once per stage. All timings
    // use the pause-aware stage clock rather than wall-clock seconds.
    function getAdrenalinePhase(time){
      if(rule?.id!=='crossbow'||!adrenalineActive||!adrenalineTriggered)return 'off';
      return validTime(time)<adrenalineLastStandUntil?'last-stand':'overdrive';
    }
    function getSpawnIntervalMultiplier(time){
      const phase=getAdrenalinePhase(time);
      if(phase==='last-stand')return 1/rule.lastStandSpawnFrequency;
      if(phase==='overdrive')return 1/rule.overdriveSpawnFrequency;
      return 1;
    }
    function onWordSpawn(word,hp){
      if(rule?.id!=='crossbow')return;
      if(crossbowTypeable(word))word.el?.classList?.toggle('operator-crossbow-adrenaline',Number(hp)===rule.adrenalineHp&&adrenalineActive&&adrenalineMomentumUnlocked);
    }
    function longestCrossbowWord(words){
      const available=(Array.isArray(words)?words:[]).filter(crossbowTypeable);
      // Length uses A-Z letters, matching existing game vocabulary scoring.
      return available.reduce((best,w)=>{
        const len=String(w.answer||'').replace(/[^a-z]/gi,'').length;
        if(!best||len>best.len||(len===best.len&&w.y>best.word.y))return {word:w,len};
        return best;
      },null)?.word||null;
    }
    // Only words present at the below-3-HP activation are frozen; later spawns remain unaffected.
    let shieldUpperUsed=false,shieldLowerUsed=false;
    // One deferred charge at a time. Lower priority never overrides the 35% push.
    // The trigger is consumed only when at least one currently falling word is affected.
    let shieldPending=null;
    const shieldFrozenWords=new Map();
    function shieldLevelForHp(hp){
      if(rule?.id!=='shield'||!Number.isFinite(Number(hp))||Number(hp)<=0)return null;
      if(Number(hp)<rule.lowerHp&&!shieldLowerUsed)return 'lower';
      if(Number(hp)<rule.upperHp&&!shieldUpperUsed)return 'upper';
      return null;
    }
    function queueShield(level){
      if(!level)return;
      if(shieldPending!=='lower'||level==='lower')shieldPending=level;
    }
    function executeShield(level,time,words){
      const available=(Array.isArray(words)?words:[]).filter(fallingWord);
      if(!available.length){queueShield(level);return null;}
      // A stronger pending charge supersedes a weaker one. Consuming the lower
      // charge also consumes the upper charge, so two pushes cannot stack.
      if(level==='lower'){shieldLowerUsed=true;shieldUpperUsed=true;}
      else shieldUpperUsed=true;
      shieldPending=null;
      const percent=level==='lower'?rule.lowerPushPct:rule.upperPushPct;
      const freezeSeconds=level==='lower'?rule.freezeSec:0;
      if(freezeSeconds){
        const until=validTime(time)+freezeSeconds;
        for(const word of available){
          shieldFrozenWords.set(word.id,{word,until});
          word.el?.classList?.add('operator-shield-hold');
        }
      }
      activations++;
      return {type:'shield-advance',percent,freezeSeconds,wordIds:available.map(w=>w.id),characterId:rule.id};
    }
    function releaseShieldFrozen(){
      for(const {word} of shieldFrozenWords.values())word.el?.classList?.remove('operator-shield-hold');
      shieldFrozenWords.clear();
    }
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
    function releaseHoundMark(){
      houndMarked?.el?.classList?.remove('operator-hound-prey','operator-hound-chain');
      if(houndMarked?.el?.removeAttribute)houndMarked.el.removeAttribute('data-hunt-time');
      houndMarked=null;
    }
    function endHound(){
      releaseHoundMark();houndPhase='none';houndDeadline=0;houndChainHits=0;
      houndProgress=0;houndNeedSpawn=false;
    }
    function markHound(word,t){
      if(!fallingWord(word))return null;
      releaseHoundMark();houndMarked=word;houndNeedSpawn=false;
      const chain=houndPhase==='chain',seconds=chain?rule.chainSec:rule.preySec;
      houndDeadline=t+seconds;
      word.el?.classList?.add('operator-hound-prey');
      if(chain)word.el?.classList?.add('operator-hound-chain');
      if(word.el?.setAttribute)word.el.setAttribute('data-hunt-time',String(seconds));
      return {type:'hound-mark',wordId:word.id,seconds,chain,chainHits:houndChainHits,characterId:rule.id};
    }
    function startFoxfire(words){
      const ordered=(Array.isArray(words)?words:[]).filter(rewindableWord)
        .slice().sort((a,b)=>{
          const al=String(a.answer||'').replace(/[^a-z]/gi,'').length;
          const bl=String(b.answer||'').replace(/[^a-z]/gi,'').length;
          return al-bl||a.id-b.id;
        });
      foxfireProgress=0;
      if(!ordered.length){foxfirePrimed=true;return {type:'foxfire-ready',characterId:rule.id};}
      foxfirePrimed=false;foxfireActive=true;
      const ids=ordered.map(w=>w.id);
      foxfireCurrentId=ids[0];foxfireQueue=ids.slice(1);activations++;
      return {type:'foxfire-start',wordIds:ids,releaseId:foxfireCurrentId,characterId:rule.id};
    }

    function startLupa(wordIds,time){
      const ids=(Array.isArray(wordIds)?wordIds:[]).filter(id=>Number.isFinite(id));
      lupaProgress=0;
      if(!ids.length)return null;
      lupaActive=true;
      lupaTargets=ids.slice(0,rule.weakpointCount);
      lupaDeadline=validTime(time)+rule.weakpointSec;
      activations++;
      return {type:'lupa-start',wordIds:lupaTargets.slice(),seconds:rule.weakpointSec,characterId:rule.id};
    }
    function endLupa(){
      lupaActive=false;lupaDeadline=0;lupaTargets=[];lupaProgress=0;
    }
    function reset(){
      releaseFrozen();releaseMark();releaseHoundMark();correct=0;activations=0;spawnPauseUntil=0;slowUntil=0;
      lastSlowAt=-Infinity;mistakeArmed=false;used=false;streak=0;domainFreezeUntil=0;
      charged=false;awaitingMark=false;executionPendingUntil=0;
      foxfireProgress=0;foxfirePrimed=false;foxfireActive=false;foxfireQueue=[];foxfireCurrentId=null;
      endLupa();
      endHound();cassianProgress=0;cassianGuardUntil=0;anodyneProgress=0;
      chainCleaveProgress=0;chainCleaveUntil=0;
      shieldUpperUsed=false;shieldLowerUsed=false;shieldPending=null;releaseShieldFrozen();
      releaseCrossbowTarget();crossbowCombo=0;adrenalineActive=false;adrenalineTriggered=false;adrenalineLastStandUntil=0;
      adrenalineMomentumStreak=0;adrenalineMomentumUnlocked=false;
    }
    function tick(time){
      const t=validTime(time);
      if(frozen&&(t>=freezeUntil||frozen.state!=='falling'))releaseFrozen();
      if(rule?.id==='shield')for(const [id,entry] of shieldFrozenWords){
        if(t>=entry.until||entry.word.state!=='falling'||entry.word.el?.isConnected===false){
          entry.word.el?.classList?.remove('operator-shield-hold');shieldFrozenWords.delete(id);
        }
      }
      if(marked&&(marked.state!=='falling'||marked.el?.isConnected===false))releaseMark();
      if(crossbowTarget&&(!crossbowTypeable(crossbowTarget)||crossbowTarget.el?.isConnected===false))releaseCrossbowTarget();
      if(spawnPauseUntil&&t>=spawnPauseUntil)spawnPauseUntil=0;
      if(slowUntil&&t>=slowUntil)slowUntil=0;
      if(domainFreezeUntil&&t>=domainFreezeUntil)domainFreezeUntil=0;
      if(executionPendingUntil&&t>=executionPendingUntil)executionPendingUntil=0;
      if(rule?.id==='hound'&&houndPhase!=='none'){
        if(houndMarked){
          // Landing changes a word from 'falling' to 'landed', but it stays
          // typable in the word stack. Prey must keep its mark and countdown
          // until the player clears it, the timer expires, or it is removed.
          const stillTypable=(houndMarked.state==='falling'||houndMarked.state==='landed');
          const valid=stillTypable&&houndMarked.el?.isConnected!==false;
          if(!valid||t>=houndDeadline)endHound();
          else if(houndMarked.el?.setAttribute){
            const remaining=String(Math.max(1,Math.ceil(houndDeadline-t)));
            if(houndMarked.el.getAttribute?.('data-hunt-time')!==remaining)houndMarked.el.setAttribute('data-hunt-time',remaining);
          }
        }
      }
    }
    function isFieldFrozen(time){return rule?.id==='isolde'&&validTime(time)<domainFreezeUntil;}
    function isSpawnPaused(time){
      const t=validTime(time);
      return (rule?.id==='mira'&&t<spawnPauseUntil)||(rule?.id==='isolde'&&t<domainFreezeUntil)
        ||(rule?.id==='anodyne'&&t<spawnPauseUntil)
        ||(rule?.id==='tavi'&&foxfireActive);
    }
    function isWordFrozen(word,time){
      return (rule?.id==='nora'&&word===frozen&&validTime(time)<freezeUntil&&word.state==='falling')
        ||(rule?.id==='shield'&&word?.state==='falling'&&shieldFrozenWords.get(word?.id)?.word===word&&validTime(time)<(shieldFrozenWords.get(word?.id)?.until??0))
        ||isFieldFrozen(time);
    }
    function getFallMultiplier(time){
      if(!rule)return 1;
      const t=validTime(time);
      if(rule.id==='livia')return rule.fallMultiplier;
      if((rule.id==='alden'||rule.id==='elise')&&t<slowUntil)return 1-rule.slowPct/100;
      if(rule.id==='anodyne'&&t<slowUntil)return 1-rule.slowPct/100;
      if(rule.id==='crossbow'){
        const phase=getAdrenalinePhase(t);
        return phase==='last-stand'?rule.lastStandSpeedMultiplier:phase==='overdrive'?rule.overdriveSpeedMultiplier:1;
      }
      if(rule.id==='isolde'){
        if(t<domainFreezeUntil)return 0;
        if(t<slowUntil)return 1-rule.slowPct/100;
      }
      return 1;
    }
    function isChainCleaveActive(time){return rule?.id==='hexaxe'&&chainCleaveUntil>0&&validTime(time)<chainCleaveUntil;}
    function getChainCleaveRemaining(time){return isChainCleaveActive(time)?Math.max(0,chainCleaveUntil-validTime(time)):0;}
    function getMaxHpBonus(){return rule?.maxHpBonus||0;}
    function onMistake(time){
      if(!rule)return null;
      const t=validTime(time);
      if(rule.id==='crossbow'){
        crossbowCombo=0;
        if(!adrenalineMomentumUnlocked)adrenalineMomentumStreak=0;
        return null;
      }
      if(rule.id==='isolde'){streak=0;return null;}
      if(rule.id==='tavi'){
        if(!foxfireActive)foxfireProgress=0;
        return null;
      }
      if(rule.id==='lupa'){
        if(!lupaActive)lupaProgress=0;
        return null;
      }
      if(rule.id==='hound'){
        houndProgress=0;return null;
      }
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
    function activateFletcherLastStand(time){
      if(rule?.id!=='crossbow'||adrenalineTriggered||!adrenalineActive)return null;
      adrenalineTriggered=true;
      adrenalineLastStandUntil=validTime(time)+rule.lastStandSeconds;
      activations++;
      return {type:'fletcher-last-stand',seconds:rule.lastStandSeconds,characterId:rule.id};
    }
    // A Continue is a revive inside the SAME stage, not a stage reset. Clear
    // Fletcher's old life/temporary VFX, but keep adrenalineTriggered so the
    // 3-second invulnerability can never be farmed with Continue hearts.
    function onRevive(hp,time,words=[]){
      if(rule?.id==='shield'){
        shieldPending=null;
        releaseShieldFrozen();
        for(const word of (Array.isArray(words)?words:[])){
          word?.el?.classList?.remove('operator-shield-pushing','operator-shield-hold');
          word?.el?.style?.removeProperty?.('--mara-shield-push-distance');
        }
        return null; // Continue is not a new stage; used thresholds stay used.
      }
      if(rule?.id==='hexaxe'){chainCleaveProgress=0;chainCleaveUntil=0;return null;}
      if(rule?.id!=='crossbow')return null;
      releaseCrossbowTarget();
      crossbowCombo=0;
      adrenalineActive=false;
      adrenalineLastStandUntil=0;
      adrenalineMomentumStreak=0;
      adrenalineMomentumUnlocked=false;
      for(const word of (Array.isArray(words)?words:[])){
        word?.el?.classList?.remove('operator-crossbow-bullseye','operator-crossbow-adrenaline');
      }
      syncAdrenaline(words,hp);
      // Normal Continue resumes at 3 HP. Support a 1-HP revive safely if a
      // future mode adds one, without bypassing the once-per-stage restriction.
      return Number(hp)===rule.adrenalineHp?activateFletcherLastStand(time):null;
    }
    // Stage transitions retain player HP in Normal/Extra but reset operator
    // counters. Trigger a fresh emergency shield if Fletcher enters at 1 HP.
    // Called after the stage countdown: its 3 seconds are all playable time.
    function onStageStart(hp,time,words=[]){
      if(rule?.id==='shield'){
        // Stage carryover can start below a threshold with no fresh HP loss.
        // Arm (do not spend) the strongest applicable charge; updateField
        // waits for words to reach the middle of the playfield.
        queueShield(shieldLevelForHp(hp));
        return null;
      }
      if(rule?.id!=='crossbow')return null;
      syncAdrenaline(words,hp);
      return Number(hp)===rule.adrenalineHp?activateFletcherLastStand(time):null;
    }
    function onPlayerDamage(previousHp,nextHp,time,words=[]){
      if(rule?.id==='crossbow'){
        if(nextHp<previousHp){
          crossbowCombo=0;
          if(!adrenalineMomentumUnlocked)adrenalineMomentumStreak=0;
        }
        syncAdrenaline(words,nextHp);
        // Exactly 1 HP, reached through HP damage. A lethal hit ending at
        // 0 HP does not grant an automatic revive or protection.
        if(nextHp===rule.adrenalineHp&&previousHp>nextHp&&!adrenalineTriggered){
          return activateFletcherLastStand(time);
        }
        return null;
      }
      if(rule?.id==='shield'){
        // Thresholds are strictly below 10/3. A fatal hit cannot save Mara.
        // A low-HP start may already have queued a charge; any new HP damage
        // with falling words can spend it immediately (stronger always wins).
        if(!(nextHp>0&&nextHp<previousHp))return null;
        // Damage must CROSS a threshold; being below it is not enough.
        // A low-HP stage-start charge remains prepared until the field reaches
        // 40% depth, unless a fresh hit crosses a stronger threshold.
        const crossedLow=previousHp>=rule.lowerHp&&nextHp<rule.lowerHp&&!shieldLowerUsed;
        const crossedUpper=previousHp>=rule.upperHp&&nextHp<rule.upperHp&&!shieldUpperUsed;
        const level=crossedLow?'lower':crossedUpper?'upper':null;
        if(!level)return null;
        // Only the current HP crossing can spend the charge immediately; any
        // stale pending tier from before healing cannot override this one.
        shieldPending=level;
        return executeShield(level,time,words);
      }
      if(rule?.id!=='alden'||used||previousHp<=1||nextHp!==1)return null;
      used=true;activations++;slowUntil=validTime(time)+rule.durationSec;
      return {type:'slowdown',seconds:rule.durationSec,percent:rule.slowPct,characterId:rule.id};
    }
    function onCorrect(words,time,context={}){
      if(!rule)return null;
      correct++;
      const t=validTime(time);
      if(rule.id==='hexaxe'){
        // Hexed words remain real, manually typed answers with full rewards,
        // but none of them can charge the next Chain Cleave activation.
        if(context.clearedWord?.chainHexed)return null;
        if(++chainCleaveProgress<rule.every)return null;
        chainCleaveProgress=0;
        chainCleaveUntil=t+rule.durationSec;
        activations++;
        return {type:'chain-cleave-start',seconds:rule.durationSec,
          extraWords:rule.extraWords,maxExisting:rule.maxExisting,characterId:rule.id};
      }
      if(rule.id==='crossbow'){
        // The cleared word has already left the DOM, but its identity remains
        // available for correctly awarding both independent damage bonuses.
        const hit=!!crossbowTarget&&!!context.clearedWord&&crossbowTarget.id===context.clearedWord.id;
        if(hit)releaseCrossbowTarget();
        tick(t);
        crossbowCombo++;
        // HP can be healed by another stage mechanic between animation frames.
        // Use the current HP from this hit, not just the last per-frame sync.
        if(Number(context.hp)!==rule.adrenalineHp&&adrenalineActive)syncAdrenaline(words,context.hp);
        const phase=getAdrenalinePhase(t);
        const vulnerableOverdrive=Number(context.hp)===rule.adrenalineHp&&phase==='overdrive';
        // Earn progress only while vulnerable in Overdrive. The third word
        // unlocks the buff; the NEXT correctly typed word receives +1 damage.
        // A Show-Off bullseye can still grant its independent +1 at any time.
        const adrenaline=vulnerableOverdrive&&adrenalineMomentumUnlocked;
        let momentumUnlocked=false;
        if(vulnerableOverdrive&&!adrenalineMomentumUnlocked){
          adrenalineMomentumStreak++;
          if(adrenalineMomentumStreak>=rule.momentumWords){
            adrenalineMomentumUnlocked=true;
            momentumUnlocked=true;
            activations++;
            refreshAdrenalineWords(words);
          }
        }
        const bonusDamage=(hit?rule.showOffDamage:0)+(adrenaline?rule.adrenalineDamage:0);
        if(crossbowCombo%rule.every===0){
          const word=longestCrossbowWord(words);
          if(word){
            markCrossbowWord(word);activations++;
            return {type:'crossbow-showoff',wordId:word.id,bonusDamage,hit,adrenaline,momentumUnlocked,characterId:rule.id};
          }
          // Empty battlefield: the real stage vocabulary will provide the
          // longest answer. A forced word is not a free typed answer.
          return {type:'crossbow-showoff',forceLongest:true,bonusDamage,hit,adrenaline,momentumUnlocked,characterId:rule.id};
        }
        return (bonusDamage||momentumUnlocked)?{type:'crossbow-hit',bonusDamage,hit,adrenaline,momentumUnlocked,characterId:rule.id}:null;
      }
      // Capture the marked-word hit before tick() removes DOM-disconnected marks.
      const wasMarkedHit=rule.id==='seraphine'&&!!marked&&!!context.clearedWord&&marked.id===context.clearedWord.id;
      // Capture the prey before tick() sees the newly removed DOM node.
      const houndPreviousPhase=houndPhase;
      const wasHoundHit=rule.id==='hound'&&!!houndMarked&&!!context.clearedWord
        &&houndMarked.id===context.clearedWord.id&&t<houndDeadline;
      // The DOM was removed before onCorrect; preserve the ongoing hunt's
      // chain count rather than letting tick() treat that as a failed mark.
      if(wasHoundHit)releaseHoundMark();
      tick(t);
      if(rule.id==='lupa'){
        const clearedId=context.clearedWord?.id??null;
        if(lupaActive){
          if(!Number.isFinite(clearedId)||!lupaTargets.includes(clearedId))return null;
          lupaTargets=lupaTargets.filter(id=>id!==clearedId);
          if(!lupaTargets.length){
            endLupa();
            return {type:'lupa-complete',damage:rule.bonusDamage+rule.fullClearBonus,characterId:rule.id};
          }
          return {type:'lupa-hit',damage:rule.bonusDamage,remaining:lupaTargets.length,characterId:rule.id};
        }
        if(++lupaProgress>=rule.every){
          lupaProgress=0;
          return {type:'lupa-ready',characterId:rule.id};
        }
        return null;
      }
      if(rule.id==='tavi'){
        // Rewound words never charge the next combo, even if typed after landing.
        if(foxfireActive||foxfirePrimed||context.clearedWord?.foxfireOrigin)return null;
        if(++foxfireProgress>=rule.every)return startFoxfire(words);
        return null;
      }
      if(rule.id==='hound'){
        if(wasHoundHit){
          releaseHoundMark();
          if(houndPreviousPhase==='initial'){
            houndPhase='chain';houndChainHits=0;
          }else if(houndPreviousPhase==='chain'){
            houndChainHits++;
          }
          const awarded=houndPreviousPhase==='chain'?rule.bonusDamage:0;
          if(houndChainHits>=rule.maxChain){
            endHound();return {type:'hound-complete',damage:awarded,characterId:rule.id};
          }
          const next=lowestWord(words);
          if(next)markHound(next,t);
          else houndNeedSpawn=true;
          return {type:'hound-next',damage:awarded,chainHits:houndChainHits,
            wordId:houndMarked?.id??null,forceSpawn:houndNeedSpawn,characterId:rule.id};
        }
        // A word unrelated to the hunt is typed; it earns normal rewards, not combo progress.
        if(houndPhase!=='none')return null;
        if(++houndProgress>=rule.every){
          houndProgress=0;houndPhase='initial';
          const target=lowestWord(words);
          if(target)return markHound(target,t);
          return {type:'hound-await-prey',characterId:rule.id};
        }
        return null;
      }
      if(rule.id==='cassian'){
        if(t<cassianGuardUntil)return null; // no activation progress under invulnerability
        if(++cassianProgress<rule.every)return null;
        cassianProgress=0;activations++;
        const eligible=(Array.isArray(words)?words:[]).filter(fallingWord).slice()
          .sort((a,b)=>b.y-a.y||a.id-b.id);
        const chosen=eligible.slice(0,rule.maxEliminations);
        if(eligible.length>rule.maxEliminations)cassianGuardUntil=t+rule.invulnerableSec;
        return {type:'cassian-decree',wordIds:chosen.map(w=>w.id),
          missingDamage:rule.maxEliminations-chosen.length,
          invulnerable:eligible.length>rule.maxEliminations,
          seconds:eligible.length>rule.maxEliminations?rule.invulnerableSec:0,
          characterId:rule.id};
      }
      if(rule.id==='anodyne'){
        if(++anodyneProgress<rule.every)return null;
        anodyneProgress=0;activations++;
        // Roll once per six manually typed correct answers. Mistakes do not reset progress.
        // RNG argument is optional and used for repeatable local simulations.
        const roll=Math.max(0,Math.min(0.999999,Number(random())||0));
        if(roll<1/3)return {type:'anodyne-serum',hp:rule.heal,allowOverheal:true,characterId:rule.id};
        if(roll<2/3){
          slowUntil=t+rule.slowSec;
          return {type:'anodyne-cryo',seconds:rule.slowSec,percent:rule.slowPct,characterId:rule.id};
        }
        // Suppression only pauses while at least one typable word remains.
        const active=(Array.isArray(words)?words:[]).some(w=>w&&(w.state==='falling'||w.state==='landed'));
        spawnPauseUntil=active?t+rule.suppressSec:0;
        return active
          ? {type:'anodyne-suppression',seconds:rule.suppressSec,characterId:rule.id}
          : {type:'anodyne-suppression-ended',reason:'empty',characterId:rule.id};
      }
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
    function updateField(words,time,context={}){
      if(rule?.id==='shield'){
        tick(time);
        if(!shieldPending)return null;
        // Healing can cancel a stronger emergency before it has been spent.
        // If Mara is still below 10, downgrade to the remaining 10% charge.
        if(Number.isFinite(Number(context.hp))){
          const applicable=shieldLevelForHp(context.hp);
          if(!applicable){shieldPending=null;return null;}
          shieldPending=applicable;
        }
        const available=(Array.isArray(words)?words:[]).filter(fallingWord);
        const height=Number(context.laneHeight);
        // Deferred effects require a meaningful field position. The same
        // rule covers low-HP stage starts and empty-field damage triggers.
        if(!(height>0)||!available.some(w=>w.y>=height*rule.emergencyDepthPct/100))return null;
        return executeShield(shieldPending,time,available);
      }
      if(rule?.id==='crossbow'){
        // If the target was removed by a stage mechanic, never leave a stale marker.
        tick(time);
        return null;
      }
      if(rule?.id==='anodyne'&&spawnPauseUntil){
        const active=(Array.isArray(words)?words:[]).some(w=>w&&(w.state==='falling'||w.state==='landed'));
        if(!active){
          spawnPauseUntil=0;
          return {type:'anodyne-suppression-ended',reason:'empty',characterId:rule.id};
        }
      }
      if(rule?.id==='lupa'){
        const t=validTime(time);
        if(!lupaActive)return null;
        if(t<lupaDeadline)return null;
        const activeIds=new Set((Array.isArray(words)?words:[]).map(w=>w.id));
        const remaining=lupaTargets.filter(id=>activeIds.has(id));
        const count=remaining.length;
        endLupa();
        return {type:'lupa-timeout',remainingWordIds:remaining,selfDamage:count*rule.selfDamage,count,characterId:rule.id};
      }
      if(rule?.id==='tavi'){
        if(foxfirePrimed){
          const available=(Array.isArray(words)?words:[]).some(rewindableWord);
          if(available)return startFoxfire(words);
        }
        if(!foxfireActive)return null;
        const current=(Array.isArray(words)?words:[]).find(w=>w.id===foxfireCurrentId);
        if(current&&current.state==='falling')return null;
        const next=foxfireQueue.shift();
        if(next!=null){
          foxfireCurrentId=next;
          return {type:'foxfire-next',wordId:next,characterId:rule.id};
        }
        foxfireActive=false;foxfireCurrentId=null;foxfireQueue=[];foxfireProgress=0;
        return {type:'foxfire-end',characterId:rule.id};
      }
      if(rule?.id==='hound'){
        const t=validTime(time);tick(t);
        if(houndPhase==='none'||houndMarked)return null;
        const target=lowestWord(words);
        if(target)return markHound(target,t);
        if(houndPhase==='chain'&&!houndNeedSpawn){
          houndNeedSpawn=true;
          return {type:'hound-force-spawn',characterId:rule.id};
        }
        return null;
      }
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
      frozenWordId:frozen?.id??null,mistakeArmed,used,
      lupaProgress,lupaActive,lupaDeadline,lupaTargets:lupaTargets.slice(),
      foxfireProgress,foxfirePrimed,foxfireActive,foxfireQueue:foxfireQueue.slice(),foxfireCurrentId,
      houndProgress,houndPhase,houndPreyId:houndMarked?.id??null,houndDeadline,houndChainHits,houndNeedSpawn,
      cassianProgress,cassianGuardUntil,anodyneProgress,chainCleaveProgress,chainCleaveUntil,
      shieldUpperUsed,shieldLowerUsed,shieldPending,shieldFrozenIds:[...shieldFrozenWords.keys()],
      crossbowCombo,crossbowTargetId:crossbowTarget?.id??null,adrenalineActive,
      adrenalineTriggered,adrenalineLastStandUntil,
      adrenalineMomentumStreak,adrenalineMomentumUnlocked};}
    function isInvulnerable(time){return (rule?.id==='cassian'&&validTime(time)<cassianGuardUntil)||getAdrenalinePhase(time)==='last-stand';}
    function isFoxfireHidden(word){return rule?.id==='tavi'&&!!word?.foxfireHidden;}
    return Object.freeze({rule,reset,tick,onCorrect,onMistake,onPlayerDamage,onStageStart,onRevive,updateField,
      startLupa,markCrossbowWord,syncAdrenaline,onWordSpawn,
      isSpawnPaused,isWordFrozen,isFieldFrozen,getFallMultiplier,getSpawnIntervalMultiplier,getAdrenalinePhase,getMaxHpBonus,
      isInvulnerable,isFoxfireHidden,isChainCleaveActive,getChainCleaveRemaining,debug});
  }
  window.RPG_OPERATOR_PASSIVES=Object.freeze({RULES,ALLOWED_MODES,create});
})();
