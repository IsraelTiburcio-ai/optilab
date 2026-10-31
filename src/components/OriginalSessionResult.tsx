import {originalResultDisplay,type OriginalResult,type ResultPilotId} from '../integration/originalResults';

export function OriginalSessionResult({gameId,runId,result}:{gameId:ResultPilotId;runId:string;result:OriginalResult}){
  const {labels,note}=originalResultDisplay[gameId];
  const values=[result.correct,result.total,result.attempts,result.errors,result.durationMs===undefined?undefined:`${(result.durationMs/1000).toFixed(1)} s`,result.score,result.timeouts];
  return <aside className="paper original-session-result" aria-label="Resultado de esta sesión" data-run-id={runId}>
    <h2>Resultado comunicado por el juego</h2><p role="status">{result.reason==='time-limit'?'Partida finalizada por límite de tiempo.':'Partida finalizada.'} No es una calificación ni acredita dominio.</p>
    <dl>{labels.map((label,i)=>label&&values[i]!==undefined?<div key={label}><dt>{label}</dt><dd>{values[i]}</dd></div>:null)}{labels.length<6&&result.score!==undefined&&<div><dt>Puntuación nativa reportada</dt><dd>{result.score}</dd></div>}</dl>
    <p>{note}</p>
    <small>Autoinforme del iframe, validado por formato y sesión. Solo se muestra aquí; no se guarda ni cambia progreso, insignias o recompensas.</small>
  </aside>;
}
