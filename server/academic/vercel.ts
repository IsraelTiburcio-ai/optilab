import type {IncomingMessage,ServerResponse} from 'node:http';
import {handleAcademicRequest,Limiter,type HandlerPolicy} from './handler.js';
import {parseAllowedOrigins,vercelRuntimeConfig,type AcademicRuntime} from './runtime.js';
import {ProductionInitError,productionAdmin,safeInitCode,type EmulatorAdmin} from './sdk.js';
import {oidcTokenFromRequest,withRequestOidcToken} from '../vercel-oidc.js';
import {AcademicRepository} from './repository.js';
import {AcademicService} from './service.js';

export interface AcademicRuntimeFlags {
  modeOff:boolean;
  modePreview:boolean;
  modeProduction:boolean;
  vercelEnvProduction:boolean;
  nodeEnvProduction:boolean;
  productionEnabled:boolean;
  projectConfigured:boolean;
  noAuthEmulator:boolean;
  noFirestoreEmulator:boolean;
  allowedOriginsValid:boolean;
}
export function academicRuntimeFlags(env:NodeJS.ProcessEnv=process.env):AcademicRuntimeFlags {
  const requested=env.ACADEMIC_ADMIN_MODE;
  return Object.freeze({
    modeOff:requested===undefined||requested===''||requested==='off',
    modePreview:requested==='vercel-preview',
    modeProduction:requested==='vercel-production',
    vercelEnvProduction:env.VERCEL_ENV==='production',
    nodeEnvProduction:env.NODE_ENV==='production',
    productionEnabled:env.ACADEMIC_PRODUCTION_ENABLED==='true',
    projectConfigured:env.ACADEMIC_ADMIN_PROJECT==='optilab-cd829',
    noAuthEmulator:!env.FIREBASE_AUTH_EMULATOR_HOST,
    noFirestoreEmulator:!env.FIRESTORE_EMULATOR_HOST,
    allowedOriginsValid:parseAllowedOrigins(env.ACADEMIC_ALLOWED_ORIGINS).length>0,
  });
}
const safeErrorCodes=new Set(['ACADEMIC_ENV_REJECTED','firestore/invalid-credential','firestore/invalid-argument','firestore/failed-precondition','app/invalid-credential','app/invalid-app-name','app/duplicate-app','app/app-deleted','app/no-app']);
export function safeErrorCode(error:unknown):string {
  if(error instanceof ProductionInitError)return error.code;
  if(error instanceof Error){
    const code=(error as Error&{code?:unknown}).code;
    if(typeof code==='string'&&safeErrorCodes.has(code))return code;
    if(safeErrorCodes.has(error.message))return error.message;
  }
  return 'UNCLASSIFIED';
}
function logAcademicClosed(reason:string,stage:string,flags:AcademicRuntimeFlags,code?:string):void {
  console.warn(JSON.stringify({event:'academic_closed',reason,stage,flags,...(code?{code}:{})}));
}

let cached:{admin:EmulatorAdmin;service:AcademicService;limiter:Limiter;runtime:AcademicRuntime}|undefined;
let oidcLimiter:Limiter|undefined;
function closed(res:ServerResponse) {
  res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify({error:{code:'ACADEMIC_DISABLED',message:'La API académica no está habilitada en este entorno.'}}));
}
function operationFrom(req:IncomingMessage):string|undefined {
  const query=(req as IncomingMessage&{query?:Record<string,string|string[]|undefined>}).query?.operation;
  if(typeof query==='string'&&/^[A-Za-z]+$/.test(query))return query;
  const match=/^\/(?:api\/)?v1\/([A-Za-z]+)\/?$/.exec(req.url??'');
  return match?.[1];
}
async function backend(runtime:AcademicRuntime) {
  if(!runtime.open||runtime.mode!=='vercel-production'||!runtime.projectId)throw new Error('ACADEMIC_ENV_REJECTED');
  if(runtime.credentialMode!=='oidc'&&cached&&cached.runtime.credentialMode===runtime.credentialMode&&cached.runtime.projectId===runtime.projectId&&cached.runtime.allowedOrigins.join('|')===runtime.allowedOrigins.join('|'))return cached;
  let admin:EmulatorAdmin|undefined;
  try{
    admin=await productionAdmin(runtime.projectId,runtime.credentialMode);
    const service=new AcademicService(new AcademicRepository(admin.db,'production'),admin,runtime.maxTtlSeconds,{progressAttemptLimit:runtime.progressAttemptLimit});
    const limiter=runtime.credentialMode==='oidc'?(oidcLimiter??=new Limiter(runtime.rateLimit)):new Limiter(runtime.rateLimit);
    const result={admin,service,limiter,runtime};
    if(runtime.credentialMode!=='oidc')cached=result;
    return result;
  }catch(error){
    if(runtime.credentialMode==='oidc'&&admin){try{await admin.close();}catch{}}
    if(error instanceof ProductionInitError)throw error;
    throw new ProductionInitError('SERVICE_CONSTRUCT',safeInitCode(error));
  }
}
export interface VercelTestDependencies {runtime:AcademicRuntime;admin:Pick<EmulatorAdmin,'auth'>;service:AcademicService;limiter:Limiter}
export async function vercelHandler(req:IncomingMessage,res:ServerResponse,test?:VercelTestDependencies):Promise<void> {
  const runtime=test?.runtime??vercelRuntimeConfig(process.env);
  if(!runtime.open){logAcademicClosed('runtime_config_closed','runtime_config',academicRuntimeFlags());closed(res);return;}
  const raw=oidcTokenFromRequest(req);
  if(!test&&runtime.credentialMode==='oidc'&&!raw){logAcademicClosed('missing_oidc_header','request_header',academicRuntimeFlags());closed(res);return;}
  const run=async()=>{
    let ready:{admin:Pick<EmulatorAdmin,'auth'>;service:AcademicService;limiter:Limiter;runtime:AcademicRuntime};
    try{ready=test??await backend(runtime);}catch(error){const stage=error instanceof ProductionInitError?error.stage:'production_admin';logAcademicClosed('production_admin_init_failed',stage,academicRuntimeFlags(),safeErrorCode(error));closed(res);return;}
    const policy:HandlerPolicy={allowedOrigins:runtime.allowedOrigins,requireLoopback:false,rateLimit:runtime.rateLimit,
      maxBodyBytes:runtime.maxBodyBytes,projectId:runtime.projectId!,health:false,mode:runtime.mode,trustProxy:true};
    try{await handleAcademicRequest(req,res,policy,ready.admin,ready.service,ready.limiter,operationFrom(req));}
    finally{
      if(!test&&runtime.credentialMode==='oidc'){
        const admin=ready.admin as Partial<EmulatorAdmin>;
        if(typeof admin.close==='function'){try{await admin.close();}catch{}}
      }
    }
  };
  if(raw&&!test)await withRequestOidcToken(raw,run);else await run();
}
