import {useProgress} from '../store';
import {GameResultPanel} from './GameResultPanel';
export function GameHistory() {
  const {state} = useProgress();
  const last = state.gameResults.at(-1);
  return <section className="game-history"><h2>Partidas integradas</h2>
    {last ? <><p className="muted">{state.gameResults.length} finalizaciones guardadas (máximo 50). Última partida:</p><GameResultPanel result={last}/></> :
      <p className="muted">Todavía no hay partidas completadas dentro de OptiLab. El piloto de Memorama Simplex registra sus resultados al encontrar ocho parejas.</p>}
  </section>;
}
