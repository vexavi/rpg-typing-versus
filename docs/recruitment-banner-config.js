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
     if(!row.title.trim()||!row.tab.trim()||!row.kicker.trim())throw Error('Banner tab label, small heading and large title are required.');
     if(!/^[a-z][a-z0-9_]{0,39}$/.test(row.featured_character_id))throw Error('Choose an available featured operator.');
   }
   return normalize(source);
 }
 const REQUIRED=['tab','title','kicker'];
 function merge(base,overrides){
   const rows=Array.isArray(overrides)?overrides:[];
   return (Array.isArray(base)?base:[]).map(row=>{
     const o=rows.find(x=>x&&x.id===row.id);
     if(!o)return row;
     // v148.9: a saved banner that is missing fields keeps the packaged text for them
     // (required fields never become blank); optional fields may be cleared on purpose.
     const out={...row};
     for(const field of FIELDS){
       if(!(field in o))continue;
       const value=String(o[field]??'').trim().slice(0,LIMITS[field]);
       if(!value&&(REQUIRED.includes(field)||field==='featured_character_id'))continue;
       out[field]=value;
     }
     if(!/^[a-z][a-z0-9_]{0,39}$/.test(out.featured_character_id||''))out.featured_character_id=row.featured_character_id||'tavi';
     // Never let teacher text overwrite file-backed artwork, ID, or game behavior.
     out.art=row.art;
     return out;
   });
 }
 const api={IDS,FIELD_LIMITS:LIMITS,FIELDS,normalize,assertEditable,merge};
 root.RPG_RECRUITMENT_BANNERS=api;
 if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
