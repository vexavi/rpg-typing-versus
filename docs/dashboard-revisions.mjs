// Keep old rankings valid until their own mode changes.
export const rankedModes=['normal','challenge','shared'];
export function modeRevision(data,mode){return Number(data?.modeRevisions?.[mode]??data?.revision)||1;}
export function nextModeConfig(data,mode){
 if(!['normal','challenge'].includes(mode))throw Error('Not a configurable ranked mode.');
 const modes=Object.fromEntries(rankedModes.map(m=>[m,modeRevision(data,m)]));
 modes[mode]++;return {revision:(Number(data?.revision)||1)+1,modeRevisions:modes};
}
export function balanceScopes(mode,ids,chapter=null){return [...new Set([`mode:${mode}`,...(chapter?[`chapter:${chapter}`]:[]),...ids.map(x=>`stage:${mode}:${x}`)])];}
