import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient,type AcademicCall} from './client';
import {useAcademicPage} from './usePage';
import {Pagination} from './components';
import './teacher.css';
export default function MyClasses(){
  const auth=useAuth();
  if(!auth.user)return null;
  return <ClassesSession key={auth.user.uid} uid={auth.user.uid}/>;
}
function ClassesSession({uid}:{uid:string}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;
  const api=useRef<AcademicCall|null>(null),[ready,setReady]=useState(false),[revision,setRevision]=useState(0);
  const call=useCallback<AcademicCall>((op,input,cancel)=>api.current?api.current(op,input,cancel):Promise.reject(new DOMException('Sesión cambiada','AbortError')),[]);
  useEffect(()=>{const controller=new AbortController();let active=true;
    api.current=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);setReady(true);
    const refresh=()=>setRevision(n=>n+1);window.addEventListener('focus',refresh);
    return ()=>{active=false;controller.abort();api.current=null;window.removeEventListener('focus',refresh);};
  },[uid]);
  const page=useAcademicPage(call,'myScopes',{kind:'student'},revision,ready);
  return <section className="paper academic-classes" aria-labelledby="my-classes-title"><div className="section-heading"><div><span className="eyebrow">TU COMUNIDAD DE APRENDIZAJE</span><h2 id="my-classes-title">Mis clases</h2></div><button className="button" disabled={!ready||page.loading} onClick={()=>setRevision(n=>n+1)}>Actualizar mis clases</button></div>
    <p>Tu matrícula académica es independiente de tu progreso personal. Consulta aquí el estado confirmado por el servidor.</p>
    {page.loading?<p role="status">Consultando tus clases…</p>:page.error?<p role="alert" className="teacher-error">{page.error}</p>:!page.data?.items.length?<p role="status">{page.hasPrevious||page.data?.nextCursor?'No hay clases disponibles en esta página':'Todavía no perteneces a un grupo de clase'}</p>:<ul className="academic-class-list">{page.data.items.map(item=><li key={`${item.courseId}/${item.termId}/${item.groupId}`}>
      <div><span className="eyebrow">{item.courseTitle||'Curso no disponible'}</span><h3>{item.title||'Grupo no disponible'}</h3><p>Periodo: {item.termTitle||'No disponible'}</p></div><span className={`teacher-badge ${item.status==='active'?'academic-enrolled':''}`}>{item.status==='active'?'Inscrito':'Inactivo · baja confirmada'}</span>
    </li>)}</ul>}
    <Pagination {...page} nextCursor={page.data?.nextCursor} disabled={page.loading||!ready}/>
  </section>;
}
