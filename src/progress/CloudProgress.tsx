import {useIntegratedFeatures} from '../integration/features';
import CloudAttempts from '../attempts/CloudAttempts';
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
import {productionSessionKind,singleOperatorWindowAllowed,observeSingleOperatorExpiry} from './productionConfig';

export default function CloudProgress({uid,children}:{uid:string;children:ReactNode}) {
  const integrated=useIntegratedFeatures();
  const [local]=useState(accountStorage);
  const [engine]=useState(()=>new ProgressEngine(uid,local.storage,createProgressTransport(uid),600,local.durable));
  const view=useSyncExternalStore(engine.subscribe,engine.getSnapshot);
  useEffect(()=>{
    engine.start();engine.setOnline(navigator.onLine);
    const timed=productionSessionKind(import.meta.env??{})==='single-operator-test';
    const expire=()=>engine.suspend('La ventana de prueba terminó. El envío se pausó; conserva y exporta tu copia local.');
    const online=()=>{if(timed&&!singleOperatorWindowAllowed(import.meta.env??{}))expire();else engine.setOnline(navigator.onLine);};
    const stopExpiry=observeSingleOperatorExpiry(import.meta.env??{},expire);
    const storage=()=>engine.refreshLocal();
    addEventListener('online',online);addEventListener('offline',online);addEventListener('storage',storage);addEventListener('visibilitychange',online);
    return ()=>{stopExpiry();engine.dispose();removeEventListener('online',online);removeEventListener('offline',online);removeEventListener('storage',storage);removeEventListener('visibilitychange',online);};
  },[engine]);
  const p=view.progress;
  const change=(update:(value:Progress)=>Progress)=>engine.change(update(engine.getSnapshot().progress));
  const evolution=evolutionProgress(p.practiced,p.evolutionMilestones,games);
  return <ProgressContext.Provider value={{state:p,badges:gyms.filter(g=>gymGames(g.id).every(x=>p.practiced[x.repo])).map(g=>g.id),
    storageOK:local.durable&&!view.error.includes('Almacenamiento'),evolution,sync:{engine,view},
    markPracticed:id=>change(v=>integrated&&games.some(g=>g.repo===id)&&!v.practiced[id]?withEvolution({...v,practiced:{...v.practiced,[id]:new Date().toISOString()}}):v),
    toggle:id=>change(v=>{
      if(!games.some(g=>g.repo===id))return v;
      const practiced={...v.practiced};if(practiced[id])delete practiced[id];else practiced[id]=new Date().toISOString();
      return withEvolution({...v,practiced});
    }),
    visit:id=>change(v=>v.visited.includes(id)?v:{...v,visited:[...v.visited,id]}),
    saveResult:r=>change(v=>({...v,results:[...v.results,r].slice(-30)})),
    saveGameResult:r=>change(v=>!savedResults([r]).length||v.gameResults.some(x=>x.runId===r.runId)?v:withEvolution({...v,practiced:integrated?{...v.practiced,[r.gameId]:v.practiced[r.gameId]??r.date}:v.practiced,gameResults:[...v.gameResults,r].slice(-50)})),
    setRoute:route=>change(v=>({...v,route})),nickname:nickname=>change(v=>({...v,nickname})),
    selectAvatar:avatarId=>{if(isAvatarId(avatarId))change(v=>({...v,avatarId}));},
    selectCompanion:companionId=>{if(isCompanionId(companionId))change(v=>({...v,companionId}));},
    acknowledgeEvolution:(stage:UnlockStage)=>change(v=>{
      const unlocked=evolutionProgress(v.practiced,v.evolutionMilestones,games).stage;
      return stage===v.evolutionCelebratedStage+1&&stage<=unlocked?{...v,evolutionCelebratedStage:stage}:v;
    }),
    reset:()=>{void engine.reset().catch(()=>engine.reportError('No se reinició la aventura. Revisa el respaldo, almacenamiento o nuevos cambios y reintenta.'));},
  }}>{!local.durable&&<p role="alert">El navegador bloquea el almacenamiento: esta copia es temporal. Exporta tus cambios antes de cerrar; importación y reinicio están bloqueados.</p>}<CloudAttempts key={uid} uid={uid}>{children}</CloudAttempts></ProgressContext.Provider>;
}
