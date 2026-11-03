import {games} from '../data';
import {isAvatarId} from '../data/avatars';
import {isCompanionId} from '../data/companions';
import {emptyProgress,equal,importProgress,type Operation} from './model';
import {parseMilestones} from '../lib/evolutionRules';

export const syncOperationLimits={fields:40,diagnostics:30,runs:50,bytes:200000,writes:122} as const;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,fields:string[])=>Object.keys(v).sort().join(',')===[...fields].sort().join(',');
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&Date.parse(v)>=0&&Date.parse(v)<=Date.now();
const ids=new Set(games.map(g=>g.repo));
function validValue(key:string,value:unknown):boolean {
  if(key.startsWith('practice--'))return ids.has(key.slice(10))&&(value===null||date(value));
  if(/^visit--[1-5]$/.test(key))return value===true;
  if(key==='nickname')return typeof value==='string'&&value.length<=30;
  if(key==='route')return Array.isArray(value)&&value.length<=28&&new Set(value).size===value.length&&value.every(id=>ids.has(id));
  if(key==='avatarId')return value===null||isAvatarId(value);
  if(key==='companionId')return value===null||isCompanionId(value);
  if(key==='celebrated')return integer(value,1,3);
  if(/^milestone--[23]$/.test(key)&&record(value)&&value.stage===Number(key.slice(-1))) {
    const parsed=parseMilestones([value],games).find(m=>m.stage===value.stage);
    return !!parsed&&equal(parsed,value)&&date(parsed.unlockedAt)&&parsed.practice.every(p=>date(p.practicedAt));
  }
  return false;
}
/** Reject corrupt journals, path injection and oversized work BEFORE any SDK read/write. */
export function validateSyncOperation(value:unknown):asserts value is Operation {
  const reject=()=>{throw new Error('Operación de sincronización inválida o fuera del presupuesto; conserva y exporta el journal.');};
  if(!record(value)||!exact(value,['id','epoch','kind','afterId','changes','diagnostics','runs',...('sourceHash'in value?['sourceHash']:[])]))return reject();
  if(!uuid(value.id)||!integer(value.epoch,1,1000000)||typeof value.kind!=='string'||!['edit','import','reset','restore'].includes(value.kind)||
    !(value.afterId===null||uuid(value.afterId))||!record(value.changes)||!record(value.diagnostics)||!record(value.runs))return reject();
  if(value.kind==='import'?(typeof value.sourceHash!=='string'||!/^[0-9a-f]{64}$/.test(value.sourceHash)):
    ('sourceHash'in value&&(typeof value.sourceHash!=='string'||value.sourceHash.length>64)))return reject();
  const fields=Object.entries(value.changes),diagnostics=Object.entries(value.diagnostics),runs=Object.entries(value.runs);
  if(fields.length>syncOperationLimits.fields||diagnostics.length>syncOperationLimits.diagnostics||runs.length>syncOperationLimits.runs)return reject();
  if((value.kind==='reset'||value.kind==='restore')&&value.epoch===1000000)return reject();
  if(value.kind==='reset'&&(fields.length||diagnostics.length||runs.length))return reject();
  for(const [key,c] of fields)if(!record(c)||!exact(c,['value','baseRevision','predecessor'])||!integer(c.baseRevision,0,2147483647)||
    !(c.predecessor===null||uuid(c.predecessor))||!validValue(key,c.value))return reject();
  for(const [id,r] of diagnostics)if(!uuid(id)&&!/^d_[0-9a-f]{64}_\d{1,2}$/.test(id)||!record(r)||!exact(r,['date','answers','score']))return reject();
  for(const [id,r] of runs)if(!uuid(id)||!record(r)||r.runId!==id)return reject();
  try{
    importProgress(JSON.stringify({...emptyProgress(),results:diagnostics.map(([,r])=>r),gameResults:runs.map(([,r])=>r)}));
    if(new TextEncoder().encode(JSON.stringify(value)).length>syncOperationLimits.bytes)return reject();
  }catch{return reject();}
}
