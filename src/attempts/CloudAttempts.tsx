import {useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {AttemptCloudEngine} from './cloudEngine';
import {createCloudAttemptTransport} from './cloudTransport';
import {AttemptCloudContext} from './cloudContext';
import {validateLedger} from './cloudModel';
import * as local from './storage';

export default function CloudAttempts({uid,children}:{uid:string;children:ReactNode}){
 const auth=useAuth(),alive=useRef(true),[error,setError]=useState('');
 const valid=()=>alive.current&&auth.isCurrentSession(uid);
 const decision=`optilab-attempt-cloud:v1:${encodeURIComponent(uid)}`;
 const [engine]=useState(()=>new AttemptCloudEngine({
  read:()=>local.readCanonical(uid),
  merge:(ledger,remoteWins)=>local.mergeHistory(uid,ledger,valid,remoteWins),
  backup:async(ledger,source)=>{if(valid())local.backupHistory(uid,ledger,source);},
 },createCloudAttemptTransport(uid),valid));
 const view=useSyncExternalStore(engine.subscribe,engine.getSnapshot);
 useEffect(()=>{
  alive.current=true;engine.start();engine.setOnline(navigator.onLine);
  try{if(localStorage.getItem(decision)==='accepted')engine.activate();}catch{setError('No se pudo leer el consentimiento de intentos.');}
  const stop=local.subscribe(()=>{
   if(!valid())return;
   try{if(localStorage.getItem(decision)!=='accepted'){engine.pause();return;}}catch{engine.pause();setError('No se pudo comprobar el consentimiento; envío pausado.');return;}
   engine.changed();
  });
  const decisionChanged=(event:StorageEvent)=>{if(event.key!==decision||!valid())return;if(event.newValue==='accepted')engine.activate();else engine.pause();};
  const online=()=>engine.setOnline(navigator.onLine);
  addEventListener('storage',decisionChanged);addEventListener('online',online);addEventListener('offline',online);
  return()=>{alive.current=false;stop();engine.dispose();removeEventListener('storage',decisionChanged);removeEventListener('online',online);removeEventListener('offline',online);};
 },[engine,decision]);
 const run=async(action:()=>Promise<void>)=>{setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'No se guardó el cambio. Conserva los respaldos.');}};
 const activate=async(guest:boolean)=>run(async()=>{
  if(!valid()||!auth.user?.emailVerified)throw Error('Sesión no verificada.');
  local.backupHistory(uid,await local.readCanonical(uid),'antes-de-activar-canal');
  if(guest){const ledger=await local.readCanonical('guest');if(!valid())return;local.backupHistory(uid,ledger,'importación-invitado-revisada');if(!local.setConsent(uid,true))throw Error('No se pudo guardar el consentimiento local.');await local.mergeHistory(uid,ledger,valid);}
  if(!valid())return;if(!local.setConsent(uid,true))throw Error('No se pudo guardar el consentimiento local.');localStorage.setItem(decision,'accepted');engine.activate();
 });
 return <AttemptCloudContext.Provider value={{view:{...view,error:error||view.error},verified:!!auth.user?.emailVerified,activate,
  pause:()=>{engine.pause();try{localStorage.setItem(decision,'paused');}catch{setError('El envío se pausó, pero no se guardó la preferencia.');}},retry:()=>engine.retry(),keepRemote:()=>run(()=>engine.keepRemote()),
  restore:file=>run(async()=>{if(file.size>20_000_000)throw Error('Respaldo mayor de 20 MB');const value=JSON.parse(await file.text());if(value.version!==1||value.owner!==uid)throw Error('El respaldo pertenece a otra cuenta o versión.');const ledger=validateLedger(value.ledger);local.backupHistory(uid,await local.readCanonical(uid),'antes-de-restaurar');await local.mergeHistory(uid,ledger,valid);engine.changed();}),
  exportAll:()=>run(async()=>{if(!valid())return;const value={version:1,owner:uid,createdAt:new Date().toISOString(),source:'historial-local-y-remoto-recibido',ledger:await local.readCanonical(uid),backups:local.attemptBackups(uid)};if(!valid())return;const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='optilab-intentos-respaldo-cuenta.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}),
 }}>{children}</AttemptCloudContext.Provider>;
}
