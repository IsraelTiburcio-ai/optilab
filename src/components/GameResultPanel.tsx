import {Link} from 'react-router-dom';
import {Check, Trophy} from 'lucide-react';
import {type SavedGameResult} from '../integration/protocol';

export function GameResultPanel({result, live = false}: {result: SavedGameResult; live?: boolean}) {
  const seconds = Math.floor(result.elapsedMs / 1000);
  return <section className="game-result-panel paper" aria-label="Resultado de Memorama Simplex" aria-live={live ? 'polite' : undefined}>
    <div className="game-result-heading"><Trophy size={30}/><div>
      <span className="eyebrow">BITÁCORA DE LA FORTALEZA</span>
      <h2>Memorama Simplex completado</h2>
    </div><Check aria-hidden="true"/></div>
    <dl className="game-result-stats">
      <div><dt>Precisión del juego</dt><dd>{result.accuracy}%</dd></div>
      <div><dt>Parejas</dt><dd>{result.matchedPairs}/{result.totalPairs}</dd></div>
      <div><dt>Intentos / errores</dt><dd>{result.attempts} / {result.errors}</dd></div>
      <div><dt>Tiempo activo</dt><dd>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</dd></div>
    </dl>
    <p className="muted">Resultado informado por el juego al encontrar sus ocho parejas. Precisión = parejas ÷ intentos; no es una calificación de dominio.</p>
    <small>Registrado el {new Date(result.date).toLocaleString('es-MX')}. La práctica manual y las insignias se conservan por separado.</small>
    <Link className="button" to="/gimnasio/3">Regresar a Fortaleza Simplex</Link>
  </section>;
}
