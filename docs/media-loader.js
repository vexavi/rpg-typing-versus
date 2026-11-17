/* v69: small, request-bounded media cache. No service worker, no offline play. */
(function(){
  'use strict';
  const catalog=window.RPG_ASSET_MANIFEST||{};
  const base=new URL('.',document.baseURI);
  const pictures=new Map(), prefetchedAudio=new Set();
  function classify(raw){
    const value=String(raw||'').trim();
    if(!value)return {present:false,url:''};
    let u;try{u=new URL(value,base);}catch(_){return {present:false,url:''};}
    if(u.origin!==base.origin||!u.pathname.startsWith(base.pathname))return {present:true,url:value,external:true};
    const path=decodeURIComponent(u.pathname.slice(base.pathname.length));
    const entry=catalog[path];
    if(!entry)return {present:false,url:'',missing:path};
    u.searchParams.set('v',entry.hash);
    return {present:true,url:u.href,path,bytes:entry.bytes};
  }
  function image(raw){
    const info=classify(raw);
    if(!info.present)return Promise.resolve(false);
    if(pictures.has(info.url))return pictures.get(info.url);
    const pending=new Promise(resolve=>{
      const img=new Image();
      img.decoding='async';
      img.onload=()=>{if(typeof img.decode==='function'){img.decode().then(()=>resolve(true),()=>resolve(true));}else resolve(true);};
      img.onerror=()=>resolve(false);
      img.src=info.url;
    });
    pictures.set(info.url,pending);
    return pending;
  }
  function audio(raw){
    const info=classify(raw);
    if(!info.present||prefetchedAudio.has(info.url))return;
    if(navigator.connection?.saveData||/(^|-)2g$/.test(navigator.connection?.effectiveType||''))return;
    prefetchedAudio.add(info.url);
    const link=document.createElement('link');
    link.rel='prefetch';link.as='audio';link.href=info.url;
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
    if(!stageToPreload)return;
    if(scheduled!=null){if(typeof cancelIdleCallback==='function')cancelIdleCallback(scheduled);else clearTimeout(scheduled);}
    const run=()=>{scheduled=null;void stage(stageToPreload,true);};
    if(typeof requestIdleCallback==='function')scheduled=requestIdleCallback(run,{timeout:2200});
    else scheduled=setTimeout(run,250);
  }
  window.RPG_MEDIA=Object.freeze({classify,image,audio,stage,next,has:raw=>classify(raw).present,url:raw=>classify(raw).url});
})();
