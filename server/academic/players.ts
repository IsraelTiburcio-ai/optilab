import type {Actor,Input,Data} from './contracts';
import type {Reader} from './authorization';
import {ApiError,conflict} from './errors';
import {normalizeGamertag,playerDocument,reservation,tagPath,publicPlayer} from './playerModel';
import {updateProfile,type AuthIdentity} from './profiles';
import {plan,type Plan} from './plans';
export async function ownPlayer(r:Reader,uid:string):Promise<Data>{
  const p=playerDocument(await r.get(`playerIdentities/${uid}`),uid);
  if(p){const index=reservation(await r.get(tagPath(p.normalizedGamertag)),p.normalizedGamertag);if(!index||index.uid!==uid||index.status!=='reserved')throw conflict();}
  return {identity:publicPlayer(p)};
}
export async function tagAvailability(r:Reader,uid:string,gamertag:string):Promise<Data>{
  const {normalized}=normalizeGamertag(gamertag),entry=reservation(await r.get(tagPath(normalized)),normalized);
  return {available:!entry||entry.status==='released'||entry.uid===uid};
}
export async function savePlayer(r:Reader,actor:Actor,i:Input,auth:AuthIdentity,time:()=>unknown):Promise<Plan>{
  const old=playerDocument(await r.get(`playerIdentities/${actor.uid}`),actor.uid),{display,normalized}=normalizeGamertag(i.gamertag);
  if((old?.revision??0)!==i.expectedVersion)throw conflict();
  const target=reservation(await r.get(tagPath(normalized)),normalized);
  if(target?.status==='reserved'&&target.uid!==actor.uid)throw new ApiError(409,'GAMERTAG_TAKEN','Ese gamertag ya está ocupado.');
  if(target?.status==='reserved'&&target.uid===actor.uid&&old?.normalizedGamertag!==normalized)throw conflict();
  let previous:Data|null=null;
  if(old&&old.normalizedGamertag!==normalized){previous=reservation(await r.get(tagPath(old.normalizedGamertag)),old.normalizedGamertag);if(!previous||previous.uid!==actor.uid||previous.status!=='reserved')throw conflict();}
  const identity={schemaVersion:2,uid:actor.uid,revision:(old?.revision??0)+1,gamertag:display,normalizedGamertag:normalized,
    avatarId:i.avatarId!,companionId:i.companionId!,completedAt:old?.completedAt??time(),updatedAt:time()};
  const profile=await updateProfile(r,actor,{...i,expectedVersion:i.expectedProfileVersion,nickname:i.shareGameIdentity?display:null,
    avatarId:i.shareGameIdentity?i.avatarId:null,companionId:i.shareGameIdentity?i.companionId:null},auth,time,identity);
  const writes:Plan['writes']=[...profile.writes,{path:`playerIdentities/${actor.uid}`,data:identity},
    {path:tagPath(normalized),data:{schemaVersion:2,normalized,uid:actor.uid,status:'reserved'}}];
  if(previous&&old)writes.push({path:tagPath(old.normalizedGamertag),data:{...previous,status:'released'}});
  return plan({outcome:'player-identity-saved',uid:actor.uid,version:identity.revision,profileVersion:profile.result.version},writes);
}
