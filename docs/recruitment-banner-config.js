/* v71 Recruitment banner TEXT controls. Artwork stays in recruitment-banners.json.
 * Do not use this file for currency, odds, or recruitment outcomes. */
(function(root){
 'use strict';
 const IDS=['featured'];
 const LIMITS={tab:22,title:70,kicker:50,subtitle:110,description:260,featured_character_id:40};
 const FIELDS=Object.keys(LIMITS);
 function normalize(source){
   if(!Array.isArray(source))return [];
   return IDS.map(id=>{
     const sourceRow=source.find(x=>x&&x.id===id);
     if(!sourceRow)return null;
     const row={id};
     for(const field of FIELDS)row[field]=String(sourceRow[field]??(field==='featured_character_id'?'tavi':'')).trim().slice(0,LIMITS[field]);
     return row;
   }).filter(Boolean);
 }
 function assertEditable(source){
   if(!Array.isArray(source)||source.length!==IDS.length)throw Error('Exactly one Featured banner is required.');
   if(source.some((x,i)=>!x||x.id!==IDS[i]))throw Error('The only banner ID must be featured.');
   for(const row of source){
     for(const field of FIELDS){
       if(typeof row[field]!=='string'||row[field].length>LIMITS[field])throw Error(field+' exceeds the maximum length.');
     }
     if(!row.title.trim()||!row.tab.trim()||!row.kicker.trim())throw Error('Title, tab label, and kicker are required.');
     if(!/^[a-z][a-z0-9_]{0,39}$/.test(row.featured_character_id))throw Error('Choose an available featured operator.');
   }
   return normalize(source);
 }
 function merge(base,overrides){
   const byId=new Map(normalize(overrides).map(x=>[x.id,x]));
   return (Array.isArray(base)?base:[]).map(row=>{
     const x=byId.get(row.id);
     // Never let teacher text overwrite file-backed artwork, ID, or game behavior.
     return x?{...row,...x,art:row.art}:row;
   });
 }
 const api={IDS,FIELD_LIMITS:LIMITS,FIELDS,normalize,assertEditable,merge};
 root.RPG_RECRUITMENT_BANNERS=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
