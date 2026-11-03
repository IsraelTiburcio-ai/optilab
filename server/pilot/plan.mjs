import {createHash} from 'node:crypto';
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function checkUid(uid){if(typeof uid!=='string'||!/^[-A-Za-z0-9_:]{1,128}$/.test(uid))throw Error('Explicit compatible UID required');return uid;}
const protectedRoots=new Set(['syncPilotMembers','syncPilotAudit','syncPilotControl']);
function references(value,uid){if(value===uid)return true;if(!value||typeof value!=='object')return false;return Object.entries(value).some(([key,v])=>key===uid||references(v,uid));}
export function planUid(uid,documents){
 checkUid(uid);const owned=[],review=[],retained=[],parents=[];
 for(const document of [...documents].sort((a,b)=>a.path.split('/').length-b.path.split('/').length||a.path.localeCompare(b.path))){
  const {path,data}=document;const root=path.split('/')[0];const below=path===`users/${uid}`||path.startsWith(`users/${uid}/`)||parents.some(p=>path.startsWith(p+'/'));
  const owners=['uid','ownerUid','subjectUid'].map(field=>data?.[field]).filter(value=>typeof value==='string');
  const direct=owners.includes(uid);
  if(protectedRoots.has(root)){if(direct||references(data,uid)||path===`syncPilotMembers/${uid}`)retained.push(document);continue;}
  if((below||direct)&&owners.some(owner=>owner!==uid)){review.push(document);continue;}
  if(direct&&root==='users'&&path.split('/')[1]!==uid){review.push(document);continue;}
  if(below||direct){owned.push(document);parents.push(path);}
  else if(references(data,uid)||path.split('/').at(-1)===uid)review.push(document);
 }
 const compact=list=>list.map(d=>({path:d.path,version:d.version})).sort((a,b)=>a.path.localeCompare(b.path));
 const summary={version:1,uid,owned:compact(owned),review:compact(review),retained:compact(retained)};
 // Registry/audit changes do not invalidate the approved data deletion plan.
 return {...summary,hash:hash({uid,owned:summary.owned,review:summary.review}),documents:owned,retainedDocuments:retained};
}
