import {academicEnabled,academicEndpoint,academicMode} from './config';
import type {Api} from './types';
export class AcademicError extends Error {
  constructor(readonly status:number,readonly uncertain=false,readonly code=''){super(message(status,uncertain,code));}
}
function message(status:number,uncertain:boolean,code:string) {
  if(code==='GAMERTAG_TAKEN')return 'Ese gamertag ya está ocupado. Elige otro; tus datos anteriores no se cambiaron.';
  if(code==='VERIFIED_EMAIL_REQUIRED')return 'Verifica tu correo desde Cuenta y actualiza la sesión para completar la inscripción.';
  if(code==='ONBOARDING_REQUIRED')return 'Completa tu bienvenida antes de inscribirte.';
  if(uncertain)return academicMode==='emulator'?'No pudimos confirmar la respuesta del API local. Comprueba que esté encendido y reintenta exactamente la misma operación.':'No pudimos confirmar la respuesta del API académico. Reintenta exactamente la misma operación.';
  return ({401:'La sesión ya no es válida. Vuelve a entrar desde Cuenta.',403:'No tienes permiso para esta operación o se retiró tu acceso. Actualiza tus grupos.',
    502:academicMode==='emulator'?'El API local devolvió un contrato incompatible. Reinícialo desde esta rama y actualiza los grupos.':'El API académico devolvió un contrato incompatible. Actualiza la aplicación antes de continuar.',
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
      const response=await fetch(academicEndpoint(String(operation)),{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000),...(cancel?[cancel]:[])]),
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input)});
      if(signal.aborted||!session.current())throw new DOMException('Sesión cambiada','AbortError');
      if(!response.ok){let code='';try{const body=await response.json();if(['GAMERTAG_TAKEN','VERIFIED_EMAIL_REQUIRED','ONBOARDING_REQUIRED'].includes(body.error?.code))code=body.error.code;}catch{/* Never expose raw server errors. */}
        throw new AcademicError(['getAcademicProfile','getPlayerIdentity'].includes(operation)&&response.status===404?502:response.status,false,code);}
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
  if(operation==='getPlayerIdentity')return data.identity===null||!!data.identity&&typeof data.identity==='object'&&typeof (data.identity as {gamertag:unknown}).gamertag==='string';
  if(operation==='gamertagAvailability')return typeof data.available==='boolean';
  if(operation==='groupEnrollmentLink')return data.link===null||!!data.link&&typeof data.link==='object'&&Number.isInteger((data.link as {revision:number}).revision);
  if(operation==='getAcademicProfile')return Number.isSafeInteger(data.revision)&&validProfile(data.profile);
  if(operation==='requestStatus')return ['pending','approved','rejected'].includes(String(data.status))&&['active','revoked','none'].includes(String(data.membershipStatus))&&typeof data.accessAllowed==='boolean'&&typeof data.requestId==='string'&&typeof data.invitationState==='string';
  if(operation==='groupProgress'){
    const period=data.period as Record<string,unknown>|undefined,activities=data.activities as Record<string,unknown>|undefined;
    return !!period&&Number.isInteger(period.days)&&(period.from===null||typeof period.from==='string')&&typeof period.to==='string'&&
      Number.isInteger(data.studentsTotal)&&Number.isInteger(data.studentsActive)&&typeof data.activityDataTruncated==='boolean'&&!!activities&&
      ['opened','declared','reported','completed','validated'].every(key=>Number.isInteger(activities[key]))&&
      Array.isArray(data.gyms)&&Array.isArray(data.students)&&typeof data.truncated==='boolean';
  }
  if(operation==='activityWorkspace'){
    return Array.isArray(data.definitions)&&Array.isArray(data.assignments)&&Array.isArray(data.placements)&&
      data.definitions.every(d=>d&&typeof d.activityId==='string'&&['wordwall','learningapps'].includes(d.provider)&&['draft','published','archived'].includes(d.status))&&
      data.assignments.every(a=>a&&typeof a.activityId==='string'&&['draft','published','hidden','archived'].includes(a.status)&&Number.isInteger(a.gymId))&&
      data.placements.every(p=>p&&Number.isInteger(p.gymId)&&Array.isArray(p.orderedActivityIds)&&Number.isInteger(p.revision));
  }
  if(operation==='publishedGroupActivities')return Array.isArray(data.gyms)&&data.gyms.every((g:any)=>g&&Number.isInteger(g.gymId)&&Array.isArray(g.activities)&&g.activities.every((a:any)=>a&&typeof a.activityId==='string'&&typeof a.embedUrl==='string'&&Number.isInteger(a.gymId)));
  if(operation==='publishedActivity')return typeof data.activityId==='string'&&typeof data.embedUrl==='string'&&typeof data.provider==='string'&&['wordwall','learningapps'].includes(data.provider)&&Number.isInteger(data.gymId);
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
