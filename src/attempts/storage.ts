import {mergeLedgers} from './cloudModel';
import type {Ledger} from './model';
import {append,decode,empty,type Attempt} from './model';
export const attemptKey=(scope:string)=>`optilab-attempts:v1:${encodeURIComponent(scope)}`;
const failures=new Map<string,string>();
const change=()=>window.dispatchEvent(new Event('optilab-attempts'));
export const failure=(scope:string)=>failures.get(scope)??'';
function failed(scope:string) { failures.set(scope,'No se guardó el intento o la preferencia. El almacenamiento está bloqueado, lleno o es incompatible. Exporta el historial antes de repararlo.');change(); }
export function subscribe(callback:()=>void){window.addEventListener('optilab-attempts',callback);window.addEventListener('storage',callback);return()=>{window.removeEventListener('optilab-attempts',callback);window.removeEventListener('storage',callback);};}
export const history=(scope:string)=>decode(localStorage.getItem(attemptKey(scope)));
export const consent=(scope:string)=>localStorage.getItem(attemptKey(scope)+':consent')==='yes';
export function setConsent(scope:string,enabled:boolean){try{localStorage.setItem(attemptKey(scope)+':consent',enabled?'yes':'no');failures.delete(scope);change();return true;}catch{failed(scope);return false;}}
export function exportHistory(scope:string){try{return localStorage.getItem(attemptKey(scope))??JSON.stringify(empty());}catch{failed(scope);return null;}}
function atomicLedger(scope:string,event:Attempt|Ledger,isCurrent:()=>boolean,remoteWins=false):Promise<boolean>{
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('optilab-attempts-v1',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('ledgers');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{
   const db=request.result,tx=db.transaction('ledgers','readwrite'),store=tx.objectStore('ledgers');
   let reason:unknown,changed=false;
   tx.oncomplete=()=>{db.close();resolve(changed);};
   tx.onabort=()=>{db.close();reject(reason??tx.error??Error('Storage transaction aborted'));};
   tx.onerror=()=>{};
   const read=store.get(scope);
   read.onsuccess=()=>{
    try{
     if(!isCurrent()||!consent(scope))return;
     // Safari caches localStorage per process; use an IDB transaction as the
     // authoritative read/modify/write boundary and retain a JSON export mirror.
     const mirror=history(scope);
     const previous=read.result===undefined?mirror:decode(read.result);
     const next='entries' in event?mergeLedgers(previous,event,remoteWins):append(previous,event);
     if(JSON.stringify(next)===JSON.stringify(previous))return;
     const raw=JSON.stringify(next);
     localStorage.setItem(attemptKey(scope),raw);
     store.put(raw,scope);changed=true;
    }catch(error){reason=error;tx.abort();}
   };
  };
 });
}

/** Re-read consent and ledger under a shared origin lock. Never erase replay keys. */
export async function record(scope:string,event:Attempt,isCurrent:()=>boolean){
 try {
  if(!isCurrent()||!consent(scope))return;
  if(!navigator.locks)throw Error('Lock unavailable');
  await navigator.locks.request(attemptKey(scope),async()=>{
   if(!isCurrent()||!consent(scope))return;
   await atomicLedger(scope,event,isCurrent);
   failures.delete(scope);change();
  });
 }catch{failed(scope);}
}

export async function readCanonical(scope:string):Promise<Ledger>{
 return new Promise((resolve,reject)=>{const request=indexedDB.open('optilab-attempts-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('ledgers');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('ledgers','readonly'),get=tx.objectStore('ledgers').get(scope);let result:Ledger;get.onsuccess=()=>{try{result=get.result===undefined?history(scope):decode(get.result);}catch(e){reject(e);}};tx.oncomplete=()=>{db.close();if(result)resolve(result);};tx.onabort=()=>{db.close();reject(tx.error);};};});
}
export async function mergeHistory(scope:string,ledger:Ledger,isCurrent:()=>boolean,remoteWins=false){
 if(!navigator.locks)throw Error('No hay bloqueo local seguro para mezclar el historial.');
 await navigator.locks.request(attemptKey(scope),async()=>{if(!isCurrent())return;if(await atomicLedger(scope,ledger,isCurrent,remoteWins))change();});
}
export function backupHistory(scope:string,ledger:Ledger,source:string){
 const backup={version:1,owner:scope,source,createdAt:new Date().toISOString(),ledger:decode(JSON.stringify(ledger))};
 localStorage.setItem(`optilab-attempt-backup:${encodeURIComponent(scope)}:${crypto.randomUUID()}`,JSON.stringify(backup));
 return backup;
}
export function attemptBackups(scope:string){
 const prefix=`optilab-attempt-backup:${encodeURIComponent(scope)}:`;const result=[];
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith(prefix))result.push(JSON.parse(localStorage.getItem(key)!));}
 return result as {version:1;owner:string;source:string;createdAt:string;ledger:Ledger}[];
}
