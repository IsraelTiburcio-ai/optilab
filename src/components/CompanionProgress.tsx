import {useProgress} from '../store';

export function CompanionProgress() {
  const {evolution} = useProgress();
  const rule = evolution.nextRule;
  return <section className="companion-progress" aria-label="Progreso evolutivo">
    <span className="eyebrow">CONSTANCIA DE TU EQUIPO</span><h3>Etapa {evolution.stage} de 3 desbloqueada</h3>
    {rule ? <>
      <p>Próxima forma: registra <strong>{rule.uniqueGames} juegos diferentes</strong> entre al menos <strong>{rule.distinctGyms} gimnasios</strong>.</p>
      <div className="progress-track" role="progressbar" aria-label={`Juegos únicos para la etapa ${rule.stage}`} aria-valuenow={Math.min(evolution.uniqueGames,rule.uniqueGames)} aria-valuemin={0} aria-valuemax={rule.uniqueGames}>
        <span style={{width:`${Math.min(100,evolution.uniqueGames/rule.uniqueGames*100)}%`}}/>
      </div><div className="companion-progress-counts"><span>{evolution.uniqueGames}/{rule.uniqueGames} juegos únicos</span><span>{evolution.distinctGyms}/{rule.distinctGyms} gimnasios</span></div>
    </> : <p>Las tres etapas están desbloqueadas. Cada nueva práctica sigue formando parte de tu aventura.</p>}
    <small>Cuenta la práctica manual válida de los 28 juegos originales. Evolucionar reconoce constancia, no dominio académico. Las formas desbloqueadas se conservan al desmarcar.</small>
  </section>;
}
