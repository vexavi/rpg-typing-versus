/* v76: Pure validation for teacher Guild Coin grants. No browser-only authority.
 * The Firestore transaction and teacher-only rules are the enforcement point. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.RPG_GUILD_GRANTS_CORE=api;})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const MAX_GRANT=1000000;
 const MAX_BALANCE=1000000000;
 const idPattern=/^P\d{6,}$/;
 function amount(value){
  const raw=String(value).trim();
  if(!/^[1-9]\d*$/.test(raw))throw Error('Enter a whole number greater than zero.');
  const n=Number(raw);
  if(!Number.isSafeInteger(n)||n>MAX_GRANT)throw Error('Grant must be between 1 and 1,000,000 Guild Coins.');
  return n;
 }
 function balance(old,added){
  if(!Number.isSafeInteger(old)||old<0||old>MAX_BALANCE)throw Error('Player Guild Coin balance is invalid.');
  if(!Number.isSafeInteger(added)||added<1||added>MAX_GRANT)throw Error('Invalid grant amount.');
  if(old+added>MAX_BALANCE)throw Error('Guild Coin wallet limit reached (1,000,000,000).');
  return old+added;
 }
 function playerId(value){
  const id=String(value||'').trim().toUpperCase();
  if(!idPattern.test(id))throw Error('Select a valid player.');
  return id;
 }
 function note(value){
  const clean=String(value||'').replace(/\s+/g,' ').trim();
  if(clean.length>100)throw Error('Reason can be up to 100 characters.');
  return clean;
 }
 return Object.freeze({MAX_GRANT,MAX_BALANCE,amount,balance,playerId,note});
});
