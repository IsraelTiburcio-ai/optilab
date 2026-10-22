import {useState} from 'react';
import {Link} from 'react-router-dom';
import {Flag, LockKeyhole, Shield, Trophy} from 'lucide-react';
import {games, gyms, gymGames, questions} from '../data';
import {getAvatar} from '../data/avatars';
import {getBadgeAsset, specialBadges} from '../data/badges';
import {useProgress} from '../store';
import {Badge as BadgeSymbol} from '../Art';
import {AssetImage} from '../components/AssetImage';
import {AvatarPortrait} from '../components/AvatarPortrait';
import {GymBadge, badgeEarnedDate} from '../components/GymBadge';
import {Progress} from '../components/Progress';

export default function Profile() {
  const {state, badges, nickname, reset} = useProgress();
  const [confirm, setConfirm] = useState(false);
  const last = state.results.at(-1);
  const avatar = getAvatar(state.avatarId);
  return <>
    <header className="page-title"><span className="eyebrow">TU BITÁCORA PERSONAL</span><h1>Mi aventura</h1>
      <p>No hay dos caminos iguales. Este es el que estás construyendo tú.</p></header>
    <section className="profile-intro paper trainer-profile">
      <div className="profile-portrait-stage"><AvatarPortrait id={state.avatarId} eager/>
        <span>{avatar.name}{!state.avatarId && ' · predeterminado'}</span>
      </div>
      <div><label className="eyebrow" htmlFor="nickname">TU APODO LOCAL</label>
        <input id="nickname" className="nickname" maxLength={30} value={state.nickname} onChange={e => nickname(e.target.value)}/>
        <p>{state.visited.length} gimnasios visitados · {Object.keys(state.practiced).length}/28 juegos practicados · {badges.length}/5 insignias</p>
        <small>Tu práctica es autorregistrada. Visitar, practicar y evaluar son estados diferentes.</small>
        <Link className="button change-trainer" to="/entrenador?volver=aventura">Cambiar entrenador</Link>
      </div>
    </section>
    <div className="section-heading"><h2>Insignias de exploración</h2><span>{badges.length} de 5</span></div>
    <p className="muted">Marca todos los juegos de un gimnasio como practicados para obtener su insignia. Reconocen constancia, no dominio académico.</p>
    <div className="badge-collection">{gyms.map(g => {
      const earned = badges.includes(g.id);
      const date = earned ? badgeEarnedDate(g.id, state.practiced) : null;
      return <Link to={`/gimnasio/${g.id}`} key={g.id} className="gym-badge-card">
        <GymBadge id={g.id} earned={earned}/><strong>{g.badge}</strong>
        <small>{earned ? 'Conseguida' : 'Bloqueada'}</small>
        <Progress value={gymGames(g.id).filter(x => state.practiced[x.repo]).length} total={gymGames(g.id).length}/>
        <small className="badge-requirement">{earned ? date ? <time dateTime={date}>Desde {new Date(date).toLocaleDateString('es-MX')}</time> : 'Prácticas registradas' : `Practica y marca los ${gymGames(g.id).length} juegos del Gimnasio ${g.id}.`}</small>
        <small>{state.visited.includes(g.id) ? 'Gimnasio visitado' : 'Por explorar'}</small>
      </Link>;
    })}</div>
    <section className="future-rewards" aria-labelledby="future-rewards-title">
      <div className="section-heading"><h2 id="future-rewards-title">Horizontes por descubrir</h2><span>4 recompensas futuras</span></div>
      <p className="muted">Insignias especiales de aventura. Sus desafíos todavía no están disponibles; no se conceden por practicar ni por aprobar el diagnóstico.</p>
      <div className="special-badge-grid">{specialBadges.map(s => {
        const asset = getBadgeAsset(s.assetId);
        return <article className="special-badge-card" key={s.assetId} data-badge-id={s.assetId}>
          <div className="special-badge-art"><AssetImage src={asset.image} alt={`Insignia especial ${s.name}, recompensa futura`} width={1254} height={1254} fallback={<span aria-hidden="true"><BadgeSymbol id={3} earned={false}/></span>}/><LockKeyhole size={15} aria-hidden="true"/></div>
          <h3>{s.name}</h3><span className="future-label">Próximamente</span><p>{s.description}</p>
        </article>;
      })}</div>
    </section>
    <div className="profile-panels"><section className="paper"><Trophy/><h2>Último diagnóstico</h2>
      {last ? <><strong className="score">{last.score}/5</strong><p>{new Date(last.date).toLocaleString('es-MX')} · Simplex</p>
        <p>Reforzar: {questions.filter((q,i) => last.answers[i] !== q.answer).map(q => q.concept).join(', ') || 'Sin errores en estos cinco reactivos.'}</p></> : <p>Todavía no has realizado el reto de Simplex.</p>}
      <Link className="button" to="/reto">{last ? 'Repetir diagnóstico' : 'Explorar reto final'}</Link>
    </section><section className="paper"><Flag/><h2>Tu ruta activa</h2>
      {state.route.length ? <ol>{state.route.map(id => <li key={id}>{games.find(g => g.repo === id)?.nombre}{state.practiced[id] ? ' · Practicado' : ''}</li>)}</ol> : <p>Traza una ruta y guarda aquí tus próximas misiones.</p>}
      <Link className="button" to="/entrenar">Mi entrenamiento</Link>
    </section></div>
    <section className="local-note"><Shield/><p>Esta aventura se guarda únicamente en este navegador. No se sincroniza entre dispositivos y puede perderse al borrar los datos del sitio.</p></section>
    {confirm ? <div className="reset-confirm" role="alert"><p>¿Borrar toda tu aventura local, apodo, entrenador, ruta y resultados? No se puede deshacer.</p>
      <button className="button danger" onClick={() => {reset(); setConfirm(false);}}>Sí, borrar progreso</button><button className="button" onClick={() => setConfirm(false)}>Cancelar</button>
    </div> : <button className="text-button" onClick={() => setConfirm(true)}>Reiniciar progreso local</button>}
  </>;
}
