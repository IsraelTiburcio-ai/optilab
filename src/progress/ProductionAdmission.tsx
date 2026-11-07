import {lazy,Suspense,useEffect,useRef,useState,type ReactNode} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {academicClient} from '../academic/client';
import {productionKind} from './config';
import {setAdmission,clearAdmission,rememberAdmission} from './admissionSignal';
const CloudProgress=lazy(()=>import('./CloudProgress'));
export function ProductionAdmission({uid,children,fallback}:{uid:string;children:ReactNode;fallback:ReactNode}){
 const auth=useAuth(),ref=useRef(auth);ref.current=auth;const [state,setState]=useState(()=>{let cached=false;try{const value=JSON.parse(localStorage.getItem(`optilab-sync:v2:${encodeURIComponent(uid)}:cache`)??'null');cached=value?.schemaVersion===2&&value.uid===uid;}catch{}return {checked:false,ever:cached,active:false};});
 useEffect(()=>{let alive=true,timer:ReturnType<typeof setTimeout>;const controller=new AbortController();clearAdmission(uid);if(state.ever)rememberAdmission(uid);
  const check=async()=>{let allowed=false;try{if(ref.current.user?.emailVerified){const call=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>alive&&ref.current.isCurrentSession(uid)},controller.signal),result=await call('syncAdmission',{});allowed=result.allowed&&result.mode===productionKind&&(result.mode==='production'?result.expiresAt===null:!!result.expiresAt&&Date.parse(result.expiresAt)>Date.now());}}catch{/* Fail closed, preserve an admitted account's local journal. */}
   if(!alive)return;setAdmission(uid,allowed);setState(old=>({checked:true,ever:old.ever||allowed,active:allowed}));timer=setTimeout(check,30000);
  };void check();return()=>{alive=false;clearTimeout(timer);controller.abort();clearAdmission(uid);};
 },[uid]);
 if(!state.checked)return <p role="status">Comprobando la admisión de esta cuenta…</p>;
 if(!state.ever)return <><p role="status">Verifica tu correo y comprueba la conexión para sincronizar. Tu progreso local se conserva.</p>{fallback}</>;
 return <>{!state.active&&<p role="alert">Sincronización no disponible o pausada. Tu copia por cuenta y las operaciones pendientes se conservan; exporta antes de salir. Recarga tras la reapertura autorizada.</p>}<Suspense fallback={<p role="status">Abriendo el perfil privado de la cuenta…</p>}><CloudProgress uid={uid}>{children}</CloudProgress></Suspense></>;
}
