/* v86: remember the authenticated Adventure session before returning to Mode Select. */
(()=>{'use strict';
 document.addEventListener('click',e=>{
   const link=e.target.closest('a[data-return-modes="1"]');
   if(!link)return;
   try{sessionStorage.setItem('rpgReturnToAdventureModeSelect','1');}catch(_){}
 });
})();
