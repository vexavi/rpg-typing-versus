await import('./online-spark.js?v=148.9');
import {googleTeacher,currentTeacher,teacherSignOut,listCards,createCards,importCards,disableCard,enableCard,clearCard,revokeCard,rotateCard,normalizeCode,formatCode,errorMessage} from './cloud-api.js';
const TEACHER_UID='1BsaIx7kcfUSRO3rhNbHsJPRHkw1';
const $=s=>document.getElementById(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let teacher=null,records=[],busy=false;
const message=(txt,bad=false)=>{$('cloud-status').textContent=txt;$('cloud-status').classList.toggle('error',!!bad)};
const isLocal=['localhost','127.0.0.1','::1','[::1]'].includes(location.hostname);
if(isLocal){$('import-local').style.display='';$('sync-local').style.display='';}
$('card-search').value=new URLSearchParams(location.search).get('player')||'';
if(new URLSearchParams(location.search).get('filter')==='new')$('card-filter').value='new';
$('qr-base').value=localStorage.getItem('rpgCloudCardsQrBase')||(location.protocol==='https:'?new URL('adventure.html',location.href).href:'');
function enableUI(ready){for(let b of document.querySelectorAll('.teacher-btn'))b.disabled=!ready||busy;$('sign-in').disabled=busy;$('sign-in').classList.toggle('hide',!!teacher);$('sign-out').classList.toggle('hide',!teacher);$('copy-uid').disabled=!teacher;}
function format(c){return {id:c.publicId,code:formatCode(c.code),username:c.username,registered:!!c.username,disabled:!!c.disabled,deleted:!!c.deleted,character:c.character,createdAt:c.createdAt?.seconds||0}}
async function reload(){records=await listCards();showList();message(records.length+' cloud cards loaded.');}
function statusOf(c){return c.disabled?'disabled':c.username?'registered':'new';}
function maskCode(code){const f=formatCode(code);return $('show-codes').checked?esc(f):`<span class="code-mask" title="Tick “Show secret codes” to reveal">${esc(f.slice(0,4))}-••••-••••-••••</span>`;}
function updatePrintLabel(){const n=document.querySelectorAll('.chosen:checked').length;$('print').textContent=n?`Print ${n} selected (A4)`:'Print selected (A4)';document.querySelectorAll('#list tr').forEach(tr=>tr.classList.toggle('is-picked',!!tr.querySelector('.chosen:checked')));}
function showList(){const keep=new Set([...document.querySelectorAll('.chosen:checked')].map(n=>n.value));const term=$('card-search').value.trim().toLowerCase(),filter=$('card-filter').value;const vis=records.filter(c=>!c.deleted&&(filter==='all'||statusOf(c)===filter)&&(!term||`${c.publicId} ${c.username||''}`.toLowerCase().includes(term)));const total=records.filter(c=>!c.deleted).length;$('card-count').textContent=vis.length===total?total+' cards':`${vis.length} of ${total} cards`;
 const label={registered:['reg','Registered'],new:['new','Not registered yet'],disabled:['off','Disabled']};
 $('list').innerHTML=vis.map(c=>{const st=label[statusOf(c)],q=encodeURIComponent(c.publicId);return `<tr><td><input type="checkbox" class="chosen" value="${esc(c.code)}" aria-label="Select ${esc(c.publicId)}" ${c.disabled?'disabled':''} ${keep.has(c.code)&&!c.disabled?'checked':''}></td><td>${esc(c.publicId)}</td><td>${esc(c.username||'—')}</td><td><span class="st ${st[0]}">${st[1]}</span></td><td><code>${maskCode(c.code)}</code></td><td><a href="rankings-admin.html?player=${q}">Grade</a> · <a href="guild-grants.html?player=${q}">Coins</a> · <a href="aura-admin.html?player=${q}">Shards</a> · <a href="player-management.html?player=${q}">Progress</a><div class="acts"><button class="secondary" data-act="rotate" data-code="${esc(c.code)}" title="Make a new code for a lost card; the old card stops working">Replace QR</button><button class="secondary" data-act="reset" data-code="${esc(c.code)}" title="Let the student choose a new name">Clear name</button><button class="secondary" data-act="${c.disabled?'enable':'disable'}" data-code="${esc(c.code)}">${c.disabled?'Enable':'Disable'}</button><button class="secondary danger" data-act="revoke" data-code="${esc(c.code)}" title="Permanently retire this card">Revoke</button></div></td></tr>`;}).join('')||`<tr><td colspan="6">${records.length?'No cards match this search.':'No cloud cards yet. Create some below.'}</td></tr>`;
 $('all').checked=false;updatePrintLabel();}
async function run(job){if(busy)return;busy=true;enableUI(false);try{await job()}catch(e){message(errorMessage(e),true)}finally{busy=false;enableUI(!!teacher)}}
async function login(){teacher=await googleTeacher();if(teacher?.uid!==TEACHER_UID){await teacherSignOut();teacher=null;throw Error('Use the authorized teacher account.');}$('teacher-name').textContent=(teacher.name||'Teacher')+' · '+teacher.email;$('teacher-id').textContent=teacher.uid;enableUI(true);try{await reload()}catch(e){message(errorMessage(e),true)}}
$('sign-in').addEventListener('click',()=>run(login));
$('sign-out').addEventListener('click',()=>run(async()=>{await teacherSignOut();teacher=null;records=[];showList();$('teacher-name').textContent='Teacher account required';$('teacher-id').textContent='—';message('Signed out.')}));
$('copy-uid').addEventListener('click',async()=>{if(teacher){await navigator.clipboard.writeText(teacher.uid);message('Teacher UID copied.')}});
$('generate').addEventListener('click',()=>run(async()=>{if(!teacher)return;const n=Math.trunc(Number($('count').value));if(!(n>=1&&n<=50)){message('Choose between 1 and 50 cards.',true);return;}if(!confirm('Create '+n+' new player cards?'))return;
 const before=new Set(records.map(c=>c.code));await createCards(n);await reload();
 // Show and pre-select only the cards just created, ready to print.
 $('card-search').value='';$('card-filter').value='new';showList();
 document.querySelectorAll('.chosen').forEach(x=>{x.checked=!before.has(x.value);});updatePrintLabel();
 message(n+' new cards created and selected. Press “Print selected” to print them.');}));
$('refresh').addEventListener('click',()=>run(reload));
$('save-base').addEventListener('click',()=>{const url=$('qr-base').value.trim();if(url){try{const u=new URL(url);if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')throw Error('Only HTTPS or localhost is allowed.');}catch(e){message('Enter a valid HTTPS game URL.',true);return}}localStorage.setItem('rpgCloudCardsQrBase',url);message('QR URL saved on this browser.');});
$('import-local').addEventListener('click',()=>run(async()=>{
 if(!isLocal)throw Error('Open this page from localhost on the teacher laptop to import local cards.');
 const r=await window.RPG_LOCAL_CARD_FETCH('/api/cards/list',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error('Laptop card registry unavailable.');
 const data=await r.json(),rows=data.cards||[];
 if(!rows.length){message('No laptop cards found.');return}
 if(!confirm('Import '+rows.length+' existing cards into Firebase? Their IDs and backup codes will stay the same.'))return;
 const result=await importCards(rows);await reload();message('Cloud migration: '+result.imported+' imported, '+result.skipped+' existing. Scores and rewards remain laptop-only.');
}));
$('backup-file').addEventListener('change',e=>run(async()=>{const f=e.target.files?.[0];if(!f)return;const rows=JSON.parse(await f.text());const list=Array.isArray(rows)?rows:Array.isArray(rows.cards)?rows.cards:null;if(!list)throw Error('Expected a JSON array of cards.');if(!confirm('Import '+list.length+' cards from this backup?'))return;const r=await importCards(list);await reload();message('Imported: '+r.imported+', already present: '+r.skipped)}));
$('sync-local').addEventListener('click',()=>run(async()=>{
 if(!isLocal)throw Error('Open from http://localhost:8765/cloud-cards.html to sync with this laptop.');
 if(!records.length)await reload();const list=records.filter(x=>/P\d{6,}/.test(x.publicId));
 if(!list.length){message('No cards to sync.');return}
 if(!confirm('Mirror '+list.length+' cloud cards to the laptop database? This will update code/name/status on matching Player IDs. Back up player_cards.db first.'))return;
 let count=0;
 for(const c of list){const req={id:c.publicId,code:c.code,username:c.username||null,registered:!!c.username,character:c.character,disabled:!!c.disabled,deleted:!!c.deleted};const resp=await window.RPG_LOCAL_CARD_FETCH('/api/cards/import-cloud',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(req)});if(!resp.ok)throw Error('Laptop sync stopped at '+c.publicId+': '+(await resp.text()).slice(0,150));count++}
 message(count+' cards mirrored to the laptop. Tournament card lookup is ready.');
}));
$('export').addEventListener('click',()=>{const data=JSON.stringify({schema:1,exportedAt:new Date().toISOString(),cards:records.filter(x=>!x.deleted).map(c=>({...format(c),public_id:c.publicId,code:c.code}))},null,2);const u=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='RPG_Cloud_Adventure_Cards_PRIVATE.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);message('Private backup downloaded. Keep card codes secret.');});
$('card-search').addEventListener('input',showList);
$('card-filter').addEventListener('change',showList);
$('show-codes').addEventListener('change',showList);
$('list').addEventListener('change',e=>{if(e.target.matches('.chosen'))updatePrintLabel();});
$('pick-new').addEventListener('click',()=>{$('card-filter').value='new';$('card-search').value='';showList();document.querySelectorAll('.chosen:not(:disabled)').forEach(x=>x.checked=true);updatePrintLabel();});
$('pick-shown').addEventListener('click',()=>{document.querySelectorAll('.chosen:not(:disabled)').forEach(x=>x.checked=true);updatePrintLabel();});
$('pick-none').addEventListener('click',()=>{document.querySelectorAll('.chosen').forEach(x=>x.checked=false);$('all').checked=false;updatePrintLabel();});
$('all').addEventListener('change',e=>{document.querySelectorAll('.chosen:not(:disabled)').forEach(x=>x.checked=e.target.checked);updatePrintLabel();});
const cardArts=['navy','crimson','forest','violet'];
function selectedCards(){const codes=new Set([...document.querySelectorAll('.chosen:checked')].map(n=>n.value));return records.filter(c=>codes.has(c.code)&&!c.deleted)}
$('print').addEventListener('click',async()=>{
 const selected=selectedCards(),base=$('qr-base').value.trim();
 if(!selected.length){message('Select cards to print.',true);return}
 if(!base){$('settings').open=true;$('qr-base').focus();message('Set the QR link (game address) under Settings & backups before printing.',true);return}
 let u;try{u=new URL(base);if(u.protocol!=='https:'&&u.hostname!=='localhost'&&u.hostname!=='127.0.0.1')throw Error('HTTPS required')}catch(e){message('Enter a valid HTTPS game URL.',true);return}
 const theme=$('theme').value;
 const chunks=[];
 for(let i=0;i<selected.length;i+=10){const group=selected.slice(i,i+10);chunks.push('<div class="gridprint">'+group.map((c,j)=>{
  const cardTheme=theme==='mixed'?cardArts[(Number(c.publicId.slice(1))-1)%4]:theme;
  const dest=new URL(u.toString());dest.searchParams.set('card',c.code);
  return `<div class="print-card"><img class="print-card-art" alt="" src="assets/card_themes/${cardTheme}.webp"><div class="print-qr">${window.RPGQrSvg(dest.toString())}</div><div class="print-code"><span>${esc(c.publicId)}</span>${esc(formatCode(c.code))}</div></div>`;
 }).join('')+'</div>')}
 $('print-area').innerHTML=chunks.join('');
 await Promise.all([...$('print-area').querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true})})));
 $('print-status').textContent=selected.length+' cards ready · A4 portrait · Print at 100%';window.print();
});
$('list').addEventListener('click',e=>{const btn=e.target.closest('[data-act]');if(!btn||!teacher)return;const code=btn.dataset.code,action=btn.dataset.act,card=records.find(x=>x.code===code);if(!card)return;
 void run(async()=>{
  if(action==='rotate'){if(!confirm('Replace the QR code for '+card.publicId+'? The previous code will stop working.'))return;const newCode=await rotateCard(code);message('New secret: '+formatCode(newCode)+' · Reprint this card.');}
  if(action==='reset'){if(!confirm('Clear the username for '+card.publicId+'?'))return;await clearCard(code)}
  if(action==='disable')await disableCard(code);
  if(action==='enable')await enableCard(code);
  if(action==='revoke'){if(!confirm('Revoke '+card.publicId+' and erase its registered name? The record remains disabled to prevent accidental ID reuse.'))return;await revokeCard(code)}
  await reload();
 });
});
(async()=>{try{const user=await currentTeacher();if(user?.uid===TEACHER_UID){teacher=user;$('teacher-name').textContent=(user.name||'Teacher')+' · '+user.email;$('teacher-id').textContent=user.uid;enableUI(true);await reload()}}catch(e){message(errorMessage(e),true)}})();
