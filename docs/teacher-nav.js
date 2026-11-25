/* v85: Shared teacher navigation. No Firebase calls; each tool retains its existing auth checks. */
(()=>{
  'use strict';
  const items=[
    ['cloud-cards.html','Players'],
    ['vocabulary-admin.html','Vocabulary'],
    ['game-settings.html','Game Settings'],
    ['story-editor.html','Conquest Editor'],
    ['recruitment-admin.html','Featured Banner'],
    ['setup-spark.html','Firebase Setup'],
    ['traffic-budget.html','Traffic']
  ];
  function init(){
    if(document.querySelector('.teacher-hub-nav')) return;
    const current=location.pathname.split('/').pop()||'';
    const bar=document.createElement('nav');
    bar.className='teacher-hub-nav';bar.setAttribute('aria-label','Teacher tools');
    const inner=document.createElement('div');inner.className='teacher-hub-nav__inner';
    const home=document.createElement('a');home.href='teacher-dashboard.html';home.className='teacher-hub-nav__home';
    home.textContent='← Teacher Home';
    if(current==='teacher-dashboard.html')home.setAttribute('aria-current','page');
    const label=document.createElement('span');label.className='teacher-hub-nav__label';label.textContent='Go to';
    const links=document.createElement('div');links.className='teacher-hub-nav__links';
    for(const [url,name] of items){const a=document.createElement('a');a.href=url;a.textContent=name;
      if(url===current||(url==='cloud-cards.html'&&['cloud-cards.html','rankings-admin.html','guild-grants.html','aura-admin.html','player-management.html'].includes(current)))a.setAttribute('aria-current','page');links.append(a);}
    inner.append(home,links);bar.append(inner);
    document.body.prepend(bar);
    if(['cloud-cards.html','rankings-admin.html','guild-grants.html','aura-admin.html','player-management.html'].includes(current)){const sub=document.createElement('nav');sub.className='teacher-player-nav';sub.setAttribute('aria-label','Player management');const player=new URLSearchParams(location.search).get('player');for(const [url,title] of [['cloud-cards.html','Cards'],['rankings-admin.html','Grades'],['guild-grants.html','Coins'],['aura-admin.html','Shards'],['player-management.html','Progress']]){const link=document.createElement('a');link.href=url+(player?'?player='+encodeURIComponent(player):'');link.textContent=title;if(url===current)link.setAttribute('aria-current','page');sub.append(link);}bar.after(sub);}
    document.body.classList.add('teacher-nav-ready');
    if(current==='aura-admin.html')document.body.classList.add('teacher-nav-aura');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
