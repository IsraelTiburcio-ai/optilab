import {authSettings,type FirebaseSettings} from '../auth/config';
export type AcademicApiMode='off'|'emulator'|'preview'|'production';
export interface AcademicTarget {mode:AcademicApiMode;enabled:boolean;apiBase:string|null;appOrigin:string|null}
const localApi='http://127.0.0.1:5200',localAuth='http://127.0.0.1:9099',localFirestore='127.0.0.1:8085';
const localHosts=['localhost','127.0.0.1'];
function modeOf(env:Record<string,unknown>):AcademicApiMode {
  const explicit=env.VITE_ACADEMIC_API_MODE;
  if(explicit==='off'||explicit==='emulator'||explicit==='preview'||explicit==='production')return explicit;
  return env.VITE_ACADEMIC_ADMIN==='emulator'?'emulator':'off';
}
function localBase(value:unknown):string|null {
  if(value===undefined||value==='')return localApi;
  if(typeof value!=='string')return null;
  try{const url=new URL(value);
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.port!=='5200'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
    return url.origin;
  }catch{return null;}
}
function remoteBase(value:unknown):string|null {
  if(typeof value!=='string'||!value)return null;
  try{const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||
      !['','/','/api'].includes(url.pathname)||['localhost','127.0.0.1','::1'].includes(url.hostname))return null;
    return `${url.origin}${url.pathname==='/api'?'/api':''}`;
  }catch{return null;}
}
function remoteOrigin(value:unknown):string|null {
  if(typeof value!=='string'||!value)return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash&&!url.port?url.origin:null;}catch{return null;}
}
export function academicTarget(env:Record<string,unknown>,auth:FirebaseSettings,origin:string):AcademicTarget {
  const mode=modeOf(env),off:AcademicTarget={mode:'off',enabled:false,apiBase:null,appOrigin:null};
  if(mode==='emulator'){
    const host=origin?new URL(origin).hostname:'';
    if(env.DEV!==true||!localHosts.includes(host)||auth.status!=='ready'||auth.config.projectId!=='demo-optilab-sync'||
      auth.emulatorUrl!==localAuth||env.VITE_FIRESTORE_EMULATOR_HOST!==localFirestore)return {...off,mode};
    const apiBase=localBase(env.VITE_ACADEMIC_API_URL);if(!apiBase)return {...off,mode};
    return {mode,enabled:true,apiBase,appOrigin:origin};
  }
  if(mode==='preview'||mode==='production'){
    const appOrigin=remoteOrigin(env.VITE_ACADEMIC_APP_ORIGIN),apiBase=remoteBase(env.VITE_ACADEMIC_API_URL);
    if(env.PROD!==true||env.DEV===true||!appOrigin||appOrigin!==origin||!apiBase||auth.status!=='ready'||auth.emulatorUrl!==null||
      auth.config.projectId==='demo-optilab-sync'||(mode==='production'&&auth.config.projectId!=='optilab-cd829'))return {...off,mode};
    return {mode,enabled:true,apiBase,appOrigin};
  }
  return off;
}
/** Kept for the existing local gate tests and callers. */
export function academicAllowed(env:Record<string,unknown>,auth:FirebaseSettings,hostname:string):boolean {
  const origin=localHosts.includes(hostname)?`http://${hostname}:5195`:'';
  return academicTarget(env,auth,origin).enabled;
}
export const academicConfig=academicTarget(import.meta.env??{},authSettings,typeof location==='undefined'?'':location.origin);
export const academicEnabled=academicConfig.enabled;
export const academicMode=academicConfig.mode;
export const academicApiBase=academicConfig.apiBase;
export const academicAppOrigin=academicConfig.appOrigin;
export function academicEndpoint(operation:string):string {if(!academicConfig.enabled||!academicConfig.apiBase)throw new Error('ACADEMIC_DISABLED');return `${academicConfig.apiBase}/v1/${operation}`;}
