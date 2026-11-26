/* Story manifest is a SINGLE Firestore document read on Story Map open.
 * Illustrations are existing static files under docs/story/images; no Cloud Storage.
 * No listener/polling: one read per opening, making Spark quota predictable.
 */
import './cloud-api.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import {getFirestore,doc,getDocFromServer} from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
export const STORY_COLLECTION='storyContent';
export const STORY_DOCUMENT='published';
// v148.9 quota saver: the published Conquest is one large document that changes only
// when the teacher publishes. Keep it 10 minutes on the Chromebook (map re-opens are free).
const STORY_CACHE_KEY='rpgStoryPublished',STORY_CACHE_MS=10*60*1000;
export async function loadPublishedStory({fresh=false}={}){
 let value,cached=null;
 if(!fresh)try{cached=JSON.parse(localStorage.getItem(STORY_CACHE_KEY)||'null');}catch(_){}
 if(cached&&Date.now()-cached.at>=0&&Date.now()-cached.at<STORY_CACHE_MS)value=cached.value;
 else{
  const db=getFirestore(getApp());
  const snapshot=await getDocFromServer(doc(db,STORY_COLLECTION,STORY_DOCUMENT));
  value=snapshot.exists()?snapshot.data():null;
  try{localStorage.setItem(STORY_CACHE_KEY,JSON.stringify({at:Date.now(),value:value?{chapters:value.chapters,revision:value.revision,retiredStageIds:value.retiredStageIds,retiredChapterIds:value.retiredChapterIds}:null}));}catch(_){}
 }
 if(!value)return null;
 if(!value||!Array.isArray(value.chapters)||!value.chapters.length)throw Error('The published Story content is invalid. Contact your teacher.');
 return {version:1,chapters:value.chapters,revision:Number(value.revision)||0,retiredStageIds:Array.isArray(value.retiredStageIds)?value.retiredStageIds:[],retiredChapterIds:Array.isArray(value.retiredChapterIds)?value.retiredChapterIds:[]};
}
export function missingStoryRule(error){
 return String(error?.code||'').includes('permission-denied')||String(error?.message||'').includes('Missing or insufficient permissions');
}
export async function loadEffectiveStory(){
 let published=null,missingRule=false;
 try{published=await loadPublishedStory();}
 catch(error){
  if(!missingStoryRule(error))throw error;
  // Safe rollout: old Story Mode stays usable before this new Firestore rule is deployed.
  missingRule=true;console.warn('Story publication rule missing. Using static chapters until rules are deployed.');
 }
 if(published)return {manifest:published,source:'firestore'};
 const response=await fetch('story/chapters.json',{cache:'no-store'});
 if(!response.ok)throw Error('Unable to load default Story chapters.');
 return {manifest:await response.json(),source:missingRule?'static-rules-not-installed':'static'};
}
