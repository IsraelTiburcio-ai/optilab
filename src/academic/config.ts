import {authSettings,type FirebaseSettings} from '../auth/config';
export function academicAllowed(env:Record<string,unknown>,auth:FirebaseSettings,hostname:string):boolean {
  return env.DEV===true&&env.VITE_ACADEMIC_ADMIN==='emulator'&&['localhost','127.0.0.1'].includes(hostname)&&
    auth.status==='ready'&&auth.config.projectId==='demo-optilab-sync'&&auth.emulatorUrl==='http://127.0.0.1:9099'&&
    env.VITE_FIRESTORE_EMULATOR_HOST==='127.0.0.1:8085';
}
export const academicEnabled=academicAllowed(import.meta.env??{},authSettings,typeof location==='undefined'?'':location.hostname);
