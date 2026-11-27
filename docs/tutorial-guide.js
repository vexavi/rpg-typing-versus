/* v148.9 tutorial guard rails for real game screens (Mode Select, Recruitment).
 * RPG_TUTORIAL_GUIDE.show({target, kicker, title, text, button}) dims the screen except
 * the target, places a coach card beside it and BLOCKS every click / key that is not on
 * the target or the coach card. RPG_TUTORIAL_GUIDE.clear() removes everything.
 * Presentation + input filtering only: it never moves or restyles game elements.
 */
(()=>{
 'use strict';
 let cur=null;
 const BLOCKED=['pointerdown','pointerup','mousedown','mouseup','click','dblclick','auxclick','contextmenu','touchstart','touchend','submit'];
 const targetEl=()=>{try{const t=cur?.target;const el=typeof t==='function'?t():typeof t==='string'?document.querySelector(t):t;return el&&el.isConnected?el:null;}catch(_){return null;}};
 function allowed(node){
  if(!cur||!node||!(node instanceof Node))return !cur;
  if(cur.coach.contains(node))return true;
  const t=targetEl();
  return !!(cur.allowTarget&&t&&(t===node||t.contains(node)));
 }
 function onPointer(e){
  if(!cur)return;
  if(allowed(e.target)){
   // Pressing the guided button ends this guide step (the game takes over from here).
   if(e.type==='click'&&!cur.coach.contains(e.target)&&cur.clearOnTarget){const mine=cur;setTimeout(()=>{if(cur===mine)clear();},0);}
   return;
  }
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  if(e.type==='click')pulse();
 }
 function onKey(e){
  if(!cur)return;
  if(allowed(document.activeElement)&&(e.key==='Enter'||e.key===' '))return;
  if(e.key==='Tab'){ // keep keyboard focus on the guided controls
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   const order=[cur.allowTarget?targetEl():null,...cur.coach.querySelectorAll('button')].filter(Boolean);
   if(order.length){const i=order.indexOf(document.activeElement);order[(i+1)%order.length].focus({preventScroll:true});}
   return;
  }
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
 }
 function pulse(){if(!cur)return;cur.coach.animate?.([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}],{duration:260});}
 function place(){
  if(!cur)return;
  const {veil,coach,arrow}=cur,ctx=veil.getContext('2d'),vw=innerWidth,vh=innerHeight;
  if(veil.width!==vw||veil.height!==vh){veil.width=vw;veil.height=vh;}
  ctx.clearRect(0,0,vw,vh);
  if(cur.dim){ctx.fillStyle='rgba(4,6,12,.72)';ctx.fillRect(0,0,vw,vh);}
  const t=targetEl();
  if(!t||!t.getClientRects().length){
   coach.style.left=Math.max(12,(vw-coach.offsetWidth)/2)+'px';coach.style.top=Math.max(12,(vh-coach.offsetHeight)/2)+'px';arrow.hidden=true;return;
  }
  const r=t.getBoundingClientRect(),pad=6;
  const x=Math.max(0,r.left-pad),y=Math.max(0,r.top-pad),w=Math.min(vw,r.right+pad)-x,h=Math.min(vh,r.bottom+pad)-y;
  ctx.clearRect(x,y,w,h);
  ctx.strokeStyle='#fff200';ctx.lineWidth=4;ctx.strokeRect(x+2,y+2,w-4,h-4);
  const cw=coach.offsetWidth,ch=coach.offsetHeight,gap=34;
  let left,top,dir;
  if(r.right+gap+cw+12<=vw){left=r.right+gap;top=r.top+r.height/2-ch/2;dir='left';}
  else if(r.left-gap-cw>=12){left=r.left-gap-cw;top=r.top+r.height/2-ch/2;dir='right';}
  else if(r.bottom+gap+ch+12<=vh){left=r.left+r.width/2-cw/2;top=r.bottom+gap;dir='up';}
  else{left=r.left+r.width/2-cw/2;top=r.top-gap-ch;dir='down';}
  left=Math.max(12,Math.min(vw-cw-12,left));top=Math.max(12,Math.min(vh-ch-12,top));
  coach.style.left=left+'px';coach.style.top=top+'px';
  arrow.hidden=false;
  const glyph={left:'◀',right:'▶',up:'▲',down:'▼'}[dir];
  if(arrow.textContent!==glyph)arrow.textContent=glyph;
  const ax=dir==='left'?r.right+6:dir==='right'?r.left-30:r.left+r.width/2-12;
  const ay=dir==='up'?r.bottom+4:dir==='down'?r.top-32:r.top+r.height/2-15;
  arrow.style.left=ax+'px';arrow.style.top=ay+'px';
  arrow.style.setProperty('--nx',dir==='left'?'-6px':dir==='right'?'6px':'0');
  arrow.style.setProperty('--ny',dir==='up'?'-6px':dir==='down'?'6px':'0');
 }
 let raf=0,last=0;
 function loop(ts){raf=0;if(!cur)return;if(ts-last>=110){last=ts;place();}raf=requestAnimationFrame(loop);}
 function clear(){
  if(!cur)return;
  for(const type of BLOCKED)window.removeEventListener(type,onPointer,true);
  window.removeEventListener('keydown',onKey,true);
  cur.veil.remove();cur.coach.remove();cur.arrow.remove();
  if(raf)cancelAnimationFrame(raf);raf=0;cur=null;
  document.documentElement.classList.remove('rpg-guide-on');
 }
 function show(opts={}){
  clear();
  const veil=document.createElement('canvas');veil.className='rpg-guide-veil';veil.setAttribute('aria-hidden','true');
  const coach=document.createElement('section');coach.className='rpg-guide-coach';coach.setAttribute('role','note');coach.setAttribute('aria-live','polite');
  const kicker=document.createElement('span');kicker.className='rpg-guide-kicker';kicker.textContent=opts.kicker||'TUTORIAL';
  const h=document.createElement('h3');h.textContent=opts.title||'';
  const p=document.createElement('p');p.textContent=opts.text||'';
  coach.append(kicker);if(opts.title)coach.append(h);coach.append(p);
  if(opts.button){const b=document.createElement('button');b.type='button';b.textContent=opts.button.label;b.addEventListener('click',e=>{e.stopPropagation();opts.button.onClick?.();});coach.append(b);}
  const arrow=document.createElement('div');arrow.className='rpg-guide-arrow';arrow.setAttribute('aria-hidden','true');arrow.hidden=true;
  document.body.append(veil,coach,arrow);
  cur={veil,coach,arrow,target:opts.target||null,clearOnTarget:opts.clearOnTarget!==false,allowTarget:opts.allowTarget!==false&&!!opts.target,dim:opts.dim!==false};
  for(const type of BLOCKED)window.addEventListener(type,onPointer,true);
  window.addEventListener('keydown',onKey,true);
  document.documentElement.classList.add('rpg-guide-on');
  place();raf=requestAnimationFrame(loop);
  const focusTarget=()=>{const t=cur&&cur.allowTarget?targetEl():null;(t||coach.querySelector('button'))?.focus?.({preventScroll:true});};
  focusTarget();setTimeout(focusTarget,120);
  return {clear,update:(o)=>{if(o.text!=null)p.textContent=o.text;place();}};
 }
 addEventListener('resize',()=>{if(cur)place();},{passive:true});
 window.RPG_TUTORIAL_GUIDE={show,clear,active:()=>!!cur};
})();
