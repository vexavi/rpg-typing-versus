/* v148.9 Adventure battle start countdown ("Level X", bars converge 5 → 0).
 * RPG_ADVENTURE_FX.countdown({level, territory, emblem, seconds, alive}) → Promise<boolean>
 * alive() is polled; when it returns false the countdown is cancelled (resolves false).
 * Presentation only — the engine still owns game state.
 */
(()=>{
 'use strict';
 const reduce=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 // Six slanted blades around the centre (an aperture), drawn once.
 const blades=Array.from({length:6},(_,i)=>`<path transform="rotate(${i*60})" d="M14 -70 L70 -70 L36 -10 L-6 -34 Z"/>`).join('');
 function countdown({level=1,territory='',emblem='',seconds=5,alive=()=>true}={}){
  return new Promise(resolve=>{
   const root=document.createElement('div');root.className='afx-cd';root.setAttribute('role','status');
   root.setAttribute('aria-label',`Level ${level}. Battle starts in ${seconds}`);
   root.innerHTML=`<div class="afx-glow"></div><div class="afx-ring afx-ring-l"></div><div class="afx-ring afx-ring-r"></div>
    <svg class="afx-aperture" viewBox="-80 -80 160 160" aria-hidden="true"><g>${blades}${reduce?'':'<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="9s" repeatCount="indefinite"/>'}</g></svg>
    <div class="afx-track"><i class="afx-cap afx-cap-l"></i><i class="afx-cap afx-cap-r"></i>
     <b class="afx-bar afx-bar-l"></b><b class="afx-bar afx-bar-r"></b>
     <span class="afx-num afx-num-l">${seconds}</span><span class="afx-num afx-num-r">${seconds}</span></div>
    <div class="afx-center">${emblem?`<img class="afx-emblem" src="${esc(emblem)}" alt="">`:''}<h2>Level ${esc(level)}</h2><div class="afx-dots"></div></div>
    <p class="afx-sub">${esc(territory?territory+' · ':'')}Battle Commencing</p>`;
   document.body.append(root);
   const nums=root.querySelectorAll('.afx-num');
   let left=seconds,done=false;
   const total=(seconds+0.0)*1000;
   requestAnimationFrame(()=>{root.classList.add('is-on');root.style.setProperty('--dur',total+'ms');requestAnimationFrame(()=>root.classList.add('is-run'));});
   const finish=ok=>{if(done)return;done=true;clearInterval(tick);clearInterval(watch);
    if(!ok){root.remove();resolve(false);return;}
    root.classList.add('is-meet');                       // bars meet in the middle
    setTimeout(()=>root.classList.add('is-out'),reduce?50:380);
    setTimeout(()=>{root.remove();resolve(true);},reduce?120:820);};
   const tick=setInterval(()=>{left--;nums.forEach(n=>{n.textContent=String(Math.max(0,left));n.classList.remove('pop');void n.offsetWidth;n.classList.add('pop');});
    if(left<=0)finish(true);},1000);
   const watch=setInterval(()=>{try{if(!alive())finish(false);}catch(_){finish(false);}},120);
  });
 }
 window.RPG_ADVENTURE_FX={countdown};
})();
