/* Teacher-only UI; permissions enforced in online-spark.js + Firestore rules. */
import './online-spark.js?v=148.9';
const $=id=>document.getElementById(id);
const utils=window.RPG_RECRUITMENT_BANNERS;
let banners=[],revision=0,busy=false;
const fields=['tab','kicker','title','subtitle','description','featured_character_id'];
let sixStars=[];
function status(msg,kind=''){$('status').textContent=msg;$('status').className='status '+kind;}
function current(){return banners[0];}
async function loadFeaturedOptions(){
 const response=await fetch('gacha_catalog.json',{cache:'no-cache'});
 if(!response.ok)throw Error('Character catalog missing. Upload the new GitHub files.');
 const data=await response.json();
 sixStars=(data.characters||[]).filter(c=>c&&c.rarity===6&&/^[a-z][a-z0-9_]{0,39}$/.test(c.id)&&/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(c.art));
 if(!sixStars.length)throw Error('The catalog must contain at least one 6★ operator.');
 $('featured_character_id').innerHTML=sixStars.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}
function fieldValues(){const b=current();if(!b)return;for(const f of fields)$(f).value=b[f]||'';}
function preview(){const b=current();if(!b)return;
 const character=sixStars.find(c=>c.id===b.featured_character_id);$('previewOperatorName').textContent=character?`FEATURED 6★ · ${character.name.toUpperCase()}`:'CHOOSE A 6★';$('previewOperatorArt').src=character?.art||'';$('previewOperatorArt').hidden=!character;
 for(const [id,key] of [['previewKicker','kicker'],['previewTitle','title'],['previewSubtitle','subtitle'],['previewDescription','description'],['previewTab','tab']])$(id).textContent=b[key]||'';
}
function collect(){const b=current();if(!b)return;for(const f of fields)b[f]=$(f).value;preview();}
function setBusy(value){busy=value;$('save').disabled=value;$('reload').disabled=value;}
async function api(action,data={}){const cloud=window.RPG_V66;const ready=await cloud?.ready;if(!ready)throw Error('Firebase and authorized teacher sign-in required.');return cloud.call('/api/recruitment/banners/admin',{action,...data});}
async function load(){setBusy(true);status('Loading banner text…');try{
 await loadFeaturedOptions();
 const local=await fetch('recruitment-banners.json',{cache:'default'}).then(r=>{if(!r.ok)throw Error('Bundled recruitment configuration missing.');return r.json();});
 const remote=await api('load');revision=Number(remote.revision)||0;
 const merged=utils.merge(local.banners,remote.banners);
 banners=utils.assertEditable(merged);
 if(!sixStars.some(c=>c.id===banners[0].featured_character_id))throw Error('Featured operator is not in the 6★ catalog.');
 $('revision').textContent='Revision '+revision;
 fieldValues();preview();status(revision?'Saved banner text loaded.':'Using packaged defaults. Save to publish your first Firebase version.','good');
 }catch(e){status(e.message||String(e),'error');}finally{setBusy(false)}}
async function save(){if(busy)return;collect();let safe;try{safe=utils.assertEditable(banners);}catch(e){status(e.message,'error');return;}
 if(!sixStars.some(c=>c.id===safe[0].featured_character_id)){status('Select an operator from the available 6★ roster.','error');return;}
 setBusy(true);status('Saving…');try{const r=await api('save',{expected_revision:revision,banners:safe});
 banners=r.banners;revision=r.revision;$('revision').textContent='Revision '+revision;
 status('Saved to Firebase. Students see the update on their next Recruitment visit or reload.','good');
 }catch(e){status(e.message||String(e),'error');}finally{setBusy(false)}}
for(const f of fields)$(f).addEventListener('input',collect);
$('editor').addEventListener('submit',e=>{e.preventDefault();void save()});
$('reload').addEventListener('click',()=>{if(!busy&&confirm('Discard unsaved text and reload Firebase values?'))void load()});
void load();
