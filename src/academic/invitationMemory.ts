import {academicEnabled} from './config';
import type {Scope} from './types';
export interface InvitationContext extends Scope {inviteId:string;token:string|null}
type Memory={context:InvitationContext|null;state:'none'|'ready'|'submitted'|'lost'|'invalid'|'disabled';uid:string|null;generation:number};
let memory:Memory={context:null,state:'none',uid:null,generation:0},knownUid:string|null=null,installed=false;
const listeners=new Set<()=>void>();
function publish(next:Memory){memory=next;listeners.forEach(fn=>fn());}
export const invitationSnapshot=()=>memory;
export const subscribeInvitation=(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};};
export function invitationLink(origin:string,base:string,context:InvitationContext):string {
  const url=new URL(base,origin);
  if(!academicEnabled||url.protocol!=='http:'||!['localhost','127.0.0.1'].includes(url.hostname)||!context.token)throw new Error('INVITATION_LOCAL_ONLY');
  url.search='';url.hash='/unirse?'+new URLSearchParams({...context,token:context.token}).toString();return url.href;
}
function consume(){
  if(typeof window==='undefined'||!window.location.hash.startsWith('#/unirse?'))return;
  const raw=window.location.hash.slice('#/unirse?'.length);
  // Scrub before HashRouter/Auth/any rendering. Even disabled or malformed links
  // lose their parameters; history replaces the current entry instead of adding one.
  history.replaceState(history.state,'',location.pathname+location.search+'#/unirse');
  const generation=memory.generation+1;
  if(!academicEnabled){publish({context:null,state:'disabled',uid:null,generation});return;}
  if(raw.length>2048){publish({context:null,state:'invalid',uid:knownUid,generation});return;}
  const params=new URLSearchParams(raw),keys=['courseId','termId','groupId','inviteId','token'];
  if([...params.keys()].some(k=>!keys.includes(k))||keys.some(k=>params.getAll(k).length!==1)||
    keys.slice(0,4).some(k=>!/^[A-Za-z0-9_-]{1,80}$/.test(params.get(k)??''))||!/^[A-Za-z0-9_-]{43}$/.test(params.get('token')??'')){
    publish({context:null,state:'invalid',uid:knownUid,generation});return;
  }
  publish({context:Object.fromEntries(keys.map(k=>[k,params.get(k)!])) as unknown as InvitationContext,state:'ready',uid:knownUid,generation});
}
export function installInvitationCapture(){consume();if(!installed){window.addEventListener('hashchange',consume);window.addEventListener('popstate',consume);installed=true;}}
export function bindInvitationSession(uid:string|null){
  knownUid=uid;
  if(memory.uid&&memory.uid!==uid){publish({context:null,state:'lost',uid:null,generation:memory.generation});return;}
  if(memory.context&&uid&&!memory.uid)publish({...memory,uid});
}
export function discardInvitationSecret(){if(memory.context)publish({...memory,context:{...memory.context,token:null},state:'submitted'});}
export function clearInvitation(){publish({context:null,state:'lost',uid:knownUid,generation:memory.generation});}
if(import.meta.hot)import.meta.hot.dispose(()=>{window.removeEventListener('hashchange',consume);window.removeEventListener('popstate',consume);});
