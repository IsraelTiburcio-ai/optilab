import {useState, type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import {gyms, gymGames} from '../data';
import {getAvatar} from '../data/avatars';
import {useProgress} from '../store';
import {Mascot} from '../Art';
import {AvatarPortrait} from '../components/AvatarPortrait';
import {GymBadge} from '../components/GymBadge';
import {Progress} from '../components/Progress';

export default function GymMap() {
  const [selected, setSelected] = useState(3);
  const {state, badges} = useProgress();
  const gym = gyms[selected - 1];
  const avatar = getAvatar(state.avatarId);
  return <>
    <header className="page-title"><span className="eyebrow">CARTOGRAFÍA DE UNA AVENTURA</span>
      <h1>Cada camino abre una posibilidad.</h1><p>Cinco gimnasios, una región por descubrir. Tú eliges dónde comenzar.</p></header>
    <div className="traveler-strip"><AvatarPortrait id={state.avatarId} decorative/><div><strong>En ruta con {avatar.name}</strong><span>{state.nickname || 'Entrenador OptiLab'} · {Object.keys(state.practiced).length}/28 practicados</span></div>
      <Link className="text-button" to="/aventura">Mi aventura →</Link></div>
    <div className="map-layout"><div className="world-map"><span className="map-label">LA REGIÓN OPTILAB</span>
      <svg className="map-terrain" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-40 110Q180-50 330 100T700 90 1100 160V650H-40Z" fill="#bed0a0"/>
        <path d="M-20 410Q170 200 390 410T760 320 1100 390V650H-20Z" fill="#a1bb8a"/>
        <path d="M760-20Q630 160 780 240T700 620" fill="none" stroke="#86b9be" strokeWidth="40"/>
        <path d="M130 390Q70 140 310 240T480 390 650 240 860 140" fill="none" stroke="#738d68" strokeWidth="26"/>
        <path d="M130 390Q70 140 310 240T480 390 650 240 860 140" fill="none" stroke="#f4dfac" strokeWidth="18" strokeDasharray="3 8"/>
        {Array.from({length:28}, (_,i) => <g key={i} transform={`translate(${(i * 157 + 30) % 990} ${(i * 73 + 20) % 580})`}><path d="m0 0-15 30h8l-12 16h38L7 30h8Z" fill={i % 2 ? '#6f9468' : '#83a574'}/></g>)}
      </svg>
      <div className="map-route" aria-label="Seleccionar gimnasio">{gyms.map(g => <button key={g.id} className={`map-node node-${g.id} ${selected === g.id ? 'selected' : ''}`} onClick={() => setSelected(g.id)} aria-pressed={selected === g.id} style={{'--accent':g.color,'--pale':g.pale} as CSSProperties}>
        <span className="node-island"><Mascot id={g.id}/><span className="node-number">{g.id}</span><GymBadge id={g.id} decorative/></span>
        <strong>{g.name}</strong><small>{gymGames(g.id).filter(x => state.practiced[x.repo]).length}/{gymGames(g.id).length} practicados</small>
      </button>)}</div>
      <span className="map-compass" aria-hidden="true">N<br/>✧</span><span className="map-caption">Todos los caminos están abiertos.</span>
    </div>
      <aside className="map-panel" style={{'--accent':gym.color,'--pale':gym.pale} as CSSProperties} aria-live="polite">
        <div className="panel-top"><span className="eyebrow">DESTINO {String(gym.id).padStart(2,'0')}</span><GymBadge id={gym.id}/></div>
        <Mascot id={gym.id}/><h2>{gym.name}</h2><h3>{gym.topic}</h3><p>{gym.desc}</p>
        <Progress value={gymGames(gym.id).filter(x => state.practiced[x.repo]).length} total={gymGames(gym.id).length}/>
        <p className="map-badge-rule">{badges.includes(gym.id) ? `Insignia ${gym.badge} conseguida.` : `Insignia ${gym.badge}: marca sus ${gymGames(gym.id).length} juegos como practicados para obtenerla.`}</p>
        <Link className="button primary" to={`/gimnasio/${gym.id}`}>Entrar al gimnasio <ArrowRight size={18}/></Link><small>{gymGames(gym.id).length} juegos · Exploración libre</small>
      </aside>
    </div>
  </>;
}
