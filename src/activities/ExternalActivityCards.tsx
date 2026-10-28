import {Link} from 'react-router-dom';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {publicGymActivities,providerName} from './catalog';
import './external.css';
export function ExternalActivityCards({gymId}:{gymId:number}){
  const placements=publicGymActivities(gymId);if(!placements.length)return null;
  return <section className="external-gym-activities" aria-labelledby="external-activities-title"><div className="section-heading"><div><span className="eyebrow">OTRAS FORMAS DE EXPLORAR</span><h2 id="external-activities-title">Actividades complementarias</h2></div></div>
    <p>Practica dentro de OptiLab con recursos externos. Son adicionales a los 28 juegos: no dan insignias, evoluciones ni calificaciones.</p>
    <div className="external-activity-grid">{placements.map(({activity})=><article className="paper external-activity-card" key={activity.activityId}><span className="external-provider"><ExternalLink size={16}/>{providerName[activity.provider]} · Recurso externo</span><h3>{activity.title}</h3><p>Al abrirla te conectarás con el proveedor. OptiLab no envía datos de tu cuenta ni de tu grupo.</p><Link className="button primary" to={`/actividad/${activity.activityId}`}>Abrir actividad <ArrowRight size={18}/></Link></article>)}</div>
  </section>;
}
