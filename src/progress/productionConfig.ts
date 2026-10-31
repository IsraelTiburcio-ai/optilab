import type {FirebaseSettings} from '../auth/config';

/** Public build switches, never credentials or an authorization mechanism. */
export const productionSyncTarget={projectId:'optilab-cd829',origin:'https://israeltiburcio-ai.github.io',base:'/optilab/'} as const;
export function productionSyncAllowed(env:Record<string,unknown>,auth:FirebaseSettings,origin:string):boolean {
  return env.PROD===true&&env.DEV===false&&env.VITE_PROGRESS_SYNC==='production'&&
    env.VITE_PROGRESS_SYNC_RELEASE==='private-progress-v2'&&
    env.VITE_PROGRESS_SYNC_PROJECT_ID===productionSyncTarget.projectId&&
    env.VITE_PROGRESS_SYNC_ORIGIN===productionSyncTarget.origin&&origin===productionSyncTarget.origin&&
    env.BASE_URL===productionSyncTarget.base&&auth.status==='ready'&&
    auth.config.projectId===productionSyncTarget.projectId&&auth.config.authDomain==='optilab-cd829.firebaseapp.com'&&
    auth.emulatorUrl===null&&!env.VITE_FIREBASE_AUTH_EMULATOR_URL&&!env.VITE_FIRESTORE_EMULATOR_HOST;
}
