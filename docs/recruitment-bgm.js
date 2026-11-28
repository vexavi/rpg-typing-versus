/* Recruitment music (v2): plays the featured operator's theme from the start of the
 * Recruitment intro, loops, and fades out when the student leaves Recruitment.
 * Tracks live at story/audio/recruit-<operator id>.webm. An operator without a file just
 * has no music, so new themes only need the file uploaded with that name.
 *
 * v2 fixes: each track fades on its own (switching tracks no longer leaves the old one
 * playing), music pauses while the tab is hidden, a cancelled "leave" brings the music
 * back, the click-to-start fallback is registered once, and previews no longer cut each
 * other off. */
(function(){
 'use strict';
 const VOL=0.35,ID=/^[a-z][a-z0-9_]{0,39}$/;
 let audio=null,current='',leaving=false,waiting=false,resumeTimer=0,previewTimer=0,hiddenPaused=false;

 // Fade one element; each element keeps its own timer so two tracks can cross-fade.
 function fade(el,to,ms,done){
  if(!el){done?.();return;}
  clearInterval(el.__fade);
  const from=Number.isFinite(el.volume)?el.volume:0,start=performance.now();
  el.__fade=setInterval(()=>{
   const k=Math.min(1,(performance.now()-start)/ms);
   try{el.volume=Math.max(0,Math.min(1,from+(to-from)*k));}catch(_){}
   if(k>=1){clearInterval(el.__fade);el.__fade=0;done?.();}
  },40);
 }
 function begin(el){
  if(!el||leaving)return;
  el.play().then(()=>{if(audio===el&&!leaving)fade(el,VOL,800);}).catch(e=>{
   if(audio!==el)return;
   console.info('[Recruit BGM] waiting for a click/key to start music:',e?.name||e);unlock();
  });
 }
 // Browsers may block sound until the student clicks or presses a key on this page.
 function unlock(){
  if(waiting)return;waiting=true;
  const retry=()=>{
   window.removeEventListener('pointerdown',retry,true);window.removeEventListener('keydown',retry,true);waiting=false;
   if(audio&&audio.paused&&!leaving&&document.visibilityState!=='hidden')begin(audio);
  };
  window.addEventListener('pointerdown',retry,true);window.addEventListener('keydown',retry,true);
 }
 function play(id){
  id=String(id||'');if(!ID.test(id)||id===current||leaving)return;
  current=id;
  const old=audio;
  if(old)fade(old,0,400,()=>{try{old.pause();}catch(_){}});
  const a=new Audio(`story/audio/recruit-${id}.webm`);
  a.loop=true;a.preload='auto';a.volume=0;audio=a;
  a.addEventListener('error',()=>{console.info(`[Recruit BGM] no track at story/audio/recruit-${id}.webm`);if(audio===a)audio=null;},{once:true}); // no theme for this operator yet
  begin(a);
 }
 function stop(ms=450){
  leaving=true;const el=audio;
  if(el)fade(el,0,ms,()=>{try{el.pause();}catch(_){}});
  // If the page is still here a few seconds later, the leave was cancelled: bring it back.
  clearTimeout(resumeTimer);
  resumeTimer=setTimeout(()=>{if(document.visibilityState==='visible'&&leaving&&!document.querySelector('.ef-wipe.is-in'))resume();},4000);
 }
 function resume(){
  leaving=false;const el=audio;if(!el)return;
  clearInterval(el.__fade);try{el.volume=0;}catch(_){}
  begin(el);
 }
 // Leaving through any same-origin link fades the music while the page transition plays.
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');
  if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank')return;
  let url;try{url=new URL(a.getAttribute('href'),location.href);}catch(_){return;}
  if(url.origin===location.origin&&url.pathname!==location.pathname)stop();
 },true);
 // Hidden tab (another tab, laptop lid): pause; back in front: continue.
 document.addEventListener('visibilitychange',()=>{
  const el=audio;if(!el)return;
  if(document.visibilityState==='hidden'){if(!el.paused){hiddenPaused=true;clearInterval(el.__fade);try{el.pause();}catch(_){}}}
  else if(hiddenPaused&&!leaving){hiddenPaused=false;try{el.volume=0;}catch(_){}begin(el);}
 });
 window.addEventListener('pagehide',()=>{clearTimeout(resumeTimer);try{audio?.pause();}catch(_){}});
 // Back button restores the page from cache: start the theme again.
 window.addEventListener('pageshow',e=>{if(e.persisted&&audio){clearTimeout(resumeTimer);resume();}});

 /** Banner editor preview: play the theme for the length of the intro, then fade. */
 function preview(id,ms=5200){
  clearTimeout(previewTimer);clearTimeout(resumeTimer);leaving=false;
  if(id!==current||!audio||audio.paused){current='';play(id);}
  previewTimer=setTimeout(()=>{const el=audio;fade(el,0,700,()=>{try{el?.pause();}catch(_){}if(audio===el)current='';});},ms);
 }
 window.RPG_RECRUIT_BGM={play,stop,preview,state:()=>({id:current,paused:audio?audio.paused:null,volume:audio?+audio.volume.toFixed(2):null,leaving})};
})();
