const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('./docs/aura-core.js');
const totals=[0,10,30,70,150];
assert.deepEqual(core.totals,totals);
assert.deepEqual(core.duplicateRewards,{4:1,5:3,6:8});
let checks=0;
for(let start=0;start<=4;start++){
 const state={level:start,equipped:start};
 for(let wallet=0;wallet<=160;wallet++){
  checks++;
  if(start===4){assert.throws(()=>core.change('upgrade',state,wallet),/already unlocked/);continue;}
  const price=totals[start+1]-totals[start];
  if(wallet<price){assert.throws(()=>core.change('upgrade',state,wallet),/Need/);continue;}
  const got=core.change('upgrade',state,wallet);
  assert.deepEqual(got,{shards:wallet-price,spent:price,level:start+1,equipped:start+1});
 }
}
for(let unlocked=0;unlocked<=4;unlocked++)for(let equipped=0;equipped<=unlocked;equipped++)for(let target=0;target<=4;target++){
 checks++;const st={level:unlocked,equipped};
 if(target>unlocked||target===equipped)assert.throws(()=>core.change('equip',st,100,target));
 else assert.deepEqual(core.change('equip',st,100,target),{shards:100,spent:0,level:unlocked,equipped:target});
}
for(const input of [-1,0.5,NaN,Infinity,'abc',null]){checks++;assert.throws(()=>core.change('upgrade',{level:0,equipped:0},input));}
// Fail closed if somebody tries to use Guild Coins as shards.
assert.ok(fs.readFileSync('./docs/online-spark.js','utf8').includes("'recruitment.shards':shards-cost"));
const rules=fs.readFileSync('./firestore.rules','utf8');
for(const word of ['validAuraWalletUpdate','after.shards==oldShards-auraTierCost(next.level)','request.resource.data.recruitment.shards==0','auraTierCost(level)','validAuraRecord'])assert.ok(rules.includes(word),`Rules missing ${word}`);
for(const file of ['auras.html','auras-demo.html','auras.css','auras.js','aura-admin.html','aura-admin.js'])assert.ok(fs.existsSync(path.join('docs',file)));
console.log(`PASS ${checks} aura economy checks, files and rule structure`);
