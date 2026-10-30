import {useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowUpRight,Shield} from 'lucide-react';
import {gyms,type Game} from '../data';
import {GameArena} from '../components/GameArena';
import {embeddedOriginalGame,originalGameIframePolicy} from '../integration/originalGames';
import {isResultPilot,originalResultSource} from '../integration/originalResults';
import {useOriginalResults} from '../integration/useOriginalResults';
import {OriginalSessionResult} from '../components/OriginalSessionResult';
import './GamePlayer.css';
import './OriginalGamePlayer.css';

export default function OriginalGamePlayer(){
  const {gameId}=useParams(),game=embeddedOriginalGame(gameId??'');
  if(!game)return <section className="paper"><h1>Este juego no está disponible en el piloto integrado</h1><Link className="button" to="/optidex">Volver al OptiDex</Link></section>;
  return <OriginalSession key={game.repo} game={game}/>;
}
function OriginalSession({game}:{game:Game}){
  const gym=gyms.find(g=>g.id===game.gimnasio)!;
  const frame=useRef<HTMLIFrameElement>(null),[session]=useState(()=>crypto.randomUUID());
  const source=originalResultSource(game.juego_url,game.repo,session,window.location.origin);
  const telemetry=useOriginalResults(game.repo,session,source,frame);
  const [phase,setPhase]=useState<'loading'|'loaded'|'slow'|'error'>('loading');
  useEffect(()=>{const timer=setTimeout(()=>setPhase(old=>old==='loading'?'slow':old),15000);return ()=>clearTimeout(timer);},[]);
  const status={loading:'Abriendo el juego…',loaded:telemetry.enabled?'Visor abierto · piloto de resultados de sesión':'Visor abierto · sin resultados conectados',slow:'El juego está tardando en aparecer',error:'No pudimos confirmar la carga del juego'}[phase];
  return <section className="game-player original-player" aria-label="Reproductor de juego original">
    <div className="player-navigation"><Link className="back-link" to={`/gimnasio/${gym.id}`}>← Regresar al gimnasio</Link><a className="text-button" href={game.juego_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir juego independiente <ArrowUpRight size={16}/></a></div>
    <header className="player-title"><div><span className="eyebrow">{gym.name} · Piloto integrado</span><h1>{game.nombre}</h1><p>{game.tema}</p></div></header>
    <GameArena title={game.nombre} region={gym.name} returnTo={`/gimnasio/${gym.id}`} controls={<p className="player-status" role="status"><Shield size={17}/><span>{status}</span></p>}>
      <div className="player-frame-shell"><iframe ref={frame} src={source} title={`${game.nombre} · juego original`} {...originalGameIframePolicy} onLoad={()=>{setPhase('loaded');telemetry.onLoad();}} onError={()=>setPhase('error')}/></div>
    </GameArena>
    <p className="player-honesty">Ampliar y restaurar conserva la partida. Salir de esta pantalla o recargar la reinicia. {telemetry.enabled?'Este piloto puede mostrar un informe del juego solo en esta sesión, sin guardar resultados ni conceder recompensas.':'Este piloto no comunica resultados, finalizaciones ni recompensas a OptiLab.'}</p>
    {telemetry.enabled&&<p aria-live="polite" className="muted">{({waiting:'Resultados de sesión: esperando un conector compatible del juego.',connected:'Resultados de sesión: conector disponible.',playing:'Resultados de sesión: partida en curso, sin resultado todavía.',ended:'Resultados de sesión: informe recibido.',aborted:'Partida interrumpida: no se recibió resultado.',retired:'El visor cambió de documento. Vuelve a abrir el juego para conectar resultados.'})[telemetry.status]}</p>}
    {telemetry.report&&isResultPilot(game.repo)&&<OriginalSessionResult gameId={game.repo} {...telemetry.report}/>}
    <section className="paper original-fallback" aria-labelledby="original-fallback-title"><h2 id="original-fallback-title">¿No aparece o no responde?</h2><p>El juego se ejecuta aislado y no puede usar almacenamiento local en este visor. Algunos bloqueos no se pueden detectar automáticamente. Puedes abrirlo de forma independiente.</p><a className="button" href={game.juego_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir en otra pestaña <ArrowUpRight size={17}/></a></section>
  </section>;
}
