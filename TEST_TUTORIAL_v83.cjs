/* Static tutorial/regression checks, NOT a Firebase emulator or browser test. */
const fs=require('node:fs'),assert=require('node:assert/strict');
const get=x=>fs.readFileSync('docs/'+x,'utf8');
const tut=get('tutorial.js'),page=get('tutorial.html'),boot=get('online-boot-v66.js'),bridge=get('online-spark.js'),rules=fs.readFileSync('firestore.rules','utf8'),recruit=get('recruitment.js'),reveal=get('recruitment-reveal.js'),engine=get('adventure_engine.js');
let n=0;function ok(v,m){assert.ok(v,m);n++;}
for(let x of ['tutorial.html','tutorial.js','tutorial-preview.html','recruitment-core.mjs','recruitment.js','recruitment-reveal.js','gacha_catalog.json'])ok(fs.existsSync('docs/'+x),`missing ${x}`);
for(let w of ['apple','cat','sun','book','green','water','happy','What is your name?']){if(w==='What is your name?')ok(get('online-boot-v66.js').includes(w),'registration label');else ok(tut.includes(w),`training word ${w}`)}
for(let s of ['tutorialState','tutorialProgress','recruitmentPull','lastDailyDate','lastDrawResults','runTransaction'])ok(bridge.includes(s),`bridge missing ${s}`);
for(let s of ['recruitmentDraws','validRecruitmentWalletUpdate','validTutorialUpdate','getAfter','tutorialClaimed'])ok(rules.includes(s),`rules missing ${s}`);
ok(recruit.includes('openResults'),'real recruitment reveal');
ok(reveal.includes('openResults'),'real result display');
ok(tut.includes("'tutorial'"),'tutorial first pull mode');
ok(tut.includes('step:next'),'progression writes');
ok(tut.includes('resumeResults'),'reload recovery');
ok(engine.includes('title: "How to Play"'),'replay choice');
ok(engine.includes('title: "Recruitment"'),'recruitment choice');
ok(engine.includes('tutorial.html'),'intro-> tutorial redirect');
ok(boot.includes('tutorial:profile?.tutorial'),'card loads tutorial state');
ok(page.includes('recruitment-reveal.js'),'star reveal loaded');
console.log(`PASS: ${n} v83 static tutorial integration checks. Firebase rules/runtime still require live/emulator testing.`);
