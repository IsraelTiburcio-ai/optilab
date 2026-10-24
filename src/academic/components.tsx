import {useEffect,useRef,type ReactNode} from 'react';
import type {Api,CommandName,MutationResult} from './types';
export type Intent={operation:CommandName;input:Api[CommandName]['input'];label:string;description:string;done?:(result:MutationResult)=>void};
export type Prepare=(intent:Intent)=>void;
export function Pagination({page,hasPrevious,nextCursor,disabled,back,next}:{page:number;hasPrevious:boolean;nextCursor?:string|null;disabled:boolean;back:()=>void;next:()=>void}) {
  return <nav className="teacher-pagination" aria-label="Paginación de la sección"><button className="button" disabled={disabled||!hasPrevious} onClick={back}>Anterior</button><span>Página {page} · hasta 20 registros</span><button className="button" disabled={disabled||!nextCursor} onClick={next}>Siguiente</button></nav>;
}
export function SectionState({loading,error,empty,children}:{loading:boolean;error:string;empty:boolean;children:ReactNode}) {
  return loading?<p role="status">Consultando el archivo del grupo…</p>:error?<p role="alert" className="teacher-error">{error}</p>:empty?<p className="teacher-empty">No hay registros en esta página.</p>:<>{children}</>;
}
export function Confirmation({intent,busy,error,retry,blocked,confirm,cancel}:{intent:Intent;busy:boolean;error:string;retry:boolean;blocked:boolean;confirm:()=>void;cancel:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),cancelButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();cancelButton.current?.focus();return ()=>previous?.focus();},[]);
  return <dialog ref={dialog} className="teacher-dialog paper" aria-labelledby="teacher-confirm-title" onCancel={e=>{e.preventDefault();if(!busy)cancel();}}>
    <span className="eyebrow">CONFIRMAR OPERACIÓN</span><h2 id="teacher-confirm-title">{intent.label}</h2><p>{intent.description}</p>
    <p>La operación solo se mostrará como completada cuando el API la confirme.</p>
    {error&&<p role="alert" className="teacher-error">{error}</p>}
    {retry&&<p>El reintento conserva la misma clave y los mismos datos. Si se perdió la respuesta al crear una invitación, el secreto no se recupera: habrá que reemitirla.</p>}
    <div className="teacher-actions"><button ref={cancelButton} className="button" disabled={busy} onClick={cancel}>{error?'Cerrar y actualizar':'Cancelar'}</button><button className="button primary" disabled={busy||blocked} onClick={confirm}>{busy?'Esperando confirmación…':retry?'Reintentar misma operación':'Confirmar'}</button></div>
  </dialog>;
}
export const scopeInput=(s:{courseId:string;termId:string;groupId:string})=>({courseId:s.courseId,termId:s.termId,groupId:s.groupId});
export const key=()=>crypto.randomUUID();
export function Person({label,uid}:{label:string;uid:string}) {return <><strong>{label||'Sin etiqueta'}</strong><small>Nombre elegido · identidad académica no verificada</small><span className="teacher-identifier">ID: {uid}</span></>;}
