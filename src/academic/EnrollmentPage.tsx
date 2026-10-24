import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,AcademicError,type AcademicCall} from './client';
import {invitationSnapshot,subscribeInvitation,discardInvitationSecret,clearInvitation} from './invitationMemory';
import {AcademicProfileForm} from './AcademicProfileForm';
import {Confirmation,Pagination,key,scopeInput,type Intent} from './components';
import {useAcademicPage} from './usePage';
import type {AcademicProfile,RequestStatus} from './types';
import './teacher.css';
export default function EnrollmentPage(){
  const auth=useAuth(),memory=useSyncExternalStore(subscribeInvitation,invitationSnapshot);
  return <section className="teacher-panel academic-enrollment" aria-label="Inscripción académica local"><header className="paper teacher-hero"><div><span className="eyebrow">TU PRÓXIMA EXPEDICIÓN · SOLO EMULADORES</span><h1>Inscripción académica</h1><p>Una invitación permite solicitar acceso; tu profesora debe aprobarlo.</p></div></header>
    {!memory.context&&<p role="status">{memory.state==='invalid'?'El enlace de invitación no tiene un formato válido.':'No hay una invitación en memoria. Si recargaste o cambiaste de cuenta, vuelve a abrir el enlace original.'} Puedes seguir administrando tu propio perfil.</p>}
    {memory.context&&<p>Invitación académica abierta. El secreto ya fue retirado de la URL y no se guarda en el navegador.</p>}
    {auth.status==='loading'?<p role="status">Preparando tu sesión…</p>:!auth.user?<div className="paper teacher-section"><h2>Entra con tu cuenta de estudiante</h2><p>Usa el acceso existente para iniciar sesión o registrarte. La invitación permanecerá solo en memoria durante ese proceso; una recarga la pierde.</p><Link className="button primary" to="/cuenta">Iniciar sesión o registrarme</Link></div>:<StudentSession key={[auth.user.uid,memory.generation,memory.context?.courseId,memory.context?.termId,memory.context?.groupId,memory.context?.inviteId].join('/')} uid={auth.user.uid}/>}
  </section>;
}
function StudentSession({uid}:{uid:string}){
  const auth=useAuth(),authRef=useRef(auth);authRef.current=auth;
  const memory=useSyncExternalStore(subscribeInvitation,invitationSnapshot),invitation=memory.context;
  const client=useRef<AcademicCall|null>(null),epoch=useRef(0),statusSequence=useRef(0),lock=useRef(false);
  const [profile,setProfile]=useState<AcademicProfile|null>(null),[revision,setRevision]=useState(0),[ready,setReady]=useState(false),[loading,setLoading]=useState(false);
  const [status,setStatus]=useState<RequestStatus|null>(null),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [intent,setIntent]=useState<Intent|null>(null),[busy,setBusy]=useState(false),[commandError,setCommandError]=useState<AcademicError|null>(null);
  const current=()=>authRef.current.isCurrentSession(uid);
  const call=useCallback<AcademicCall>((op,input,cancel)=>client.current?client.current(op,input,cancel):Promise.reject(new DOMException('Sesión cambiada','AbortError')),[]);
  const groups=useAcademicPage(call,'myScopes',{kind:'student'},refresh,ready);
  async function loadProfile(){const data=await call('getAcademicProfile',{});if(current()){setProfile(data.profile);setRevision(data.revision);setReady(true);}}
  async function loadStatus(){
    if(!invitation||memory.uid!==uid)return;
    const sequence=++statusSequence.current;
    try{const data=await call('requestStatus',{...scopeInput(invitation),inviteId:invitation.inviteId});if(current()&&sequence===statusSequence.current){setStatus(data);discardInvitationSecret();}}
    catch(e){if((e as AcademicError).status===404){if(current()&&sequence===statusSequence.current)setStatus(null);}else throw e;}
  }
  useEffect(()=>{
    const controller=new AbortController(),generation=++epoch.current;
    client.current=academicClient({uid,getIdToken:id=>authRef.current.getIdToken(id),current:()=>generation===epoch.current&&current()},controller.signal);
    setLoading(true);void loadProfile().catch(e=>{if(current()&&e.name!=='AbortError')setError(e.message);}).finally(()=>{if(current())setLoading(false);});
    return ()=>{epoch.current++;statusSequence.current++;controller.abort();client.current=null;};
  },[uid]);
  useEffect(()=>{statusSequence.current++;setStatus(null);if(ready&&invitation&&memory.uid===uid)void loadStatus().catch(e=>{if(current()&&e.name!=='AbortError')setError(e.message);});},[ready,invitation?.inviteId,memory.uid]);
  async function refreshData(){setError('');setNotice('');setLoading(true);try{await loadProfile();await loadStatus();if(current())setRefresh(v=>v+1);}catch(e){if(current()&&(e as Error).name!=='AbortError')setError((e as Error).message);}finally{if(current())setLoading(false);}}
  async function confirm(){
    if(!intent||lock.current)return;lock.current=true;setBusy(true);setCommandError(null);
    let confirmed=false;
    try{const result=await call(intent.operation,intent.input);if(!current())return;confirmed=true;
      setIntent(null);setNotice(result.replayed?'Operación confirmada por su recibo; no se duplicó.':'Operación confirmada por el API local.');
      if(intent.operation==='requestMembership'){discardInvitationSecret();await loadStatus();setRefresh(v=>v+1);}else await loadProfile();
    }catch(e){if(current()&&(e as Error).name!=='AbortError'){
      if(confirmed)setError('La operación fue confirmada, pero no se pudieron actualizar los datos. Usa Actualizar perfil y estado.');
      else if(intent.operation==='requestMembership'&&(e as AcademicError).status===404)setCommandError(new AcademicError(404));
      else setCommandError(e instanceof AcademicError?e:new AcademicError(500));
    }}finally{lock.current=false;if(current())setBusy(false);}
  }
  const disabled=busy||!!intent||loading;
  const activeScope=invitation&&groups.data?.items.find(g=>g.courseId===invitation.courseId&&g.termId===invitation.termId&&g.groupId===invitation.groupId&&g.status==='active');
  const confirmedActive=status?status.accessAllowed&&status.membershipStatus==='active':!!activeScope;
  const stateText=status?status.membershipStatus==='revoked'?'Tu membresía fue dada de baja. Necesitas una invitación nueva y otra aprobación.':status.accessAllowed&&status.membershipStatus==='active'?'Inscripción activa confirmada por el API.':status.status==='rejected'?'Solicitud rechazada. No se concedió membresía.':status.status==='approved'?'Solicitud aprobada, pero el acceso académico no está activo.':
    ({active:'Solicitud enviada. Esperando aprobación de tu profesora.',expired:'La invitación venció. La solicitud pendiente no concede acceso; pide un enlace nuevo.',revoked:'La invitación fue revocada. La solicitud pendiente no concede acceso.',exhausted:'La invitación agotó sus usos. La solicitud pendiente no concede acceso.',unavailable:'La invitación ya no está disponible.'})[status.invitationState]:activeScope?'Ya tienes una matrícula activa en este grupo.':null;
  return <><div className="teacher-toolbar"><Link className="button" to="/cuenta">Mi cuenta</Link><button className="button" disabled={disabled} onClick={()=>void refreshData()}>Actualizar perfil y estado</button><button className="button" onClick={()=>void auth.logout().catch(()=>{})}>Cerrar sesión de estudiante</button></div>
    {error&&<p className="teacher-error" role="alert">{error}</p>}{notice&&<p className="teacher-success" role="status">{notice}</p>}{loading&&<p role="status">Consultando tus datos académicos…</p>}
    {ready&&<AcademicProfileForm key={revision} profile={profile} revision={revision} email={auth.user?.email??null} busy={disabled} prepare={next=>{if(!lock.current){setCommandError(null);setNotice('');setIntent(next);}}}/>}
    {invitation&&memory.uid===uid&&<section className="paper teacher-section" aria-labelledby="academic-invitation-title"><h2 id="academic-invitation-title">Tu invitación</h2><p>Ámbito indicado por el enlace (el API lo valida): curso {invitation.courseId}, periodo {invitation.termId}, grupo {invitation.groupId}.</p>
      {status&&<p>Estado de esta solicitud: <strong>{({pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'})[status.status]}</strong>.</p>}
      {stateText&&<p role="status" className={confirmedActive?'teacher-success':status?.status==='pending'&&status.invitationState==='active'?'academic-pending':'teacher-error'}>{stateText}</p>}
      {!status&&!activeScope&&<><p>Completa y guarda tu perfil antes de solicitar inscripción. No existe alta automática.</p><button className="button primary" disabled={disabled||!profile||!invitation.token} onClick={()=>{if(invitation.token)setIntent({operation:'requestMembership',input:{...scopeInput(invitation),inviteId:invitation.inviteId,token:invitation.token,idempotencyKey:key()},label:'Solicitar inscripción',description:'Enviar tu solicitud a la profesora del ámbito indicado. Permanecerá pendiente hasta aprobación explícita.'});}}>Solicitar inscripción</button>
      {!invitation.token&&<p>El código ya fue consumido en esta sesión. Actualiza el estado o vuelve a abrir el enlace original si no hay una solicitud confirmada.</p>}</>}
      <button className="button" disabled={disabled} onClick={()=>{clearInvitation();setStatus(null);}}>Descartar invitación de esta sesión</button>
    </section>}
    <section className="paper teacher-section" aria-labelledby="academic-my-groups"><h2 id="academic-my-groups">Mis grupos académicos</h2><p>Solo matrículas devueltas por el API. Una solicitud pendiente no aparece como grupo activo.</p>
      {groups.loading?<p role="status">Consultando mis grupos…</p>:groups.error?<p role="alert">{groups.error}</p>:!groups.data?.items.length?<p>No hay grupos en esta página.</p>:<ul>{groups.data.items.map(g=><li key={`${g.courseId}/${g.termId}/${g.groupId}`}><strong>{g.title}</strong> · {g.status==='active'?'Activo':'Inactivo'}</li>)}</ul>}
      <Pagination {...groups} nextCursor={groups.data?.nextCursor} disabled={disabled||groups.loading}/>
    </section>
    {intent&&<Confirmation intent={intent} busy={busy} exitSession={()=>void auth.logout().catch(()=>{})} error={commandError?commandError.status===404&&intent.operation==='requestMembership'?'Invitación no disponible: puede estar vencida, revocada, agotada o ser inválida. Pide un enlace nuevo.':commandError.message:''} retry={!!commandError&&(commandError.uncertain||commandError.status===429||commandError.status>=500)} blocked={!!commandError&&!commandError.uncertain&&commandError.status!==429&&commandError.status<500} confirm={()=>void confirm()} cancel={()=>{if(!busy){setIntent(null);setCommandError(null);void refreshData();}}}/>}
  </>;
}
