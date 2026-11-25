import './conquest-core.js?v=136.0';
/* Pure validation/normalization; imported by the teacher editor and testable in Node.
 * Stable identifiers are essential to player progress and Game Settings overrides.
 */
export const safeStoryImage = s => /^story\/images\/[\w.-]+\.(png|webp|jpg|jpeg|svg)$/i.test(String(s||''));
export const safeStoryAudio = s => /^story\/audio\/[a-zA-Z0-9][\w.-]*\.(mp3|m4a|webm|opus|ogg|wav)$/i.test(String(s||''));
export function cleanStory(raw){
 if(!raw||!Array.isArray(raw.chapters)||!raw.chapters.length||raw.chapters.length>40)throw Error('Story must have 1–40 chapters.');
 const seen=new Set(),chapters=[],chapterIds=new Set();let totalStages=0;
 for(const ch of raw.chapters){
  const chId=String(ch.id??'');
  if(!/^[1-9]\d{0,3}$/.test(chId)||chapterIds.has(chId))throw Error('Chapter IDs must be unique positive numbers.');
  chapterIds.add(chId);
  const title=String(ch.title||'').trim(),subtitle=String(ch.subtitle||'').trim();
  if(!title||title.length>80||subtitle.length>150)throw Error(`Chapter ${chId}: title required (max 80) and subtitle max 150 characters.`);
  if(!Array.isArray(ch.stages)||!ch.stages.length||ch.stages.length>60)throw Error(`Chapter ${chId} must contain 1–60 stages.`);
  const stages=[];
  for(const st of ch.stages){
   const id=String(st.id||'');
   if(!new RegExp('^'+chId+'-[1-9]\\d{0,3}$').test(id)||seen.has(id))throw Error(`Invalid or repeated stage ID: ${id}`);
   seen.add(id);totalStages++;
   const title=String(st.title||'').trim(),description=String(st.description||'').trim();
   if(!title||title.length>85||description.length>600)throw Error(`Stage ${id}: title required (max 85), description max 600.`);
   if(!['story-only','battle-only','story-battle'].includes(st.type))throw Error(`Stage ${id}: invalid type.`);
   const battle={template:Number(st.battle?.template??1),bossName:String(st.battle?.bossName??'Story Boss').trim(),bossHp:Number(st.battle?.bossHp??20)};
   const bossSprite=String(st.battle?.bossSprite||'').trim();
   if(bossSprite&&!safeStoryImage(bossSprite))throw Error(`Stage ${id}: boss sprite must be a static story/images/... image path.`);
   if(bossSprite)battle.bossSprite=bossSprite;
   const battleBackground=String(st.battle?.battleBackground||'').trim();
   if(battleBackground&&!safeStoryImage(battleBackground))throw Error(`Stage ${id}: battle background must be a static story/images/... image path.`);
   if(battleBackground)battle.battleBackground=battleBackground;
   const bgmFile=String(st.battle?.bgmFile||'').trim();
   if(bgmFile&&!safeStoryAudio(bgmFile))throw Error(`Stage ${id}: BGM must be a static story/audio/... music path.`);
   if(bgmFile)battle.bgmFile=bgmFile;
   if(st.battle?.bgmLoop!==undefined){
    if(typeof st.battle.bgmLoop!=='boolean')throw Error(`Stage ${id}: BGM loop must be true or false.`);
    battle.bgmLoop=st.battle.bgmLoop;
   }
   const numericRanges={fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],hitDamage:[1,100],missDamage:[1,10],overflowDamage:[1,10],cometDamage:[1,10],shootingStarDamage:[1,10]};
   for(const [key,[min,max]] of Object.entries(numericRanges)){
    const rawValue=st.battle?.[key];
    if(rawValue===undefined||rawValue===null)continue;
    if(typeof rawValue!=='number'||!Number.isFinite(rawValue)||rawValue<min||rawValue>max)throw Error(`Stage ${id}: invalid ${key} (${min}–${max}).`);
    if(['missDamage','overflowDamage','cometDamage','shootingStarDamage'].includes(key)&&!Number.isInteger(rawValue))throw Error(`Stage ${id}: invalid ${key} (whole HP only).`);
    battle[key]=rawValue;
   }
   for(const key of ['cometEnabled','shootingStarEnabled']){
    if(st.battle?.[key]===undefined)continue;
    if(typeof st.battle[key]!=='boolean')throw Error(`Stage ${id}: ${key} must be true or false.`);
    battle[key]=st.battle[key];
   }
   const rawMechanics=st.battle?.mechanics||{};
   if(typeof rawMechanics!=='object'||Array.isArray(rawMechanics)||rawMechanics===null||Object.keys(rawMechanics).length>24)throw Error(`Stage ${id}: invalid word mechanics.`);
   battle.mechanics={};
   for(const [mechanicId,settings] of Object.entries(rawMechanics)){
    if(!/^[a-z][a-z0-9_]{0,47}$/.test(mechanicId)||!settings||typeof settings!=='object'||Array.isArray(settings)||Object.keys(settings).length>32)throw Error(`Stage ${id}: invalid word mechanic ${mechanicId}.`);
    const clean={};
    for(const [key,value] of Object.entries(settings)){
     if(!/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/.test(key)||!(typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)&&value>=-100000&&value<=100000))throw Error(`Stage ${id}: unsafe mechanic setting ${key}.`);
     clean[key]=value;
    }
    battle.mechanics[mechanicId]=clean;
   }
   // Known Chapter 1 mechanics: reject manipulated imports and impossible intervals before publish.
   const chapter1Ranges={sleepy:{minIntervalSec:[4,120],maxIntervalSec:[4,120],bgmDipPct:[0,90],closingSec:[0.2,4],closedSec:[0.2,4],openingSec:[0.2,4]},delirium:{changePercent:[0,100]},panic:{chancePct:[0,100],maxActive:[1,8],minGapSec:[0,30],damage:[1,10]},disorientation:{intervalSec:[3,120],freezeSec:[0.5,5],rushSec:[0.5,5],speedPct:[100,300]},repression:{chancePct:[0,100],visibleSec:[0.5,10],hiddenSec:[0.5,5],maxActive:[1,6]}};
   if(chId==='1')for(const [name,ranges] of Object.entries(chapter1Ranges)){
    const values=battle.mechanics[name];if(!values)continue;
    if(values.enabled!==undefined&&typeof values.enabled!=='boolean')throw Error(`Stage ${id}: ${name}.enabled must be true or false.`);
    for(const [key,[min,max]] of Object.entries(ranges))if(values[key]!==undefined&&(typeof values[key]!=='number'||!Number.isFinite(values[key])||values[key]<min||values[key]>max))throw Error(`Stage ${id}: ${name}.${key} must be ${min}–${max}.`);
    if(name==='repression'&&values.maxActive!==undefined&&!Number.isInteger(values.maxActive))throw Error(`Stage ${id}: repression.maxActive must be a whole number.`);
    if(name==='sleepy'&&(values.minIntervalSec??16)>(values.maxIntervalSec??22))throw Error(`Stage ${id}: Sleepy shortest interval cannot exceed longest interval.`);
   }
   const valcrestRanges={fortification:{chancePct:[0,100],maxActive:[1,5],hits:[2,3],speedPct:[40,100]},reinforcements:{intervalSec:[5,120],count:[1,5],gapSec:[0.5,3],warningSec:[0.5,4]},siege:{chancePct:[0,100],rows:[2,3],speedPct:[40,100],maxActive:[1,3]},encirclement:{intervalSec:[5,120],count:[1,3],warningSec:[0.5,4],entrySec:[0.2,1.5],heightPct:[0,35]},duel:{intervalSec:[5,120],speedPct:[40,150],damagePct:[100,500],damage:[1,10]}};
   for(const [name,ranges] of Object.entries(valcrestRanges)){const v=battle.mechanics[name];if(!v)continue;
    if(chId!=='2'&&v.enabled===true)throw Error(`Stage ${id}: ${name} is exclusive to Valcrest.`);
    if(v.enabled!==undefined&&typeof v.enabled!=='boolean')throw Error(`Stage ${id}: ${name}.enabled must be boolean.`);
    for(const [key,[min,max]] of Object.entries(ranges))if(v[key]!==undefined&&(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max||(['count','rows','hits','maxActive','damage'].includes(key)&&!Number.isInteger(v[key]))))throw Error(`Stage ${id}: invalid ${name}.${key}.`);
   }
   const vesperRanges={poison:{chancePct:[0,100],damage:[1,10],durationSec:[1,15],maxActive:[1,4],speedPct:[50,200]},blood_pact:{chancePct:[0,100],healPct:[0,15],maxActive:[1,3],speedPct:[50,200]},infiltration:{chancePct:[0,100],speedPct:[100,300],lockSec:[1,10],maxActive:[1,1],minGapSec:[5,60]},death_mark:{chancePct:[0,100],durationSec:[3,20],damage:[0,100],maxActive:[1,3],speedPct:[50,200]},moonlit_execution:{intervalSec:[10,120],count:[1,5],durationSec:[4,20],damage:[0,100],maxDamage:[0,100]}};
   for(const [name,ranges] of Object.entries(vesperRanges)){const v=battle.mechanics[name];if(!v)continue;
    if(chId!=='3'&&v.enabled===true)throw Error(`Stage ${id}: ${name} is exclusive to Vesper.`);
    if(v.enabled!==undefined&&typeof v.enabled!=='boolean')throw Error(`Stage ${id}: ${name}.enabled must be boolean.`);
    for(const [key,[min,max]] of Object.entries(ranges))if(v[key]!==undefined&&(typeof v[key]!=='number'||!Number.isFinite(v[key])||v[key]<min||v[key]>max||!Number.isInteger(v[key])))throw Error(`Stage ${id}: invalid ${name}.${key}.`);
   }
   if(!Number.isInteger(battle.template)||battle.template<1||battle.template>5||!battle.bossName||battle.bossName.length>40||!Number.isInteger(battle.bossHp)||battle.bossHp<1||battle.bossHp>999)throw Error(`Stage ${id}: invalid battle template, boss name or HP.`);
   function scenes(items,phase){
    if(!Array.isArray(items)||items.length>50)throw Error(`Stage ${id}: too many ${phase} slides (max 50).`);
    return items.map((x,i)=>{const image=String(x.image||'').trim(),caption=String(x.caption||'');
     if(image&&!safeStoryImage(image))throw Error(`Stage ${id} ${phase} slide ${i+1}: image must be a static story/images/... path.`);
     if(caption.length>300)throw Error(`Stage ${id} ${phase} slide ${i+1}: caption over 300 characters.`);
     return {image,caption};});
   }
   const defaults=[0,1,2,3];
   const damageMax=st.stars?.damageMax===undefined?defaults:st.stars.damageMax;
   if(!Array.isArray(damageMax)||damageMax.length!==4||damageMax.some((n,i)=>!Number.isInteger(n)||n<0||n>99||(i>0&&n<=damageMax[i-1])))throw Error(`Stage ${id}: star damage limits must be four increasing integers (0–99).`);
   const unlock={stageId:String(st.unlock?.stageId||''),minStars:Number(st.unlock?.minStars??0)};
   if(!Number.isInteger(unlock.minStars)||unlock.minStars<0||unlock.minStars>4)throw Error(`Stage ${id}: unlock stars must be 0–4.`);
   stages.push({id,title,type:st.type,description,battle,stars:{damageMax:[...damageMax]},unlock,intro:scenes(st.intro,'intro'),outro:scenes(st.outro,'outro')});
  }
  const conquest=ch.conquest===undefined?{}:{conquest:(typeof window!=='undefined'?window:globalThis).RPG_CONQUEST.normalizeConfig(ch.conquest,true,chId)};
  chapters.push({id:chId,title,subtitle,stages,...conquest});
 }
 if(totalStages>300)throw Error('Maximum 300 stages in a published story.');
 // Conquest uses territory order, not the legacy story prerequisites. Keep those
 // fields for backwards compatibility without blocking encounter reordering.
 const previous=[];
 if(!chapters.some(ch=>ch.conquest!==undefined))for(const stage of chapters.flatMap(ch=>ch.stages)){
  const autoPrerequisite=previous.at(-1)?.id||'';
  const required=stage.unlock.stageId||autoPrerequisite;
  if(stage.unlock.stageId&&!previous.some(s=>s.id===stage.unlock.stageId))throw Error(`Stage ${stage.id}: prerequisite must be an earlier stage.`);
  const prior=previous.find(s=>s.id===required);
  if(stage.unlock.minStars>0&&(!prior||prior.type==='story-only'))throw Error(`Stage ${stage.id}: a star prerequisite needs an earlier battle stage.`);
  if(!required&&stage.unlock.minStars>0)throw Error(`Stage ${stage.id}: the first stage cannot require stars.`);
  previous.push(stage);
 }
 const result={version:1,chapters};
 if(new TextEncoder().encode(JSON.stringify(result)).length>700000)throw Error('Story text exceeds 700 KB. Please split content or shorten captions before publishing.');
 return result;
}
