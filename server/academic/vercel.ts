import type {IncomingMessage,ServerResponse} from 'node:http';
import {handleAcademicRequest,Limiter,type HandlerPolicy} from './handler';
import {vercelRuntimeConfig,type AcademicRuntime} from './runtime';
import {productionAdmin,type EmulatorAdmin} from './sdk';
import {AcademicRepository} from './repository';
import {AcademicService} from './service';

let cached:{admin:EmulatorAdmin;service:AcademicService;limiter:Limiter;runtime:AcademicRuntime}|undefined;
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
  if(cached&&cached.runtime.projectId===runtime.projectId&&cached.runtime.allowedOrigins.join('|')===runtime.allowedOrigins.join('|'))return cached;
  const admin=await productionAdmin(runtime.projectId);
  const service=new AcademicService(new AcademicRepository(admin.db,'production'),admin,runtime.maxTtlSeconds,{progressAttemptLimit:runtime.progressAttemptLimit});
  cached={admin,service,limiter:new Limiter(runtime.rateLimit),runtime};return cached;
}
export interface VercelTestDependencies {runtime:AcademicRuntime;admin:Pick<EmulatorAdmin,'auth'>;service:AcademicService;limiter:Limiter}
export async function vercelHandler(req:IncomingMessage,res:ServerResponse,test?:VercelTestDependencies):Promise<void> {
  const runtime=test?.runtime??vercelRuntimeConfig(process.env);
  if(!runtime.open){closed(res);return;}
  let ready:{admin:Pick<EmulatorAdmin,'auth'>;service:AcademicService;limiter:Limiter;runtime:AcademicRuntime};
  try{ready=test??await backend(runtime);}catch{closed(res);return;}
  const policy:HandlerPolicy={allowedOrigins:runtime.allowedOrigins,requireLoopback:false,rateLimit:runtime.rateLimit,
    maxBodyBytes:runtime.maxBodyBytes,projectId:runtime.projectId!,health:false,mode:runtime.mode,trustProxy:true};
  await handleAcademicRequest(req,res,policy,ready.admin,ready.service,ready.limiter,operationFrom(req));
}
