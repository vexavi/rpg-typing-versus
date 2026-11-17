/* v86.9 Local-first recovery for previously verified Adventure Cards.
 * A cached identity permits UNRANKED practice only; it is not authentication.
 * No bearer card codes, coins, gacha receipts or pending reward writes are stored.
 */
const CARD_PREFIX='rpgVerifiedCard_v869_';
const VOCAB_PREFIX='bossTyping_verifiedVocab_v3__';
const JOURNAL_PREFIX='rpgLocalPractice_v869__';
const TTL=7*24*60*60*1000;
const codePattern=/^[A-HJ-NP-Z2-9]{16}$/;
const idPattern=/^P\d{6,}$/;
const safeRead=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const safeWrite=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
async function keyFor(code){
 const clean=String(code||'').replace(/[^A-Z2-9]/gi,'').toUpperCase();
 if(!codePattern.test(clean)||!crypto.subtle)return null;
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(clean));
 return CARD_PREFIX+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
const publicScope=id=>String(id||'').replace(/[^A-Z0-9_-]/gi,'').slice(0,32);
function readVocab(publicId){
 const v=safeRead(VOCAB_PREFIX+publicScope(publicId));
 if(v?.v!==3||v?.publicId!==publicId||
  !['1','2','3','b'].includes(v.pool)||!['1','2','3'].includes(v.grade)||
  !/^[123]b?$/.test(v.rankGrade)||
  (v.pool==='b')!==v.rankGrade.endsWith('b')||v.rankGrade[0]!==v.grade||
  !Number.isInteger(v.revision)||v.revision<1||
  !Number.isFinite(v.updatedAt)||v.updatedAt>Date.now()+60000||
  !Array.isArray(v.words)||!v.words.length||v.words.length>1000)return null;
 const seen=new Set();
 for(const w of v.words){
  const answer=String(w?.answer||'').trim().toLowerCase();
  if(!String(w?.prompt||'').trim()||!answer||seen.has(answer))return null;
  seen.add(answer);
 }
 return v;
}
function saveVocabulary(publicId,response){
 if(!idPattern.test(publicId)||!response?.ok)return false;
 const {pool,grade,rank_grade,revision}=response;
 if(!['1','2','3','b'].includes(pool)||!['1','2','3'].includes(grade)||
   !/^[123]b?$/.test(String(rank_grade||''))||
   (pool==='b')!==rank_grade.endsWith('b')||rank_grade[0]!==grade||
   !Number.isInteger(Number(revision))||Number(revision)<1||!Array.isArray(response.words)||response.words.length>1000)return false;
 const seen=new Set(),words=[];
 for(const w of response.words){
  const prompt=String(w?.prompt||'').trim(),answer=String(w?.answer||'').trim();
  if(!prompt||!answer||seen.has(answer.toLowerCase()))continue;
  seen.add(answer.toLowerCase());words.push({prompt,answer});
 }
 // Empty server lists are authoritative: overwrite an older nonempty cache.
 const item={v:3,publicId,pool,grade,rankGrade:rank_grade,revision:Number(revision),updatedAt:Date.now(),words};
 return safeWrite(VOCAB_PREFIX+publicScope(publicId),item);
}
async function save(code,identity,progress){
 if(!idPattern.test(identity?.public_id))return false;
 const key=await keyFor(code);if(!key)return false;
 const tutorial=identity?.tutorial||{};
 // A first-time student must finish the authoritative Firebase tutorial once.
 const record={v:1,verifiedAt:Date.now(),identity:{
  public_id:identity.public_id,name:String(identity.name||'').slice(0,20),
  selected_character:String(identity.selected_character||'mc').slice(0,60),
  tutorial:{version:Number(tutorial.version)||0,step:Number(tutorial.step)||1}
 },progress:{xp:Math.max(0,Math.trunc(Number(progress?.xp)||0)),
  achievements:Array.isArray(progress?.achievements)?progress.achievements.filter(x=>typeof x==='string').slice(0,100):[],
  best_normal:Math.max(0,Math.trunc(Number(progress?.best_normal)||0)),
  best_extra:Math.max(0,Math.trunc(Number(progress?.best_extra)||0)),
  normal_clear:progress?.normal_clear===true,extra_clear:progress?.extra_clear===true}};
 return safeWrite(key,record);
}
async function updateConfirmedProgress(code,payload){
 const key=await keyFor(code);if(!key)return false;
 const record=safeRead(key);if(!record||record.v!==1)return false;
 const p=record.progress||{};
 const val=k=>Math.max(0,Math.trunc(Number(payload?.[k])||0));
 record.progress={xp:val('xp'),achievements:Array.isArray(payload?.achievements)?payload.achievements.filter(x=>typeof x==='string').slice(0,100):[],
   best_normal:val('best_normal'),best_extra:val('best_extra'),
   normal_clear:payload?.normal_clear===true,extra_clear:payload?.extra_clear===true};
 // Do not extend the offline verification lifetime just because a score saved.
 return safeWrite(key,record);
}
async function get(code){
 const key=await keyFor(code);if(!key)return null;
 const record=safeRead(key);
 if(!record||record.v!==1||!Number.isFinite(record.verifiedAt)||
  record.verifiedAt>Date.now()+60000||Date.now()-record.verifiedAt>TTL||
  !idPattern.test(record.identity?.public_id)||
  Number(record.identity?.tutorial?.version)<1)return null;
 const vocabularyAvailable=Boolean(readVocab(record.identity.public_id));
 return {...record,vocabularyAvailable};
}
function recordLocalResult(publicId,{mode,stageId=null,score=null}={}){
 if(!idPattern.test(publicId)||!['story','normal','extra','practice'].includes(mode))return false;
 const key=JOURNAL_PREFIX+publicScope(publicId),stored=safeRead(key);
 const history=Array.isArray(stored?.runs)?stored.runs.slice(-19):[];
 history.push({mode,stageId:typeof stageId==='string'&&/^[\d-]{1,16}$/.test(stageId)?stageId:null,
  score:Number.isFinite(score)?Math.max(0,Math.trunc(score)):null,at:Date.now(),synced:false});
 // Local practice history is informational; it is NEVER replayed to cloud.
 return safeWrite(key,{v:1,runs:history});
}
export const offlineCardCache={save,get,saveVocabulary,readVocab,recordLocalResult,updateConfirmedProgress};
