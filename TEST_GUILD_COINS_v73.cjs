'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/docs/online-spark.js','utf8');
const part=source.slice(source.indexOf('/* v73 Guild Coins:'),source.indexOf('async function profile(b)'));
assert(part.includes('async function guildClaim(b)'));
const makeUUID=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const docs=new Map(),playerId='P123456',playerPath=`players/${playerId}`,rankPath='sparkRuns/demoUid';
docs.set(playerPath,{publicId:playerId,recruitment:{coins:0,permits:0,pity_six:0},story:{completed:['1-1','1-2','1-3']},disabled:false});
const snap=path=>{const x=docs.get(path);return {exists:()=>x!==undefined,data:()=>x ? structuredClone(x) : undefined};};
function updateNested(obj,key,val){const parts=key.split('.');let cur=obj;for(const p of parts.slice(0,-1))cur=cur[p]??={};cur[parts.at(-1)]=val;}
const ctx={
 db:{},ref:(kind,id)=>kind+'/'+id,uid:()=> 'demoUid',serverTimestamp:()=>({__serverTimestamp:true}),
 err:(x)=>{throw new Error(x)},
 currentPlayer:async()=>({id:playerId,player:structuredClone(docs.get(playerPath)),playerRef:playerPath}),
 getDocFromServer:async r=>snap(r),
 runTransaction:async(db,fn)=>{
  const writes=[];
  const tx={get:async path=>snap(path),set:(path,value)=>writes.push(['set',path,value]),update:(path,patch)=>writes.push(['update',path,patch])};
  const result=await fn(tx);
  for(const [action,path,data] of writes){if(action==='set'){docs.set(path,structuredClone(data));continue;}
   const copy=structuredClone(docs.get(path));for(const [k,v] of Object.entries(data))updateNested(copy,k,v);docs.set(path,copy);}
  return result;
 }
};
vm.createContext(ctx);vm.runInContext(part,ctx);const claim=vm.runInContext('guildClaim',ctx);
const test=async()=>{
 let n=0;const check=(cond,msg)=>{assert(cond,msg);n++};
 docs.set(rankPath,{status:'submitted',mode:'normal',token:makeUUID(1),publicId:playerId});
 let x=await claim({mode:'normal',run_token:makeUUID(1),correct:90,incorrect:10});check(x.awarded===15&&x.coins===15,'Normal 90%');
 x=await claim({mode:'normal',run_token:makeUUID(1),correct:90,incorrect:10});check(x.awarded===0&&x.duplicate&&x.coins===15,'duplicate rank token');
 docs.set(rankPath,{status:'submitted',mode:'normal',token:makeUUID(2),publicId:playerId});
 x=await claim({mode:'normal',run_token:makeUUID(2),correct:89,incorrect:11});check(x.awarded===10&&x.coins===25,'Normal 89%');
 docs.set(rankPath,{status:'submitted',mode:'extra',token:makeUUID(3),publicId:playerId});
 x=await claim({mode:'extra',run_token:makeUUID(3),correct:19,incorrect:1});check(x.awarded===20&&x.coins===45,'Extra 95%');
 docs.set(rankPath,{status:'submitted',mode:'extra',token:makeUUID(4),publicId:playerId});
 x=await claim({mode:'extra',run_token:makeUUID(4),correct:8,incorrect:2});check(x.awarded===15&&x.coins===60,'Extra 80%');
 x=await claim({mode:'story',stage_id:'1-1',attempt_id:makeUUID(5),first_clear:true,correct:10,incorrect:0});check(x.awarded===20&&x.firstClear&&x.coins===80,'Story first');
 x=await claim({mode:'story',stage_id:'1-1',attempt_id:makeUUID(5),first_clear:true,correct:10,incorrect:0});check(x.awarded===0&&x.duplicate&&x.coins===80,'Story first retry idempotent');
 x=await claim({mode:'story',stage_id:'1-1',attempt_id:makeUUID(6),first_clear:false,correct:10,incorrect:0});check(x.awarded===5&&x.coins===85,'Story replay');
 x=await claim({mode:'story',stage_id:'1-1',attempt_id:makeUUID(6),first_clear:false,correct:10,incorrect:0});check(x.awarded===0&&x.duplicate&&x.coins===85,'Story replay retry idempotent');
 x=await claim({mode:'story',stage_id:'1-2',attempt_id:makeUUID(7),first_clear:false,correct:10,incorrect:0});check(x.awarded===5&&x.coins===90,'Legacy completed Story replay first claim');
 await assert.rejects(()=>claim({mode:'story',stage_id:'9-9',attempt_id:makeUUID(8),correct:10,incorrect:0}),/Save the Story/);n++;
 await assert.rejects(()=>claim({mode:'practice',correct:10,incorrect:0}),/This mode does not/);n++;
 await assert.rejects(()=>claim({mode:'normal',run_token:makeUUID(999),correct:10,incorrect:0}),/Complete and submit/);n++;
 await assert.rejects(()=>claim({mode:'normal',run_token:makeUUID(4),correct:0,incorrect:10}),/Invalid run answer counts/);n++;
 for(let i=0;i<100;i++){docs.set(rankPath,{status:'submitted',mode:'normal',token:makeUUID(1000+i),publicId:playerId});x=await claim({mode:'normal',run_token:makeUUID(1000+i),correct:10,incorrect:0});check(x.awarded===15,'Unlimited repeated clears '+i);}
 check(docs.get(playerPath).recruitment.coins===1590,'No daily cap or diminishing returns');
 const client=fs.readFileSync(__dirname+'/docs/guild-coins.js','utf8');
 const window={};vm.runInNewContext(client,{window});
 const g=window.RPG_GUILD;check(g.preview('normal',90,10)===15&&g.preview('normal',89,11)===10,'client Normal');
 check(g.preview('extra',90,10)===20&&g.preview('extra',89,11)===15,'client Extra');
 check(g.preview('story',1,1,true)===20&&g.preview('story',1,1,false)===5,'client Story');
 check(g.preview('practice')===0&&g.preview('shared')===0&&g.preview('challenge')===0,'other modes 0');
 check(g.COST_SINGLE===100&&g.COST_TEN===1000,'unchanged pull prices');
 console.log(`PASS: ${n} guild currency tests; real Firebase/Firestore rules still require deployed project or emulator testing.`);
};test().catch(e=>{console.error(e);process.exit(1)});
