import {useEffect} from 'react';
import {useProgress} from '../store';
import {useAuth} from '../auth/AuthProvider';
import {useAcademicAccess} from './AcademicAccess';
import type {CompanionId} from '../data/companions';
/** Restore only missing cosmetics in the UID-owned adventure. Never reset or
 * replace practices, results, routes, epochs or evolution evidence. */
export function PlayerProgressBridge(){
  const {identity}=useAcademicAccess(),{sync}=useProgress(),auth=useAuth();
  useEffect(()=>{if(!identity||!sync?.view.ready||sync.engine.uid!==auth.user?.uid||!auth.isCurrentSession(sync.engine.uid))return;
    const old=sync.engine.getSnapshot().progress;
    if(!old.avatarId||!old.companionId||old.nickname==='Entrenador OptiLab')sync.engine.change({...old,
      avatarId:old.avatarId??identity.avatarId,companionId:old.companionId??identity.companionId as CompanionId,
      nickname:old.nickname==='Entrenador OptiLab'?identity.gamertag:old.nickname});
  },[identity,sync?.view.ready,sync?.view.progress.avatarId,sync?.view.progress.companionId,auth.user?.uid]);return null;
}
