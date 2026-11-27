/* v148.10 Kurone's "notifications": a sticker pops in like a phone push message.
   notify(text, sub, {sticker:'angry'|'shocked', seconds}) — with `seconds`, a countdown
   ("RESUMING IN 3") shows and the box stays exactly that long. */
(()=>{'use strict';
  let box=null,timer=0,tick=0;
  const STICKERS={angry:'assets/stickers/kurone-angry.webp',shocked:'assets/stickers/kurone-shocked.webp'};
  function notify(text='I go 1st!',sub='Put me in slot 1.',opts={}){
    if(!box){
      box=document.createElement('div');box.className='kurone-notify';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
      box.innerHTML='<img class="kurone-notify-sticker" alt=""><div class="kurone-notify-body"><div class="kurone-notify-app"><img alt="" src="assets/profile-icons/kurone.webp"><b>Kurone</b><span>now</span></div><p class="kurone-notify-text"></p><p class="kurone-notify-sub"></p><p class="kurone-notify-count" hidden></p></div>';
      document.body.appendChild(box);
    }
    const seconds=Number(opts.seconds)||3.2;
    box.querySelector('.kurone-notify-sticker').src=STICKERS[opts.sticker]||STICKERS.angry;
    box.querySelector('.kurone-notify-text').textContent=`${text}${opts.sticker==='shocked'?' 😱':' 💢'}`;
    box.querySelector('.kurone-notify-sub').textContent=sub;
    const count=box.querySelector('.kurone-notify-count');
    clearInterval(tick);count.hidden=!opts.seconds;
    if(opts.seconds){const end=performance.now()+seconds*1000;const draw=()=>{const left=Math.max(0,Math.ceil((end-performance.now())/1000));count.textContent=`⏸ WORDS RESUME IN ${left}`;if(left<=0)clearInterval(tick);};draw();tick=setInterval(draw,100);}
    box.style.setProperty('--dur',`${seconds}s`);
    box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
    clearTimeout(timer);timer=setTimeout(()=>{box?.classList.remove('show');clearInterval(tick);},seconds*1000);
  }
  window.RPG_KURONE_NOTIFY=notify;
})();
