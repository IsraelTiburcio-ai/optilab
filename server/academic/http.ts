import {createServer,type Server} from 'node:http';
import {PROJECT,type LocalConfig} from './config';
import type {EmulatorAdmin} from './sdk';
import {assertEmulatedDatabase} from './sdk';
import type {AcademicService} from './service';
import {handleAcademicRequest,Limiter,type HandlerPolicy} from './handler';
export function localHandlerPolicy(config:LocalConfig):HandlerPolicy {
  if(config.host!=='127.0.0.1'||config.projectId!==PROJECT)throw new Error('ACADEMIC_ENV_REJECTED');
  return {allowedOrigins:['http://127.0.0.1:5195','http://localhost:5195'],requireLoopback:true,rateLimit:config.rateLimit,
    maxBodyBytes:16384,projectId:config.projectId,health:true,mode:'emulator'};
}
export function httpServer(config:LocalConfig,sdk:EmulatorAdmin,service:AcademicService):Server {
  assertEmulatedDatabase(sdk.db);
  const policy=localHandlerPolicy(config),limiter=new Limiter(policy.rateLimit);
  return createServer((req,res)=>void handleAcademicRequest(req,res,policy,sdk,service,limiter));
}
