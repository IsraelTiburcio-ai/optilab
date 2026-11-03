import {lazy,Suspense,useRef, useState} from 'react';
import {Link} from 'react-router-dom';
import {Flag, LockKeyhole, Shield, Trophy} from 'lucide-react';
import {games, gyms, gymGames, questions} from '../data';
import {getAvatar} from '../data/avatars';
import {getCompanionForm} from '../data/companions';
import {getBadgeAsset, specialBadges} from '../data/badges';
import {useProgress} from '../store';
import {syncMode} from '../progress/config';
import {Badge as BadgeSymbol} from '../Art';
import {AssetImage} from '../components/AssetImage';
import {AvatarPortrait} from '../components/AvatarPortrait';
import {GymBadge, badgeEarnedDate} from '../components/GymBadge';
import {Progress} from '../components/Progress';
import {CompanionPortrait} from '../components/CompanionPortrait';
import {CompanionProgress} from '../components/CompanionProgress';
import {EvolutionLine} from '../components/EvolutionLine';
import {academicEnabled} from '../academic/config';
import {useAcademicAccess} from '../academic/AcademicAccess';
const MyClasses=academicEnabled?lazy(()=>import('../academic/MyClasses')):null;

export default function Profile() {
  const {state, badges, nickname, reset, evolution, sync} = useProgress();
  const player=useAcademicAccess().identity;
  const [confirm, setConfirm] = useState(false);
  const [nicknameDraft,setNicknameDraft]=useState<string|null>(null);
  const nicknameBase=useRef<{baseRevision:number;predecessor:string|null}|null>(null);
  const last = state.results.at(-1);
  const avatar = getAvatar(state.avatarId);
  const form = getCompanionForm(state.companionId,state.companionId?evolution.stage:1);
  return <>
    <header className="page-title"><span className="eyebrow">TU BITÁCORA PERSONAL</span><h1>Mi aventura</h1>
      <p>No hay dos caminos iguales. Este es el que estás construyendo tú.</p></header>
    <section className="profile-intro paper trainer-profile team-profile">
      <div className="profile-team-art">
      <div className="profile-portrait-stage"><AvatarPortrait id={state.avatarId} eager/>
        <span>{avatar.name}{!state.avatarId && ' · predeterminado'}</span>
      </div>
      <div className="profile-companion-stage"><CompanionPortrait id={state.companionId} stage={state.companionId?evolution.stage:1} eager/>
        <strong>{form.name}</strong><span>{state.companionId?`Etapa ${evolution.stage} de 3`:'Vista predeterminada · por elegir'}</span>
      </div></div>
      <div><label className="eyebrow" htmlFor="nickname">{academicEnabled&&player?'TU GAMERTAG ÚNICO':sync?'TU APODO DE CUENTA':'TU APODO LOCAL'}</label>
        <input id="nickname" className="nickname" maxLength={30} readOnly={academicEnabled&&!!player} value={academicEnabled&&player?player.gamertag:nicknameDraft??state.nickname}
          onFocus={()=>{if(sync)nicknameBase.current=sync.engine.captureBase('nickname');}}
          onChange={e=>{if(academicEnabled&&player)return;sync?setNicknameDraft(e.target.value):nickname(e.target.value);}}
          onBlur={()=>{if(sync&&nicknameDraft!==null){sync.engine.change({...sync.engine.getSnapshot().progress,nickname:nicknameDraft},
            {nickname:nicknameBase.current??sync.engine.captureBase('nickname')});setNicknameDraft(null);}}}/>
        {sync&&<small>El apodo se guarda al salir del campo.</small>}
        <p>{state.visited.length} gimnasios visitados · {Object.keys(state.practiced).length}/28 juegos practicados · {badges.length}/5 insignias</p>
        <small>Tu práctica es autorregistrada. Visitar, practicar y evaluar son estados diferentes.</small>
        <Link className="button change-trainer" to="/entrenador?volver=aventura">Cambiar entrenador</Link>
        <Link className="text-button account-profile-link" to="/cuenta">Cuenta e inicio de sesión</Link>
        {academicEnabled&&<Link className="button" to="/bienvenida?editar=1">Cambiar gamertag y equipo</Link>}
      </div>
    </section>
    {MyClasses&&<Suspense fallback={<p role="status">Abriendo mis clases…</p>}><MyClasses/></Suspense>}
    <section className="paper companion-profile" aria-label="Mi compañero de aventura">
      <div className="section-heading"><h2>Tu compañero de aventura</h2><Link className="button" to="/companero?volver=aventura">{state.companionId?'Cambiar compañero':'Elegir compañero'}</Link></div>
      <CompanionProgress/>
      {state.companionId?<EvolutionLine id={state.companionId}/>:<p className="muted">Todavía no has confirmado una familia. La vista de Nexo es un ejemplo: elige a quien quieras para comenzar vuestra historia.</p>}
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
    <section className="local-note"><Shield/><p>{sync?syncMode==='production'?'Perfil privado aislado por cuenta. Consulta el estado de sincronización y los respaldos arriba.':'Perfil aislado por cuenta. Sincronización solo con los emuladores; consulta el estado y los respaldos arriba.':'Esta aventura se guarda únicamente en este navegador. No se sincroniza entre dispositivos y puede perderse al borrar los datos del sitio.'}</p></section>
    {confirm ? <div className="reset-confirm" role="alert"><p>{sync?'¿Reiniciar esta aventura de cuenta? Se guardará un respaldo y se creará una generación nueva. La historia Cloud anterior permanece; no es eliminación definitiva.':'¿Borrar toda tu aventura local, apodo, entrenador, compañero, evoluciones, ruta y resultados? No se puede deshacer.'}</p>
      <button className="button danger" onClick={() => {reset(); setConfirm(false);}}>{sync?'Sí, reiniciar aventura':'Sí, borrar progreso'}</button><button className="button" onClick={() => setConfirm(false)}>Cancelar</button>
    </div> : <button className="text-button" onClick={() => setConfirm(true)}>{sync?'Reiniciar aventura de cuenta':'Reiniciar progreso local'}</button>}
  </>;
}
