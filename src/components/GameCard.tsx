import {useState, type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, ArrowUpRight, Check} from 'lucide-react';
import {games, gyms, type Game} from '../data';
import {useProgress} from '../store';
import {GAME_ID} from '../integration/protocol';
import {embeddedOriginalGame} from '../integration/originalGames';
import {SimplexCover} from './SimplexCover';

export function GameCard({game, index = 0}: {game: Game; index?: number}) {
  const {state, toggle} = useProgress();
  const [details, setDetails] = useState(false);
  const gym = gyms[game.gimnasio - 1];
  const practiced = state.practiced[game.repo];
  const memorama = game.repo === GAME_ID;
  const integrated = memorama || !!embeddedOriginalGame(game.repo);
  const completion = state.gameResults.filter(r => r.gameId === game.repo).at(-1);
  return <article className={`cartridge ${practiced ? 'practiced' : ''}`} style={{'--accent': gym.color, '--pale': gym.pale} as CSSProperties}>
    <div className="cartridge-art">
      {game.gimnasio === 3 ? <SimplexCover repo={game.repo}/> : <div className="game-glyph" aria-hidden="true">{['◈','⌘','⊞','⟷','△'][(index + game.gimnasio - 1) % 5]}</div>}
      <span className="serial">OPTI / {String(games.indexOf(game) + 1).padStart(2, '0')}</span>
      <span className="game-region">GIMNASIO {game.gimnasio}</span>
      {practiced && <span className="practice-check" aria-label="Practicado"><Check size={18}/></span>}
    </div>
    <div className="cartridge-body">
      <h3>{game.nombre}</h3><p>{game.tema}</p>
      <div className="game-actions">
        {integrated ? <Link className="button play" to={`${memorama?'/jugar':'/jugar-original'}/${game.repo}`}>Jugar <ArrowRight size={17}/><span className="sr-only"> {game.nombre} dentro de OptiLab</span></Link> :
          <a className="button play" href={game.juego_url} target="_blank" rel="noopener noreferrer">Jugar <ArrowUpRight size={17}/><span className="sr-only"> {game.nombre}, nueva pestaña</span></a>}
        <button className="text-button" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Cerrar' : 'Detalles'}</button>
      </div>
      {integrated && <span className="integrated-label">Piloto · juega dentro de OptiLab</span>}
      {completion && <p className="completion-label">Partida completada · {completion.accuracy}% de precisión</p>}
      {details && <div className="game-details">
        <p>{memorama ? 'Piloto integrado: registra el resultado informado por el juego al completar ocho parejas.' : integrated ? 'Piloto integrado aislado: el resultado no se comunica a OptiLab.' : 'Actividad externa: el resultado no se comunica a OptiLab.'} · {gym.topic}.</p>
        {integrated && <p><a className="external-game" href={game.juego_url} target="_blank" rel="noopener noreferrer">Abrir juego independiente ↗</a></p>}
        <a href={game.repositorio_url} target="_blank" rel="noopener noreferrer">Ver código original ↗</a>
        {practiced && <p>Práctica manual registrada el {new Date(practiced).toLocaleDateString('es-MX')}.</p>}
        {game.repo === 'mapa-produccion' && <p className="notice">Correspondencia académica pendiente de revisión con la profesora. No se utiliza en el diagnóstico ni en rutas recomendadas.</p>}
      </div>}
      <button className="practice-toggle" aria-pressed={!!practiced} onClick={() => toggle(game.repo)}><span>{practiced ? <Check size={14}/> : null}</span>{practiced ? 'Practicado · desmarcar' : 'Marcar como practicado'}</button>
    </div>
  </article>;
}
