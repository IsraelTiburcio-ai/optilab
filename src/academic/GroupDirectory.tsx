import type {Scope,TeachingScope} from './types';
export const teachingKey=(s:Scope)=>`${s.courseId}/${s.termId}/${s.groupId}`;
const names=new Intl.Collator('es',{numeric:true,sensitivity:'base'});
export function GroupDirectory({scopes,loading,hasMore,disabled,loadMore,manage,create}:{scopes:TeachingScope[];loading:boolean;hasMore:boolean;disabled:boolean;loadMore:()=>void;manage:(s:TeachingScope)=>void;create:()=>void}){
  const courses=Array.from(new Map(scopes.map(s=>[s.courseId,s])).values()).sort((a,b)=>names.compare(a.courseTitle,b.courseTitle));
  const canCreate=scopes.some(s=>s.capabilities.createGroups||s.capabilities.createTerms);
  return <section className="teacher-directory" aria-labelledby="teacher-directory-title"><div className="section-heading"><div><span className="eyebrow">TUS COMUNIDADES DE APRENDIZAJE</span><h2 id="teacher-directory-title">Mis grupos</h2><p>Elige el grupo que quieres acompañar hoy.</p></div><button className="button primary" disabled={disabled||!canCreate} onClick={create}>Crear grupo</button></div>
    {!canCreate&&scopes.length>0&&<p className="muted">Tu acceso actual permite administrar tus grupos, pero no crear grupos o periodos en estos cursos.</p>}
    {courses.map(course=><section className="teacher-course" key={course.courseId} aria-label={course.courseTitle||'Curso sin título disponible'}><h3>{course.courseTitle||'Curso sin título disponible'}</h3>
      {Array.from(new Map(scopes.filter(s=>s.courseId===course.courseId).map(s=>[s.termId,s])).values()).sort((a,b)=>names.compare(a.termTitle,b.termTitle)).map(term=><section className="teacher-period" key={term.termId} aria-label={term.termTitle||'Periodo sin título disponible'}><h4>{term.termTitle||'Periodo sin título disponible'}</h4><div className="teacher-group-grid">
        {scopes.filter(s=>s.courseId===course.courseId&&s.termId===term.termId).sort((a,b)=>names.compare(a.title,b.title)).map(s=><article className="paper teacher-group-card" key={teachingKey(s)} data-group-id={s.groupId}><span className="teacher-badge">Grupo de clase</span><h5>{s.title||'Grupo sin título disponible'}</h5><button className="button primary" aria-label={`Administrar grupo ${s.title||'sin título disponible'}`} disabled={disabled} onClick={()=>manage(s)}>Administrar grupo</button></article>)}
      </div></section>)}
    </section>)}
    {loading&&<p role="status">Consultando tus grupos autorizados…</p>}
    {hasMore&&<button className="button" disabled={disabled||loading} onClick={loadMore}>Cargar más grupos</button>}
    {hasMore&&<p className="muted">Hay más grupos por consultar. No se muestra un total global de alumnos.</p>}
  </section>;
}
