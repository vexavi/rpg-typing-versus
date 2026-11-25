/* v86.9 Offline shell. Public static content only. No Firestore/API responses or card codes. */
'use strict';
const VERSION='rpg-shell-v1470';
const BASE=new URL('./',self.registration.scope);
const CORE=["adventure.html", "online-boot-v66.js", "offline-session.js", "game-balance-runtime.js", "game-balance-cloud.js", "adventure_engine.js", "squad-tutorial.js", "conquest-core.js", "conquest-map.js", "operator-passives.js", "story-mode.js", "story-content-cloud.js", "adventure_rewards.js", "guild-coins.js", "game-mechanics.js", "custom-mechanics.js", "asset-manifest.js", "media-loader.js", "performance-meter.js", "rpg-theme.css", "adventure-ui.css", "chapter-special.css", "story-mode.css", "student-ui.css", "story-map-v54.css", "guild-coins.css", "story/chapters.json", "story/audio/ch1-battle.webm", "icon01.webp", "icon02.webp", "assets/boss_hit.m4a", "assets/player_hit.m4a", "assets/card_themes/navy.webp", "assets/card_themes/crimson.webp", "assets/card_themes/forest.webp", "assets/card_themes/violet.webp", "assets/previews/qr-v82-returning.webp", "assets/previews/qr-v82-first-time.webp", "assets/characters/mc.webp", "assets/profile-icons/alden.webp", "assets/profile-icons/aveline.webp", "assets/profile-icons/cassian.webp", "assets/profile-icons/elise.webp", "assets/profile-icons/hound.webp", "assets/profile-icons/isolde.webp", "assets/profile-icons/kade.webp", "assets/profile-icons/livia.webp", "assets/profile-icons/mc.webp", "assets/profile-icons/mira.webp", "assets/profile-icons/nora.webp", "assets/profile-icons/seraphine.webp", "assets/profile-icons/tavi.webp", "assets/profile-icons/lupa.webp", "assets/profile-icons/anodyne.webp", "assets/profile-icons/shield.webp", "assets/profile-icons/crossbow.webp", "assets/profile-icons/hexaxe.webp", "assets/profile-icons/nitrate.webp", "assets/profile-icons/vern.webp", "assets/profile-icons/vex.webp", "assets/recruitment/cassian.webp", "assets/recruitment/livia.webp", "assets/recruitment/vex.webp", "assets/recruitment/aveline.webp", "assets/recruitment/nora.webp", "assets/recruitment/elise.webp", "assets/recruitment/hound.webp", "assets/recruitment/alden.webp", "assets/recruitment/vern.webp", "assets/recruitment/mira.webp", "assets/recruitment/tavi.webp", "assets/recruitment/lupa.webp", "assets/recruitment/anodyne.webp", "assets/recruitment/shield.webp", "assets/recruitment/crossbow.webp", "assets/recruitment/hexaxe.webp", "assets/recruitment/nitrate.webp", "assets/recruitment/seraphine.webp", "assets/recruitment/isolde.webp", "assets/recruitment/kade.webp", "story/images/map-placeholder.svg", "story/images/placeholder-04.svg", "story/images/placeholder-03.svg", "story/images/placeholder-02.svg", "story/images/placeholder-01.svg"];
const allowedExt=/\.(?:html|js|mjs|css|json|webp|png|jpg|jpeg|svg|m4a|mp3|opus|webm|ogg|wav)$/i;
function staticKey(request){
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE.pathname)||
    url.pathname.includes('/api/'))return null;
 const rel=url.pathname.slice(BASE.pathname.length);
 if(!allowedExt.test(rel)||rel.includes('..'))return null;
 // Normalize query strings; scanned Adventure Card tokens must never enter Cache API.
 return new Request(new URL(rel,BASE).href,{method:'GET',credentials:'same-origin'});
}
self.addEventListener('install',evt=>evt.waitUntil((async()=>{
 const cache=await caches.open(VERSION);
 // Only essential shell assets are warmed at install. Full character art, BGM,
 // preview images and Conquest assets are cached on demand, not on every Chromebook.
 const queue=CORE.filter(rel=>!/^assets\/(?:recruitment|previews|card_themes)\//.test(rel)&&!/^story\/audio\//.test(rel));
 async function worker(){while(queue.length){const rel=queue.shift();try{
  const key=new Request(new URL(rel,BASE).href);
  const result=await fetch(key,{cache:/\.(?:html|js|mjs|css|json)$/i.test(rel)?'no-cache':'default'});
  if(result.ok&&result.type==='basic')await cache.put(key,result);
 }catch(_){}}}
 await Promise.allSettled(Array.from({length:4},worker));
 await self.skipWaiting();
})()));
self.addEventListener('activate',evt=>evt.waitUntil((async()=>{
 await Promise.all((await caches.keys()).filter(name=>name.startsWith('rpg-shell-')&&name!==VERSION).map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',evt=>{
 if(evt.request.method!=='GET')return;
 const key=staticKey(evt.request);if(!key)return;
 evt.respondWith((async()=>{
  const cache=await caches.open(VERSION);
  const saved=await cache.match(key);
  if(!navigator.onLine && saved)return saved;
  // Catalog metadata and banner settings must refresh too when online,
  // otherwise a new operator can stay invisible in Profile or Recruitment.
  // Keep large media cached for fast classroom launches.
  const path=new URL(key.url).pathname;
  // Only content-addressed media may bypass HTTP revalidation. Never serve an
  // old banner after its version changes or an unversioned custom asset is replaced.
  const version=new URL(evt.request.url).searchParams.get('v');
  const immutable=/\.(?:webp|png|jpg|jpeg|svg|m4a|mp3|opus|webm|ogg|wav)$/i.test(path)&&/^[0-9a-f]{12}$/.test(version||'');
  if(immutable&&saved?.url&&new URL(saved.url).searchParams.get('v')===version)return saved;
  try{const response=await fetch(evt.request,/\.(?:html|js|mjs|css|json)$/i.test(path)?{cache:'no-cache'}:undefined);
   // Deliver the response immediately; cache failures never mask a good response.
   // A QR URL may contain a bearer credential in Response.url: do not store it.
   const requestUrl=new URL(evt.request.url);
   if(response.ok&&response.type==='basic'&&!requestUrl.searchParams.has('card')){
    evt.waitUntil(cache.put(key,response.clone()).catch(()=>{}));
   }
   return response;
  }catch(e){if(saved)return saved;throw e;}
 })());
});
