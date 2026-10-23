/** Local lifecycle fences, not credentials/roles. Used only by explicit emulator-sync mode. */
type Signal={kind:'logout'|'accepted';uid:string;nonce:string};
const prefix='optilab-auth-logout:',generationKey='optilab-auth-logout-generation';
const blocked=new Set<string>();let memoryGeneration='';
function stored(key:string) {try{return localStorage.getItem(key);}catch{return null;}}
export function logoutGeneration(){
  const fences:[string,string|null][]=[];
  try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith(prefix))fences.push([key,localStorage.getItem(key)]);}}catch{/* memory fallback */}
  return JSON.stringify([stored(generationKey),memoryGeneration,fences.sort(([a],[b])=>a.localeCompare(b))]);
}
export function logoutBlocked(uid:string){return blocked.has(uid)||!!stored(prefix+encodeURIComponent(uid));}
function broadcast(signal:Signal) {
  if(typeof window==='undefined'||typeof BroadcastChannel==='undefined')return;
  try{const channel=new BroadcastChannel('optilab-auth-lifecycle');channel.postMessage(signal);setTimeout(()=>channel.close(),0);}catch{/* storage signal remains available */}
}
export function announceLogout(uid:string) {
  const nonce=crypto.randomUUID();blocked.add(uid);memoryGeneration=nonce;
  try{localStorage.setItem(prefix+encodeURIComponent(uid),nonce);localStorage.setItem(generationKey,nonce);}catch{/* memory/IPC fallback */}
  broadcast({kind:'logout',uid,nonce});
}
export function acceptInteractiveLogin(uid:string,startedGeneration:string):boolean {
  if(logoutGeneration()!==startedGeneration)return false; // A later logout wins over an in-flight login.
  blocked.delete(uid);try{localStorage.removeItem(prefix+encodeURIComponent(uid));}catch{/* memory fallback */}
  broadcast({kind:'accepted',uid,nonce:crypto.randomUUID()});return true;
}
export function subscribeSessions(next:(signal:Signal)=>void):()=>void {
  const receive=(signal:Signal)=>{
    if(!signal||typeof signal.uid!=='string'||!['logout','accepted'].includes(signal.kind))return;
    // Ignore delayed logout messages after a fresh interactive login, and delayed
    // acceptance messages after a newer logout. IPC never grants a backend role.
    try {
      const current=localStorage.getItem(prefix+encodeURIComponent(signal.uid));
      if((signal.kind==='logout'&&current!==signal.nonce)||(signal.kind==='accepted'&&current!==null))return;
    }catch{/* memory-only contexts use the message */}
    if(signal.kind==='logout'){blocked.add(signal.uid);memoryGeneration=signal.nonce;}
    else blocked.delete(signal.uid);
    next(signal);
  };
  const storage=(event:StorageEvent)=>{
    if(!event.key?.startsWith(prefix))return;
    try{receive({uid:decodeURIComponent(event.key.slice(prefix.length)),kind:event.newValue?'logout':'accepted',nonce:event.newValue??''});}catch{/* invalid local key */}
  };
  addEventListener('storage',storage);
  let channel:BroadcastChannel|null=null;
  try{if(typeof BroadcastChannel!=='undefined')channel=new BroadcastChannel('optilab-auth-lifecycle');}catch{/* storage-only context */}
  if(channel)channel.onmessage=event=>receive(event.data);
  return ()=>{removeEventListener('storage',storage);channel?.close();};
}
