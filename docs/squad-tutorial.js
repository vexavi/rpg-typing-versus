/* v127: Story squad onboarding. Presentation only, no rewards or progress unlocks. */
(()=>{
 'use strict';
 const keys=['squadAssembly','squadKnockout'];
 const inMemory=new Map(),pending=new Set();
 function identity(){return window.ADVENTURE_PLAYER||{};}
 function key(kind){const id=String(identity().public_id||'');return /^P\d{6,}$/.test(id)?'rpg_squad_guide_v1__'+id+'__'+kind:null;}
 function localDone(kind){const k=key(kind);if(!k)return false;try{return localStorage.getItem(k)==='1'||inMemory.has(k)}catch(_){return inMemory.has(k)}}
 function saveLocal(kind){const k=key(kind);if(!k)return;inMemory.set(k,true);try{localStorage.setItem(k,'1')}catch(_){}}
 function completed(kind){if(!keys.includes(kind))return false;if(identity().tutorial?.[kind]===true){saveLocal(kind);return true;}return localDone(kind);}
 function sync(kind){
  const p=identity(),k=key(kind);
  if(!keys.includes(kind)||!k||p.tutorial?.[kind]===true||!localDone(kind)||pending.has(k)||!p.cloud||!p.card_code||!window.RPG_V66?.call)return;
  pending.add(k);
  // One small authenticated write per completed guide. Never delay battle or queue a credential.
  Promise.resolve().then(()=>window.RPG_V66.call('/api/tutorial/squad',{card_code:p.card_code,guide:kind})).then(result=>{
   if(result?.ok===true){p.tutorial={...p.tutorial,[kind]:true};}
  }).catch(error=>console.info('Squad guide saved on this device; cloud sync unavailable.',error?.code||error?.message||error)).finally(()=>pending.delete(k));
 }
 function mark(kind){if(!keys.includes(kind))return;saveLocal(kind);sync(kind);}
 function el(tag,cls,text){const node=document.createElement(tag);node.className=cls;if(text)node.textContent=text;return node;}
 // Like the original tutorial, a transparent canvas cutout never moves the game controls.
 function spotlight(host){
  const canvas=el('canvas','squadGuideVeil');canvas.setAttribute('aria-hidden','true');host.append(canvas);
  const ctx=canvas.getContext('2d');let targets=[],frame=0,closed=false;
  function paint(){frame=0;if(closed||!ctx)return;const w=innerWidth,h=innerHeight,scale=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.ceil(w*scale);canvas.height=Math.ceil(h*scale);ctx.setTransform(scale,0,0,scale,0,0);ctx.fillStyle='rgba(5,8,12,.73)';ctx.fillRect(0,0,w,h);
   const holes=[];for(const [node,outline] of targets){if(!node?.isConnected)continue;const r=node.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;const x=Math.max(0,r.left-3),y=Math.max(0,r.top-3),right=Math.min(w,r.right+3),bottom=Math.min(h,r.bottom+3);if(right<=x||bottom<=y)continue;holes.push({x,y,w:right-x,h:bottom-y,outline});}
   for(const r of holes)ctx.clearRect(r.x,r.y,r.w,r.h);
   ctx.strokeStyle='#fff200';ctx.lineWidth=3;for(const r of holes)if(r.outline)ctx.strokeRect(r.x+1.5,r.y+1.5,Math.max(0,r.w-3),Math.max(0,r.h-3));
  }
  function schedule(){if(!closed&&!frame)frame=requestAnimationFrame(paint);}
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
  window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true);
  return {show(items){targets=items;observer?.disconnect();for(const [node] of items)if(node?.isConnected)observer?.observe(node);schedule();},close(){closed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true);canvas.remove();}};
 }
 const labels=['first','second','final'];
 const chooseText=['Choose your first operator.','Choose your second operator. They enter if the first falls.','Choose your final operator. If all three fall, the battle ends.'];
 function createPicker({screen,mount,roster,ready,footer}){
  if(completed('squadAssembly')){sync('squadAssembly');return null;}
  const coach=el('div','squadGuideCoach');coach.setAttribute('role','status');
  const copy=el('div','squadGuideCopy'),step=el('span','squadGuideStep'),line=el('strong','squadGuideText');copy.append(step,line);
  const skip=el('button','squadGuideButton','SKIP');skip.type='button';coach.append(copy,skip);
  mount.before(coach);
  const veil=spotlight(screen);let closed=false;
  function close(){if(closed)return;closed=true;veil.close();coach.remove();}
  skip.addEventListener('click',()=>{mark('squadAssembly');close();});
  return {update(index,hasChoice){if(closed||index>2)return;step.textContent=`${index*2+(hasChoice?2:1)} / 6`;
    line.textContent=hasChoice?(index===2?'Press READY to start the battle.':`Press READY to lock in your ${labels[index]} operator.`):chooseText[index];
    // Keep reset/back available. The spotlight changes only when an actual choice or lock-in occurs.
    veil.show([[hasChoice?ready:roster,true],[coach,false],[footer,false]]);
   },finish(){if(!closed)mark('squadAssembly');close();},close};
 }
 let knockout=null;
 function cancelKnockout(){if(knockout){knockout.close();knockout=null;}}
 function showKnockout(resume){
  if(completed('squadKnockout')){sync('squadKnockout');return false;}
  cancelKnockout();
  const host=el('div','squadGuideKnockout');host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Next operator tutorial');document.body.append(host);
  const coach=el('div','squadGuideCoach squadGuideBattleCoach');const copy=el('div','squadGuideCopy');copy.append(el('span','squadGuideStep','NEXT OPERATOR'),el('strong','squadGuideText','Your next operator has their own HP and ability. The battle continues.'));
  const next=el('button','squadGuideButton primary','CONTINUE');next.type='button';coach.append(copy,next);host.append(coach);
  const veil=spotlight(host);veil.show([[document.querySelector('.storySquadHero'),true],[document.querySelector('#storyStatusPanel'),true],[coach,false]]);
  const acknowledge=()=>{if(knockout?.host!==host)return;mark('squadKnockout');cancelKnockout();resume();};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();acknowledge();}else if(e.key==='Tab'){e.preventDefault();next.focus({preventScroll:true});}};
  const close=()=>{window.removeEventListener('keydown',onKey,true);veil.close();host.remove();};knockout={close,host};
  window.addEventListener('keydown',onKey,true);next.addEventListener('click',acknowledge);next.focus({preventScroll:true});return true;
 }
 window.RPG_SQUAD_TUTORIAL={createPicker,showKnockout,cancelKnockout,completed,mark,sync};
})();
