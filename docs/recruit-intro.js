/* Featured-operator intro on the way into Recruitment (v1).
 *
 * Flow: the page you leave plays a short main-color tile cover while it looks up the
 * featured operator (one cached banner read, the same one Recruitment would make), then
 * opens recruitment.html. Recruitment plays the rest of the intro on top of itself while
 * it connects underneath, so the animation also hides the loading time.
 *
 * Teachers pick the colors in the Recruitment banner editor (banner field `intro_theme`,
 * "#main,#light,#dark"). Click or press any key to skip. Reduced-motion users skip it. */
(function(){
 'use strict';
 const STASH='rpgRecruitIntro',BANNER_CACHE='rpgSparkBanner',VERSION='1';
 const PRESETS=[
  {id:'signal',name:'Signal Yellow',a:'#fff200',l:'#ecece8',d:'#111214'},
  {id:'stream',name:'Stream Pink',a:'#ff2e86',l:'#f3edf1',d:'#140b12'},
  {id:'arctic',name:'Arctic Cyan',a:'#22d3ee',l:'#edf4f6',d:'#0b151a'},
  {id:'crimson',name:'Crimson',a:'#ff3b3b',l:'#f3eeee',d:'#160b0b'},
  {id:'toxic',name:'Toxic Green',a:'#a3ff2e',l:'#eef3ea',d:'#0f150a'},
  {id:'violet',name:'Royal Violet',a:'#a970ff',l:'#f0edf7',d:'#110c1a'},
  {id:'ember',name:'Ember Orange',a:'#ff8a1f',l:'#f4efe9',d:'#160f08'}
 ];
 const DEFAULT=PRESETS[0];
 const THEME_RE=/^#[0-9a-f]{6},#[0-9a-f]{6},#[0-9a-f]{6}$/;
 // Face position (% of assets/recruitment art) so the close-up lands on the face. Banner
 // operators are 6★; measured on the current art. Unknown IDs fall back to the upper middle.
 const FACE={cassian:[53.5,8.0],hound:[61.0,34.0],tavi:[50.0,22.0],lupa:[63.5,23.0],nitrate:[49.5,23.0],kurone:[53.5,21.5]};
 const reduce=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const within=(p,ms,fallback)=>Promise.race([p,wait(ms).then(()=>fallback)]).catch(()=>fallback);

 function parseTheme(value){
  const v=String(value||'').trim().toLowerCase();
  if(!THEME_RE.test(v))return {...DEFAULT};
  const [a,l,d]=v.split(',');return {a,l,d};
 }
 function themeString(t){const s=[t.a,t.l,t.d].map(x=>String(x||'').toLowerCase()).join(',');return THEME_RE.test(s)?s:'';}

 let cssReady=null;
 function ensureCss(){
  if(document.querySelector('link[href^="recruit-intro.css"]'))return cssReady||Promise.resolve();
  const link=document.createElement('link');link.rel='stylesheet';link.href='recruit-intro.css?v='+VERSION;
  cssReady=new Promise(r=>{link.onload=r;link.onerror=r;});document.head.appendChild(link);
  return within(cssReady,700);
 }

 // ---------- featured operator lookup (no extra Firebase reads: uses the shared 10-min cache)
 async function bannerRow(){
  const cloud=window.RPG_V66;
  if(cloud?.call){
   const ok=await within(cloud.ready,600,false);
   if(ok){const r=await within(cloud.call('/api/recruitment/banners'),900,null);const b=r?.banners?.[0];if(b)return b;}
  }
  try{const c=JSON.parse(localStorage.getItem(BANNER_CACHE)||'null');const b=c?.data?.banners?.find?.(x=>x?.id==='featured');if(b)return b;}catch(_){}
  const local=await within(fetch('recruitment-banners.json',{cache:'default'}).then(r=>r.ok?r.json():null),900,null);
  return local?.banners?.find?.(x=>x?.id==='featured')||null;
 }
 async function catalog(){
  if(window.RPG_GACHA_CATALOG?.characters)return window.RPG_GACHA_CATALOG.characters;
  const c=await within(fetch('gacha_catalog.json',{cache:'default'}).then(r=>r.ok?r.json():null),900,null);
  return c?.characters||[];
 }
 async function featured(){
  const [b,chars]=await Promise.all([bannerRow(),catalog()]);
  const id=String(b?.featured_character_id||'tavi');
  const c=chars.find(x=>x&&x.id===id)||chars.find(x=>x&&x.id==='tavi')||{id,name:id,rarity:6,art:`assets/recruitment/${id}.webp`};
  return {id:c.id,name:String(c.name||c.id),rarity:Number(c.rarity)||6,art:String(c.art||`assets/recruitment/${c.id}.webp`),
   title:String(b?.title||'FEATURED RECRUITMENT').slice(0,70),theme:themeString(parseTheme(b?.intro_theme))};
 }
 function loadArt(src){
  return new Promise(resolve=>{const img=new Image();img.decoding='async';img.onload=()=>{(img.decode?img.decode():Promise.resolve()).catch(()=>{}).then(()=>resolve(img));};img.onerror=()=>resolve(null);img.src=src;});
 }

 // ---------- markup
 const CHEV='<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 37 34H28L20 19 12 34H3Z"/><path d="M20 24 25 34H15Z"/></svg>';
 function shuffle(n,spread){const a=[...Array(n).keys()].map(i=>[Math.random(),i]).sort((x,y)=>x[0]-y[0]);const out=Array(n);a.forEach(([,i],k)=>out[i]=Math.round(k/(n-1||1)*spread));return out;}
 function build(data,{arrive}){
  const t=parseTheme(data.theme),name=esc(data.name),NAME=esc(data.name.toUpperCase());
  const stars=Math.max(1,Math.min(6,data.rarity||6));
  const chev=k=>Array.from({length:stars},(_,i)=>CHEV.replace('<svg ',`<svg style="--i:${i}" `)).join('');
  const cover=shuffle(40,260).map(d=>`<i style="--d:${d}ms"></i>`).join('');
  const mos=shuffle(60,430).map(d=>`<i style="--d:${d}ms"></i>`).join('');
  const pix=shuffle(144,260).map(d=>`<i style="--d:${d}ms"></i>`).join('');
  const barColors=['var(--ri-a)','var(--ri-l)','#fff','var(--ri-a)','color-mix(in srgb,var(--ri-l) 70%,var(--ri-d))'];
  const bars=Array.from({length:12},(_,i)=>{const top=Math.round(Math.random()*92),h=(2+Math.random()*9).toFixed(1),w=Math.round(45+Math.random()*60),d=Math.round(Math.random()*170);
   return `<i style="--t:${top}%;--h:${h}%;--w:${w}%;--d:${d}ms;--c:${barColors[i%barColors.length]}"></i>`;}).join('');
  const topo='<svg class="ri-topo" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">'+
   [8,15,23,32,42].map((r,i)=>`<path d="M${-10+i*2} ${30+r*.3} C 20 ${10+i*4}, 45 ${55-i*3}, 70 ${22+i*5} S 105 ${40-i*2}, 112 ${18+i*6}"/>`).join('')+'</svg>';
  const el=document.createElement('div');
  el.className='ri'+(arrive?' ri-arrive':'');el.setAttribute('role','presentation');el.setAttribute('aria-hidden','true');
  el.style.cssText=`--ri-a:${t.a};--ri-l:${t.l};--ri-d:${t.d};--ri-art:url("${String(data.art).replace(/"/g,'')}")`;
  el.innerHTML=
   `<div class="ri-s1"><div class="ri-bigv">${NAME}</div>${topo}<i class="ri-band"></i><i class="ri-band l"></i><div class="ri-sil"></div>`+
    `<div class="ri-tag"><small>FEATURED RECRUITMENT // OPERATOR</small><div class="ri-chev">${chev()}</div><div class="ri-tri"><i></i><i></i><i></i><i></i></div></div></div>`+
   `<div class="ri-s2"><i class="ri-shut"></i><i class="ri-dots t"></i><i class="ri-dots b"></i><div class="ri-load"><b></b><span>//</span><em></em></div></div>`+
   `<div class="ri-s3"><img class="ri-face" alt=""><div class="ri-mos">${mos}</div></div>`+
   `<div class="ri-s4"><div class="ri-ghost">OPERATOR</div><img class="ri-art" alt=""><div class="ri-big">${NAME}</div><i class="ri-accent"></i>`+
    `<div class="ri-plate"><small>// FEATURED ${stars}★</small><div><b>${name}</b><em>//</em><u></u></div></div><div class="ri-chev2">${chev()}</div>`+
    `<div class="ri-chip"><i></i><span>${esc(data.title)}</span></div></div>`+
   `<div class="ri-bars">${bars}</div>`+
   `<div class="ri-s5"><div class="ri-pix">${pix}</div><div class="ri-final"><small>FEATURED RECRUITMENT // OPERATOR</small><b data-t="${NAME}">${NAME}</b></div><i class="ri-scan"></i></div>`+
   `<div class="ri-black"></div>`+
   `<div class="ri-cover">${cover}<i class="ri-cslash"></i></div>`+
   `<div class="ri-skip">CLICK TO SKIP ›</div>`;
  // ri-band/ri-shut/etc. are <i> inside stages, so they are not caught by ".ri>div".
  return el;
 }
 function placeArt(el,img,data){
  const vw=innerWidth,vh=innerHeight;
  const ratio=img&&img.naturalWidth?img.naturalWidth/img.naturalHeight:1;
  const [fx,fy]=(FACE[data.id]||[50,14]).map(v=>v/100);
  // Close-up: the face sits a little right of centre.
  const face=el.querySelector('.ri-face');const fh=vh*2.7,fw=fh*ratio;
  Object.assign(face.style,{height:fh+'px',width:fw+'px',left:(vw*.56-fx*fw)+'px',top:(vh*.42-fy*fh)+'px'});
  // Card: full art on the left-centre, face kept in the upper third.
  const art=el.querySelector('.ri-art');const ah=vh*1.12,aw=ah*ratio;
  const top=Math.max(-vh*.22,Math.min(vh*.04,vh*.3-fy*ah));
  Object.assign(art.style,{height:ah+'px',width:aw+'px',left:(vw*.36-aw*.5)+'px',top:top+'px'});
  if(img){face.src=img.src;art.src=img.src;}
 }

 // ---------- running the intro
 let active=null;
 function finish(el,resolve){
  if(!el||el.__done)return;el.__done=true;
  el.classList.add('ri-out');setTimeout(()=>{el.remove();if(active===el)active=null;resolve?.();},240);
 }
 function run(el,img,data){
  return new Promise(resolve=>{
   placeArt(el,img,data);
   const skip=e=>{if(e.type==='keydown'&&['Shift','Control','Alt','Meta'].includes(e.key))return;e.preventDefault?.();cleanup();finish(el,resolve);};
   const cleanup=()=>{el.removeEventListener('pointerdown',skip);window.removeEventListener('keydown',skip,true);};
   el.addEventListener('pointerdown',skip);window.addEventListener('keydown',skip,true);
   void el.offsetWidth;el.classList.add('ri-run');
   setTimeout(()=>{cleanup();finish(el,resolve);},5150);
  });
 }

 /** Plays the full intro on this page (used by the banner editor preview). */
 async function play(data){
  if(active)return;await ensureCss();
  const el=build(data,{arrive:false});active=el;document.body.appendChild(el);
  const [img]=await Promise.all([loadArt(data.art),wait(430)]);
  el.classList.add('ri-arrive');
  await run(el,img,data);
 }

 /** Called by links/buttons that open Recruitment. */
 async function go(url){
  url=url||'recruitment.html';
  if(active)return;
  if(reduce()){location.assign(url);return;}
  try{
   active=true;
   const lookup=featured();
   // Usually answered from the shared banner cache within a few ms; otherwise start the cover
   // with the last known colours and recolour it when the answer arrives.
   const [early]=await Promise.all([within(lookup,260,null),ensureCss()]);
   let guess=early?.theme||'';
   if(!early){try{guess=JSON.parse(localStorage.getItem(BANNER_CACHE)||'null')?.data?.banners?.find?.(x=>x?.id==='featured')?.intro_theme||'';}catch(_){}}
   const el=build({id:'',name:'',rarity:6,art:'',title:'',theme:guess},{arrive:false});
   active=el;document.body.appendChild(el);
   const data=early||await within(lookup,1400,null);
   if(data){
    const t=parseTheme(data.theme);el.style.setProperty('--ri-a',t.a);el.style.setProperty('--ri-d',t.d);
    try{sessionStorage.setItem(STASH,JSON.stringify({at:Date.now(),...data}));}catch(_){}
    await within(loadArt(data.art),900);
   }
   await wait(120);
  }catch(_){}
  location.assign(url);
 }

 // The cover stays up while the next page loads; Back (bfcache) must not show it again.
 window.addEventListener('pageshow',e=>{if(e.persisted){document.querySelectorAll('.ri').forEach(x=>x.remove());active=null;}});

 // ---------- arrival on recruitment.html
 function arrive(){
  let data=null;try{data=JSON.parse(sessionStorage.getItem(STASH)||'null');sessionStorage.removeItem(STASH);}catch(_){}
  if(!data||!(Date.now()-data.at<20000)||!data.art||reduce())return;
  const el=build(data,{arrive:true});active=el;
  (document.body||document.documentElement).appendChild(el);
  within(loadArt(data.art),1500,null).then(img=>run(el,img,data));
 }
 if(/recruitment\.html$/.test(location.pathname)&&!document.documentElement.dataset.v66Teacher)arrive();

 // Student nav links to Recruitment on other pages (Collection, Aura Workshop).
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href^="recruitment.html"]');
  if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank')return;
  if(/recruitment\.html$/.test(location.pathname))return;
  e.preventDefault();void go(a.getAttribute('href'));
 });

 window.RPG_RECRUIT_INTRO={go,play,featured,parseTheme,themeString,PRESETS,DEFAULT};
})();
