import {useEffect, useState, useSyncExternalStore, type ReactNode} from 'react';
import {ProgressContext} from '../store';
import {games, gyms, gymGames} from '../data';
import {isAvatarId} from '../data/avatars';
import {isCompanionId} from '../data/companions';
import {savedResults} from '../integration/protocol';
import {evolutionProgress, type UnlockStage} from '../lib/evolutionRules';
import {ProgressEngine} from './engine';
import {createProgressTransport} from './transport';
import {withEvolution, type Progress} from './model';
import {accountStorage} from './storage';

export default function CloudProgress({uid,children}:{uid:string;children:ReactNode}) {
  const [local]=useState(accountStorage);
  const [engine]=useState(()=>new ProgressEngine(uid,local.storage,createProgressTransport(uid),600,local.durable));
  const view=useSyncExternalStore(engine.subscribe,engine.getSnapshot);
  useEffect(()=>{
    engine.start();engine.setOnline(navigator.onLine);
    const online=()=>engine.setOnline(navigator.onLine);
    const storage=()=>engine.refreshLocal();
    addEventListener('online',online);addEventListener('offline',online);addEventListener('storage',storage);
    return ()=>{engine.dispose();removeEventListener('online',online);removeEventListener('offline',online);removeEventListener('storage',storage);};
  },[engine]);
  const p=view.progress;
  const change=(update:(value:Progress)=>Progress)=>engine.change(update(engine.getSnapshot().progress));
  const evolution=evolutionProgress(p.practiced,p.evolutionMilestones,games);
  return <ProgressContext.Provider value={{state:p,badges:gyms.filter(g=>gymGames(g.id).every(x=>p.practiced[x.repo])).map(g=>g.id),
    storageOK:local.durable&&!view.error.includes('Almacenamiento'),evolution,sync:{engine,view},
    toggle:id=>change(v=>{
      if(!games.some(g=>g.repo===id))return v;
      const practiced={...v.practiced};if(practiced[id])delete practiced[id];else practiced[id]=new Date().toISOString();
      return withEvolution({...v,practiced});
    }),
    visit:id=>change(v=>v.visited.includes(id)?v:{...v,visited:[...v.visited,id]}),
    saveResult:r=>change(v=>({...v,results:[...v.results,r].slice(-30)})),
    saveGameResult:r=>change(v=>!savedResults([r]).length||v.gameResults.some(x=>x.runId===r.runId)?v:{...v,gameResults:[...v.gameResults,r].slice(-50)}),
    setRoute:route=>change(v=>({...v,route})),nickname:nickname=>change(v=>({...v,nickname})),
    selectAvatar:avatarId=>{if(isAvatarId(avatarId))change(v=>({...v,avatarId}));},
    selectCompanion:companionId=>{if(isCompanionId(companionId))change(v=>({...v,companionId}));},
    acknowledgeEvolution:(stage:UnlockStage)=>change(v=>{
      const unlocked=evolutionProgress(v.practiced,v.evolutionMilestones,games).stage;
      return stage===v.evolutionCelebratedStage+1&&stage<=unlocked?{...v,evolutionCelebratedStage:stage}:v;
    }),
    reset:()=>{void engine.reset().catch(()=>engine.reportError('No se reinició la aventura. Revisa el respaldo, almacenamiento o nuevos cambios y reintenta.'));},
  }}>{!local.durable&&<p role="alert">El navegador bloquea el almacenamiento: esta copia es temporal. Exporta tus cambios antes de cerrar; importación y reinicio están bloqueados.</p>}{children}</ProgressContext.Provider>;
}
