/* v148.9 first-time tutorial intro: two terminal-style title cards
 * ("WELCOME, <NAME>" then "TUTORIAL"), then a fade into the tutorial battle.
 * RPG_TUTORIAL_INTRO.play(name) → Promise (resolves when the intro has finished).
 * Pure presentation: no saving, no network. Respects prefers-reduced-motion.
 */
(()=>{
 'use strict';
 const reduce=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const NS='http://www.w3.org/2000/svg';
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 function backdropSvg(){
  // Rounded "four-lobe" outline, corner ticks, faint emblem and four hatched discs.
  const d=118,R=150;
  return `<svg class="ti-art" viewBox="-460 -300 920 600" aria-hidden="true">
   <defs>
    <pattern id="tiHatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(255,255,255,.08)"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,.55)" stroke-width="2.2"/></pattern>
   </defs>
   <g class="ti-lobes">
    <g stroke="rgba(255,255,255,.22)" stroke-width="3" fill="#101114">
     <circle cx="${-d*1.55}" cy="0" r="${R}"/><circle cx="${d*1.55}" cy="0" r="${R}"/><circle cx="0" cy="${-d}" r="${R}"/><circle cx="0" cy="${d}" r="${R}"/>
    </g>
    <g fill="#101114"><circle cx="${-d*1.55}" cy="0" r="${R-1.5}"/><circle cx="${d*1.55}" cy="0" r="${R-1.5}"/><circle cx="0" cy="${-d}" r="${R-1.5}"/><circle cx="0" cy="${d}" r="${R-1.5}"/>
     <rect x="${-d*1.55}" y="-120" width="${d*3.1}" height="240"/></g>
   </g>
   <g class="ti-ticks" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none">
    ${[[-300,-205],[300,-205],[-300,205],[300,205]].map(([x,y])=>`<path d="M${x-7} ${y}h14M${x} ${y-7}v14"/><rect x="${x+(x<0?10:-18)}" y="${y+(y<0?10:-18)}" width="8" height="8"/>`).join('')}
   </g>
   <g class="ti-emblem" stroke="rgba(255,255,255,.16)" stroke-width="2" fill="rgba(255,255,255,.03)">
    <path d="M-46 -62h20v-12h16v12h20v-12h16v12h20v84l-46 30-46-30z"/>
    <path d="M0 -40l8 12h-16z M0 40l8-12h-16z" fill="rgba(255,255,255,.18)" stroke="none"/>
    <circle r="56" fill="none"/>
   </g>
   <g class="ti-discs">
    ${[[0,-74],[-74,0],[74,0],[0,74]].map(([x,y],i)=>`<circle class="ti-disc" style="--i:${i}" cx="${x}" cy="${y}" r="36" fill="url(#tiHatch)" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>`).join('')}
    <path class="ti-hex" d="M0 -24l21 12v24l-21 12-21-12v-24z" fill="#f3f3f1"/>
   </g>
  </svg>`;
 }
 function card(root,title,sub){
  const el=document.createElement('div');el.className='ti-card';
  el.innerHTML=`${backdropSvg()}<div class="ti-bar" aria-hidden="true"></div>
   <div class="ti-label"><span class="ti-brk"></span><span class="ti-hatch"></span><b class="ti-title"></b><span class="ti-hatch"></span><span class="ti-brk"></span></div>
   <small class="ti-sub"></small>`;
  el.querySelector('.ti-title').textContent=title;
  el.querySelector('.ti-sub').textContent=sub;
  root.querySelector('.ti-stage').replaceChildren(el);
  return el;
 }
 async function play(name){
  const who=String(name||'Operator').trim().slice(0,16)||'Operator';
  const root=document.createElement('div');root.className='ti-root';root.setAttribute('role','status');
  root.setAttribute('aria-label',`Welcome, ${who}. Tutorial.`);
  root.innerHTML='<div class="ti-glow"></div><div class="ti-stage"></div><div class="ti-foot"><i></i>RPG TYPING VERSUS · TRAINING TERMINAL</div>';
  document.body.append(root);
  if(reduce){
   card(root,`WELCOME, ${who.toUpperCase()}`,'OPERATOR VERIFIED').classList.add('is-static');await wait(1600);
   card(root,'TUTORIAL','TRAINING PROTOCOL').classList.add('is-static');await wait(1300);
  }else{
   card(root,`WELCOME, ${who.toUpperCase()}`,'OPERATOR VERIFIED').classList.add('is-run');await wait(2900);
   card(root,'TUTORIAL','TRAINING PROTOCOL').classList.add('is-run');await wait(2700);
  }
  root.classList.add('is-out');            // fade into the tutorial battle underneath
  await wait(reduce?200:650);root.remove();
 }
 window.RPG_TUTORIAL_INTRO={play};
})();
