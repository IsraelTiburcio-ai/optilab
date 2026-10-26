import {useEffect,useRef,useState} from 'react';
import {AcademicError,type AcademicCall} from './client';
import type {Api,Member,TeachingScope} from './types';
import {key,scopeInput} from './components';
import {teachingKey} from './GroupDirectory';
export function TransferDialog({member,source,scopes,hasMore,loading,discoveryError,loadMore,call,close,success}:{member:Member;source:TeachingScope;scopes:TeachingScope[];hasMore:boolean;loading:boolean;discoveryError:string;loadMore:()=>void;call:AcademicCall;close:(refresh?:boolean,denied?:boolean)=>void;success:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),cancelButton=useRef<HTMLButtonElement>(null),lock=useRef(false),controller=useRef<AbortController|null>(null);
  const opener=useRef(document.activeElement as HTMLElement|null);
  const [destination,setDestination]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<AcademicError|null>(null),[intent,setIntent]=useState<Api['transferMembership']['input']|null>(null);
  const destinations=scopes.filter(s=>s.courseId===source.courseId&&s.termId===source.termId&&s.groupId!==source.groupId&&s.capabilities.manageMembers);
  const retry=!!error&&(error.uncertain||error.status===429||error.status>=500),blocked=!!error&&!retry;
  useEffect(()=>{const abort=new AbortController();controller.current=abort;dialog.current?.showModal();cancelButton.current?.focus();
    return ()=>{abort.abort();if(opener.current?.isConnected)opener.current.focus();else document.querySelector<HTMLElement>('.teacher-workspace h2')?.focus();};},[]);
  async function confirm(){
    if(lock.current||blocked||loading)return;
    const target=destinations.find(s=>teachingKey(s)===destination);if(!target)return;
    const payload=intent??{...scopeInput(source),uid:member.uid,destinationGroupId:target.groupId,expectedVersion:member.revision,idempotencyKey:key()};
    lock.current=true;setBusy(true);setError(null);setIntent(payload);
    try{await call('transferMembership',payload,controller.current?.signal);if(!controller.current?.signal.aborted)success();}
    catch(e){if(!controller.current?.signal.aborted&&(e as Error).name!=='AbortError')setError(e instanceof AcademicError?e:new AcademicError(500));}
    finally{lock.current=false;if(!controller.current?.signal.aborted)setBusy(false);}
  }
  function cancel(){if(!busy)close(!!error,error?.status===403||error?.status===401);}
  return <dialog ref={dialog} className="teacher-dialog paper teacher-transfer-dialog" aria-labelledby="teacher-move-title" onCancel={e=>{e.preventDefault();cancel();}}>
    <span className="eyebrow">ACOMPAÑAR SU SIGUIENTE PASO</span><h2 id="teacher-move-title">¿A qué grupo deseas mover a este alumno?</h2>
    <p><strong>{member.academicProfile?.fullName||member.label||'Alumno sin nombre disponible'}</strong><br/>Grupo actual: <strong>{source.title}</strong> · {source.termTitle}</p>
    <p>El traslado retira el acceso al grupo actual y conserva cuenta, progreso e historial.</p>
    <fieldset className="teacher-destination-grid" disabled={busy||!!intent}><legend>Elige el grupo destino</legend>{destinations.map(s=><label className={`teacher-destination ${destination===teachingKey(s)?'is-selected':''}`} key={teachingKey(s)}><input type="radio" name="transfer-destination" aria-label={s.title||'Grupo sin título disponible'} checked={destination===teachingKey(s)} onChange={()=>setDestination(teachingKey(s))}/><span><strong>{s.title||'Grupo sin título disponible'}</strong><small>{s.courseTitle} · {s.termTitle}</small></span></label>)}</fieldset>
    {!destinations.length&&<p>{hasMore?'No hay otro destino entre los grupos cargados. Consulta más grupos para buscar uno autorizado.':'No tienes otro grupo autorizado del mismo curso y periodo al que puedas mover a este alumno.'}</p>}
    {hasMore&&<button className="button" disabled={busy||loading||!!intent} onClick={loadMore}>Cargar más grupos destino</button>}{loading&&<p role="status">Consultando más grupos autorizados…</p>}
    {discoveryError&&<p className="teacher-error" role="alert">{discoveryError}</p>}
    {error&&<p className="teacher-error" role="alert">{error.status===409?'La matrícula cambió mientras trabajabas. Actualiza los alumnos antes de intentar otro traslado.':error.status===403?'Se retiró tu autorización para este traslado. Actualiza tu acceso.':error.message}</p>}
    {retry&&<p>No se asumió éxito. El reintento conserva los mismos datos y clave para evitar duplicados.</p>}
    <div className="teacher-actions"><button ref={cancelButton} className="button" disabled={busy} onClick={cancel}>{error?'Actualizar alumnos y cerrar':'Cancelar'}</button><button className="button primary" disabled={busy||blocked||loading||!destination} onClick={()=>void confirm()}>{busy?'Confirmando traslado…':retry?'Reintentar traslado':'Confirmar traslado'}</button></div>
  </dialog>;
}
