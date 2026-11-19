/* Future custom word mechanics go here; append RPG_MECHANICS.register({...}).
 * Registration is deliberately CODE, not executable strings downloaded from Firebase.
 * Example hook signatures: onSpawn({word,mode,stageIndex}, settings),
 * onTick({word,dt,mode},settings), onCorrect({word,mode},settings),
 * onLand({word,mode},settings), onMistake, onPlayerDamage, onStageStart.
 * The context also includes spawn(options), remove(id), damagePlayer(n), damageBoss(n), time(). Settings: .enabled() and .get(key,fallback).
 * Declare fields for the dashboard: boolean or bounded number.
 * Add the implementation once, then manage its settings live without code changes.
 */

// Included example: a safe, opt-in story mechanic that changes falling speed of selected words.
// The editor discovers its fields automatically. New behaviors can be registered similarly.
window.RPG_MECHANICS?.register({
 id:'drift_words', label:'Drifting Words', description:'Randomly slow some falling words in Story battles.',
 modes:['story'], defaultEnabled:false,
 fields:[
  {key:'enabled',label:'Enabled',type:'boolean',default:false},
  {key:'chancePct',label:'Affected words (%)',type:'number',min:0,max:100,step:1,default:25},
  {key:'speedPercent',label:'Word speed (%)',type:'number',min:20,max:200,step:5,default:65}
 ],
 onSpawn(ctx,settings){
  if(!ctx.word||Math.random()*100>=settings.get('chancePct',25))return;
  const percent=Number(settings.get('speedPercent',65));
  ctx.word.fallMult=(ctx.word.fallMult||1)*Math.max(0.2,Math.min(2,percent/100));
  ctx.word.el?.classList.add('story-drifting-word');
 }
});
