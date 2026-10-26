import type {Data} from './contracts';
import {hash} from './repository';
import {conflict} from './errors';
// Unicode NFKC compatibility normalization, then locale-independent lowercase.
// The resulting namespace is deliberately ASCII: 3–20 letters/digits/underscore.
export function normalizeGamertag(value:unknown):{display:string;normalized:string} {
  if(typeof value!=='string'||value.length>80)throw conflict();
  const display=value.normalize('NFKC').trim();
  if(!/^[A-Za-z0-9_]{3,20}$/.test(display))throw conflict();
  return {display,normalized:display.toLowerCase()};
}
export const tagPath=(normalized:string)=>`gamertagReservations/${hash(normalized)}`;
export function playerDocument(raw:Data|null,uid:string):Data|null {
  if(!raw)return null;
  const keys=['schemaVersion','uid','revision','gamertag','normalizedGamertag','avatarId','companionId','completedAt','updatedAt'];
  if(Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k))||raw.schemaVersion!==2||raw.uid!==uid||!Number.isInteger(raw.revision)||raw.revision<1||raw.revision>2147483646||
    typeof raw.avatarId!=='string'||!/^avatar-0[1-6]$/.test(raw.avatarId)||!['nexo','poli','piv','dua','brio'].includes(raw.companionId)||
    typeof raw.completedAt?.toMillis!=='function'||typeof raw.updatedAt?.toMillis!=='function'||normalizeGamertag(raw.gamertag).normalized!==raw.normalizedGamertag)throw conflict();
  return raw;
}
export function reservation(raw:Data|null,normalized:string):Data|null {
  if(!raw)return null;
  if(Object.keys(raw).length!==4||raw.schemaVersion!==2||raw.normalized!==normalized||typeof raw.uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(raw.uid)||!['reserved','released'].includes(raw.status))throw conflict();
  return raw;
}
export const publicPlayer=(p:Data|null)=>p?{revision:p.revision,gamertag:p.gamertag,avatarId:p.avatarId,companionId:p.companionId,updatedAt:p.updatedAt.toDate().toISOString()}:null;
