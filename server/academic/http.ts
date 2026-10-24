import {createServer,type Server} from 'node:http';
import {authenticate} from './authentication';
import {ApiError,publicError} from './errors';
import {PROJECT,type LocalConfig} from './config';
import type {EmulatorAdmin} from './sdk';
import {assertEmulatedDatabase} from './sdk';
import type {AcademicService} from './service';
/** Single-process bounded limiter, NOT a distributed-production rate limiter. */
class Limiter {
  private entries=new Map<string,{count:number;until:number}>();
  constructor(private maximum:number){}
  take(key:string) {
    const now=Date.now();for(const [k,v] of this.entries)if(v.until<=now)this.entries.delete(k);
    let row=this.entries.get(key);if(!row){if(this.entries.size>=1000)throw new ApiError(429,'RATE_LIMIT','Espera antes de reintentar.');row={count:0,until:now+60000};this.entries.set(key,row);}
    if(++row.count>this.maximum)throw new ApiError(429,'RATE_LIMIT','Espera antes de reintentar.');
  }
}
export function httpServer(config:LocalConfig,sdk:EmulatorAdmin,service:AcademicService):Server {
  if(config.host!=='127.0.0.1'||config.projectId!==PROJECT)throw new Error('ACADEMIC_ENV_REJECTED');
  assertEmulatedDatabase(sdk.db);
  const limiter=new Limiter(config.rateLimit);
  return createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    try {
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
      if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`)throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
      const origin=req.headers.origin;
      if(origin&&!['http://127.0.0.1:5195','http://localhost:5195'].includes(origin))throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
      if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
      if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST');res.writeHead(204).end();return;}
      limiter.take(`ip:${req.socket.remoteAddress}`);
      if(req.method==='GET'&&req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mode:'emulator',projectId:config.projectId}));return;}
      const match=/^\/v1\/([A-Za-z]+)$/.exec(req.url??'');
      if(req.method!=='POST'||!match)throw new ApiError(404,'NOT_FOUND','Operación no disponible.');
      if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new ApiError(400,'INVALID_INPUT','Se requiere JSON.');
      const actor=await authenticate(sdk.auth,req.headers.authorization);limiter.take(`uid:${actor.uid}`);
      const chunks:Buffer[]=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>16384)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Solicitud demasiado grande.');chunks.push(chunk);}
      let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(400,'INVALID_INPUT','Solicitud no válida.');}
      const result=await service.execute(actor,match[1],input);
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
    }catch(error){const e=publicError(error);if(e.status===429)res.setHeader('Retry-After','60');res.writeHead(e.status,{'Content-Type':'application/json'}).end(JSON.stringify({error:{code:e.code,message:e.message}}));}
  });
}
