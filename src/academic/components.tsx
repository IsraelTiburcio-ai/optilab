import {useEffect,useRef,type ReactNode} from 'react';
import type {Api,CommandName,MutationResult,AcademicProfile} from './types';
import {getAvatar} from '../data/avatars';
import {getCompanion} from '../data/companions';
export type Intent={operation:CommandName;input:Api[CommandName]['input'];label:string;description:string;done?:(result:MutationResult)=>void};
export type Prepare=(intent:Intent)=>void;
export function Pagination({page,hasPrevious,nextCursor,disabled,back,next}:{page:number;hasPrevious:boolean;nextCursor?:string|null;disabled:boolean;back:()=>void;next:()=>void}) {
  return <nav className="teacher-pagination" aria-label="Paginación de la sección"><button className="button" disabled={disabled||!hasPrevious} onClick={back}>Anterior</button><span>Página {page} · hasta 20 registros</span><button className="button" disabled={disabled||!nextCursor} onClick={next}>Siguiente</button></nav>;
}
export function SectionState({loading,error,empty,children}:{loading:boolean;error:string;empty:boolean;children:ReactNode}) {
  return loading?<p role="status">Consultando el archivo del grupo…</p>:error?<p role="alert" className="teacher-error">{error}</p>:empty?<p className="teacher-empty">No hay registros en esta página.</p>:<>{children}</>;
}
export function Confirmation({intent,busy,error,retry,blocked,confirm,cancel,exitSession}:{intent:Intent;busy:boolean;error:string;retry:boolean;blocked:boolean;confirm:()=>void;cancel:()=>void;exitSession?:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),cancelButton=useRef<HTMLButtonElement>(null);
  const opener=useRef(document.activeElement as HTMLElement|null);
  useEffect(()=>{dialog.current?.showModal();cancelButton.current?.focus();return ()=>{if(opener.current?.isConnected)opener.current.focus();};},[]);
  return <dialog ref={dialog} className="teacher-dialog paper" aria-labelledby="teacher-confirm-title" onCancel={e=>{e.preventDefault();if(!busy)cancel();}}>
    <span className="eyebrow">CONFIRMAR OPERACIÓN</span><h2 id="teacher-confirm-title">{intent.label}</h2><p>{intent.description}</p>
    <p>La operación solo se mostrará como completada cuando el API la confirme.</p>
    {error&&<p role="alert" className="teacher-error">{error}</p>}
    {retry&&<p>El reintento conserva la misma clave y los mismos datos.{['createInvitation','reissueInvitation'].includes(intent.operation)&&' Si se perdió la respuesta al crear una invitación, el secreto no se recupera: habrá que reemitirla.'}</p>}
    <div className="teacher-actions"><button ref={cancelButton} className="button" disabled={busy} onClick={cancel}>{error?'Cerrar y actualizar':'Cancelar'}</button><button className="button primary" disabled={busy||blocked} onClick={confirm}>{busy?'Esperando confirmación…':retry?'Reintentar misma operación':'Confirmar'}</button></div>
    {exitSession&&<><p>Si sales mientras esperas, la solicitud puede haber llegado al servidor. Comprueba su estado al volver; no se asumirá éxito.</p><button className="button" onClick={exitSession}>Cerrar sesión de estudiante</button></>}
  </dialog>;
}
export const scopeInput=(s:{courseId:string;termId:string;groupId:string})=>({courseId:s.courseId,termId:s.termId,groupId:s.groupId});
export const key=()=>crypto.randomUUID();
export function Person({label,uid,profile}:{label:string;uid:string;profile?:AcademicProfile|null}) {return <>
  <strong>{profile?.fullName||label||'Perfil no disponible'}</strong><small>{profile?'Nombre completo declarado · no verificado':'Nombre elegido · identidad académica no verificada'}</small>
  {profile?<><span className="teacher-person-email">Correo de Auth: {profile.email??'No disponible'} · {profile.emailVerified?'verificado al actualizar el perfil':'sin verificar'}</span>
    <small>Identidad de Auth actualizada: {new Date(profile.updatedAt).toLocaleString('es')}</small>
    <span>Gamertag: {profile.shareGameIdentity?profile.gameIdentity?.nickname??'No disponible':'No compartido'}</span>
    <span>Entrenador: {profile.gameIdentity?.avatarId?getAvatar(profile.gameIdentity.avatarId).name:profile.shareGameIdentity?'No seleccionado':'No compartido'}</span>
    <span>OptiCriatura: {profile.gameIdentity?.companionId?getCompanion(profile.gameIdentity.companionId as Parameters<typeof getCompanion>[0]).name:profile.shareGameIdentity?'No seleccionada':'No compartida'}</span>
    {!profile.shareGameIdentity&&<small>El alumno no comparte su identidad de juego.</small>}</>:<small>Perfil académico no disponible en este ámbito. No se consulta el progreso privado.</small>}
  <details><summary>Detalles técnicos</summary><span className="teacher-identifier">ID: {uid}</span></details>
</>;}
