const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const core=require('./docs/guild-grants-core.js');
const sleep=()=>new Promise(done=>setTimeout(done,10));
class Element {
 constructor(id){this.id=id;this.value='';this.disabled=false;this.textContent='';this.className='';this.options=[];this.children=[];this.listeners={};this.classList={toggle(){}};}
 addEventListener(event,fn){this.listeners[event]=fn;}
 async fire(name){return this.listeners[name]?.({preventDefault(){}})}
 replaceChildren(){this.options=[];this.children=[];}
 add(option){this.options.push(option);}
 insertRow(){const row=new Element('row');row.insertCell=()=>{const cell={textContent:'',colSpan:1};row.children.push(cell);return cell};this.children.push(row);return row}
}
const elements=new Map();
const $=id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)};
$('amount').value='100';
const players=new Map([
 ['P000001',{publicId:'P000001',username:'Alice',grade:'1',disabled:false,recruitment:{coins:500}}],
 ['P000002',{publicId:'P000002',username:'Bob',grade:'2',disabled:true,recruitment:{coins:25}}],
]);
const grants=new Map();let grantIndex=0,confirmCount=0,playerReads=0,historyReads=0;
function pathRef(a,b){return {collection:a,id:b,path:`${a}/${b}`}}
function collection(db,name){return {collection:name}}
function doc(a,b){if(a.collection&&b===undefined)return pathRef(a.collection,'receipt-'+(++grantIndex));if(a===db)return pathRef(b,arguments[2]);throw Error('invalid mock doc')}
const db={};
const makeSnap=(id,data)=>({id,data:()=>structuredClone(data),exists:()=>data!==undefined});
const context={
 window:{RPG_GUILD_GRANTS_CORE:core,confirm:()=>{confirmCount++;return true}},
 document:{getElementById:$},Option:class {constructor(label,value){this.text=label;this.value=value}},
 console,Number,String,Error,Map,Promise,
 googleTeacher:async()=>({uid:'1BsaIx7kcfUSRO3rhNbHsJPRHkw1',email:'teacher@example.net'}),
 currentTeacher:async()=>({uid:'1BsaIx7kcfUSRO3rhNbHsJPRHkw1',email:'teacher@example.net'}),
 errorMessage:e=>String(e.message||e),
 getApp:()=>({}),getFirestore:()=>db,doc,collection,
 query:(...x)=>x,orderBy:()=>{},limit:()=>{},serverTimestamp:()=>({serverTimestamp:true}),
 getDocsFromServer:async q=>{
  if(q.collection==='players'){playerReads++;return {docs:[...players].map(([id,data])=>makeSnap(id,data))}};
  historyReads++;
  const docs=[...grants].reverse().map(([id,data])=>makeSnap(id,{...data,createdAt:{toDate:()=>new Date('2026-11-17T00:00:00Z')}}));
  return {docs,empty:!docs.length};
 },
 getDocFromServer:async ref=>makeSnap(ref.id,players.get(ref.id)),
 runTransaction:async(db,fn)=>{
  const staged=[];
  const tx={get:async ref=>makeSnap(ref.id,ref.collection==='players'?players.get(ref.id):grants.get(ref.id)),
   update:(ref,data)=>staged.push(()=>{const p=players.get(ref.id);assert.ok(p);p.recruitment.coins=data['recruitment.coins'];p.recruitment.lastTeacherGrantId=data['recruitment.lastTeacherGrantId']}),
   set:(ref,data)=>staged.push(()=>{grants.set(ref.id,data)})};
  const result=await fn(tx);staged.forEach(fn=>fn());return result;
 }
};
(async()=>{
 const source=fs.readFileSync('./docs/guild-grants.js','utf8').replace(/^import .*;\s*$/gm,'');
 vm.runInNewContext(source,context,{filename:'guild-grants.js'});
 await sleep();
 assert.equal(playerReads,1,'teacher loads players only once');
 assert.equal(historyReads,1);
 assert.match($('authStatus').textContent,/Loaded 2 player wallets/);
 $('player').value='P000001';await $('player').fire('change');
 assert.equal($('before').textContent,'500');
 assert.equal($('after').textContent,'600');
 await $('grantForm').fire('submit');
 assert.equal(players.get('P000001').recruitment.coins,600);
 assert.equal(grants.size,1);
 assert.equal([...grants.values()][0].balanceBefore,500);
 assert.equal([...grants.values()][0].balanceAfter,600);
 assert.equal(confirmCount,1);
 assert.match($('grantStatus').textContent,/SUCCESS/);
 $('amount').value='0';await $('grantForm').fire('submit');
 assert.equal(grants.size,1);
 $('amount').value='100';$('player').value='P000002';await $('player').fire('change');
 await $('grantForm').fire('submit');
 assert.equal(grants.size,1,'disabled players cannot get grants');
 assert.equal(players.get('P000002').recruitment.coins,25);
 console.log('PASS: teacher UI mock transaction, atomic wallet + receipt, invalid amount, disabled player, and single-load behavior');
})().catch(err=>{console.error(err);process.exitCode=1});
