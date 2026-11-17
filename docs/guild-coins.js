/* Guild Coins v73 — zero-cost client-reported rewards.
 * Browser results are NOT proof of gameplay. These coins are visible but recruitment
 * spending stays disabled until an authoritative reward/pull backend exists. */
(() => {
 'use strict';
 const COST_SINGLE=100, COST_TEN=1000;
 function accuracy(correct,incorrect){
  correct=Math.max(0,Math.trunc(Number(correct)||0));incorrect=Math.max(0,Math.trunc(Number(incorrect)||0));
  return correct+incorrect>0 ? (100*correct/(correct+incorrect)) : 0;
 }
 function preview(mode,correct=0,incorrect=0,firstClear=false){
  if(mode==='normal'||mode==='extra'){
   const base=mode==='normal'?10:15;return base+(accuracy(correct,incorrect)>=90?5:0);
  }
  return mode==='story'?(firstClear?20:5):0;
 }
 async function claim({mode,runToken=null,stageId=null,attemptId=null,firstClear=false,correct=0,incorrect=0}={}){
  if(!window.RPG_V68_CONNECTION?.connected||window.RPG_V66_DISCONNECTED)throw Error('Connection required.');
  const cardCode=window.ADVENTURE_PLAYER?.card_code;
  if(!cardCode)throw Error('Sign in with your Player Card.');
  return window.RPG_V66.call('/api/guild/claim',{card_code:cardCode,mode,run_token:runToken,stage_id:stageId,attempt_id:attemptId,first_clear:firstClear,correct,incorrect});
 }
 window.RPG_GUILD={COST_SINGLE,COST_TEN,accuracy,preview,claim};
})();
