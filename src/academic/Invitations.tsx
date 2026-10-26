import {useEffect,useState} from 'react';
import type {AcademicCall} from './client';
import type {EnrollmentLink,TeachingScope} from './types';
import {key,scopeInput,type Prepare} from './components';
import {invitationLink} from './invitationMemory';
export function Invitations({scope,call,refresh,prepare,busy}:{scope:TeachingScope;call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean}){
  const [link,setLink]=useState<EnrollmentLink|null>(null),[loaded,setLoaded]=useState(false),[error,setError]=useState('');
  const [duration,setDuration]=useState(7),[unit,setUnit]=useState(86400),[secret,setSecret]=useState<{inviteId:string;token:string}|null>(null),[notice,setNotice]=useState('');
  useEffect(()=>{const controller=new AbortController();setLoaded(false);setError('');
    void call('groupEnrollmentLink',scopeInput(scope),controller.signal).then(r=>{if(!controller.signal.aborted){setLink(r.link);setLoaded(true);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();},[call,scope.courseId,scope.termId,scope.groupId,refresh]);
  if(!scope.capabilities.manageInvitations)return <p>No tienes permiso para invitar alumnos a este grupo.</p>;
  return <section aria-labelledby="teacher-invitations"><h2 id="teacher-invitations">Invita a tus alumnos</h2><p>Grupo seleccionado: <strong>{scope.title}</strong>. Los alumnos con cuenta y correo verificado podrán inscribirse automáticamente.</p>
    <p>El enlace se puede reutilizar por diferentes alumnos mientras esté vigente. No hay un cupo académico de admisiones. Comparte el enlace solo con tu grupo: quien lo reciba y cumpla los requisitos podrá entrar.</p>
    {error&&<p role="alert" className="teacher-error">{error}</p>}{!loaded&&!error&&<p role="status">Consultando el enlace del grupo…</p>}
    {loaded&&<p role="status">Estado: <strong>{link?({active:'Activo',expired:'Vencido',revoked:'Revocado'})[link.status]:'Sin enlace'}</strong>{link&&` · Vence ${new Date(link.expiresAt).toLocaleString('es')}`}</p>}
    <form onSubmit={e=>{e.preventDefault();setSecret(null);setNotice('');prepare({operation:'rotateEnrollmentLink',input:{...scopeInput(scope),expectedVersion:link?.revision??0,idempotencyKey:key(),expiresInSeconds:duration*unit},
      label:link?'Generar nuevo enlace':'Crear enlace de invitación',description:link?'El enlace anterior dejará de funcionar. Los alumnos ya inscritos conservarán su matrícula.':'Crear un enlace reutilizable para inscribir alumnos automáticamente en este grupo.',
      done:r=>{setSecret(r.inviteId&&r.token?{inviteId:r.inviteId,token:r.token}:null);if(!r.token)setNotice('La operación fue confirmada, pero el enlace no se puede recuperar. Genera uno nuevo para invalidar el anterior.');}});}}>
      <fieldset disabled={busy||!loaded}><legend>Duración del enlace</legend><div className="teacher-controls"><label>Duración<input required type="number" min={1} max={604800/unit} step={1} value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label>Unidad<select aria-label="Unidad de duración" value={unit} onChange={e=>{const next=Number(e.target.value);setDuration(Math.min(604800/next,Math.max(1,Math.ceil(duration*unit/next))));setUnit(next);}}><option value={3600}>Horas</option><option value={86400}>Días</option></select></label></div>
        <button className="button primary" type="submit">{link?'Generar nuevo enlace':'Crear enlace de invitación'}</button></fieldset>
    </form>
    {secret&&<div className="teacher-secret"><h3>Tu enlace está listo</h3><p>Se conserva solo mientras estás en esta sección. Si lo pierdes, genera otro: no almacenamos su secreto para recuperarlo.</p><button className="button primary" onClick={()=>{const value=invitationLink(location.origin,import.meta.env.BASE_URL,{...scopeInput(scope),...secret});void navigator.clipboard.writeText(value).then(()=>setNotice('Enlace copiado. Ábrelo en una sesión de alumno de esta Mac.')).catch(()=>setNotice('No se pudo copiar. Revisa el permiso del portapapeles y reintenta.'));}}>Copiar enlace</button></div>}
    {notice&&<p role="status">{notice}</p>}
    {link&&<button className="button" disabled={busy||!loaded||link.status==='revoked'} onClick={()=>{setSecret(null);prepare({operation:'revokeEnrollmentLink',input:{...scopeInput(scope),expectedVersion:link.revision,idempotencyKey:key()},label:'Revocar enlace',description:'Los nuevos alumnos ya no podrán utilizarlo. No se borran las matrículas existentes.'});}}>Revocar enlace</button>}
  </section>;
}
