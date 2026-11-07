// Process-memory fences; deployed Rules remain authoritative.
const admitted=new Set<string>(),remembered=new Set<string>(),listeners=new Set<()=>void>();
export const subscribeAdmission=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export function setAdmission(uid:string,allowed:boolean){const previous=admitted.has(uid);allowed?admitted.add(uid):admitted.delete(uid);if(allowed)remembered.add(uid);if(previous!==allowed)listeners.forEach(f=>f());}
export function rememberAdmission(uid:string){remembered.add(uid);listeners.forEach(f=>f());}
export function clearAdmission(uid:string){admitted.delete(uid);remembered.delete(uid);listeners.forEach(f=>f());}
export const admissionAllowed=(uid:string)=>admitted.has(uid);
export const wasAdmitted=(uid:string)=>remembered.has(uid);
export function admissionWatch<T>(uid:string,create:()=>{watch:(next:(value:T)=>void,error:(e:unknown)=>void)=>()=>void},next:(value:T)=>void,error:(e:unknown)=>void){let active=true,stop:(()=>void)|undefined;const connect=()=>{if(!active)return;if(!admissionAllowed(uid)){stop?.();stop=undefined;return;}if(!stop)try{stop=create().watch(next,error);}catch(e){error(e);}};const unsubscribe=subscribeAdmission(connect);connect();return()=>{active=false;unsubscribe();stop?.();};}
