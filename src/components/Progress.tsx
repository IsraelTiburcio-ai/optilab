export function Progress({value, total}: {value: number; total: number}) {
  return <div className="progress"><div className="progress-track" role="progressbar" aria-label="Juegos practicados" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}>
    <span style={{width: `${value / total * 100}%`}}/>
  </div><span>{value}/{total} practicados</span></div>;
}
