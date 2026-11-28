/* Recruitment music (v1): plays the featured operator's theme from the start of the
 * Recruitment intro, loops, and fades out when the student leaves Recruitment.
 * Tracks live at story/audio/recruit-<operator id>.webm. An operator without a file just
 * has no music, so new themes only need the file uploaded with that name. */
(function(){
 'use strict';
 const VOL=0.35,ID=/^[a-z][a-z0-9_]{0,39}$/;
 let audio=null,current='',fadeTimer=0,leaving=false;
 function fade(to,ms,done){
  clearInterval(fadeTimer);if(!audio){done?.();return;}
  const from=audio.volume,start=performance.now();
  fadeTimer=setInterval(()=>{const k=Math.min(1,(performance.now()-start)/ms);try{audio.volume=from+(to-from)*k;}catch(_){}
   if(k>=1){clearInterval(fadeTimer);done?.();}},40);
 }
 function unlock(){
  const retry=()=>{window.removeEventListener('pointerdown',retry,true);window.removeEventListener('keydown',retry,true);if(audio&&audio.paused&&!leaving)audio.play().then(()=>fade(VOL,800)).catch(()=>{});};
  window.addEventListener('pointerdown',retry,true);window.addEventListener('keydown',retry,true);
 }
 function play(id){
  id=String(id||'');if(!ID.test(id)||id===current||leaving)return;
  current=id;
  const old=audio;if(old){fade(0,400,()=>{old.pause();});}
  const a=new Audio(`story/audio/recruit-${id}.webm`);
  a.loop=true;a.preload='auto';a.volume=0;audio=a;
  a.addEventListener('error',()=>{if(audio===a)audio=null;},{once:true}); // no theme for this operator yet
  a.play().then(()=>{if(audio===a)fade(VOL,800);}).catch(()=>unlock());
 }
 function stop(ms=450){leaving=true;if(audio)fade(0,ms,()=>{try{audio.pause();}catch(_){}});}
 // Leaving through any same-origin link fades the music while the page transition plays.
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');
  if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank')return;
  const url=new URL(a.getAttribute('href'),location.href);
  if(url.origin===location.origin&&url.pathname!==location.pathname)stop();
 },true);
 window.addEventListener('pagehide',()=>{try{audio?.pause();}catch(_){}});
 window.addEventListener('pageshow',e=>{if(e.persisted&&audio){leaving=false;audio.volume=0;audio.play().then(()=>fade(VOL,800)).catch(()=>unlock());}});
 window.RPG_RECRUIT_BGM={play,stop,state:()=>({id:current,paused:audio?audio.paused:null,volume:audio?+audio.volume.toFixed(2):null})};
})();
