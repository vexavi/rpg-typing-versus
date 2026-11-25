/* Territory-scoped progress. A stage value is -1 (story-only) or 0–4 stars.
 * Legacy progress is read, never rewritten. Each operation changes one document. */
export const validTerritoryId=id=>typeof id==='string'&&/^[1-9]\d{0,3}$/.test(id);
export const validStageId=id=>typeof id==='string'&&/^[1-9]\d{0,3}-[1-9]\d{0,3}$/.test(id);
export const territoryOf=id=>validStageId(id)?id.split('-')[0]:null;
const rating=n=>Number.isInteger(n)&&n>=-1&&n<=4;
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
export function cleanTerritory(id,stages){
 if(!validTerritoryId(id))return {};
 return Object.fromEntries(Object.entries(object(stages)).filter(([key,n])=>territoryOf(key)===id&&rating(n)));
}
export function legacyTerritories(story){
 const result={};
 const put=(key,n)=>{const id=territoryOf(key);if(!id||!rating(n))return;const stages=result[id]??={};stages[key]=Math.max(stages[key]??-1,n);};
 for(const key of Array.isArray(story?.completed)?story.completed:[])put(key,-1);
 // Legacy ratings were only created on clear; recover any omitted by the old 200-ID cap.
 for(const [key,n] of Object.entries(object(story?.best_stars)))if(n>=0&&rating(n))put(key,n);
 return result;
}
export function mergeTerritory(id,...sources){
 const out={};for(const source of sources)for(const [key,n] of Object.entries(cleanTerritory(id,source)))out[key]=Math.max(out[key]??-1,n);return out;
}
export function progressResponse(stages){
 return {completed:Object.keys(stages),best_stars:Object.fromEntries(Object.entries(stages).filter(([,n])=>n>=0))};
}
export function combineProgress(story,records){
 const groups=legacyTerritories(story);
 for(const {id,stages} of records)if(validTerritoryId(id))groups[id]=mergeTerritory(id,groups[id],stages);
 return progressResponse(Object.assign({},...Object.values(groups)));
}
export function validateDelta(body){
 const id=body.territory_id,stages=body.stages;
 if(!validTerritoryId(id)||!stages||typeof stages!=='object'||Array.isArray(stages))throw Error('Invalid territory save. Refresh the game to v132.');
 const keys=Object.keys(stages);
 if(!keys.length||keys.length>100||keys.some(key=>territoryOf(key)!==id||!rating(stages[key])))throw Error('Invalid encounter results for territory '+id+'.');
 return {id,stages:cleanTerritory(id,stages)};
}
export function planTerritorySave(id,legacy,existing,delta){
 const before=mergeTerritory(id,legacyTerritories(legacy)[id],existing);
 const stages=mergeTerritory(id,before,delta);
 const firstClears=Object.keys(delta).filter(key=>!Object.hasOwn(before,key));
 return {stages,firstClears,changed:Object.keys(stages).length!==Object.keys(cleanTerritory(id,existing)).length||Object.entries(stages).some(([key,n])=>existing?.[key]!==n)};
}
export function hasClear(story,id,stages){
 const territory=territoryOf(id);return !!territory&&(Object.hasOwn(legacyTerritories(story)[territory]||{},id)||Object.hasOwn(cleanTerritory(territory,stages),id));
}
