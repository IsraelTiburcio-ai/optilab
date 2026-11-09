import {Link,useNavigate,useParams} from 'react-router-dom';
import {ShieldCheck,Trophy} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {useAcademicAccess} from './AcademicAccess';
import {useStudentGymConfig} from './GymGameGrid';
import {GroupRanking} from './GroupRanking';
import {LoadingContent} from '../components/LoadingShell';
import type {Scope} from './types';
import './teacher.css';

const scopeKey=(scope:Scope)=>JSON.stringify([scope.courseId,scope.termId,scope.groupId]);
const path=(scope:Scope)=>`/grupo/${encodeURIComponent(scope.courseId)}/${encodeURIComponent(scope.termId)}/${encodeURIComponent(scope.groupId)}/ranking`;
export default function RankingPage(){
 const {courseId,termId,groupId}=useParams(),auth=useAuth(),access=useAcademicAccess(),config=useStudentGymConfig(0),navigate=useNavigate();
 if(auth.status==='loading'||!access.checked)return <LoadingContent/>;
 if(!auth.user)return <section className="paper ranking-page"><h1>Ranking de mi grupo</h1><p>Inicia sesión para consultar la participación de tu grupo.</p><Link className="button primary" to="/cuenta">Ir a Cuenta</Link></section>;
 if(!courseId||!termId||!groupId)return <section className="paper ranking-page"><h1>Ranking no disponible</h1><p>El enlace no identifica un grupo académico.</p><Link className="button" to="/aventura">Volver a mis clases</Link></section>;
 const scope={courseId,termId,groupId};const options=config.groups.filter(group=>group.status==='active');
 return <section className="paper ranking-page"><div className="ranking-page-heading"><Link className="back-link" to="/">← Volver al inicio</Link><div><span className="eyebrow">TU COMUNIDAD DE APRENDIZAJE</span><h1><Trophy size={28}/> Ranking de mi grupo</h1><p>Consulta la participación registrada en este grupo. Es un acumulado, no una calificación.</p></div></div>
  {!access.teacher&&options.length>1&&<label className="ranking-page-select">Cambiar de grupo<select value={scopeKey(scope)} onChange={event=>{const next=options.find(group=>scopeKey(group)===event.target.value);if(next){config.select(scopeKey(next));navigate(path(next));}}}>{options.map(group=><option key={scopeKey(group)} value={scopeKey(group)}>{[group.courseTitle,group.termTitle,group.title].filter(Boolean).join(' · ')}</option>)}</select></label>}
  <p className="ranking-page-privacy"><ShieldCheck size={15}/> Solo los integrantes autorizados de este grupo pueden consultar esta vista; la profesora no compite.</p>
  <GroupRanking scope={scope} teacher={access.teacher} canConfigure={false}/>
 </section>;
}
