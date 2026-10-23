import {Link} from 'react-router-dom';
import {getAvatar} from '../data/avatars';
import {getCompanionForm} from '../data/companions';
import {useProgress} from '../store';
import {AvatarPortrait} from './AvatarPortrait';
import {CompanionPortrait} from './CompanionPortrait';

export function ExpeditionPanel(){
  const {state,evolution}=useProgress();
  const avatar=getAvatar(state.avatarId);const stage=state.companionId?evolution.stage:1;
  const form=getCompanionForm(state.companionId,stage);
  return <div className="traveler-strip expedition-panel"><div className="expedition-portraits"><AvatarPortrait id={state.avatarId} decorative/><CompanionPortrait id={state.companionId} stage={stage} decorative/></div>
    <div><strong>{avatar.name} + {form.name}</strong><span>{state.companionId?`Etapa ${stage} · `:'Compañero predeterminado · '}{evolution.uniqueGames}/28 prácticas válidas</span><span>{state.nickname||'Tu equipo de exploración'}</span></div>
    <Link className="text-button" to={state.companionId?'/aventura':'/companero'}>{state.companionId?'Mi aventura →':'Elegir compañero →'}</Link>
  </div>;
}
