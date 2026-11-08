import '../components/loading.css';
export function TeacherSkeleton({variant='list'}:{variant?:'dashboard'|'list'|'directory'}){
 return <div className={`teacher-skeleton teacher-skeleton-${variant}`} role="status" aria-label="Cargando información autorizada" aria-busy="true"><span className="sr-only">Cargando información autorizada…</span>{variant==='dashboard'&&<><div className="teacher-skeleton-cards">{Array.from({length:7},(_,i)=><div className="skeleton teacher-skeleton-card" key={i}/>)}</div><div className="skeleton teacher-skeleton-line"/></>}<div className="teacher-skeleton-rows">{Array.from({length:variant==='directory'?3:5},(_,i)=><div className="skeleton teacher-skeleton-row" key={i}/>)}</div></div>;
}
