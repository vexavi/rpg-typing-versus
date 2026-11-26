/* Recruitment page transitions (Endfield theme, v1): leaving the page plays a
 * yellow/black shutter, then navigates. Disabled during the guided tutorial and
 * for reduced-motion users. The link's own click handlers still run. */
(()=>{
 'use strict';
 if(!document.documentElement.classList.contains('ef-theme'))return;
 const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)');
 function wipe(label,sub){
  const w=document.createElement('div');w.className='ef-wipe';w.setAttribute('aria-hidden','true');
  w.innerHTML='<i class="ef-wipe-y"></i><i class="ef-wipe-k"></i><b></b>';
  const b=w.querySelector('b');b.textContent=label;const s=document.createElement('small');s.textContent=sub;b.appendChild(s);
  document.body.appendChild(w);void w.offsetWidth;w.classList.add('is-in');
 }
 document.addEventListener('click',e=>{
  const a=e.target.closest('a[href]');
  if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank')return;
  if(reduce?.matches||document.body.classList.contains('tutorial-recruitment'))return;
  const url=new URL(a.getAttribute('href'),location.href);
  if(url.origin!==location.origin||url.href===location.href)return;
  e.preventDefault();
  wipe(/collection\.html$/.test(url.pathname)?'COLLECTION':/auras\.html$/.test(url.pathname)?'AURA WORKSHOP':'MODE SELECT','TRANSFERRING // STAND BY');
  setTimeout(()=>location.assign(url.href),480);
 });
 // Returning with the back button restores the page from cache: drop any old shutter.
 window.addEventListener('pageshow',e=>{if(e.persisted)document.querySelectorAll('.ef-wipe').forEach(w=>w.remove());});
})();
