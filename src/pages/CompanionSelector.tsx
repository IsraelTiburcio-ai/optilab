import {useState,type CSSProperties} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {ArrowRight,Check,Compass} from 'lucide-react';
import {companions,getCompanion,getCompanionForm,type CompanionId} from '../data/companions';
import {useProgress} from '../store';
import {CompanionPortrait} from '../components/CompanionPortrait';

export default function CompanionSelector(){
  const {state,evolution,selectCompanion}=useProgress();
  const [selected,setSelected]=useState<CompanionId>(()=>getCompanion(state.companionId).id);
  const [search]=useSearchParams();const fromProfile=search.get('volver')==='aventura';
  const navigate=useNavigate();const family=getCompanion(selected);const form=getCompanionForm(selected,evolution.stage);
  return <section className="trainer-selection companion-selection" style={{'--trainer-accent':family.color} as CSSProperties}>
    <header className="page-title"><span className="eyebrow">UN EQUIPO, MUCHOS CAMINOS</span><h1>¡Elige a tu compañero de aventura!</h1><p>Cinco criaturas. Cinco formas de explorar. ¿Quién te acompañará?</p></header>
    <div className="trainer-selection-layout">
      <fieldset className="trainer-roster companion-roster"><legend className="sr-only">Familias de OptiCriaturas</legend>{companions.map((c,i)=><label key={c.id} className={`trainer-slot companion-slot ${c.id===selected?'is-selected':''}`}>
        <input type="radio" name="companion" value={c.id} aria-label={c.name} checked={selected===c.id} onChange={()=>setSelected(c.id)}/><span className="trainer-slot-number">0{i+1}</span>
        <CompanionPortrait id={c.id} stage={1} decorative eager/><span className="trainer-slot-name">{c.name}</span><span className="trainer-slot-check" aria-hidden="true">{selected===c.id&&<Check size={14}/>}</span>
      </label>)}</fieldset>
      <section className="trainer-preview" aria-label="Vista previa del compañero" aria-live="polite"><div className="trainer-stage">
        <span className="stage-orbit" aria-hidden="true"/><CompanionPortrait key={selected} id={selected} stage={evolution.stage} eager className="companion-preview-portrait"/>
        <span className="trainer-stage-caption"><Compass size={14}/> FAMILIA {family.name.toUpperCase()}</span>
      </div><div className="trainer-story"><span className="eyebrow">{family.theme}</span><h2>{form.name}</h2><p>{family.personality}</p><p className="companion-stage-label">Forma activa al elegir: etapa {evolution.stage} de 3.</p></div></section>
    </div>
    <div className="trainer-confirm"><div><button className="button primary" onClick={()=>{selectCompanion(selected);navigate(fromProfile?'/aventura':'/mapa')}}>Elegir compañero <ArrowRight size={19}/></button>
      <Link className="text-button" to={fromProfile?'/aventura':'/mapa'}>{fromProfile?'Cancelar':'Explorar sin elegir todavía'}</Link></div>
      <p>Eliges una familia, no una ventaja académica. Tu progreso evolutivo es compartido y se conserva si cambias de compañero.</p>
    </div>
  </section>;
}
