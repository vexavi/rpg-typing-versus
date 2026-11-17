/* Developer-only display, activated by ?perf=1 on localhost / 127.0.0.1. */
(function(){
  const enabled=/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)&&new URLSearchParams(location.search).get('perf')==='1';
  const stamps=new Map();const rows=[];
  const api={enabled,begin(name){if(enabled)stamps.set(name,performance.now());},end(name){if(enabled&&stamps.has(name)){api.track(name,performance.now()-stamps.get(name));stamps.delete(name);}},track(name,value){if(!enabled)return;rows.push([name,Math.round(value)]);if(rows.length>12)rows.shift();draw();}};
  window.RPG_PERF=api;
  if(!enabled)return;
  let elem;
  function draw(){
    if(!document.body)return;
    if(!elem){elem=document.createElement('aside');elem.id='rpgPerfPanel';elem.setAttribute('aria-label','Developer loading timings');Object.assign(elem.style,{position:'fixed',bottom:'10px',right:'10px',zIndex:'2147483646',background:'rgba(12,17,27,.93)',color:'#c8ffdb',border:'1px solid #729f83',borderRadius:'6px',padding:'10px',font:'12px monospace',maxWidth:'300px',pointerEvents:'none',whiteSpace:'pre-wrap'});document.body.appendChild(elem);}
    elem.textContent='LOCAL PERFORMANCE  (?perf=1)\n'+rows.map(([n,v])=>`${n}: ${v} ms`).join('\n');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const navigation=performance.getEntriesByType('navigation')[0];
    if(navigation)api.track('HTML/DOM ready',navigation.domContentLoadedEventEnd-navigation.startTime);
    draw();
  });
})();
