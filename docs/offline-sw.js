/* v86.9 Offline shell. Public static content only. No Firestore/API responses or card codes.
 * v148.9 loading speed (Chromebooks):
 *  - Images, audio and fonts live in their own cache (MEDIA) that survives game updates,
 *    so a new version never re-downloads 11 MB of art.
 *  - Media is served from cache instantly. Content-hashed URLs (?v=<hash>) are trusted;
 *    other media is refreshed quietly in the background for next time.
 *  - Pages (HTML) stay network-first but fall back to the saved copy after 3 seconds.
 *  - Code (js/css/json): build.json holds a fingerprint of all code. If it matches the
 *    build the saved code came from, code is served from cache at once (and refreshed in
 *    the background, in case a single file was edited by hand). If it changed, all saved
 *    code is dropped and loaded fresh, so old and new code never mix.
 *  - After Mode Select is idle, the page may ask for a slow background warm-up of the rest
 *    of the art and music ('warm' message), two files at a time.
 */
'use strict';
const VERSION='rpg-shell-v1480';
const MEDIA='rpg-media-v1';
const BASE=new URL('./',self.registration.scope);
const CORE=["adventure.html", "online-boot-v66.js", "offline-session.js", "game-balance-runtime.js", "game-balance-cloud.js", "adventure_engine.js", "squad-tutorial.js", "conquest-core.js", "conquest-map.js", "operator-passives.js", "story-mode.js", "story-content-cloud.js", "adventure_rewards.js", "guild-coins.js", "game-mechanics.js", "custom-mechanics.js", "asset-manifest.js", "media-loader.js", "performance-meter.js", "rpg-theme.css", "adventure-ui.css", "chapter-special.css", "story-mode.css", "student-ui.css", "story-map-v54.css", "guild-coins.css", "ak-theme.css", "ak-theme.js", "battle-fx.css", "battle-marks.css", "battle-fx.js", "aura-fx.css", "aura-fx.js", "assets/fonts/ak-roboto-var.woff2", "story/chapters.json", "story/audio/ch1-battle.webm", "icon01.webp", "icon02.webp", "assets/boss_hit.m4a", "assets/player_hit.m4a", "assets/card_themes/navy.webp", "assets/card_themes/crimson.webp", "assets/card_themes/forest.webp", "assets/card_themes/violet.webp", "assets/previews/qr-v82-returning.webp", "assets/previews/qr-v82-first-time.webp", "assets/characters/mc.webp", "assets/profile-icons/alden.webp", "assets/profile-icons/aveline.webp", "assets/profile-icons/cassian.webp", "assets/profile-icons/elise.webp", "assets/profile-icons/hound.webp", "assets/profile-icons/isolde.webp", "assets/profile-icons/kade.webp", "assets/profile-icons/livia.webp", "assets/profile-icons/mc.webp", "assets/profile-icons/mira.webp", "assets/profile-icons/nora.webp", "assets/profile-icons/seraphine.webp", "assets/profile-icons/tavi.webp", "assets/profile-icons/lupa.webp", "assets/profile-icons/anodyne.webp", "assets/profile-icons/shield.webp", "assets/profile-icons/crossbow.webp", "assets/profile-icons/hexaxe.webp", "assets/profile-icons/nitrate.webp", "assets/profile-icons/vern.webp", "assets/profile-icons/vex.webp", "assets/recruitment/cassian.webp", "assets/recruitment/livia.webp", "assets/recruitment/vex.webp", "assets/recruitment/aveline.webp", "assets/recruitment/nora.webp", "assets/recruitment/elise.webp", "assets/recruitment/hound.webp", "assets/recruitment/alden.webp", "assets/recruitment/vern.webp", "assets/recruitment/mira.webp", "assets/recruitment/tavi.webp", "assets/recruitment/lupa.webp", "assets/recruitment/anodyne.webp", "assets/recruitment/shield.webp", "assets/recruitment/crossbow.webp", "assets/recruitment/hexaxe.webp", "assets/recruitment/nitrate.webp", "assets/recruitment/seraphine.webp", "assets/recruitment/isolde.webp", "assets/recruitment/kade.webp", "story/images/map-placeholder.svg", "story/images/placeholder-04.svg", "story/images/placeholder-03.svg", "story/images/placeholder-02.svg", "story/images/placeholder-01.svg"];
const allowedExt=/\.(?:html|js|mjs|css|json|webp|png|jpg|jpeg|svg|m4a|mp3|opus|webm|ogg|wav|woff2)$/i;
const mediaExt=/\.(?:webp|png|jpg|jpeg|svg|m4a|mp3|opus|webm|ogg|wav|woff2)$/i;
const NETWORK_WAIT_MS=3000,BUILD_CHECK_MS=2500,BUILD_TTL_MS=30000;
const BUILD_KEY=new Request(new URL('__build-id__',BASE).href);
let buildCheck=null,buildCheckAt=0;
// Resolves true when every code file in the cache belongs to the live build.
function trustedBuild(){
 if(buildCheck&&Date.now()-buildCheckAt<BUILD_TTL_MS)return buildCheck;
 buildCheckAt=Date.now();
 buildCheck=(async()=>{
  try{
   const timeout=new Promise((_,reject)=>setTimeout(()=>reject(Error('slow')),BUILD_CHECK_MS));
   const live=await Promise.race([fetch(new Request(new URL('build.json',BASE).href),{cache:'no-cache'}).then(r=>r.ok?r.json():null),timeout]);
   const id=live&&typeof live.build==='string'&&/^[0-9a-f]{8,64}$/.test(live.build)?live.build:null;
   if(!id)return false;
   const cache=await caches.open(VERSION),known=await cache.match(BUILD_KEY);
   const saved=known?await known.text():'';
   if(saved===id)return true;
   // New upload: forget every saved code file, then remember the new build.
   for(const key of await cache.keys())await cache.delete(key);
   await cache.put(BUILD_KEY,new Response(id));
   return true;
  }catch(_){buildCheckAt=0;return false;}
 })();
 return buildCheck;
}
function staticKey(request){
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname)||
    url.pathname.includes('/api/'))return null;
 const rel=url.pathname.slice(BASE.pathname.length);
 if(!allowedExt.test(rel)||rel.includes('..'))return null;
 // Normalize query strings; scanned Adventure Card tokens must never enter Cache API.
 return new Request(new URL(rel,BASE).href,{method:'GET',credentials:'same-origin'});
}
const cacheFor=rel=>caches.open(mediaExt.test(rel)?MEDIA:VERSION);
self.addEventListener('install',evt=>evt.waitUntil((async()=>{
 // Only essential shell assets are warmed at install. Full character art, BGM,
 // preview images and Conquest assets are cached on demand (or by the idle warm-up).
 const queue=CORE.filter(rel=>!/^assets\/(?:recruitment|previews|card_themes)\//.test(rel)&&!/^story\/audio\//.test(rel));
 // Code downloaded now belongs to the live build: record its fingerprint first.
 try{const r=await fetch(new Request(new URL('build.json',BASE).href),{cache:'no-cache'});const live=r.ok?await r.json():null;
  if(live&&/^[0-9a-f]{8,64}$/.test(live.build||'')){const code=await caches.open(VERSION);for(const k of await code.keys())await code.delete(k);await code.put(BUILD_KEY,new Response(live.build));}}catch(_){}
 async function worker(){while(queue.length){const rel=queue.shift();try{
  const key=new Request(new URL(rel,BASE).href);const cache=await cacheFor(rel);
  if(mediaExt.test(rel)&&await cache.match(key))continue; // media kept from an earlier version
  const result=await fetch(key,{cache:/\.(?:html|js|mjs|css|json)$/i.test(rel)?'no-cache':'default'});
  if(result.ok&&result.type==='basic')await cache.put(key,result);
 }catch(_){}}}
 await Promise.allSettled(Array.from({length:4},worker));
 await self.skipWaiting();
})()));
self.addEventListener('activate',evt=>evt.waitUntil((async()=>{
 // Old code caches are removed; the MEDIA cache is kept across versions on purpose.
 await Promise.all((await caches.keys()).filter(name=>name.startsWith('rpg-shell-')&&name!==VERSION).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
function store(evt,cache,key,response,requestUrl){
 // A QR URL may contain a bearer credential in Response.url: do not store it.
 if(response.ok&&response.type==='basic'&&!requestUrl.searchParams.has('card')){
  evt.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
 }
}
self.addEventListener('fetch',evt=>{
 if(evt.request.method!=='GET')return;
 const key=staticKey(evt.request);if(!key)return;
 evt.respondWith((async()=>{
  const path=new URL(key.url).pathname,requestUrl=new URL(evt.request.url);
  const isMedia=mediaExt.test(path),cache=await caches.open(isMedia?MEDIA:VERSION);
  const saved=await cache.match(key)||(isMedia?await (await caches.open(VERSION)).match(key):undefined);
  if(!navigator.onLine && saved)return saved;
  // Only content-addressed media may bypass HTTP revalidation. Never serve an
  // old banner after its version changes or an unversioned custom asset is replaced.
  const version=requestUrl.searchParams.get('v');
  const immutable=/\.(?:webp|png|jpg|jpeg|svg|m4a|mp3|opus|webm|ogg|wav)$/i.test(path)&&/^[0-9a-f]{12}$/.test(version||'');
  if(immutable&&saved?.url&&new URL(saved.url).searchParams.get('v')===version)return saved;
  if(isMedia&&saved&&!immutable){
   // Stale-while-revalidate: show the saved picture/sound now, refresh it for next time.
   evt.waitUntil(fetch(evt.request).then(r=>{if(r.ok&&r.type==='basic'&&!requestUrl.searchParams.has('card'))return cache.put(key,r);}).catch(()=>{}));
   return saved;
  }
  const isCode=/\.(?:js|mjs|css|json)$/i.test(path);
  if(isCode&&await trustedBuild()){
   const fresh=await cache.match(key);
   if(fresh){
    // Same build as the saved copy: use it now, re-check quietly for hand edits.
    evt.waitUntil(fetch(evt.request,{cache:'no-cache'}).then(r=>{if(r.ok&&r.type==='basic'&&!requestUrl.searchParams.has('card'))return cache.put(key,r);}).catch(()=>{}));
    return fresh;
   }
  }
  const network=fetch(evt.request,/\.(?:html|js|mjs|css|json)$/i.test(path)?{cache:'no-cache'}:undefined)
   .then(response=>{store(evt,cache,key,response,requestUrl);return response;});
  if(!saved||isMedia){try{return await network;}catch(e){if(saved)return saved;throw e;}}
  // Code/pages: fresh from the network, unless the network is very slow or down.
  let timer;
  const slow=new Promise(resolve=>{timer=setTimeout(()=>resolve(saved),NETWORK_WAIT_MS);});
  try{const winner=await Promise.race([network,slow]);evt.waitUntil(network.catch(()=>{}));return winner;}
  catch(e){return saved;}
  finally{clearTimeout(timer);}
 })());
});
// Idle warm-up requested by the page: fetch missing media slowly (2 at a time).
let warming=null;
self.addEventListener('message',evt=>{
 const data=evt.data||{};
 if(data.type!=='warm'||!Array.isArray(data.urls)||warming)return;
 const queue=data.urls.slice(0,200).map(u=>{try{return new URL(u,BASE);}catch(_){return null;}})
  .filter(u=>u&&u.origin===self.location.origin&&u.pathname.startsWith(BASE.pathname)&&mediaExt.test(u.pathname)&&!u.searchParams.has('card'));
 warming=(async()=>{
  const cache=await caches.open(MEDIA);
  async function worker(){while(queue.length){const url=queue.shift();try{
   const key=new Request(new URL(url.pathname.slice(BASE.pathname.length),BASE).href);
   if(await cache.match(key))continue;
   const r=await fetch(url.href);if(r.ok&&r.type==='basic')await cache.put(key,r);
  }catch(_){}}}
  await Promise.allSettled([worker(),worker()]);
 })().finally(()=>{warming=null;});
 if(evt.waitUntil)evt.waitUntil(warming);
});
