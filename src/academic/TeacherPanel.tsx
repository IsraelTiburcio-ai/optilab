import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Compass,Shield,Users} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,AcademicError,type AcademicCall} from './client';
import type {TeachingScope,Request} from './types';
import {Confirmation,scopeInput,type Intent,type Prepare} from './components';
import {useAcademicPage} from './usePage';
import {Students,Requests} from './Students';
import {Invitations} from './Invitations';
import {Creation} from './Creation';
import './teacher.css';
const scopeKey=(s:TeachingScope)=>`${s.courseId}/${s.termId}/${s.groupId}`;
export default function TeacherPanel() {
  const auth=useAuth();
  if(auth.status==='loading')return <p role="status">Preparando la sesión docente…</p>;
  if(!auth.user)return <section className="teacher-panel paper"><h1>Panel de la profesora</h1><p>Inicia sesión en Cuenta para comprobar tus grupos docentes autorizados.</p><Link className="button primary" to="/cuenta">Ir a Cuenta</Link></section>;
  // UID-keyed boundary discards every private state and pending intent on A→B.
  return <TeacherSession key={auth.user.uid} uid={auth.user.uid}/>;
}
function TeacherSession({uid}:{uid:string}) {
  const auth=useAuth(),authRef=useRef(auth);authRef.current=auth;
  const api=useRef<AcademicCall|null>(null),generation=useRef(0),requests=useRef(0),lock=useRef(false);
  const [scopes,setScopes]=useState<TeachingScope[]>([]),[selected,setSelected]=useState(''),[cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[reset,setReset]=useState(0);
  const [intent,setIntent]=useState<Intent|null>(null),[busy,setBusy]=useState(false),[commandError,setCommandError]=useState<AcademicError|null>(null);
  const noticeRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(notice)noticeRef.current?.focus();},[notice]);
  const current=()=>authRef.current.isCurrentSession(uid);
  const call=useCallback<AcademicCall>((op,input,cancel)=>{
    if(!api.current)return Promise.reject(new DOMException('Sesión cambiada','AbortError'));
    return api.current(op,input,cancel);
  },[]);
  async function discover(append=false) {
    const request=++requests.current;setLoading(true);setError('');
    if(!append){setScopes([]);setCursor(null);}
    try {
      const result=await call('myScopes',{kind:'teacher',limit:20,...(append&&cursor?{cursor}:{})});
      if(!current()||request!==requests.current)return;
      const authorized=result.items.filter((s):s is TeachingScope=>'capabilities' in s);
      setScopes(previous=>Array.from(new Map([...append?previous:[],...authorized].map(s=>[scopeKey(s),s])).values()));
      setCursor(result.nextCursor);
    }catch(e){if(current()&&request===requests.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}
    finally{if(current()&&request===requests.current)setLoading(false);}
  }
  useEffect(()=>{
    const controller=new AbortController(),epoch=++generation.current;
    api.current=academicClient({uid,getIdToken:id=>authRef.current.getIdToken(id),current:()=>generation.current===epoch&&current()},controller.signal);
    void discover();
    return ()=>{generation.current++;requests.current++;controller.abort();api.current=null;};
  },[uid]);
  const scope=scopes.find(s=>scopeKey(s)===selected)??scopes[0];
  const disabled=busy||!!intent;
  const prepare:Prepare=next=>{if(lock.current||intent)return;setNotice('');setCommandError(null);setIntent(next);};
  async function confirm() {
    if(!intent||lock.current)return;
    lock.current=true;setBusy(true);setCommandError(null);
    try {
      const result=await call(intent.operation,intent.input);
      if(!current())return;
      intent.done?.(result);setIntent(null);setNotice(result.replayed?'Operación confirmada mediante su recibo; no se duplicó.':'Operación confirmada por el API local.');
      setRefresh(v=>v+1);
      if(intent.operation==='createGroup')void discover();
    }catch(e){if(current()&&(e as Error).name!=='AbortError')setCommandError(e instanceof AcademicError?e:new AcademicError(500));}
    finally{lock.current=false;if(current())setBusy(false);}
  }
  function cancel(){if(busy)return;setIntent(null);if(commandError){setRefresh(v=>v+1);if(commandError.status===403||commandError.status===401)void discover();}setCommandError(null);}
  const courses=Array.from(new Map(scopes.map(s=>[s.courseId,s])).values());
  const terms=Array.from(new Map(scopes.filter(s=>s.courseId===scope?.courseId).map(s=>[s.termId,s])).values());
  return <section className="teacher-panel" aria-label="Administración académica local">
    <header className="teacher-hero paper"><div><span className="eyebrow"><Compass size={17}/> CUADERNO DE EXPEDICIÓN · OPTIMIZACIÓN I</span><h1>Panel de la profesora</h1><p>Organiza tus grupos y acompaña su próxima aventura.</p><span className="teacher-badge"><Shield size={15}/> Solo emuladores · datos sintéticos</span></div><div className="teacher-actions"><Link className="button" to="/cuenta">Cuenta</Link><button className="button" onClick={()=>void auth.logout().catch(()=>{if(current())setError('No se pudo cerrar la sesión. Reintenta desde Cuenta.');})}>Cerrar sesión docente</button></div></header>
    {notice&&<p ref={noticeRef} tabIndex={-1} className="teacher-success" role="status">{notice}</p>}
    {error&&<p className="teacher-error" role="alert">{error}</p>}
    <div className="teacher-toolbar"><button className="button" disabled={disabled||loading} onClick={()=>{setNotice('');setReset(v=>v+1);void discover();}}>Actualizar grupos y datos</button>{cursor&&<button className="button" disabled={disabled||loading} onClick={()=>void discover(true)}>Cargar más grupos autorizados</button>}</div>
    {loading&&<p role="status">Comprobando tus grupos autorizados…</p>}
    {!loading&&!error&&!scopes.length&&<div className="paper teacher-empty"><Users size={30}/><h2>Sin acceso docente autorizado</h2><p>Esta cuenta no tiene grupos docentes disponibles. Una cuenta de alumno o un rol declarado en el navegador no concede acceso.</p></div>}
    {scope&&<><div className="teacher-controls paper"><label>Curso<select aria-label="Curso" disabled={disabled} value={scope.courseId} onChange={e=>setSelected(scopeKey(scopes.find(s=>s.courseId===e.target.value)!))}>{courses.map(s=><option key={s.courseId} value={s.courseId}>{s.courseTitle} · {s.courseId}</option>)}</select></label>
      <label>Periodo<select aria-label="Periodo" disabled={disabled} value={scope.termId} onChange={e=>setSelected(scopeKey(scopes.find(s=>s.courseId===scope.courseId&&s.termId===e.target.value)!))}>{terms.map(s=><option key={s.termId} value={s.termId}>{s.termTitle} · {s.termId}</option>)}</select></label>
      <label>Grupo<select aria-label="Grupo" disabled={disabled} value={scope.groupId} onChange={e=>setSelected(scopeKey(scopes.find(s=>s.courseId===scope.courseId&&s.termId===scope.termId&&s.groupId===e.target.value)!))}>{scopes.filter(s=>s.courseId===scope.courseId&&s.termId===scope.termId).map(s=><option key={s.groupId} value={s.groupId}>{s.title} · {s.groupId}</option>)}</select></label></div>
      <GroupWorkspace key={`${scopeKey(scope)}:${reset}`} scope={scope} scopes={scopes} call={call} refresh={refresh} prepare={prepare} busy={disabled}/></>}
    {intent&&<Confirmation intent={intent} busy={busy} error={commandError?.message??''} retry={!!commandError&&(commandError.uncertain||commandError.status===429||commandError.status>=500)} blocked={!!commandError&&!commandError.uncertain&&![429].includes(commandError.status)&&commandError.status<500} confirm={()=>void confirm()} cancel={cancel}/>}
  </section>;
}
function GroupWorkspace({scope,scopes,call,refresh,prepare,busy}:{scope:TeachingScope;scopes:TeachingScope[];call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean}) {
  const [tab,setTab]=useState('Alumnos'),[status,setStatus]=useState<Request['status']>('pending');
  const roster=useAcademicPage(call,'roster',scopeInput(scope),refresh,scope.capabilities.manageMembers);
  const requests=useAcademicPage(call,'groupRequests',{...scopeInput(scope),status},refresh,scope.capabilities.manageMembers);
  const invitations=useAcademicPage(call,'groupInvitations',scopeInput(scope),refresh,scope.capabilities.manageInvitations);
  return <><p className="teacher-current">Grupo seleccionado: <strong>{scope.title}</strong> · {scope.termTitle} · <span className="teacher-identifier">{scope.groupId}</span></p>
    <div className="teacher-summary" aria-label="Resumen de páginas consultadas">{[
      ['Integrantes activos en esta página',roster.data?.items.filter(m=>m.status==='active').length],
      ['Solicitudes anteriores en esta página',requests.data?.items.length],
    ].map(([label,count])=><div className="paper" key={label}><strong>{count??'—'}</strong><span>{label}</span></div>)}</div><p className="muted">Cifras de las páginas consultadas, no totales globales. Cada sección tiene su propia paginación.</p>
    <nav className="teacher-tabs" aria-label="Secciones del panel">{['Alumnos','Solicitudes','Invitaciones','Periodos y grupos'].map(t=><button className="button" key={t} aria-pressed={tab===t} disabled={busy} onClick={()=>setTab(t)}>{t==='Solicitudes'?'Solicitudes anteriores':t}</button>)}</nav>
    <div className="paper teacher-section" aria-busy={busy}>{tab==='Alumnos'?<Students scope={scope} scopes={scopes} page={roster} prepare={prepare} busy={busy}/>:tab==='Solicitudes'?<Requests scope={scope} page={requests} prepare={prepare} busy={busy} status={status} setStatus={setStatus}/>:tab==='Invitaciones'?<Invitations scope={scope} call={call} refresh={refresh} prepare={prepare} busy={busy}/>:<Creation scope={scope} call={call} refresh={refresh} prepare={prepare} busy={busy}/>}</div>
  </>;
}
