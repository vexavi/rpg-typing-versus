/* RPG Typing Versus — operator auras everywhere (v148.6).
 * Shows each operator's equipped aura wherever their art or icon appears:
 * Mode Select, the operator picker, Conquest squad screens, battle cut-ins,
 * the Recruitment reveal and the Aura Workshop. Presentation only: the equipped
 * tier comes from the verified player profile (recruitment.auras); nothing is saved here.
 */
(()=>{
  'use strict';
  const COLORS=['','#f2f7ff','#42c7ff','#c384ff','#ffc75d'];
  const NAMES=['NONE','WHITE','AZURE','VIOLET','GOLD'];
  const JP=['なし','白光','蒼光','紫光','金光'];
  const ART=/assets\/(?:recruitment|deployment|profile-icons|characters)\/([a-z][a-z0-9_]*)\.(?:webp|png|jpe?g|avif)/;
  // Where operator art is shown, and how the aura is drawn there.
  // "art" = figure with a glow, floor ring and motes; "icon" = square portrait with a coloured frame.
  const TARGETS=[
    ['.operator-hero-art img','art'],
    ['.operator-detail-art img','art'],
    ['.operator-selection-item img','icon'],
    ['#storySquadArt','art'],
    ['.storySquadRoster img','icon'],
    ['.storySquadRosterCard img','icon'],
    ['.storySquadSlotArt','art'],
    ['.fx-cutin-art img','cut'],
    ['.rv-art .rv-img','art'],
    ['.rv-lu-card img.rv-lu-img','cut'],
    ['[data-aura-art] img','art'],
    ['[data-aura-icon] img','icon']
  ];
  let player=null;
  const auras=()=>(player||window.ADVENTURE_PLAYER)?.recruitment?.auras||{};
  function level(id){
    if(!id||id==='mc')return 0;
    const v=Number(auras()?.[id]?.equipped);
    return Number.isInteger(v)&&v>=0&&v<=4?v:0;
  }
  function idFor(img){
    if(img.dataset.auraId)return img.dataset.auraId;
    const m=String(img.getAttribute('src')||'').match(ART);
    if(m)return m[1];
    return img.closest('[data-operator-id]')?.dataset.operatorId||'';
  }
  function layerFor(host){return host.querySelector(':scope>.aura-fx');}
  function decorateImg(img,kind){
    const host=img.parentElement;if(!host)return;
    const id=idFor(img);
    const lv=img.dataset.auraForce!=null?Number(img.dataset.auraForce)||0:level(id);
    if(img.dataset.aura===String(lv)&&img.dataset.auraFor===id&&(lv===0||kind==='icon'||layerFor(host)))return;
    img.dataset.aura=String(lv);img.dataset.auraFor=id;img.dataset.auraKind=kind;img.classList.add('aura-img');
    img.style.setProperty('--aura',COLORS[lv]||'transparent');
    if(kind==='icon')return; // frame only, drawn on the image itself
    let layer=layerFor(host);
    if(lv===0){layer?.remove();return;}
    if(!layer){
      layer=document.createElement('span');layer.className='aura-fx';layer.setAttribute('aria-hidden','true');
      layer.innerHTML='<i></i><i></i><i></i><b></b>';
      host.insertBefore(layer,host.firstChild);
      if(getComputedStyle(host).position==='static')host.style.position='relative';
      if(getComputedStyle(img).position==='static')img.style.position='relative';
    }
    layer.dataset.aura=String(lv);layer.dataset.kind=kind;layer.style.setProperty('--aura',COLORS[lv]);
  }
  function decorate(root=document){
    for(const [sel,kind] of TARGETS){
      for(const img of root.querySelectorAll(sel))decorateImg(img,kind);
    }
  }
  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;try{decorate();}catch(e){console.warn('Aura display skipped:',e);}});}
  // New art appears as screens are built or images change; one batched pass per frame.
  const observer=new MutationObserver(list=>{
    for(const m of list){
      if(m.type==='attributes'||[...m.addedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('aura-fx'))){schedule();return;}
    }
  });
  function start(){
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
    schedule();
  }
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
  function setPlayer(p){player=p||null;document.querySelectorAll('img.aura-img').forEach(i=>delete i.dataset.aura);schedule();}
  window.RPG_AURA=Object.freeze({level,color:lv=>COLORS[lv]||'',name:lv=>NAMES[lv]||'NONE',jp:lv=>JP[lv]||'',colors:COLORS,names:NAMES,setPlayer,refresh:()=>{document.querySelectorAll('img.aura-img').forEach(i=>delete i.dataset.aura);schedule();},decorate});
})();
