/* v148.10 Kurone's "notification": an angry sticker pops in like a phone push message
   when a student tries to put her anywhere except 1st in the squad. */
(()=>{'use strict';
  let box=null,timer=0;
  function notify(text='I go 1st!',sub='Put me in slot 1.'){
    if(!box){
      box=document.createElement('div');box.className='kurone-notify';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
      box.innerHTML='<img class="kurone-notify-sticker" alt="" src="assets/stickers/kurone-angry.webp"><div class="kurone-notify-body"><div class="kurone-notify-app"><img alt="" src="assets/profile-icons/kurone.webp"><b>Kurone</b><span>now</span></div><p class="kurone-notify-text"></p><p class="kurone-notify-sub"></p></div>';
      document.body.appendChild(box);
    }
    box.querySelector('.kurone-notify-text').textContent=`${text} 💢`;
    box.querySelector('.kurone-notify-sub').textContent=sub;
    box.classList.remove('show');void box.offsetWidth;box.classList.add('show');
    clearTimeout(timer);timer=setTimeout(()=>box?.classList.remove('show'),2800);
  }
  window.RPG_KURONE_NOTIFY=notify;
})();
