/* v69: small, request-bounded media cache. No service worker, no offline play. */
(function(){
  'use strict';
  const catalog=window.RPG_ASSET_MANIFEST||{};
  const base=new URL('.',document.baseURI);
  const pictures=new Map(), prefetchedAudio=new Set();
  const MAX_IMAGES=24,MAX_AUDIO=3;
  function classify(raw){
    const value=String(raw||'').trim();
    if(!value)return {present:false,url:''};
    let u;try{u=new URL(value,base);}catch(_){return {present:false,url:''};}
    if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return {present:true,url:value,external:true};
    let path;try{path=decodeURIComponent(u.pathname.slice(base.pathname.length));}catch(_){return {present:false,url:''};}
    const entry=catalog[path];
    if(!entry){
      // Story Editor assets are published later via GitHub and won't exist in
      // the build-time asset manifest. Permit safe same-origin Story media.
      if(/^story\/images\/[\w.-]+\.(?:png|webp|jpg|jpeg|svg)$/i.test(path) ||
         /^story\/audio\/[a-zA-Z0-9][\w.-]*\.(?:mp3|m4a|webm|opus|ogg|wav)$/i.test(path))
        return {present:true,url:u.href,path,bytes:0};
      return {present:false,url:'',missing:path};
    }
    u.searchParams.set('v',entry.hash);
    return {present:true,url:u.href,path,bytes:entry.bytes};
  }
  function image(raw){
    const info=classify(raw);
    if(!info.present)return Promise.resolve(false);
    if(pictures.has(info.url))return pictures.get(info.url);
    const pending=new Promise(resolve=>{
      const img=new Image();img.decoding='async';let done=false;
      const finish=ok=>{if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(ok);};
      const timer=setTimeout(()=>{finish(false);img.removeAttribute?.('src');},12000);
      img.onload=()=>{if(typeof img.decode==='function'){img.decode().then(()=>finish(true),()=>finish(true));}else finish(true);};
      img.onerror=()=>finish(false);img.src=info.url;
    });
    pictures.set(info.url,pending);
    // Failed preloads are never cached permanently; bound settled entries.
    pending.then(ok=>{if(!ok&&pictures.get(info.url)===pending)pictures.delete(info.url);while(pictures.size>MAX_IMAGES)pictures.delete(pictures.keys().next().value);});
    return pending;
  }
  function audio(raw){
    const info=classify(raw);
    if(!info.present||prefetchedAudio.has(info.url))return;
    if(navigator.connection?.saveData||/(^|-)2g$/.test(navigator.connection?.effectiveType||''))return;
    if(prefetchedAudio.size>=MAX_AUDIO)return;
    prefetchedAudio.add(info.url);
    const link=document.createElement('link');
    link.rel='prefetch';link.as='audio';link.href=info.url;
    const release=()=>{prefetchedAudio.delete(info.url);link.remove();};
    link.addEventListener('error',release,{once:true});
    // Keep only a bounded set of background hints, not unbounded DOM nodes.
    document.head.appendChild(link);
  }
  function stage(stage,includeAudio=true){
    if(!stage)return Promise.resolve([]);
    const pending=[stage.bgFile,stage.bossFile,stage.bossFile2,stage.bossFile3].filter(Boolean).map(image);
    if(includeAudio){audio(stage.playBgmFile);audio(stage.dialogueBgmFile);}
    return Promise.all(pending);
  }
  let scheduled=null;
  function next(stageToPreload){
    if(scheduled!=null){if(typeof cancelIdleCallback==='function')cancelIdleCallback(scheduled);else clearTimeout(scheduled);scheduled=null;}
    if(!stageToPreload||document.hidden||navigator.connection?.saveData||/(^|-)2g$/.test(navigator.connection?.effectiveType||''))return;
    const run=()=>{scheduled=null;void stage(stageToPreload,true);};
    if(typeof requestIdleCallback==='function')scheduled=requestIdleCallback(run,{timeout:2200});
    else scheduled=setTimeout(run,250);
  }
  window.RPG_MEDIA=Object.freeze({classify,image,audio,stage,next,has:raw=>classify(raw).present,url:raw=>classify(raw).url});
})();
