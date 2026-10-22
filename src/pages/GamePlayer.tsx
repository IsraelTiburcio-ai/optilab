import {useEffect, useRef, useState} from 'react';
import {Link, useParams} from 'react-router-dom';
import {ArrowUpRight, RotateCcw, Shield} from 'lucide-react';
import {Mascot} from '../Art';
import {useProgress} from '../store';
import {GameResultPanel} from '../components/GameResultPanel';
import {GAME_ID, GAME_URL, GAME_ORIGIN, PROTOCOL, parseMessage, type SavedGameResult} from '../integration/protocol';
import './GamePlayer.css';

export default function GamePlayer() {
  const {id} = useParams();
  const [attempt, setAttempt] = useState(0);
  if (id !== GAME_ID) return <section className="paper"><h1>Este juego todavía no tiene integración</h1><Link className="button" to="/optidex">Volver al OptiDex</Link></section>;
  return <PlayerSession key={attempt} retry={() => setAttempt(n => n + 1)}/>;
}

function PlayerSession({retry}: {retry: () => void}) {
  const {state, saveGameResult} = useProgress();
  const save = useRef(saveGameResult);
  save.current = saveGameResult;
  const frame = useRef<HTMLIFrameElement>(null);
  const [session] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<'loading'|'ready'|'playing'|'completed'|'unavailable'>('loading');
  const [result, setResult] = useState<SavedGameResult | null>(null);
  const [showFrame, setShowFrame] = useState(true);
  const url = new URL(GAME_URL);
  url.searchParams.set('optilabSession', session);
  url.searchParams.set('optilabOrigin', window.location.origin);
  const source = url.href;

  useEffect(() => {
    let ready = false;
    let activeRun: string | null = null;
    const retired = new Set<string>();
    const recorded = new Set(state.gameResults.map(r => r.runId));
    const init = () => frame.current?.contentWindow?.postMessage({
      protocol: PROTOCOL, version: 1, gameId: GAME_ID, session, type: 'host:init',
    }, GAME_ORIGIN);
    const receive = (event: MessageEvent) => {
      // Origin alone cannot distinguish repositories hosted on GitHub Pages.
      if (event.origin !== GAME_ORIGIN || !frame.current ||
          event.source !== frame.current.contentWindow || frame.current.src !== source) return;
      const message = parseMessage(event.data, session);
      if (!message) return;
      if (message.type === 'game:ready') {
        if (!ready) { ready = true; setPhase('ready'); }
        return;
      }
      if (!ready) return;
      if (message.type === 'game:started') {
        if (retired.has(message.runId) || recorded.has(message.runId) || activeRun === message.runId) return;
        if (activeRun) retired.add(activeRun);
        activeRun = message.runId;
        setResult(null);
        setPhase('playing');
        return;
      }
      if (message.type === 'game:completed' && message.runId === activeRun && !recorded.has(message.runId)) {
        const completed: SavedGameResult = {...message.result, gameId: GAME_ID, runId: message.runId, date: new Date().toISOString()};
        recorded.add(message.runId);
        save.current(completed);
        setResult(completed);
        setPhase('completed');
      }
    };
    window.addEventListener('message', receive);
    const interval = window.setInterval(() => { if (!ready) init(); }, 600);
    const timeout = window.setTimeout(() => { if (!ready) { setPhase('unavailable'); setShowFrame(false); } }, 15000);
    init();
    return () => {
      window.removeEventListener('message', receive);
      clearInterval(interval);
      clearTimeout(timeout);
    };
    // A fresh mounted session owns this listener; saves use the latest store callback.
  }, [session, source]);

  const status = {loading: 'Abriendo el portal…', ready: 'Conectado · voltea una carta para iniciar', playing: 'Partida en curso', completed: 'Partida completada · resultado recibido', unavailable: 'No se pudo conectar con el juego'}[phase];
  const previous = state.gameResults.filter(r => r.gameId === GAME_ID).at(-1);
  return <div className="game-player">
    <div className="player-navigation"><Link className="back-link" to="/gimnasio/3">← Regresar al gimnasio</Link>
      <a className="text-button" href={GAME_URL} target="_blank" rel="noopener noreferrer">Abrir juego independiente <ArrowUpRight size={15}/></a></div>
    <header className="player-title"><div><span className="eyebrow">FORTALEZA SIMPLEX · PILOTO INTEGRADO</span><h1>Memorama Simplex</h1><p>Encuentra conexiones. Tu partida se queda en esta aventura.</p></div><Mascot id={3}/></header>
    <div className="player-status" role="status"><Shield size={17}/><span>{status}</span>
      <button className="text-button" onClick={retry}><RotateCcw size={14}/> Reconectar</button></div>
    <div className={`player-frame-shell ${phase === 'loading' ? 'is-loading' : ''}`}>
      {showFrame && <iframe ref={frame} src={source} title="Memorama Simplex · juego integrado" referrerPolicy="strict-origin-when-cross-origin"
        onError={() => {setPhase('unavailable'); setShowFrame(false);}} allow="autoplay 'none'; camera 'none'; microphone 'none'; geolocation 'none'"/>}
      {phase === 'loading' && <div className="player-loading"><Mascot id={3}/><p>Preparando el tablero de la fortaleza…</p></div>}
      {phase === 'unavailable' && <section className="player-fallback"><h2>El portal necesita otro camino</h2><p>La conexión no está disponible. Puedes reintentar o jugar en el sitio independiente. Abrirlo no registra una victoria en OptiLab.</p><a className="button primary" href={GAME_URL} target="_blank" rel="noopener noreferrer">Jugar en otra pestaña <ArrowUpRight size={18}/></a><button className="button" onClick={retry}>Reintentar conexión</button></section>}
    </div>
    {result ? <GameResultPanel result={result} live/> : previous && <details className="previous-game-result"><summary>Consultar último resultado guardado</summary><GameResultPanel result={previous}/></details>}
    <p className="muted player-honesty">Solo se registra finalización cuando el juego informa las ocho parejas encontradas. Salir antes no cuenta como completar; puedes registrar práctica manual desde su ficha.</p>
  </div>;
}
