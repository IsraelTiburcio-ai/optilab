import {append,decode,empty,type Attempt,type Ledger} from './model';
export const attemptId=(event:Attempt)=>`${event.activityId}--${event.id}`;
// Stable recursive comparison: result fields and their units remain significant.
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export class AttemptConflict extends Error {constructor(){super('El mismo intento tiene datos diferentes. Conserva ambos respaldos antes de elegir el remoto.');}}
export function mergeLedgers(local:Ledger,remote:Ledger,remoteWins=false):Ledger {
 let result=decode(JSON.stringify(local));
 for(const event of decode(JSON.stringify(remote)).entries){
  const prior=result.entries.find(e=>attemptId(e)===attemptId(event));
  if(prior&&stable(prior)!==stable(event)){
   if(!remoteWins)throw new AttemptConflict();
   result={version:1,entries:result.entries.map(e=>attemptId(e)===attemptId(event)?event:e)};
  }else result=append(result,event);
 }
 return result;
}
export interface AttemptTransport {watch(next:(ledger:Ledger)=>void,error:(e:unknown)=>void):()=>void;put(event:Attempt):Promise<void>}
export interface AttemptRepository {read():Promise<Ledger>;merge(remote:Ledger,remoteWins?:boolean):Promise<void>;backup(ledger:Ledger,source:string):Promise<void>}
export const validateLedger=(value:unknown)=>decode(JSON.stringify(value));
export {empty};
