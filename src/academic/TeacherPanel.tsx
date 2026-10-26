import {useCallback,useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {Compass,Shield,Users} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,AcademicError,type AcademicCall} from './client';
import type {TeachingScope,Request,Member,Api} from './types';
import {Confirmation,scopeInput,type Intent,type Prepare} from './components';
import {useAcademicPage} from './usePage';
import {Students,Requests} from './Students';
import {Invitations} from './Invitations';
import {Creation} from './Creation';
import {GroupDirectory,teachingKey} from './GroupDirectory';
import {TransferDialog} from './TransferDialog';
import './teacher.css';
const scopeKey=teachingKey;
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
  const [intent,setIntent]=useState<Intent|null>(null),[busy,setBusy]=useState(false),[commandError,setCommandError]=useState<AcademicError|null>(null),[creating,setCreating]=useState(false);
  const noticeRef=useRef<HTMLParagraphElement>(null);
  useEffect(()=>{if(notice)noticeRef.current?.focus();},[notice]);
  const current=()=>authRef.current.isCurrentSession(uid);
  const call=useCallback<AcademicCall>((op,input,cancel)=>{
    if(!api.current)return Promise.reject(new DOMException('Sesión cambiada','AbortError'));
    return api.current(op,input,cancel);
  },[]);
  async function discover(append=false,seek?:{courseId:string;termId:string;groupId:string}) {
    const request=++requests.current;setLoading(true);setError('');
    if(!append){setScopes([]);setCursor(null);}
    try {
      let next=append?cursor:undefined,authorized:TeachingScope[]=[];
      do{const result=await call('myScopes',{kind:'teacher',limit:20,...next?{cursor:next}:{}});
        authorized.push(...result.items.filter((s):s is TeachingScope=>'capabilities' in s));next=result.nextCursor;
      }while(seek&&!authorized.some(s=>scopeKey(s)===scopeKey(seek))&&next&&current()&&request===requests.current);
      if(!current()||request!==requests.current)return;
      setScopes(previous=>Array.from(new Map([...append?previous:[],...authorized].map(s=>[scopeKey(s),s])).values()));
      setCursor(next??null);
      if(seek&&!authorized.some(s=>scopeKey(s)===scopeKey(seek)))setError('No pudimos recuperar ese grupo. Actualiza Mis grupos para comprobar tu acceso. Si ya se confirmó su creación, no hace falta volver a crearlo.');
    }catch(e){if(current()&&request===requests.current&&(e as Error).name!=='AbortError')setError((e as Error).message);}
    finally{if(current()&&request===requests.current)setLoading(false);}
  }
  useEffect(()=>{
    const controller=new AbortController(),epoch=++generation.current;
    api.current=academicClient({uid,getIdToken:id=>authRef.current.getIdToken(id),current:()=>generation.current===epoch&&current()},controller.signal);
    void discover();
    return ()=>{generation.current++;requests.current++;controller.abort();api.current=null;};
  },[uid]);
  const scope=scopes.find(s=>scopeKey(s)===selected);
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
      if(intent.operation==='createGroup'){
        const input=intent.input as Api['createGroup']['input'];setCreating(false);setSelected('');
        setNotice('Grupo creado y confirmado. Ya puedes encontrarlo en Mis grupos.');
        await discover(false,result.groupId?{courseId:input.courseId,termId:input.termId,groupId:result.groupId}:undefined);
      }
    }catch(e){if(current()&&(e as Error).name!=='AbortError')setCommandError(e instanceof AcademicError?e:new AcademicError(500));}
    finally{lock.current=false;if(current())setBusy(false);}
  }
  function cancel(){if(busy)return;setIntent(null);if(commandError){setRefresh(v=>v+1);if(commandError.status===403||commandError.status===401)void discover();}setCommandError(null);}
  return <section className="teacher-panel" aria-label="Administración académica local">
    <header className="teacher-hero paper"><div><span className="eyebrow"><Compass size={17}/> CUADERNO DE EXPEDICIÓN · OPTIMIZACIÓN I</span><h1>Panel de la profesora</h1><p>Organiza tus grupos y acompaña su próxima aventura.</p><span className="teacher-badge"><Shield size={15}/> Solo emuladores · datos sintéticos</span></div><div className="teacher-actions"><Link className="button" to="/cuenta">Cuenta</Link><button className="button" onClick={()=>void auth.logout().catch(()=>{if(current())setError('No se pudo cerrar la sesión. Reintenta desde Cuenta.');})}>Cerrar sesión docente</button></div></header>
    {notice&&<p ref={noticeRef} tabIndex={-1} className="teacher-success" role="status">{notice}</p>}
    {error&&<p className="teacher-error" role="alert">{error}</p>}
    <div className="teacher-toolbar"><button className="button" disabled={disabled||loading} onClick={()=>{setNotice('');setReset(v=>v+1);void discover(false,scope?scope:undefined);}}>Actualizar grupos y datos</button></div>
    {loading&&<p role="status">Comprobando tus grupos autorizados…</p>}
    {!loading&&!error&&!scopes.length&&<div className="paper teacher-empty"><Users size={30}/><h2>Sin acceso docente autorizado</h2><p>Esta cuenta no tiene grupos docentes disponibles. Una cuenta de alumno o un rol declarado en el navegador no concede acceso.</p></div>}
    {creating?<Creation scopes={scopes} call={call} refresh={refresh} prepare={prepare} busy={disabled} back={()=>setCreating(false)} hasMore={!!cursor} loadingScopes={loading} loadMore={()=>void discover(true)}/>:
      scope?<><div className="teacher-group-heading"><button className="button" disabled={disabled} onClick={()=>{setSelected('');setNotice('');}}>← Mis grupos</button><div><span className="eyebrow">{scope.courseTitle} · {scope.termTitle}</span><h2>{scope.title}</h2></div></div>
        <GroupWorkspace key={`${scopeKey(scope)}:${reset}`} scope={scope} scopes={scopes} call={call} refresh={refresh} prepare={prepare} busy={disabled} hasMore={!!cursor} loadingScopes={loading} discoveryError={error} loadMore={()=>void discover(true)}
          transferred={()=>{setNotice('Traslado confirmado. El alumno está activo en el destino y el origen se actualizó.');setRefresh(n=>n+1);}}
          refreshAccess={()=>void discover(false,scope)}/></>:
        <GroupDirectory scopes={scopes} loading={loading} hasMore={!!cursor} disabled={disabled} loadMore={()=>void discover(true)} manage={s=>{setSelected(teachingKey(s));setNotice('');}} create={()=>{setCreating(true);setNotice('');}}/>}
    {intent&&<Confirmation intent={intent} busy={busy} error={commandError?.message??''} retry={!!commandError&&(commandError.uncertain||commandError.status===429||commandError.status>=500)} blocked={!!commandError&&!commandError.uncertain&&![429].includes(commandError.status)&&commandError.status<500} confirm={()=>void confirm()} cancel={cancel}/>}
  </section>;
}
function GroupWorkspace({scope,scopes,call,refresh,prepare,busy,hasMore,loadingScopes,discoveryError,loadMore,transferred,refreshAccess}:{scope:TeachingScope;scopes:TeachingScope[];call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean;hasMore:boolean;loadingScopes:boolean;discoveryError:string;loadMore:()=>void;transferred:()=>void;refreshAccess:()=>void}) {
  const [tab,setTab]=useState('Alumnos'),[status,setStatus]=useState<Request['status']>('pending'),[historyOpen,setHistoryOpen]=useState(false);
  const [moving,setMoving]=useState<Member|null>(null),[localRefresh,setLocalRefresh]=useState(0);
  const roster=useAcademicPage(call,'roster',scopeInput(scope),refresh+localRefresh,scope.capabilities.manageMembers);
  const requests=useAcademicPage(call,'groupRequests',{...scopeInput(scope),status},refresh+localRefresh,historyOpen&&scope.capabilities.manageMembers);
  return <section className="teacher-workspace" data-group-id={scope.groupId}><h2 tabIndex={-1} className="sr-only">Administración de {scope.title}</h2>
    <div className="teacher-summary" aria-label="Resumen de páginas consultadas">{[
      ['Integrantes activos en esta página',roster.data?.items.filter(m=>m.status==='active').length],
    ].map(([label,count])=><div className="paper" key={label}><strong>{count??'—'}</strong><span>{label}</span></div>)}</div><p className="muted">Cifras de las páginas consultadas, no totales globales. Cada sección tiene su propia paginación.</p>
    <nav className="teacher-tabs" aria-label="Secciones del panel">{['Alumnos','Invitaciones'].map(t=><button className="button" key={t} aria-pressed={tab===t} disabled={busy} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    <div className="paper teacher-section" aria-busy={busy}>{tab==='Alumnos'?<Students scope={scope} page={roster} prepare={prepare} busy={busy} move={setMoving}/>:<Invitations scope={scope} call={call} refresh={refresh} prepare={prepare} busy={busy}/>}</div>
    {scope.capabilities.manageMembers&&<details className="paper teacher-history" onToggle={e=>setHistoryOpen(e.currentTarget.open)}><summary>Historial de solicitudes anteriores</summary>{historyOpen&&<Requests scope={scope} page={requests} prepare={prepare} busy={busy} status={status} setStatus={setStatus}/>}</details>}
    {moving&&<TransferDialog member={moving} source={scope} scopes={scopes} call={call} hasMore={hasMore} loading={loadingScopes} discoveryError={discoveryError} loadMore={loadMore}
      close={(update,denied)=>{setMoving(null);if(update)setLocalRefresh(n=>n+1);if(denied)refreshAccess();}} success={()=>{setMoving(null);transferred();}}/>}
  </section>;
}
