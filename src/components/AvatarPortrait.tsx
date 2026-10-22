import {getAvatar} from '../data/avatars';
import {AssetImage} from './AssetImage';

export function AvatarPortrait({id, className = '', decorative = false, eager = false}: {
  id?: string | null; className?: string; decorative?: boolean; eager?: boolean;
}) {
  const avatar = getAvatar(id);
  return <span className={`avatar-portrait ${className}`} role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : `${avatar.name}, entrenador de OptiLab`} aria-hidden={decorative || undefined}>
    <AssetImage src={avatar.image} width={1024} height={1536} eager={eager} fallback={
      <svg viewBox="0 0 160 220" aria-hidden="true"><path d="M46 73Q21 29 52 22L78 8l35 20 13 42" fill={avatar.color} stroke="#243b40" strokeWidth="4"/>
        <circle cx="80" cy="66" r="34" fill="#f3d7ad" stroke="#243b40" strokeWidth="4"/>
        <path d="M80 111q-51-3-54 52l-5 36h118l-5-36q-4-53-54-52Z" fill={avatar.color} stroke="#243b40" strokeWidth="4"/>
        <path d="m62 120 18 25 18-25M80 145v49" fill="none" stroke="#fff1cf" strokeWidth="5"/>
        <path d="m104 156 11-10 9 10-9 12Z" fill="#e8bd68"/>
        <path d="M63 66h3m29 0h3m-25 20q7 6 14 0" stroke="#243b40" strokeWidth="4" strokeLinecap="round"/>
      </svg>
    }/>
  </span>;
}
