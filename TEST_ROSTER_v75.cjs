const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'docs'),config=require(path.join(root,'recruitment-banner-config.js'));
const roster=JSON.parse(fs.readFileSync(path.join(root,'gacha_catalog.json')));
const banner=JSON.parse(fs.readFileSync(path.join(root,'recruitment-banners.json'))).banners[0];
let count=0;function check(x,msg){assert.ok(x,msg);count++}
check(roster.characters.length===14,'14 operators');
check(roster.characters.filter(x=>x.rarity===4).length===8,'eight 4-star');
check(roster.characters.filter(x=>x.rarity===5).length===3,'three 5-star');
check(roster.characters.filter(x=>x.rarity===6).length===3,'three 6-star');
check(roster.featured_character_id==='tavi','featured Tavi');
check(banner.featured_character_id==='tavi','banner Tavi');
check(roster.characters.some(x=>x.id===roster.featured_character_id&&x.rarity===6),'featured belongs to 6-star roster');
const seen=new Set();let size=0;
for (const c of roster.characters){
 check(!seen.has(c.id),'unique id '+c.id);seen.add(c.id);
 check(/^[a-z][a-z0-9_]{0,39}$/.test(c.id),'valid id');
 check([4,5,6].includes(c.rarity),'valid rarity');
 check(c.name.toLowerCase()===c.id,'name id match');
 check(/^assets\/recruitment\/[a-z0-9_-]+\.webp$/.test(c.art),'safe art path');
 const f=path.join(root,c.art);check(fs.existsSync(f),'artwork exists');
 const b=fs.readFileSync(f);check(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP','webp file');
 size+=b.length;
}
check(size<5e6,'total optimized art under 5MB');
const valid=config.assertEditable([banner]);check(valid[0].featured_character_id==='tavi','new banner passes');
const old={...banner};delete old.featured_character_id;
const merged=config.merge([banner],[old]);check(merged[0].featured_character_id==='tavi','older banner document migration');
const altered=config.assertEditable([{...banner,featured_character_id:'cassian'}]);check(altered[0].featured_character_id==='cassian','selector accepts new featured operator');
check(fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8').includes('b.featured_character_id.matches'),'teacher rule validates field');
check(fs.readFileSync(path.join(root,'recruitment.js'),'utf8').includes('window.RPG_RECRUITMENT_REVEAL?.configure'),'reveal hooked to roster');
check(fs.readFileSync(path.join(root,'recruitment-reveal.js'),'utf8').includes('session.operators'),'reveal displays known operators');
console.log(`PASS ${count} roster checks; 14 transparencies optimized to ${(size/1e6).toFixed(2)}MB. Browser/Firebase testing remains to be done.`);
