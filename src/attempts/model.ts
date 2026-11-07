import {resultPilotIds} from '../integration/originalResults.js';
export const ids:readonly string[]=[...resultPilotIds,'memorama-simplex'];
export interface AttemptContext {courseId:string;termId:string;groupId:string}
export const validContext=(value:unknown):value is AttemptContext=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')==='courseId,groupId,termId'&&Object.values(value).every(v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v));
export const validActivityId=(id:string)=>ids.includes(id)||/^a_[a-f0-9]{32}$/.test(id)||['learningapps-formulas-simplex','wordwall-metodo-m-grande'].includes(id);
export type Kind='opened'|'declared'|'reported';
export interface Attempt {version:1;id:string;activityId:string;kind:Kind;trust:'declaration'|'client-report';observedAt:string;context?:AttemptContext;result?:Record<string,number|string|boolean>}
export interface Ledger {version:1;entries:Attempt[]}
export const empty=():Ledger=>({version:1,entries:[]});
export function append(ledger:Ledger,event:Attempt):Ledger {
 if(Object.keys(event).some(k=>!['version','id','activityId','kind','trust','observedAt','result','context'].includes(k)))throw Error('Campo desconocido');
 if(event.version!==1||!validActivityId(event.activityId)||!['opened','declared','reported'].includes(event.kind)||!/^[-\w:]{1,160}$/.test(event.id)||!Number.isFinite(Date.parse(event.observedAt)))throw Error('Intento inválido');
 if(event.context!==undefined&&!validContext(event.context))throw Error('Contexto académico inválido');
 if(event.trust!==(event.kind==='reported'?'client-report':'declaration'))throw Error('Confianza no autorizada');
 if(event.kind!=='reported'&&event.result!==undefined)throw Error('Resultado no autorizado');
 if(event.result){for(const [k,v] of Object.entries(event.result)){if(!['reason','correct','total','attempts','errors','durationMs','timeouts','score','accuracy','matchedPairs','totalPairs','elapsedMs','completed'].includes(k)||!(typeof v==='boolean'||typeof v==='string'&&['completed','time-limit'].includes(v)||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0))throw Error('Métrica inválida');}}
 const prior=ledger.entries.find(x=>x.id===event.id&&x.activityId===event.activityId);
 if(prior){const stable=(v:unknown)=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);if(stable(prior)!==stable({...event,observedAt:prior.observedAt}))throw Error('El mismo intento contiene datos distintos');return ledger;}
 if(ledger.entries.length>=2000)throw Error('Historial lleno: exporta antes de continuar');
 return {version:1,entries:[...ledger.entries,structuredClone(event)]};
}
export function decode(raw:string|null):Ledger {if(!raw)return empty();const v=JSON.parse(raw);if(v.version!==1||!Array.isArray(v.entries))throw Error('Historial incompatible');return v.entries.reduce((l:Ledger,e:Attempt)=>append(l,e),empty());}
export function metrics(ledger:Ledger){return ids.map(activityId=>({activityId,opened:ledger.entries.filter(e=>e.activityId===activityId&&e.kind==='opened').length,declared:ledger.entries.filter(e=>e.activityId===activityId&&e.kind==='declared').length,reported:ledger.entries.filter(e=>e.activityId===activityId&&e.kind==='reported').length,validated:0}));}
