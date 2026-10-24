import {academicEnabled} from './config';
import type {Api} from './types';
export class AcademicError extends Error {
  constructor(readonly status:number,readonly uncertain=false){super(message(status,uncertain));}
}
function message(status:number,uncertain:boolean) {
  if(uncertain)return 'No pudimos confirmar la respuesta del API local. Comprueba que esté encendido y reintenta exactamente la misma operación.';
  return ({401:'La sesión ya no es válida. Vuelve a entrar desde Cuenta.',403:'No tienes permiso para esta operación o se retiró tu acceso. Actualiza tus grupos.',
    502:'El API local devolvió un contrato incompatible. Reinícialo desde esta rama y actualiza los grupos.',
    409:'La información cambió. Actualiza los datos antes de realizar una nueva operación; no se sobrescribió la versión actual.',
    429:'Se alcanzó el límite de peticiones. Espera un minuto antes de reintentar.',404:'La solicitud o invitación ya no está disponible.'} as Record<number,string>)[status]??'No se pudo completar la operación. Revisa los datos y vuelve a intentarlo.';
}
export function academicClient(session:{uid:string;getIdToken:(uid:string)=>Promise<string>;current:()=>boolean},signal:AbortSignal) {
  return async function call<K extends keyof Api>(operation:K,input:Api[K]['input'],cancel?:AbortSignal):Promise<Api[K]['output']> {
    if(!academicEnabled||signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
    let token:string;
    try{token=await session.getIdToken(session.uid);}catch{
      if(signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
      throw new AcademicError(401);
    }
    if(signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
    try {
      const response=await fetch(`http://127.0.0.1:5200/v1/${operation}`,{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000),...(cancel?[cancel]:[])]),
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
      if(signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
      if(!response.ok)throw new AcademicError(operation==='getAcademicProfile'&&response.status===404?502:response.status);
      const result=await response.json();
      if(signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
      if(!compatible(operation,input,result))throw new AcademicError(502);
      return result;
    }catch(error){if(signal.aborted||cancel?.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
      if(error instanceof AcademicError)throw error;throw new AcademicError(0,true);}
  };
}
export type AcademicCall=ReturnType<typeof academicClient>;
function compatible(operation:keyof Api,input:unknown,result:unknown):boolean {
  if(!result||typeof result!=='object')return false;
  const data=result as Record<string,unknown>;
  if(operation==='getAcademicProfile')return Number.isSafeInteger(data.revision)&&validProfile(data.profile);
  if(operation==='requestStatus')return ['pending','approved','rejected'].includes(String(data.status))&&['active','revoked','none'].includes(String(data.membershipStatus))&&typeof data.accessAllowed==='boolean'&&typeof data.requestId==='string'&&typeof data.invitationState==='string';
  if(['roster','groupRequests','groupInvitations','myScopes'].includes(operation)){
    if(!Array.isArray(data.items)||!(data.nextCursor===null||typeof data.nextCursor==='string'))return false;
    if(operation==='myScopes'){
      if((input as {kind:string}).kind==='student')return data.items.every(s=>s&&['courseId','termId','groupId','title'].every(k=>typeof s[k]==='string')&&['active','revoked'].includes(s.status));
      if((input as {courseId?:string}).courseId)return Array.isArray(data.periods)&&data.periods.every(p=>p&&typeof p.courseId==='string'&&typeof p.termId==='string'&&typeof p.title==='string');
      return data.items.every(s=>s&&['courseId','termId','groupId','title','courseTitle','termTitle'].every(k=>typeof s[k]==='string')&&
        s.capabilities&&['manageMembers','manageInvitations','readHistory','createTerms','createGroups'].every(k=>typeof s.capabilities[k]==='boolean'));
    }
    return data.items.every(row=>row&&typeof row==='object'&&Number.isSafeInteger(row.revision)&&row.revision>=1&&
      (operation==='groupInvitations'||row.academicProfile===undefined||validProfile(row.academicProfile)));
  }
  return typeof data.outcome==='string'&&typeof data.commandId==='string'&&data.operation===operation&&typeof data.replayed==='boolean'&&
    (data.token===undefined||(typeof data.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(data.token)));
}
function validProfile(value:unknown):boolean {
  if(value===null)return true;
  if(!value||typeof value!=='object')return false;const p=value as Record<string,unknown>;
  return Number.isSafeInteger(p.revision)&&typeof p.fullName==='string'&&p.nameSource==='self-declared'&&(p.email===null||typeof p.email==='string')&&
    typeof p.emailVerified==='boolean'&&typeof p.shareGameIdentity==='boolean'&&typeof p.updatedAt==='string'&&
    (p.shareGameIdentity?!!p.gameIdentity&&typeof p.gameIdentity==='object':p.gameIdentity===null);
}
