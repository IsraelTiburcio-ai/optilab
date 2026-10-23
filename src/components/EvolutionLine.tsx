import {useEffect,useState} from 'react';
import {LockKeyhole} from 'lucide-react';
import {getCompanion,type CompanionId,type EvolutionStage} from '../data/companions';
import {EVOLUTION_RULES,type UnlockStage} from '../lib/evolutionRules';
import {useProgress} from '../store';
import {CompanionPortrait} from './CompanionPortrait';
import {EvolutionCelebration} from './EvolutionCelebration';

export function EvolutionLine({id}:{id:CompanionId}) {
  const {evolution}=useProgress();
  const family=getCompanion(id);
  const [viewed,setViewed]=useState<EvolutionStage>(evolution.stage);
  const [replay,setReplay]=useState<UnlockStage|null>(null);
  useEffect(()=>setViewed(evolution.stage),[id,evolution.stage]);
  return <section className="evolution-line" aria-labelledby="evolution-line-title">
    <h3 id="evolution-line-title">Tu línea evolutiva</h3><p className="muted">{family.evolutions.map(f=>f.name).join(' → ')}</p>
    <ol>{family.evolutions.map(form=>{
      const unlocked=form.stage<=evolution.stage;
      const rule=EVOLUTION_RULES.find(r=>r.stage===form.stage);
      return <li key={form.id} className={unlocked?'form-unlocked':'form-locked'}>
        <button disabled={!unlocked} aria-label={`Ver ${form.name}, etapa ${form.stage}`} aria-pressed={viewed===form.stage} onClick={()=>setViewed(form.stage)}>
          <CompanionPortrait id={id} stage={form.stage} decorative/>
          {!unlocked&&<LockKeyhole className="form-lock" size={19} aria-hidden="true"/>}
          <strong>{form.name}</strong><span>Etapa {form.stage} · {unlocked?'desbloqueada':'pendiente'}</span>
        </button>
        {!unlocked&&rule&&<small>{rule.uniqueGames} juegos únicos en {rule.distinctGyms} gimnasios.</small>}
      </li>;
    })}</ol>
    <div className="evolution-inspection"><CompanionPortrait id={id} stage={viewed}/><div><strong>{family.evolutions.find(f=>f.stage===viewed)!.name}</strong><p>{viewed===evolution.stage?'Esta es tu forma activa.':'Una forma anterior de tu compañero. Tu forma más avanzada sigue activa.'}</p>
      {viewed>1&&<button className="button" onClick={()=>setReplay(viewed as UnlockStage)}>Revisar evolución a {family.evolutions.find(f=>f.stage===viewed)!.name}</button>}
    </div></div>
    {replay&&<EvolutionCelebration id={id} stage={replay} replay onClose={()=>setReplay(null)}/>}
  </section>;
}
