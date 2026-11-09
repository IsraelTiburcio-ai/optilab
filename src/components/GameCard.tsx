import {useAttempts} from '../attempts/local';
import {useState, type CSSProperties} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, ArrowUpRight, Check} from 'lucide-react';
import {games, gyms, type Game} from '../data';
import {useProgress} from '../store';
import {GAME_ID} from '../integration/protocol';
import {embeddedOriginalGame} from '../integration/originalGames';
import {isResultPilot} from '../integration/originalResults';
import {SimplexCover} from './SimplexCover';

export function GameCard({game, index = 0,academicScope,preview=false}: {game: Game; index?: number;preview?:boolean;academicScope?:{courseId:string;termId:string;groupId:string}}) {
  const attempts=useAttempts();
  const {state, toggle} = useProgress();
  const [details, setDetails] = useState(false),[saving,setSaving]=useState(false),[practiceMessage,setPracticeMessage]=useState<{kind:'personal'|'success'|'error';text:string}|null>(null);
  const gym = gyms[game.gimnasio - 1];
  const practiced = state.practiced[game.repo];
  const memorama = game.repo === GAME_ID;
  const integrated = memorama || !!embeddedOriginalGame(game.repo);
  const completion = state.gameResults.filter(r => r.gameId === game.repo).at(-1);
  async function markPractice(){
    if(saving)return;
    setPracticeMessage(null);
    if(practiced){toggle(game.repo);return;}
    if(!academicScope){
      if(!attempts.hasConsent()){toggle(game.repo);setPracticeMessage({kind:'personal',text:'Práctica personal guardada. No está vinculada a un grupo académico.'});return;}
      setSaving(true);const saved=await attempts.record(game.repo,'declared',crypto.randomUUID());setSaving(false);toggle(game.repo);setPracticeMessage(saved?{kind:'personal',text:'Práctica personal e intento local guardados. No vinculados a un grupo académico.'}:{kind:'personal',text:'Práctica personal guardada; el registro local falló y no se enviará a ningún docente.'});return;
    }
    if(!attempts.hasConsent()){toggle(game.repo);setPracticeMessage({kind:'personal',text:'Práctica personal guardada. Activa el historial de intentos para registrarla para tu docente.'});return;}
    setSaving(true);
    const saved=await attempts.record(game.repo,'declared',crypto.randomUUID(),undefined,academicScope);
    setSaving(false);
    if(!saved){setPracticeMessage({kind:'error',text:'No se guardó el intento académico. No marcamos la práctica para no mostrar un registro que no existe.'});return;}
    toggle(game.repo);
    setPracticeMessage({kind:'success',text:'Intento académico guardado en este dispositivo. Se enviará al grupo solo cuando la sincronización esté autorizada.'});
  }
  return <article className={`cartridge ${practiced ? 'practiced' : ''}`} style={{'--accent': gym.color, '--pale': gym.pale} as CSSProperties}>
    <div className="cartridge-art">
      {game.gimnasio === 3 ? <SimplexCover repo={game.repo}/> : <div className="game-glyph" aria-hidden="true">{['◈','⌘','⊞','⟷','△'][(index + game.gimnasio - 1) % 5]}</div>}
      <span className="serial">OPTI / {String(games.indexOf(game) + 1).padStart(2, '0')}</span><span className="cartridge-provider">OptiLab</span>
      <span className="game-region">GIMNASIO {game.gimnasio}</span>
      {practiced && <span className="practice-check" aria-label="Practicado"><Check size={18}/></span>}
    </div>
    <div className="cartridge-body">
      <h3>{game.nombre}</h3><p>{game.tema}</p>
      <div className="game-actions">
        {preview?<a className="button play" href={game.juego_url} target="_blank" rel="noopener noreferrer">Vista previa <ArrowUpRight size={17}/></a>:integrated ? <Link className="button play" to={`${memorama?'/jugar':'/jugar-original'}/${game.repo}${academicScope?'?'+new URLSearchParams(academicScope):''}`}>Jugar <ArrowRight size={17}/><span className="sr-only"> {game.nombre} dentro de OptiLab</span></Link> :
          <a className="button play" href={game.juego_url} target="_blank" rel="noopener noreferrer">Jugar <ArrowUpRight size={17}/><span className="sr-only"> {game.nombre}, nueva pestaña</span></a>}
        <button className="text-button" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Cerrar' : 'Detalles'}</button>
      </div>
      {!preview && integrated && <span className="integrated-label">Piloto · juega dentro de OptiLab</span>}
      {!preview && completion && <p className="completion-label">Partida completada · {completion.accuracy}% de precisión</p>}
      {details && <div className="game-details">
        <p>{memorama ? 'Piloto integrado: registra el resultado informado por el juego al completar ocho parejas.' : isResultPilot(game.repo) ? 'Piloto de resultados de sesión: informe del juego sin guardado ni recompensas.' : integrated ? 'Piloto integrado aislado: el resultado no se comunica a OptiLab.' : 'Actividad externa: el resultado no se comunica a OptiLab.'} · {gym.topic}.</p>
        {integrated && <p><a className="external-game" href={game.juego_url} target="_blank" rel="noopener noreferrer">Abrir juego independiente ↗</a></p>}
        <a href={game.repositorio_url} target="_blank" rel="noopener noreferrer">Ver código original ↗</a>
        {practiced && <p>Práctica manual registrada el {new Date(practiced).toLocaleDateString('es-MX')}.</p>}
        {game.repo === 'mapa-produccion' && <p className="notice">Correspondencia académica pendiente de revisión con la profesora. No se utiliza en el diagnóstico ni en rutas recomendadas.</p>}
      </div>}
      {!preview&&<button className="practice-toggle" aria-pressed={!!practiced} aria-busy={saving} disabled={saving} onClick={()=>void markPractice()}><span>{practiced ? <Check size={14}/> : null}</span>{saving?'Guardando…':practiced ? 'Practicado · desmarcar' : 'Marcar como practicado'}</button>}
      {practiceMessage&&<p role={practiceMessage.kind==='error'?'alert':'status'} className={`muted practice-message ${practiceMessage.kind}`}>{practiceMessage.text}</p>}
    </div>
  </article>;
}
