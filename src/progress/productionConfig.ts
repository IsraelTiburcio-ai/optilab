import type {FirebaseSettings} from '../auth/config';

/** Public build switches, never credentials or an authorization mechanism. */
export const productionSyncTarget={projectId:'optilab-cd829',origin:'https://optilab.club',base:'/'} as const;
export function productionSessionKind(env:Record<string,unknown>):'private-pilot'|'single-operator-test'|'production'|null {
  if(env.VITE_PROGRESS_SYNC_RELEASE==='general-progress-v1'&&env.VITE_SYNC_PILOT==='')return 'production';
  if(env.VITE_PROGRESS_SYNC_RELEASE==='private-progress-and-attempts-v1'&&env.VITE_SYNC_PILOT==='private-admission-v1')return 'private-pilot';
  if(env.VITE_PROGRESS_SYNC_RELEASE==='single-operator-test-v1'&&env.VITE_SYNC_PILOT==='single-operator-test-v1')return 'single-operator-test';
  return null;
}
/** Advisory client cutoff; the deployed Rules enforce identity, lease and absolute end. */
export function singleOperatorWindowAllowed(env:Record<string,unknown>,now=Date.now()):boolean {
  const start=env.VITE_SINGLE_OPERATOR_START,end=env.VITE_SINGLE_OPERATOR_END,digest=env.VITE_SINGLE_OPERATOR_DIGEST;
  if(typeof start!=='string'||typeof end!=='string'||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))return false;
  const a=Date.parse(start),b=Date.parse(end);
  return Number.isFinite(a)&&Number.isFinite(b)&&Number.isFinite(now)&&new Date(a).toISOString()===start&&new Date(b).toISOString()===end&&b>a&&b-a<=7200000&&now>=a&&now<b;
}
export function observeSingleOperatorExpiry(env:Record<string,unknown>,expire:()=>void,
  timers:{now:()=>number;set:(run:()=>void,ms:number)=>unknown;clear:(id:unknown)=>void}={now:Date.now,set:(f,ms)=>setTimeout(f,ms),clear:id=>clearTimeout(id as ReturnType<typeof setTimeout>)}):()=>void {
  if(productionSessionKind(env)!=='single-operator-test')return ()=>{};
  let stopped=false,timer:unknown;
  const check=()=>{if(stopped)return;if(!singleOperatorWindowAllowed(env,timers.now())){stopped=true;expire();return;}
    timer=timers.set(check,Math.min(1000,Date.parse(String(env.VITE_SINGLE_OPERATOR_END))-timers.now()));};
  check();return ()=>{stopped=true;timers.clear(timer);};
}
export function productionSyncAllowed(env:Record<string,unknown>,auth:FirebaseSettings,origin:string,now=Date.now()):boolean {
  const kind=productionSessionKind(env);
  return env.PROD===true&&env.DEV===false&&env.VITE_PROGRESS_SYNC==='production'&&
    (kind==='production'||kind==='private-pilot'||kind==='single-operator-test'&&singleOperatorWindowAllowed(env,now))&&
    env.VITE_PROGRESS_SYNC_PROJECT_ID===productionSyncTarget.projectId&&
    env.VITE_PROGRESS_SYNC_ORIGIN===productionSyncTarget.origin&&origin===productionSyncTarget.origin&&
    env.BASE_URL===productionSyncTarget.base&&auth.status==='ready'&&
    auth.config.projectId===productionSyncTarget.projectId&&auth.config.authDomain==='optilab-cd829.firebaseapp.com'&&
    auth.emulatorUrl===null&&!env.VITE_FIREBASE_AUTH_EMULATOR_URL&&!env.VITE_FIRESTORE_EMULATOR_HOST;
}
