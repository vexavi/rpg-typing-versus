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
   const numericRanges={fallSpeedPxPerSec:[5,250],spawnEveryMs:[180,15000],hitDamage:[1,100]};
   for(const [key,[min,max]] of Object.entries(numericRanges)){
    const rawValue=st.battle?.[key];
    if(rawValue===undefined||rawValue===null)continue;
    if(typeof rawValue!=='number'||!Number.isFinite(rawValue)||rawValue<min||rawValue>max)throw Error(`Stage ${id}: invalid ${key} (${min}–${max}).`);
    battle[key]=rawValue;
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
   const chapter1Ranges={sleepy:{minIntervalSec:[4,120],maxIntervalSec:[4,120],closingSec:[0.2,4],closedSec:[0.2,4],openingSec:[0.2,4]},delirium:{changePercent:[0,100]},panic:{chancePct:[0,100],maxActive:[1,8],minGapSec:[0,30],damage:[1,10]}};
   if(chId==='1')for(const [name,ranges] of Object.entries(chapter1Ranges)){
    const values=battle.mechanics[name];if(!values)continue;
    if(values.enabled!==undefined&&typeof values.enabled!=='boolean')throw Error(`Stage ${id}: ${name}.enabled must be true or false.`);
    for(const [key,[min,max]] of Object.entries(ranges))if(values[key]!==undefined&&(typeof values[key]!=='number'||!Number.isFinite(values[key])||values[key]<min||values[key]>max))throw Error(`Stage ${id}: ${name}.${key} must be ${min}–${max}.`);
    if(name==='sleepy'&&(values.minIntervalSec??16)>(values.maxIntervalSec??22))throw Error(`Stage ${id}: Sleepy shortest interval cannot exceed longest interval.`);
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
  chapters.push({id:chId,title,subtitle,stages});
 }
 if(totalStages>300)throw Error('Maximum 300 stages in a published story.');
 const previous=[];
 for(const stage of chapters.flatMap(ch=>ch.stages)){
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
