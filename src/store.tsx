import {createContext, lazy, Suspense, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {useAuth} from './auth/AuthProvider';
import {syncEnabled} from './progress/config';
import type {ProgressEngine, SyncView} from './progress/engine';
import {games, gyms, gymGames} from './data';
import {savedResults, type SavedGameResult} from './integration/protocol';
import {isAvatarId} from './data/avatars';
import {isCompanionId, type CompanionId, type EvolutionStage} from './data/companions';
import {evolutionProgress, reconcileMilestones, type EvolutionMilestone, type UnlockStage} from './lib/evolutionRules';

export interface Result {date: string; answers: number[]; score: number}
export interface Progress {
  practiced: Record<string, string>;
  visited: number[];
  badges: number[];
  results: Result[];
  gameResults: SavedGameResult[];
  nickname: string;
  route: string[];
  avatarId: string | null;
  companionId: CompanionId | null;
  evolutionMilestones: EvolutionMilestone[];
  evolutionCelebratedStage: EvolutionStage;
}
const empty = (): Progress => ({
  practiced: {}, visited: [], badges: [], results: [], gameResults: [],
  nickname: 'Entrenador OptiLab', route: [], avatarId: null,
  companionId:null, evolutionMilestones:[], evolutionCelebratedStage:1,
});
function withEvolution(progress: Progress): Progress {
  const milestones = reconcileMilestones(progress.practiced, progress.evolutionMilestones, games);
  const {stage} = evolutionProgress(progress.practiced, milestones, games);
  return {...progress,evolutionMilestones:milestones,evolutionCelebratedStage:Math.min(progress.evolutionCelebratedStage,stage) as EvolutionStage};
}
function load(): Progress {
  try {
    const raw=localStorage.getItem('optilab-v1');
    if(syncEnabled&&raw) {
      try {if(!localStorage.getItem('optilab-sync:legacy-original'))localStorage.setItem('optilab-sync:legacy-original',raw);}
      catch {/* A full backup quota must not hide an otherwise readable guest profile. */}
    }
    const p = JSON.parse(raw || 'null');
    if (!p || typeof p !== 'object') return empty();
    return withEvolution({
      ...empty(),
      nickname: typeof p.nickname === 'string' ? p.nickname.slice(0, 30) : empty().nickname,
      avatarId: isAvatarId(p.avatarId) ? p.avatarId : null,
      companionId: isCompanionId(p.companionId) ? p.companionId : null,
      evolutionMilestones: p.evolutionMilestones,
      evolutionCelebratedStage: [1,2,3].includes(p.evolutionCelebratedStage) ? p.evolutionCelebratedStage : 1,
      practiced: Object.fromEntries(Object.entries(p.practiced || {}).filter(
        (entry): entry is [string, string] => games.some(g => g.repo === entry[0]) && typeof entry[1] === 'string',
      )),
      visited: Array.isArray(p.visited) ? p.visited.filter((n: number) => gyms.some(g => g.id === n)) : [],
      results: Array.isArray(p.results) ? p.results.filter((r: Result) => r && Array.isArray(r.answers) &&
        r.answers.length === 5 && r.answers.every(n => Number.isInteger(n) && n >= 0 && n < 3) &&
        typeof r.score === 'number' && typeof r.date === 'string').slice(-30) : [],
      gameResults: savedResults(p.gameResults),
      route: Array.isArray(p.route) ? p.route.filter((k: string) => games.some(g => g.repo === k)) : [],
    });
  } catch { return empty(); }
}
export const ProgressContext = createContext<(ReturnType<typeof useProgressState> & {sync:{engine:ProgressEngine;view:SyncView}|null}) | null>(null);
function useProgressState() {
  const [state, setState] = useState(load);
  const initialState=useRef(state);
  const [storageOK, setStorageOK] = useState(true);
  const badges = gyms.filter(g => gymGames(g.id).every(x => state.practiced[x.repo])).map(g => g.id);
  const evolution = evolutionProgress(state.practiced,state.evolutionMilestones,games);
  useEffect(() => {
    // Preserve exact legacy bytes until an actual guest action in emulator-sync mode.
    if(syncEnabled&&state===initialState.current)return;
    try {
      localStorage.setItem('optilab-v1', JSON.stringify({...state, badges}));
      setStorageOK(true);
    } catch { setStorageOK(false); }
  }, [state]);
  return {
    state, badges, storageOK, evolution,
    toggle: (id: string) => setState(p => {
      if (!games.some(g=>g.repo===id)) return p;
      const practiced = {...p.practiced};
      if (practiced[id]) delete practiced[id];
      else practiced[id] = new Date().toISOString();
      return withEvolution({...p, practiced});
    }),
    visit: (id: number) => setState(p => p.visited.includes(id) ? p : {...p, visited: [...p.visited, id]}),
    saveResult: (r: Result) => setState(p => ({...p, results: [...p.results, r].slice(-30)})),
    saveGameResult: (result: SavedGameResult) => setState(p => {
      if (!savedResults([result]).length || p.gameResults.some(r => r.runId === result.runId)) return p;
      // Completion is separate from manual practice and exploration badges.
      return {...p, gameResults: [...p.gameResults, result].slice(-50)};
    }),
    setRoute: (route: string[]) => setState(p => ({...p, route})),
    nickname: (nickname: string) => setState(p => ({...p, nickname})),
    selectAvatar: (avatarId: string) => {if (isAvatarId(avatarId)) setState(p => ({...p, avatarId}));},
    selectCompanion: (companionId: CompanionId) => {if (isCompanionId(companionId)) setState(p => ({...p,companionId}));},
    acknowledgeEvolution: (stage: UnlockStage) => setState(p => {
      const unlocked = evolutionProgress(p.practiced,p.evolutionMilestones,games).stage;
      if (stage !== p.evolutionCelebratedStage + 1 || stage > unlocked) return p;
      return {...p,evolutionCelebratedStage:stage};
    }),
    reset: () => setState(empty()),
  };
}
function GuestProgress({children}: {children:ReactNode}) {
  const value = useProgressState();
  return <ProgressContext.Provider value={{...value,sync:null}}>{children}</ProgressContext.Provider>;
}
const CloudProgress=lazy(()=>import('./progress/CloudProgress'));
export function ProgressProvider({children}: {children: ReactNode}) {
  const auth=useAuth();
  if(syncEnabled&&auth.status==='loading')return <p role="status">Comprobando la identidad antes de abrir tu progreso…</p>;
  if(syncEnabled&&auth.user)return <Suspense fallback={<p role="status">Abriendo el progreso de esta cuenta…</p>}>
    <CloudProgress key={auth.user.uid} uid={auth.user.uid}>{children}</CloudProgress>
  </Suspense>;
  return <GuestProgress>{children}</GuestProgress>;
}
export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('ProgressProvider requerido');
  return context;
}
