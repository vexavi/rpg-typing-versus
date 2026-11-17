/* v81 registration and returning QR probe regression checks. */
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const docs=path.join(__dirname,'docs');
const bridge=fs.readFileSync(path.join(docs,'online-spark.js'),'utf8');
const boot=fs.readFileSync(path.join(docs,'online-boot-v66.js'),'utf8');
const profile=fs.readFileSync(path.join(docs,'profile.js'),'utf8');
const index=fs.readFileSync(path.join(docs,'index.html'),'utf8');
const match=bridge.match(/async function openCard\(b\)\{[\s\S]+?\n\}\n(?=async function currentConfig)/);
assert(match,'openCard function not found');
const code='ABCD2345EFGH6789',card={publicId:'P000042',username:null,character:'crimson_knight'},store={cloudCards:{[code]:card},cardSessions:{},players:{}};
const refs=[];
let updates=0;
const ctx={
 ensureStudent:async()=>({uid:'test'}),
 codeInfo:async value=>{if(value!==code)throw Error('unexpected card');return {code,card:store.cloudCards[code]}},
 name:value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,20),
 ref:(collection,id)=>({collection,id}),
 updateDoc:async(r,patch)=>{updates++;Object.assign(store[r.collection][r.id],patch)},
 setDoc:async(r,doc)=>{store[r.collection][r.id]=doc},
 read:async(collection,id)=>store[collection][id]||null,
 defaultPlayer:c=>({publicId:c.publicId,username:c.username,character:'mc',cosmetics:{featured:'mc'}}),
 uid:()=> 'test',serverTimestamp:()=>1000,err:s=>{throw Error(s)}
};
vm.createContext(ctx);vm.runInContext(match[0].replace('async function openCard(b)','this.openCard=async function openCard(b)'),ctx);
(async()=>{
 const first=await ctx.openCard({card_code:code,name:'',probe:true});
 assert.equal(first.registration_required,true,'First-time probe must request username');
 assert.equal(updates,0,'First-time probe must not register');
 assert.equal(Object.keys(store.cardSessions).length,0,'First-time probe must not establish session');
 const registered=await ctx.openCard({card_code:code,name:'Haru',probe:true});
 assert.equal(registered.name,'Haru');
 assert.equal(store.cloudCards[code].username,'Haru');
 assert.equal(store.cardSessions.test.publicId,'P000042');
 assert.equal(store.players.P000042.character,'mc');
 assert.equal(updates,1);
 const again=await ctx.openCard({card_code:code,name:'',probe:true});
 assert.equal(again.name,'Haru','Returning card must not require username');
 assert.equal(updates,1,'Returning card must not overwrite registration');
 assert(boot.includes('registration_required')&&boot.includes('probe:true'),'QR login must probe registration status');
 assert(boot.includes('if(code)void resolveCard()'),'Scanned QR code must resolve automatically');
 assert(boot.includes('view(\'register\''),'New card needs username-only screen');
 assert(!boot.includes('id="ag-code" maxlength="19"'),'Old always-visible code form must be removed');
 assert(boot.includes('id="ag-manual" hidden'),'Manual entry must remain a fallback');
 assert(index.includes('location.search+location.hash'),'Index redirect must preserve the printed QR query');
 assert(profile.includes("id:'mc',name:'Main Character'"),'Main Character should be selectable from profile');
 console.log('v81 QR login: 15 checks passed (first-time, returning, Firebase writes, manual fallback, redirects, MC selection).');
})().catch(e=>{console.error(e);process.exitCode=1});
