import {TeacherSkeleton} from './TeacherSkeleton';
import {integratedBuild} from '../integration/features';
import {useEffect,useState} from 'react';
import {Activity,BarChart3,BookOpen,CheckCircle2,ChevronDown,ClipboardCheck,Gamepad2,RefreshCw,Target,Users,UserCheck} from 'lucide-react';
import type {AcademicCall} from './client';
import type {GroupProgress,GroupProgressGymMetric,GroupProgressStudent} from './types';
import {scopeInput} from './components';
import {academicMode} from './config';
import {gyms as gymCatalog} from '../data';

const periods=[{days:7,label:'Últimos 7 días'},{days:30,label:'Últimos 30 días'},{days:90,label:'Últimos 90 días'},{days:0,label:'Todo el historial'}] as const;
const providerName=(provider:string)=>provider==='learningapps'?'LearningApps':provider==='wordwall'?'Wordwall':provider==='optilab'?'OptiLab':'Actividad externa';
const gymName=(id:number)=>gymCatalog.find(gym=>gym.id===id)?.name??`Gimnasio ${id}`;
const percentage=(value:number)=>Number.isFinite(value)?Math.max(0,Math.min(100,Math.round(value))):0;
function dateLabel(value:string|null) {
  if(!value)return 'Sin actividad';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Sin actividad':date.toLocaleString('es',{dateStyle:'medium',timeStyle:'short'});
}
function statusFor(student:GroupProgressStudent){
  if(!student.lastActivityAt&&!student.opened&&!student.declared&&!student.reported&&!student.completedGames)return {label:'Sin actividad',className:'is-empty'};
  if(!student.practicedGames&&!student.externalDeclared)return {label:'Explorando',className:'is-exploring'};
  if(student.averageProgressPercent>=70)return {label:'Avanzado',className:'is-advanced'};
  return {label:'En progreso',className:'is-progress'};
}
function fallbackGymMetrics(data:GroupProgress):GroupProgressGymMetric[]{
  return data.gyms.map(gym=>({...gym,availableGames:gym.totalGames,coveragePercent:percentage(gym.totalGames?gym.practiced*100/gym.totalGames:0),
    averageProgressPercent:0,participatingStudents:0,games:[]}));
}
export function ClassDashboard({scope,call,refresh,disabled=false,showStudents}:{scope:{courseId:string;termId:string;groupId:string};call:AcademicCall;refresh:number;disabled?:boolean;showStudents?:()=>void}) {
  const [days,setDays]=useState<number>(30),[attempt,setAttempt]=useState(0),[openGym,setOpenGym]=useState<number|null>(null),[openStudent,setOpenStudent]=useState<string|null>(null);
  const [data,setData]=useState<GroupProgress|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();let active=true;setLoading(true);setError('');setData(null);setOpenGym(null);setOpenStudent(null);
    void call('groupProgress',{...scopeInput(scope),periodDays:days},controller.signal)
      .then(result=>{if(active)setData(result);})
      .catch(e=>{if(active&&e?.name!=='AbortError')setError(e.message||'No se pudo consultar el progreso del grupo.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[call,scope.courseId,scope.termId,scope.groupId,refresh,days,attempt]);
  const students=data?.students??[];
  const noStudents=!!data&&data.studentsTotal===0;
  const noActivity=!!data&&!noStudents&&data.studentsActive===0;
  const period=!data?'':data.period.days===0?'Todo el historial':`Últimos ${data.period.days} días${data.period.from?` · desde ${dateLabel(data.period.from)}`:''}`;
  const summary=data?data.summary??{studentsTotal:data.studentsTotal,studentsParticipated:data.studentsActive,studentsWithoutActivity:data.studentsTotal-data.studentsActive,practicePairs:data.activities.practiced??data.activities.declared,coveragePercent:0,averageProgressPercent:0,availableOriginalGames:28}:null;
  const cards=summary?[
    {label:'Alumnos inscritos',value:summary.studentsTotal,detail:'estudiantes activos del grupo',icon:Users,tone:'green'},
    {label:'Alumnos que participaron',value:summary.studentsParticipated,detail:`${summary.studentsWithoutActivity} sin actividad en el periodo`,icon:UserCheck,tone:'blue'},
    {label:'Prácticas registradas',value:summary.practicePairs,detail:'pares alumno-actividad, sin repetir',icon:ClipboardCheck,tone:'sand'},
    {label:'Avance promedio',value:summary.availableOriginalGames?`${percentage(summary.averageProgressPercent)}%`:'—',detail:summary.availableOriginalGames?`${percentage(summary.coveragePercent)}% de cobertura de actividades`:'Sin juegos visibles para este grupo',icon:BarChart3,tone:'coral'},
  ]:[];
  const gymMetrics=data?(data.gymMetrics??fallbackGymMetrics(data)):[];
  const external=data?.externalActivities??[];
  return <section className="teacher-dashboard" aria-labelledby="teacher-dashboard-title">
    <div className="teacher-dashboard-heading"><div><span className="eyebrow">PANORAMA DEL GRUPO</span><h2 id="teacher-dashboard-title">Resumen del grupo</h2><p>Una lectura rápida de la participación registrada. No es una calificación ni una medida de dominio.</p></div>
      <label className="teacher-dashboard-period">Periodo<select aria-label="Periodo de actividad" value={days} disabled={disabled} onChange={e=>setDays(Number(e.target.value))}>{periods.map(item=><option key={item.days} value={item.days}>{item.label}</option>)}</select></label>
    </div>
    <div className="teacher-dashboard-meta-row"><span>{period||'Cargando periodo…'}</span><span>{data?`Actualizado ${dateLabel(data.generatedAt)}`:'Consulta autorizada'}</span></div>
    {data?.activityDataTruncated&&<p className="teacher-dashboard-warning" role="status">Historial parcial: algunos alumnos superan el límite de lectura. Los conteos pueden ser incompletos.</p>}
    {loading?<TeacherSkeleton variant="dashboard"/>:error?<div className="teacher-error" role="alert"><p>{error}</p><button className="button" onClick={()=>setAttempt(value=>value+1)}>Reintentar resumen</button></div>:data?<>
      <div className="teacher-dashboard-actions"><button className="button" onClick={()=>setAttempt(n=>n+1)} disabled={disabled||loading}><RefreshCw size={16}/> Actualizar resumen</button><span className="teacher-dashboard-note"><Activity size={15}/> Registros de participación · datos no verificados</span></div>
      <div className="teacher-kpi-grid" aria-label="Indicadores del grupo">{cards.map(card=>{const Icon=card.icon;return <article className={`paper teacher-kpi teacher-kpi-${card.tone}`} key={card.label}><span className="teacher-kpi-icon"><Icon size={20}/></span><strong>{card.value}</strong><h3>{card.label}</h3><small>{card.detail}</small></article>;})}</div>
      {noStudents?<div className="teacher-empty" role="status"><Users size={28}/><h3>Sin alumnos activos</h3><p>Cuando se inscriban estudiantes, aquí aparecerá su participación.</p>{showStudents&&<button className="button" onClick={showStudents}>Ir a Alumnos</button>}</div>:
        noActivity?<div className="teacher-empty" role="status"><Activity size={28}/><h3>Sin actividad en este periodo</h3><p>Prueba otro periodo o revisa que la sincronización esté autorizada.</p>{showStudents&&<button className="button" onClick={showStudents}>Ir a Alumnos</button>}</div>:null}
      <section className="teacher-dashboard-section" aria-labelledby="teacher-gyms-title"><div className="teacher-section-heading"><div><span className="eyebrow">DÓNDE ESTÁ EL GRUPO</span><h3 id="teacher-gyms-title">Progreso por gimnasio</h3></div><span className="teacher-section-hint">Toca un gimnasio para ver el detalle</span></div>
        <div className="teacher-gym-cards">{gymMetrics.map(gym=>{const catalog=gymCatalog.find(item=>item.id===gym.gymId);const open=openGym===gym.gymId,hasGames=gym.availableGames>0;return <article className={`teacher-gym-card ${open?'is-open':''}`} key={gym.gymId} style={{'--gym-accent':catalog?.color??'#315e4e','--gym-pale':catalog?.pale??'#e3ecd9'} as React.CSSProperties}>
          <button className="teacher-gym-summary" aria-expanded={open} onClick={()=>setOpenGym(open?null:gym.gymId)}>
            <span className="teacher-gym-number">{String(gym.gymId).padStart(2,'0')}</span><span className="teacher-gym-title"><strong>{gym.title}</strong><small>{gym.availableGames} juegos disponibles · {gym.participatingStudents} alumnos participantes</small></span><span className="teacher-gym-percent">{hasGames?`${percentage(gym.averageProgressPercent)}%`:'—'}<small>{hasGames?'avance promedio':'sin juegos visibles'}</small></span><ChevronDown className={open?'is-open':''} size={19}/>
            <span className="teacher-gym-bar"><span style={{width:`${hasGames?percentage(gym.averageProgressPercent):0}%`}}/></span>
            <span className="teacher-gym-mini"><span>Cobertura <b>{hasGames?`${percentage(gym.coveragePercent)}%`:'—'}</b></span><span>{gym.games.filter(game=>game.visible).length} visibles</span></span>
          </button>
          {open&&<div className="teacher-gym-detail"><p>El avance promedio incluye a todos los alumnos inscritos; la cobertura cuenta juegos distintos practicados por al menos una persona.</p><ul>{gym.games.map(game=><li key={game.gameId} className={!game.visible?'is-hidden':''}><span>{game.title}</span><span>{game.visible?`${game.practicedStudents} practicaron · ${game.pendingStudents} pendientes`:'No disponible para este grupo'}</span></li>)}</ul></div>}
        </article>;})}</div>
      </section>
      {!!external.length&&<section className="teacher-dashboard-section" aria-labelledby="teacher-external-title"><div className="teacher-section-heading"><div><span className="eyebrow">RECURSOS COMPLEMENTARIOS</span><h3 id="teacher-external-title">Actividades de clase</h3></div><span className="teacher-section-hint">Participación sobre alumnos inscritos</span></div>
        <div className="teacher-external-grid">{external.map(activity=>{const gym=activity.gymId?gymName(activity.gymId):'Actividad complementaria';return <article className="paper teacher-external-card" key={activity.activityId}><div className="teacher-external-top"><span className="teacher-provider">{providerName(activity.provider)}</span><span className="teacher-external-gym"><BookOpen size={14}/>{gym}</span></div><h3>{activity.title}</h3><div className="teacher-external-percent"><strong>{percentage(activity.participationPercent)}%</strong><span>participación</span></div><div className="teacher-progress-track" role="progressbar" aria-label={`${activity.title}: ${percentage(activity.participationPercent)}% de participación`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage(activity.participationPercent)}><span style={{width:`${percentage(activity.participationPercent)}%`}}/></div><dl><div><dt><Gamepad2 size={14}/> Abrieron</dt><dd>{activity.opened}</dd></div><div><dt><CheckCircle2 size={14}/> Marcaron práctica</dt><dd>{activity.declared}</dd></div><div><dt><Target size={14}/> Finalizaron</dt><dd>{activity.completed}</dd></div></dl><small>{activity.provider==='learningapps'?'Solo las señales compatibles de LearningApps pueden registrar finalización.':'Wordwall no aporta finalizaciones verificables.'} Los números son alumnos únicos, no eventos.</small></article>;})}</div>
      </section>}
      <section className="teacher-dashboard-section teacher-students-section" aria-labelledby="teacher-students-title"><div className="teacher-section-heading"><div><span className="eyebrow">ACOMPAÑAMIENTO INDIVIDUAL</span><h3 id="teacher-students-title">Progreso por alumno</h3></div><span className="teacher-section-hint">Los registros no son calificaciones</span></div>
        {!students.length?<p className="teacher-empty">No hay alumnos con información de progreso para mostrar.</p>:<div className="teacher-student-dashboard-list">{students.map(student=>{const status=statusFor(student),open=openStudent===student.uid,details=student.gymDetails??[];return <article className={`teacher-student-dashboard-card ${open?'is-open':''}`} key={student.uid}>
          <button className="teacher-student-summary" aria-expanded={open} onClick={()=>setOpenStudent(open?null:student.uid)}><span className="teacher-student-avatar"><Users size={18}/></span><span className="teacher-student-identity"><strong>{student.name||student.gamertag||'Alumno'}</strong>{student.gamertag&&<small>{student.gamertag}</small>}<small>Última actividad: {dateLabel(student.lastActivityAt)}</small></span><span className={`teacher-status ${status.className}`}>{status.label}</span><span className="teacher-student-stat"><b>{student.practicedGames}</b><small>juegos originales</small></span><span className="teacher-student-stat"><b>{percentage(student.averageProgressPercent)}%</b><small>avance</small></span><span className="teacher-student-stat"><b>{student.externalDeclared}</b><small>prácticas de clase</small></span><ChevronDown className={open?'is-open':''} size={19}/></button>
          {open&&<div className="teacher-student-detail"><div><h4>Por gimnasio</h4><ul>{details.map(detail=><li key={detail.gymId}><span>{gymName(detail.gymId)}</span><span>{detail.practicedGames}/{detail.availableGames} practicados · {percentage(detail.averageProgressPercent)}%</span></li>)}</ul></div><div><h4>Actividades de clase</h4><p>{student.externalDeclared} practicadas · {student.externalOpened} abiertas · {student.externalReported} con resultado informado</p><h4>Registro</h4><p>{student.practicedGames} juegos originales practicados · {student.completedGames} terminados · última actividad {dateLabel(student.lastActivityAt)}</p>{student.pendingGames!==undefined&&<p className="muted">{student.pendingGames} juegos originales pendientes según el catálogo visible.</p>}<p className="muted">Historial agregado del periodo; no se exponen respuestas privadas ni una cronología completa.</p></div></div>}
        </article>;})}</div>}
      </section>
      <p className="teacher-dashboard-footnote">Las aperturas, prácticas y resultados son registros de participación informados por el cliente o proyecciones autorizadas. No son calificaciones verificadas por la profesora. Las actividades de clase no modifican el denominador de los 28 juegos originales.</p>
    </>:null}
  </section>;
}
