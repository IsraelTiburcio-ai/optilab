import {lazy,Suspense,useEffect,useRef,useState,type CSSProperties} from 'react';
import {Link,NavLink,Route,Routes,useLocation,useParams} from 'react-router-dom';
import {ArrowRight,BookOpen,Compass,Home as HomeIcon,KeyRound,Map as MapIcon,Search,Shield,Signpost,Sparkles,Trophy,UserRound,X} from 'lucide-react';
import {games,gyms,gymGames,normalize,questions,type Game} from './data';
import {useProgress} from './store';
import {Landscape,Mascot} from './Art';
import {GymBadge as Badge} from './components/GymBadge';
import {Progress} from './components/Progress';
import {GameCard} from './components/GameCard';
import {GameHistory} from './components/GameHistory';
import GamePlayer from './pages/GamePlayer';
import GymMap from './pages/GymMap';
import Profile from './pages/Profile';
import TrainerSelect from './pages/TrainerSelect';
import CompanionSelector from './pages/CompanionSelector';
import {getAvatar} from './data/avatars';
import {getCompanionForm,getGymCompanion} from './data/companions';
import {CompanionPortrait} from './components/CompanionPortrait';
import {AvatarPortrait} from './components/AvatarPortrait';
import {EvolutionNotice} from './components/EvolutionCelebration';
import './styles/personalization.css';
import './styles/companions.css';
import './styles/auth.css';
import {syncEnabled} from './progress/config';
import './styles/sync.css';
const SyncPanel=lazy(()=>import('./progress/SyncPanel'));
const Account=lazy(()=>import('./pages/Account'));
const links=[['/','Inicio',HomeIcon],['/mapa','Mapa',MapIcon],['/optidex','OptiDex',BookOpen],['/entrenar','Entrenar',Signpost],['/aventura','Mi aventura',UserRound],['/cuenta','Cuenta',KeyRound]] as const;
function PageTitle({kicker,title,description}:{kicker:string;title:string;description:string}){return <header className="page-title"><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></header>}
function Home() {
  const {state,evolution} = useProgress();
  const hasTeam=!!(state.avatarId&&state.companionId);
  const avatar=getAvatar(state.avatarId);
  const form=getCompanionForm(state.companionId,evolution.stage);
  const nickname=state.nickname.trim();
  const greeting=nickname&&nickname!=='Entrenador OptiLab'?`¡Bienvenido de nuevo, ${nickname}!`:'¡Bienvenido de nuevo!';
  return <><section className={`hero${hasTeam?' has-team':''}`}><div className="hero-copy">
    <span className="eyebrow"><span className="tiny-star">✦</span> EL CONOCIMIENTO ES UNA AVENTURA</span>
    {hasTeam?<><h1>{greeting}</h1><h2 className="hero-team-names">{avatar.name} y {form.name}</h2><span className="hero-team-stage">Etapa evolutiva {evolution.stage} de 3</span><p>Tu equipo está listo para seguir explorando los gimnasios de Optimización I.</p></>:<><h1>Un mundo de retos.<br/>Un camino <em>muy tuyo.</em></h1><p>Tu aventura por los gimnasios de Optimización I.</p></>}
    <p className="hero-description">{hasTeam?'Cada práctica deja huella en vuestra aventura. ¿Hacia dónde vamos hoy?':'Explora, juega y encuentra nuevas formas de entender. Tu próxima gran idea comienza aquí.'}</p>
    <Link className="button primary" to={!state.avatarId?'/entrenador':!state.companionId?'/companero':'/mapa'}>{hasTeam?'Continuar aventura':state.avatarId?'Elegir compañero':'Comenzar aventura'} <ArrowRight size={20}/></Link>
    <span className="hero-note">Sin registros. A tu ritmo. Desde cualquier lugar.</span>
  </div><div className="hero-scene"><Landscape/>{hasTeam?<div className="hero-team"><AvatarPortrait id={state.avatarId} eager/><CompanionPortrait id={state.companionId} stage={evolution.stage} eager/></div>:<Mascot id={1}/>}<span className="scene-note"><Sparkles size={16}/> {hasTeam?'¡La aventura continúa!':'¡Hay mucho por descubrir!'}</span><span className="coordinate">REGIÓN OPTILAB · 01—05</span></div></section>
    <section className="adventure-strip"><div><Compass/><span><strong>5 gimnasios</strong><small>Un universo por explorar</small></span></div><div><BookOpen/><span><strong>28 microjuegos</strong><small>Conceptos que cobran vida</small></span></div><div><Shield/><span><strong>Tu propio progreso</strong><small>{Object.keys(state.practiced).length} actividades practicadas</small></span></div></section>
    <section className="home-next"><div className="section-heading"><div><span className="eyebrow">ELIGE TU SIGUIENTE PASO</span><h2>La aventura apenas comienza.</h2></div><span className="hand-note">La curiosidad es tu brújula ↗</span></div>
      <div className="entry-grid"><Link to="/mapa" className="entry-card green"><MapIcon/><span className="eyebrow">EXPLORAR</span><h3>Cinco destinos.<br/>Mil conexiones.</h3><p>Conoce la región y entra al gimnasio que más te llame.</p><span>Explorar gimnasios <ArrowRight size={18}/></span></Link>
        <Link to="/entrenar" className="entry-card sand"><Signpost/><span className="eyebrow">ENTRENAR</span><h3>Un pequeño paso.<br/>Un gran avance.</h3><p>Diseña una ruta de práctica para tu siguiente sesión.</p><span>Mi entrenamiento <ArrowRight size={18}/></span></Link>
        <Link to="/optidex" className="entry-card blue"><BookOpen/><span className="eyebrow">DESCUBRIR</span><h3>Tu colección<br/>de posibilidades.</h3><p>Encuentra el juego perfecto para lo que quieres repasar.</p><span>Abrir OptiDex <ArrowRight size={18}/></span></Link>
      </div>
    </section></>;
}
function GymDetail() {
  const {id} = useParams();
  const gym = gyms.find(g => g.id === Number(id));
  const {state, visit, badges} = useProgress();
  useEffect(() => {if (gym) visit(gym.id);}, [gym?.id]);
  if (!gym) return <><h1>Ese destino no existe</h1><Link to="/mapa">Volver al mapa</Link></>;
  const list = gymGames(gym.id);
  return <><Link className="back-link" to="/mapa">← Volver al mapa</Link>
    <section className="gym-banner" style={{'--pale':gym.pale,'--accent':gym.color} as CSSProperties}>
      <div><span className="eyebrow">GIMNASIO {gym.id} · {gym.creature.toUpperCase()} TE DA LA BIENVENIDA</span>
        <h1>{gym.name}</h1><h2>{gym.topic}</h2><p>{gym.desc}</p>
        <Progress value={list.filter(x=>state.practiced[x.repo]).length} total={list.length}/>
        <p className="gym-insignia-note">{badges.includes(gym.id) ? `Insignia ${gym.badge} conseguida.` : `Insignia ${gym.badge} bloqueada: marca los ${list.length} juegos como practicados para obtenerla.`}</p>
      </div><CompanionPortrait id={getGymCompanion(gym.id).id} stage={1} className="mascot"/><Badge id={gym.id} earned={badges.includes(gym.id)}/>
    </section>
    <div className="section-heading"><h2>Tu campo de entrenamiento</h2><span>{list.length} actividades disponibles</span></div>
    <p className="muted">{gym.id === 3 ? 'Memorama Simplex se juega dentro de OptiLab y registra su finalización. Los otros juegos abren otra pestaña. La práctica manual sigue disponible en todas las fichas.' : 'Los juegos se abren en otra pestaña. Al regresar, registra tu práctica manualmente.'}</p>
    <div className="game-grid">{list.map((g,i)=><GameCard key={g.repo} game={g} index={i}/>)}</div>
  </>;
}
function OptiDex(){const [query,setQuery]=useState('');const [gym,setGym]=useState(0);const [pending,setPending]=useState(false);const {state}=useProgress();const list=games.filter(g=>(!gym||g.gimnasio===gym)&&normalize(g.nombre+' '+g.tema).includes(normalize(query))&&(!pending||!state.practiced[g.repo]));return <><PageTitle kicker="ENCICLOPEDIA DE MICROAVENTURAS" title="OptiDex" description="28 juegos reales. Muchas formas de conectar con lo que aprendes."/><div className="catalog-tools"><label className="search"><Search size={20}/><input aria-label="Buscar por nombre o tema" placeholder="Busca un juego, un tema, una idea…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button onClick={()=>setQuery('')} aria-label="Limpiar búsqueda"><X size={18}/></button>}</label><label className="pending-filter"><input type="checkbox" checked={pending} onChange={e=>setPending(e.target.checked)}/> Solo pendientes</label></div><div className="filters" aria-label="Filtrar por gimnasio">{[0,1,2,3,4,5].map(n=><button key={n} aria-pressed={gym===n} className={gym===n?'active':''} onClick={()=>setGym(n)}>{n?`Gimnasio ${n}`:'Todos'} <span>{n?gymGames(n).length:28}</span></button>)}</div><p className="muted" aria-live="polite">{list.length} juegos encontrados · Práctica registrada por ti, no una medida de dominio.</p><div className="game-grid">{list.map((g,i)=><GameCard key={g.repo} game={g} index={i}/>)}</div>{!list.length&&<div className="empty-state"><Compass/><h2>No hay juegos en este rincón.</h2><p>Prueba con otro tema o cambia los filtros.</p><button className="button" onClick={()=>{setQuery('');setGym(0);setPending(false)}}>Ver todos los juegos</button></div>}</>}
function Training(){const {state,setRoute}=useProgress();const [gym,setGym]=useState(3);const [time,setTime]=useState(10);const [topic,setTopic]=useState('');const route=state.route.map(id=>games.find(g=>g.repo===id)).filter((g):g is Game=>!!g);function generate(){let list=gymGames(gym).filter(g=>g.repo!=='mapa-produccion');if(gym===3){const order=['ahorcado-simplex','memorama-simplex','rompecabezas-simplex','ordena-simplex','caza-el-pivote'];list.sort((a,b)=>order.indexOf(a.repo)-order.indexOf(b.repo))}if(topic)list=list.filter(g=>g.tema===topic);setRoute(list.slice(0,time===10?2:time===20?3:5).map(g=>g.repo))}return <><PageTitle kicker="CADA PASO CUENTA" title="Mi ruta de entrenamiento" description="Elige tu destino. Prepara una pequeña expedición de estudio."/><div className="training-layout"><section className="paper route-controls"><Signpost size={32}/><h2>¿Hacia dónde vamos?</h2><label>Gimnasio<select value={gym} onChange={e=>{setGym(Number(e.target.value));setTopic('')}}>{gyms.map(g=><option value={g.id} key={g.id}>{g.id}. {g.name}</option>)}</select></label><label>Tiempo disponible<select value={time} onChange={e=>setTime(Number(e.target.value))}><option value={10}>10 minutos · ruta breve</option><option value={20}>20 minutos · ruta media</option><option value={30}>30+ minutos · ruta amplia</option></select></label><label>Interés<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="">Panorama del gimnasio</option>{gymGames(gym).filter(g=>g.repo!=='mapa-produccion').map(g=><option key={g.repo}>{g.tema}</option>)}</select></label><button className="button primary" onClick={generate}>Trazar mi ruta <ArrowRight size={18}/></button><p className="muted">El tiempo orienta la cantidad de actividades, no su duración: aún no hemos medido cada juego. La secuencia va de conceptos a aplicación y puedes recorrerla libremente.</p></section><section><div className="section-heading"><h2>{route.length?'Tu próxima expedición':'Tu camino empieza aquí'}</h2><span>{route.length} misiones</span></div>{route.length?<div className="mission-path">{route.map((g,i)=><div className="mission" key={g.repo}><span className="mission-number">{String(i+1).padStart(2,'0')}</span><GameCard game={g} index={i}/></div>)}</div>:<div className="route-empty"><Mascot id={3}/><h3>Una idea, un juego, un avance.</h3><p>Traza una ruta para guardar tus próximas misiones en este dispositivo.</p></div>}</section></div><section className="exam-callout"><Trophy size={38}/><div><span className="eyebrow">UN DESAFÍO ESPECIAL</span><h2>¿Listo para ponerlo a prueba?</h2><p>5 preguntas de Simplex con explicación y repaso según tus respuestas.</p></div><Link className="button" to="/reto">Ir al reto final <ArrowRight size={18}/></Link></section></>}
function Exam(){const {saveResult}=useProgress();const [started,setStarted]=useState(false);const [answers,setAnswers]=useState<number[]>([]);const [selected,setSelected]=useState<number|null>(null);const [checked,setChecked]=useState(false);const [finished,setFinished]=useState(false);const q=questions[answers.length];const score=answers.reduce((s,a,i)=>s+Number(a===questions[i].answer),0);const wrong=questions.filter((x,i)=>answers[i]!==x.answer);function next(){const updated=[...answers,selected!];setAnswers(updated);setSelected(null);setChecked(false);if(updated.length===5){saveResult({date:new Date().toISOString(),answers:updated,score:updated.reduce((s,a,i)=>s+Number(a===questions[i].answer),0)});setFinished(true)}}return <><PageTitle kicker="DESAFÍO DE LA FORTALEZA" title="Reto final · Simplex" description="Un diagnóstico breve para saber qué practicar después."/>{!started?<section className="exam-intro paper"><Badge id={3}/><h2>Cinco retos. Nuevas pistas.</h2><p>Equivalencias, holgura, variable de entrada, razón y optimalidad. Responde a tu ritmo; cada respuesta tiene una explicación.</p><p className="muted">Autoestudio complementario basado en el Gimnasio 3, secciones 3.2–3.3. No es una evaluación oficial ni predice una calificación de examen.</p><button className="button primary" onClick={()=>setStarted(true)}>Iniciar diagnóstico <ArrowRight size={18}/></button></section>:finished?<section aria-live="polite"><div className="result paper"><Trophy size={48}/><span className="eyebrow">EXPEDICIÓN REGISTRADA</span><h2>{score}/5 aciertos · {score*2}/10</h2><p>{5-score} errores. {score===5?'Resolviste estos cinco reactivos correctamente. Puedes seguir practicando otros contenidos del gimnasio.':'Cada error es una pista para tu próxima ruta.'}</p><h3>Conceptos por reforzar</h3>{wrong.length?<ul>{wrong.map(x=><li key={x.concept}>{x.concept}</li>)}</ul>:<p>Sin errores en este diagnóstico breve.</p>}<button className="button" onClick={()=>{setStarted(false);setFinished(false);setAnswers([])}}>Volver a intentarlo</button><Link className="text-button" to="/aventura">Ver mi progreso →</Link></div><h2>Tu siguiente repaso</h2><div className="game-grid">{[...new Set((wrong.length?wrong:questions.slice(0,1)).map(x=>x.repo))].map(repo=><GameCard key={repo} game={games.find(g=>g.repo===repo)!}/>)}</div><h2>Bitácora de respuestas</h2>{questions.map((x,i)=><details className="answer-review" key={x.concept}><summary>{answers[i]===x.answer?'✓':'○'} {x.concept}</summary><p>Tu respuesta: {x.options[answers[i]]}</p><p>Respuesta correcta: {x.options[x.answer]}</p><p>{x.feedback}</p></details>)}</section>:<section className="exam-question paper" key={answers.length}><div className="question-meta"><span className="eyebrow">REACTIVO {answers.length+1} / 5</span><span>{q.concept}</span></div><progress aria-label="Avance del diagnóstico" value={answers.length} max={5}/><h2>{q.prompt}</h2><div className="options">{q.options.map((o,i)=><button key={o} disabled={checked} aria-pressed={selected===i} className={`${selected===i?'chosen':''} ${checked&&i===q.answer?'correct':''} ${checked&&selected===i&&i!==q.answer?'incorrect':''}`} onClick={()=>setSelected(i)}><span>{'ABC'[i]}</span>{o}</button>)}</div>{checked&&<div className="feedback" role="status"><strong>{selected===q.answer?'¡Buena conexión!':'Hay una pista por revisar.'}</strong><p>{q.feedback}</p><small>Referencia: Gimnasio 3, {q.source}.</small></div>}{checked?<button className="button primary" onClick={next}>{answers.length===4?'Ver resultado':'Siguiente pregunta'} <ArrowRight size={18}/></button>:<button className="button primary" disabled={selected===null} onClick={()=>setChecked(true)}>Comprobar respuesta</button>}</section>}</>}
export default function App(){
  const {state,storageOK}=useProgress();const location=useLocation();const main=useRef<HTMLElement>(null);
  useEffect(()=>{window.scrollTo(0,0);main.current?.focus();document.title=`OptiLab · ${location.pathname==='/'?'Tu aventura comienza aquí':links.find(l=>l[0]===location.pathname)?.[1]||'Aventura'}`},[location.pathname]);
  return <><a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="site-header"><Link to="/" className="brand" aria-label="OptiLab inicio"><span className="brand-symbol"><Compass size={25}/></span>OPTI<span>LAB</span><small>APRENDE · JUEGA · EXPLORA</small></Link>
      <nav aria-label="Navegación principal">{links.map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/'}><Icon size={19}/><span>{label}</span></NavLink>)}</nav>
      <Link className="header-progress" to="/aventura"><Shield size={18}/><span>{Object.keys(state.practiced).length} / 28</span></Link>
    </header>
    <main id="contenido" tabIndex={-1} ref={main}>
      {syncEnabled&&<Suspense fallback={null}><SyncPanel/></Suspense>}
      {!storageOK&&<p className="notice" role="status">El almacenamiento no está disponible. Puedes seguir explorando; esta sesión no se conservará al recargar.</p>}
      <EvolutionNotice/>
      <Routes>
        <Route path="/" element={<Home/>}/><Route path="/entrenador" element={<TrainerSelect/>}/><Route path="/companero" element={<CompanionSelector/>}/>
        <Route path="/mapa" element={<GymMap/>}/><Route path="/gimnasio/:id" element={<GymDetail/>}/><Route path="/jugar/:id" element={<GamePlayer/>}/>
        <Route path="/optidex" element={<OptiDex/>}/><Route path="/entrenar" element={<Training/>}/><Route path="/reto" element={<Exam/>}/>
        <Route path="/aventura" element={<><Profile/><GameHistory/></>}/>
        <Route path="/cuenta" element={<Suspense fallback={<p className="account-loading" role="status">Abriendo el portal de cuentas…</p>}><Account/></Suspense>}/>
        <Route path="*" element={<><h1>Te saliste del sendero</h1><Link className="button" to="/mapa">Volver al mapa</Link></>}/>
      </Routes>
    </main>
    <footer className="site-footer"><span className="footer-brand">OPTILAB <span>Un pequeño juego. Una gran idea.</span></span><span>Optimización I · Proyecto educativo independiente</span><span>Hecho para aprender, a tu manera. <Sparkles size={14}/></span></footer>
  </>;
}
