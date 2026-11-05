import {ApiError} from './errors.js';
import {credentialMode,type CredentialMode} from './sdk.js';

export type AcademicRuntimeMode='off'|'vercel-preview'|'vercel-production';
export interface AcademicRuntime {
  mode:AcademicRuntimeMode;
  open:boolean;
  projectId:string|null;
  allowedOrigins:string[];
  requireLoopback:boolean;
  rateLimit:number;
  maxTtlSeconds:number;
  maxBodyBytes:number;
  progressAttemptLimit:number;
  credentialMode:CredentialMode;
  health:boolean;
}
const productionProject='optilab-cd829';
const maxBody=16384;
function boundedInt(value:unknown,fallback:number,min:number,max:number):number {
  if(value===undefined||value==='')return fallback;
  const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:fallback;
}
export function parseAllowedOrigins(value:unknown):string[] {
  if(typeof value!=='string'||!value.trim())return [];
  const origins=value.split(',').map(origin=>origin.trim()).filter(Boolean);
  if(!origins.length||origins.length>5||new Set(origins).size!==origins.length)return [];
  for(const origin of origins){
    let url:URL;try{url=new URL(origin);}catch{return [];}
    if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port)return [];
    if(origin!==url.origin)return [];
  }
  return origins;
}
/** Closed by default. Preview and production require explicit, separate activation. */
export function vercelRuntimeConfig(env:NodeJS.ProcessEnv):AcademicRuntime {
  const closed:AcademicRuntime={mode:'off',open:false,projectId:null,allowedOrigins:[],requireLoopback:false,
    rateLimit:60,maxTtlSeconds:604800,maxBodyBytes:maxBody,progressAttemptLimit:200,credentialMode:'none',health:false};
  const requested=env.ACADEMIC_ADMIN_MODE;
  if(requested==='vercel-preview')return {...closed,mode:'vercel-preview',rateLimit:boundedInt(env.ACADEMIC_RATE_LIMIT,60,1,10000),maxTtlSeconds:boundedInt(env.ACADEMIC_MAX_TTL_SECONDS,604800,1,604800),progressAttemptLimit:boundedInt(env.ACADEMIC_PROGRESS_ATTEMPT_LIMIT,200,1,2000),credentialMode:credentialMode(env)};
  if(requested!=='vercel-production')return closed;
  if(env.VERCEL_ENV!=='production'||env.NODE_ENV!=='production'||env.ACADEMIC_PRODUCTION_ENABLED!=='true'||
    env.ACADEMIC_ADMIN_PROJECT!==productionProject||env.FIREBASE_AUTH_EMULATOR_HOST||env.FIRESTORE_EMULATOR_HOST)return closed;
  const allowedOrigins=parseAllowedOrigins(env.ACADEMIC_ALLOWED_ORIGINS);
  if(!allowedOrigins.length)return closed;
  return {mode:'vercel-production',open:true,projectId:productionProject,allowedOrigins,requireLoopback:false,
    rateLimit:boundedInt(env.ACADEMIC_RATE_LIMIT,60,1,10000),maxTtlSeconds:boundedInt(env.ACADEMIC_MAX_TTL_SECONDS,604800,1,604800),
    maxBodyBytes:maxBody,progressAttemptLimit:boundedInt(env.ACADEMIC_PROGRESS_ATTEMPT_LIMIT,200,1,2000),credentialMode:credentialMode(env),health:false};
}
export function assertOpenRuntime(config:AcademicRuntime):void {
  if(!config.open||config.mode!=='vercel-production')throw new ApiError(503,'ACADEMIC_DISABLED','La API académica no está habilitada en este entorno.');
}
