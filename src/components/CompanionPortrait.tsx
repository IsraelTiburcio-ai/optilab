import {Mascot} from '../Art';
import {getCompanion, getCompanionForm, type CompanionId, type EvolutionStage} from '../data/companions';
import {AssetImage} from './AssetImage';

export function CompanionPortrait({id, stage = 1, className = '', decorative = false, eager = false}: {
  id?: CompanionId | null; stage?: EvolutionStage; className?: string; decorative?: boolean; eager?: boolean;
}) {
  const family = getCompanion(id);
  const form = getCompanionForm(id,stage);
  return <span className={`companion-portrait ${className}`} data-companion-id={family.id} data-stage={stage}
    role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${form.name}, etapa ${stage} de la familia ${family.name}`} aria-hidden={decorative || undefined}>
    <AssetImage src={form.image} width={1254} height={1254} eager={eager} fallback={<span aria-hidden="true"><Mascot id={family.gymId}/></span>}/>
  </span>;
}
