import {useEffect,useState} from 'react';
import type {AcademicCall} from './client';
import type {GroupProgress} from './types';
import {scopeInput} from './components';

const periods=[{days:7,label:'Últimos 7 días'},{days:30,label:'Últimos 30 días'},{days:90,label:'Últimos 90 días'},{days:0,label:'Todo'}] as const;
function dateLabel(value:string|null) {
  if(!value)return 'Sin actividad';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Sin actividad':date.toLocaleString('es',{dateStyle:'medium',timeStyle:'short'});
}
export function ClassDashboard({scope,call,refresh,disabled=false,showStudents}:{scope:{courseId:string;termId:string;groupId:string};call:AcademicCall;refresh:number;disabled?:boolean;showStudents?:()=>void}) {
  const [days,setDays]=useState<number>(30),[attempt,setAttempt]=useState(0);
  const [data,setData]=useState<GroupProgress|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let active=true;setLoading(true);setError('');setData(null);
    void call('groupProgress',{...scopeInput(scope),periodDays:days},controller.signal)
      .then(result=>{if(active)setData(result);})
      .catch(e=>{if(active&&e?.name!=='AbortError')setError(e.message||'No se pudo consultar el progreso del grupo.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[call,scope.courseId,scope.termId,scope.groupId,refresh,days,attempt]);
  const gyms=new Map(data?.gyms.map(gym=>[gym.gymId,gym])??[]);
  const students=data?.students??[];
  const noStudents=!!data&&data.studentsTotal===0;
  const noActivity=!!data&&!noStudents&&data.studentsActive===0&&
    data.activities.opened+data.activities.declared+data.activities.reported===0;
  const period=!data?'':data.period.days===0?'Todo el historial':`Últimos ${data.period.days} días${data.period.from?` · desde ${dateLabel(data.period.from)}`:''}`;
  const cards=data?[
    ['Alumnos inscritos',data.studentsTotal,'integrantes activos en el grupo'],
    ['Alumnos con actividad',data.studentsActive,'con actividad en el periodo'],
    ['Actividades abiertas',data.activities.opened,'actividades únicas abiertas'],
    ['Actividades practicadas',data.activities.declared,'declaradas por el alumno'],
    ['Resultados informados',data.activities.reported,'informe del cliente; no validados'],
    ['Finalizaciones reportadas',data.activities.completed,'result.completed=true; no validadas'],
    ['Validación',data.activities.validated,'sin evidencia validada'],
  ] as const:[];
  return <section className="teacher-dashboard" aria-labelledby="teacher-dashboard-title">
    <div className="teacher-dashboard-heading"><div><span className="eyebrow">RESUMEN DEL PERIODO</span><h2 id="teacher-dashboard-title">Resumen</h2><p>Actividad declarada, resultados y finalizaciones informadas por el cliente en este grupo.</p></div>
      <label className="teacher-dashboard-period">Periodo de actividad<select aria-label="Periodo de actividad" value={days} disabled={disabled} onChange={e=>setDays(Number(e.target.value))}>{periods.map(period=><option key={period.days} value={period.days}>{period.label}</option>)}</select></label>
    </div>
    <p className="teacher-dashboard-note">Datos del Firestore Emulator local. Las aperturas y prácticas son declaraciones; los resultados y finalizaciones son informes del cliente y no están validados.</p>
    {loading?<p role="status">Consultando el progreso del grupo…</p>:error?<div className="teacher-error" role="alert"><p>{error}</p><button className="button" onClick={()=>setAttempt(value=>value+1)}>Reintentar resumen</button></div>:data?<>
      <div className="teacher-summary teacher-dashboard-summary" aria-label="Resumen del periodo">{cards.map(([label,value,detail])=><div className="paper" key={label}><strong>{value}</strong><span>{label}</span><small>{detail}</small></div>)}</div>
      <p className="muted teacher-dashboard-meta">{period} · Generado {dateLabel(data.generatedAt)}{data.truncated?' · La lista de alumnos se truncó en el servidor':''}</p>
      {noStudents?<div className="teacher-empty" role="status"><h3>Sin alumnos activos</h3><p>No hay integrantes activos en este grupo. Cuando se inscriban, su actividad aparecerá aquí.</p>{showStudents&&<button className="button" onClick={showStudents}>Ir a Alumnos</button>}</div>:
        noActivity?<div className="teacher-empty" role="status"><h3>Sin actividad registrada en este periodo</h3><p>No hay aperturas, prácticas declaradas ni informes del cliente para este rango. Prueba con un periodo más amplio o con «Todo».</p>{showStudents&&<button className="button" onClick={showStudents}>Ir a Alumnos</button>}</div>:null}
      {!!data.gyms.length&&<section className="teacher-dashboard-gyms" aria-labelledby="teacher-dashboard-gyms-title"><h3 id="teacher-dashboard-gyms-title">Progreso por gimnasio</h3><p className="muted">Juegos practicados sobre el total del gimnasio. Los resultados y finalizaciones son informes del cliente, no resultados validados.</p>
        <ul className="teacher-gym-progress">{data.gyms.map(gym=>{const percent=gym.totalGames?Math.min(100,Math.round(gym.practiced*100/gym.totalGames)):0;return <li key={gym.gymId}>
          <div className="teacher-gym-progress-heading"><strong>{gym.title}</strong><span>{gym.practiced}/{gym.totalGames} practicados · {gym.reported} resultados · {gym.completed} finalizaciones</span></div>
          <div className="teacher-gym-progress-track" role="progressbar" aria-label={`${gym.title}: ${gym.practiced} de ${gym.totalGames} juegos practicados`} aria-valuemin={0} aria-valuemax={gym.totalGames} aria-valuenow={gym.practiced}><span style={{width:`${percent}%`}}/></div>
          <small>{gym.opened} aperturas registradas en el periodo</small>
        </li>;})}</ul>
      </section>}
      <section className="teacher-dashboard-students" aria-labelledby="teacher-dashboard-students-title"><h3 id="teacher-dashboard-students-title">Progreso por alumno</h3><p className="muted">«Actividad declarada», «Resultado informado» y «Finalización reportada» no son validaciones. Los totales del grupo cuentan actividades únicas; las filas pueden repetir una actividad entre alumnos.</p>
        {!students.length?<p className="teacher-empty">No hay alumnos con información de progreso para mostrar en este periodo.</p>:<div className="teacher-progress-table-wrap"><table className="teacher-progress-table">
          <caption className="sr-only">Progreso declarado por alumno; los resultados son informes del cliente sin validación</caption>
          <thead><tr><th scope="col">Alumno</th><th scope="col">Última actividad</th><th scope="col">Actividad abierta</th><th scope="col">Actividad practicada (declarada)</th><th scope="col">Resultado informado (cliente)</th><th scope="col">Finalización reportada (cliente)</th><th scope="col">Juegos practicados</th><th scope="col">Por gimnasio</th><th scope="col">Validado: sin evidencia</th></tr></thead>
          <tbody>{students.map(student=><tr key={student.uid}>
            <th scope="row" className="teacher-progress-student"><span className="teacher-progress-name">{student.name||'Alumno sin nombre declarado'}</span>
              {student.email&&<small>{student.email}{student.emailVerified?' · correo verificado':''}</small>}
              {student.gamertag&&<small>Gamertag: {student.gamertag}</small>}
              {!student.email&&!student.gamertag&&<small>Sin correo ni gamertag compartidos</small>}
              <details className="teacher-row-details"><summary>Ver más</summary><div><small>Identificador de cuenta: {student.uid}</small><small>Correo verificado al actualizar: {student.emailVerified?'sí':'no'}</small><small>Actividad validada: {student.validated} · sin evidencia validada</small><small>No se muestran respuestas privadas ni puntuaciones del cliente.</small></div></details>
            </th>
            <td data-label="Última actividad">{dateLabel(student.lastActivityAt)}</td>
            <td data-label="Actividad abierta">{student.opened}</td>
            <td data-label="Actividad practicada (declarada)">{student.declared}</td>
            <td data-label="Resultado informado (cliente)">{student.reported}</td>
            <td data-label="Finalización reportada (cliente)">{student.completedGames}</td>
            <td data-label="Juegos practicados">{student.practicedGames}</td>
            <td data-label="Por gimnasio">{student.gyms.length?<ul className="teacher-progress-gyms">{student.gyms.map(activity=>{const gym=gyms.get(activity.gymId),title=gym?.title??`Gimnasio ${activity.gymId}`;return <li key={activity.gymId}><span className="teacher-progress-gym-name">{title}</span><span className="teacher-progress-gym-counts" aria-label={`${title}: ${activity.opened} actividades abiertas, ${activity.declared} declaradas, ${activity.reported} resultados informados, ${activity.completed} finalizaciones reportadas`}>A {activity.opened} · D {activity.declared} · R {activity.reported} · C {activity.completed}</span></li>;})}</ul>:<span className="muted">Sin actividad por gimnasio</span>}</td>
            <td data-label="Validado: sin evidencia">{student.validated}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>:null}
  </section>;
}
