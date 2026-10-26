import {useEffect,useRef,useState} from 'react';
import type {AcademicCall} from './client';
import type {Period,TeachingScope} from './types';
import {key,type Prepare} from './components';
export function Creation({scopes,call,refresh,prepare,busy,back,hasMore,loadingScopes,loadMore}:{scopes:TeachingScope[];call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean;back:()=>void;hasMore:boolean;loadingScopes:boolean;loadMore:()=>void}){
  const courses=Array.from(new Map(scopes.map(s=>[s.courseId,s])).values());
  const [courseId,setCourse]=useState(courses[0]?.courseId??'');
  const course=courses.find(s=>s.courseId===courseId);
  return <section className="paper teacher-section teacher-creation" aria-labelledby="teacher-creation-title"><button className="text-button" disabled={busy} onClick={back}>← Mis grupos</button><h2 id="teacher-creation-title">Prepara un nuevo grupo</h2>
    <p><strong>Curso</strong>: la asignatura que impartes. <strong>Periodo</strong>: su semestre o ciclo escolar. <strong>Grupo</strong>: los alumnos que acompañas en ese periodo.</p>
    <label>1. Elige tu curso<select aria-label="Curso autorizado" disabled={busy} value={courseId} onChange={e=>setCourse(e.target.value)}>{courses.map(c=><option key={c.courseId} value={c.courseId}>{c.courseTitle||'Curso sin título disponible'}</option>)}</select></label>
    {hasMore&&<button className="button" disabled={busy||loadingScopes} onClick={loadMore}>Consultar más cursos y grupos</button>}{loadingScopes&&<p role="status">Consultando más grupos autorizados…</p>}
    {course&&<CourseCreation key={courseId} course={course} call={call} refresh={refresh} prepare={prepare} busy={busy}/>}
  </section>;
}
function CourseCreation({course,call,refresh,prepare,busy}:{course:TeachingScope;call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean}){
  const [periods,setPeriods]=useState<Period[]>([]),[cursor,setCursor]=useState<string|null>(null),[period,setPeriod]=useState('');
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[newPeriod,setNewPeriod]=useState(false),[termTitle,setTermTitle]=useState(''),[groupTitle,setGroupTitle]=useState('');
  const sequence=useRef(0),active=useRef(true),cancel=useRef<AbortController|null>(null),seek=useRef<string|undefined>(undefined);
  async function load(append=false){
    cancel.current?.abort();const controller=new AbortController();cancel.current=controller;const request=++sequence.current;
    setLoading(true);setError('');if(!append){setPeriods([]);setCursor(null);}
    try{let next=append?cursor:undefined,rows:Period[]=[];
      do{const result=await call('myScopes',{kind:'teacher',courseId:course.courseId,limit:20,...next?{cursor:next}:{}},controller.signal);rows.push(...result.periods??[]);next=result.nextCursor??undefined;
      }while(seek.current&&!rows.some(p=>p.termId===seek.current)&&next);
      if(!active.current||request!==sequence.current)return;
      setPeriods(old=>Array.from(new Map([...(append?old:[]),...rows].map(p=>[p.termId,p])).values()));setCursor(next??null);
      const selected=seek.current;setPeriod(old=>selected&&rows.some(p=>p.termId===selected)?selected:old||rows[0]?.termId||'');seek.current=undefined;
    }catch(e){if(active.current&&!controller.signal.aborted)setError((e as Error).message);}
    finally{if(active.current&&request===sequence.current)setLoading(false);}
  }
  useEffect(()=>{active.current=true;if(course.capabilities.createTerms||course.capabilities.createGroups)void load();else setLoading(false);
    return ()=>{active.current=false;sequence.current++;cancel.current?.abort();};},[course.courseId,refresh]);
  const selected=periods.find(p=>p.termId===period);
  return <><section className="teacher-creation-step"><h3>2. Elige el semestre o ciclo escolar</h3>
    {loading&&<p role="status">Consultando periodos de este curso…</p>}{error&&<p role="alert" className="teacher-error">{error}</p>}
    {periods.length>0&&<label>Periodo existente<select aria-label="Periodo existente" disabled={busy||loading} value={period} onChange={e=>setPeriod(e.target.value)}>{periods.map(p=><option key={p.termId} value={p.termId}>{p.title||'Periodo sin título disponible'}</option>)}</select></label>}
    {!loading&&!error&&!periods.length&&<p>No hay periodos disponibles en esta página. Puedes crear uno si tienes autorización.</p>}
    {cursor&&<button className="button" disabled={busy||loading} onClick={()=>void load(true)}>Cargar más periodos</button>}
    {error&&<button className="button" disabled={busy||loading} onClick={()=>void load()}>Actualizar periodos</button>}
    {!course.capabilities.createTerms?<p>No tienes autorización para crear periodos en este curso.</p>:<><button className="button" disabled={busy||loading} onClick={()=>setNewPeriod(v=>!v)}>{newPeriod?'Usar un periodo existente':'Crear un periodo nuevo'}</button>
      {newPeriod&&<form onSubmit={e=>{e.preventDefault();prepare({operation:'createTerm',input:{courseId:course.courseId,title:termTitle.trim(),idempotencyKey:key()},label:'Crear periodo académico',description:`Crear «${termTitle.trim()}» como semestre o ciclo escolar de ${course.courseTitle}.`,done:r=>{if(r.termId)seek.current=r.termId;setTermTitle('');setNewPeriod(false);}});}}><fieldset disabled={busy}><legend>Nuevo semestre o ciclo escolar</legend><label>Nombre del periodo<input required maxLength={120} value={termTitle} onChange={e=>setTermTitle(e.target.value)}/></label><button className="button primary" disabled={!termTitle.trim()}>Confirmar nuevo periodo</button></fieldset></form>}
    </>}
  </section><section className="teacher-creation-step"><h3>3. Ponle nombre al grupo</h3>
    {!course.capabilities.createGroups?<p>No tienes autorización para crear grupos en este curso.</p>:<form onSubmit={e=>{e.preventDefault();if(!selected)return;prepare({operation:'createGroup',input:{courseId:course.courseId,termId:selected.termId,title:groupTitle.trim(),idempotencyKey:key()},label:'Crear grupo',description:`Crear «${groupTitle.trim()}» en ${course.courseTitle} · ${selected.title}. El grupo quedará a tu cargo.`});}}><fieldset disabled={busy||loading||!!error||!selected}><legend>Grupo del periodo seleccionado</legend><label>Nombre del grupo<input required maxLength={120} value={groupTitle} onChange={e=>setGroupTitle(e.target.value)}/></label>
      <p>{selected?<>Curso: <strong>{course.courseTitle}</strong> · Periodo: <strong>{selected.title}</strong></>:'Selecciona o crea primero un periodo.'}</p><button className="button primary" disabled={!groupTitle.trim()||!selected}>Revisar nuevo grupo</button></fieldset></form>}
  </section><p className="muted">No se crean asignaturas ni se asignan otros docentes desde aquí. Solo puedes organizar los cursos que tienes autorizados.</p></>;
}
