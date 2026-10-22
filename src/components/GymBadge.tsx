import {useEffect, useRef, useState} from 'react';
import {LockKeyhole, Sparkles} from 'lucide-react';
import {Badge as BadgeSymbol} from '../Art';
import {gymGames} from '../data';
import {getBadgeAsset, getGymBadge} from '../data/badges';
import {useProgress} from '../store';
import {AssetImage} from './AssetImage';

export function GymBadge({id, earned, decorative = false}: {id: number; earned?: boolean; decorative?: boolean}) {
  const {badges: earnedGyms} = useProgress();
  const definition = getGymBadge(id);
  const asset = getBadgeAsset(definition.assetId);
  const obtained = earned ?? earnedGyms.includes(definition.gymId);
  const previous = useRef({id, obtained});
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    const newlyEarned = previous.current.id === id && !previous.current.obtained && obtained;
    previous.current = {id, obtained};
    if (!newlyEarned) {setCelebrate(false); return;}
    setCelebrate(true);
    const timeout = window.setTimeout(() => setCelebrate(false), 1200);
    return () => window.clearTimeout(timeout);
  }, [id, obtained]);
  const label = `Insignia ${definition.name}: ${obtained ? 'obtenida' : 'pendiente'}`;
  return <span className={`badge gym-badge ${obtained ? 'is-earned' : 'is-locked'}${celebrate ? ' just-earned' : ''}`}
    data-badge-id={asset.id} data-gym-id={id} role={decorative ? undefined : 'img'}
    aria-label={decorative ? undefined : label} aria-hidden={decorative || undefined}
    title={obtained ? label : `Marca los ${gymGames(id).length} juegos del Gimnasio ${id} como practicados para obtenerla.`}>
    <AssetImage src={asset.image} width={1254} height={1254} fallback={<span aria-hidden="true"><BadgeSymbol id={id} earned={obtained}/></span>}/>
    <span className="badge-status-symbol" aria-hidden="true">{obtained ? <Sparkles size={13}/> : <LockKeyhole size={13}/>}</span>
  </span>;
}

/** When all practice dates are available, the last one is the acquisition threshold. */
export function badgeEarnedDate(id: number, practiced: Record<string, string>): string | null {
  const dates = gymGames(id).map(g => practiced[g.repo] ? Date.parse(practiced[g.repo]) : NaN);
  return dates.length && dates.every(Number.isFinite) ? new Date(Math.max(...dates)).toISOString() : null;
}
