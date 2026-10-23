import {useState, type CSSProperties} from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router-dom';
import {ArrowRight, Check, Compass} from 'lucide-react';
import {avatars, getAvatar} from '../data/avatars';
import {useProgress} from '../store';
import {AvatarPortrait} from '../components/AvatarPortrait';

export default function TrainerSelect() {
  const {state, selectAvatar} = useProgress();
  const [selected, setSelected] = useState(() => getAvatar(state.avatarId).id);
  const [search] = useSearchParams();
  const fromProfile = search.get('volver') === 'aventura';
  const navigate = useNavigate();
  const avatar = getAvatar(selected);
  const confirm = () => {
    selectAvatar(selected);
    navigate(fromProfile ? '/aventura' : state.companionId ? '/mapa' : '/companero');
  };
  return <section className="trainer-selection" style={{'--trainer-accent': avatar.color} as CSSProperties}>
    <header className="page-title"><span className="eyebrow">TU HISTORIA EMPIEZA CONTIGO</span>
      <h1>Elige a tu entrenador</h1><p>Seis compañeros de aventura. Elige a quien quieras: todos recorren el mismo mundo.</p>
    </header>
    <div className="trainer-selection-layout">
      <fieldset className="trainer-roster"><legend className="sr-only">Entrenadores disponibles</legend>
        {avatars.map((a, index) => <label key={a.id} className={`trainer-slot ${selected === a.id ? 'is-selected' : ''}`}>
          <input type="radio" name="trainer" value={a.id} checked={selected === a.id} onChange={() => setSelected(a.id)} aria-label={a.name}/>
          <span className="trainer-slot-number" aria-hidden="true">0{index + 1}</span>
          <AvatarPortrait id={a.id} decorative eager/>
          <span className="trainer-slot-name">{a.name}</span>
          <span className="trainer-slot-check" aria-hidden="true">{selected === a.id ? <Check size={14}/> : null}</span>
        </label>)}
      </fieldset>
      <section className="trainer-preview" aria-label="Vista previa del entrenador" aria-live="polite">
        <div className="trainer-stage"><span className="stage-orbit" aria-hidden="true"/>
          <AvatarPortrait key={selected} id={selected} eager className="trainer-preview-portrait"/>
          <span className="trainer-stage-caption"><Compass size={14}/> EXPEDICIÓN OPTILAB</span>
        </div>
        <div className="trainer-story"><span className="eyebrow">TU COMPAÑERO DE EXPLORACIÓN</span>
          <h2>{avatar.name}</h2><p>{avatar.personality}</p><blockquote>“{avatar.motto}”</blockquote>
        </div>
      </section>
    </div>
    <div className="trainer-confirm"><div><button className="button primary" onClick={confirm}>
      {fromProfile ? 'Guardar entrenador' : 'Comenzar aventura'} <ArrowRight size={19}/>
    </button><Link className="text-button" to={fromProfile ? '/aventura' : '/mapa'}>{fromProfile ? 'Cancelar' : 'Explorar el mapa sin elegir'}</Link></div>
      <p>Tu personaje es parte de tu historia. No cambia las actividades ni tus resultados. Puedes cambiarlo en Mi aventura.</p>
    </div>
  </section>;
}
