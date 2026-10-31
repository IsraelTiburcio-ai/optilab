import {authSettings, type FirebaseSettings} from '../auth/config';
import {productionSyncAllowed} from './productionConfig';
export function syncAllowed(env:Record<string,unknown>,auth:FirebaseSettings,hostname:string):boolean {
  return env.DEV===true && env.VITE_PROGRESS_SYNC==='emulator' &&
    ['localhost','127.0.0.1'].includes(hostname) && auth.status==='ready' &&
    auth.config.projectId==='demo-optilab-sync' && auth.emulatorUrl==='http://127.0.0.1:9099' &&
    env.VITE_FIRESTORE_EMULATOR_HOST==='127.0.0.1:8085';
}
export function progressSyncMode(env:Record<string,unknown>,auth:FirebaseSettings,origin:string):'disabled'|'emulator'|'production' {
  let hostname='';try{hostname=new URL(origin).hostname;}catch{return 'disabled';}
  if(syncAllowed(env,auth,hostname))return 'emulator';
  return productionSyncAllowed(env,auth,origin)?'production':'disabled';
}
export const syncMode=progressSyncMode(import.meta.env??{},authSettings,typeof location==='undefined'?'':location.origin);
export const syncEnabled=syncMode!=='disabled';
