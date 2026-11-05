import type {IncomingMessage,ServerResponse} from 'node:http';
import {authenticate} from './authentication';
import {ApiError,publicError} from './errors';
import type {EmulatorAdmin} from './sdk';
import type {AcademicService} from './service';

export interface HandlerPolicy {
  allowedOrigins:string[];
  requireLoopback:boolean;
  rateLimit:number;
  maxBodyBytes:number;
  projectId:string;
  health:boolean;
  mode:string;
}
/** Single-instance best-effort limiter. Vercel must not treat it as distributed. */
export class Limiter {
  private entries=new Map<string,{count:number;until:number}>();
  constructor(private maximum:number){}
  take(key:string) {
    const now=Date.now();for(const [k,v] of this.entries)if(v.until<=now)this.entries.delete(k);
    let row=this.entries.get(key);if(!row){if(this.entries.size>=1000)throw new ApiError(429,'RATE_LIMIT','Espera antes de reintentar.');row={count:0,until:now+60000};this.entries.set(key,row);}
    if(++row.count>this.maximum)throw new ApiError(429,'RATE_LIMIT','Espera antes de reintentar.');
  }
}
function send(res:ServerResponse,status:number,body:unknown,headers:Record<string,string>={}) {
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(body));
}
export async function handleAcademicRequest(req:IncomingMessage,res:ServerResponse,policy:HandlerPolicy,admin:Pick<EmulatorAdmin,'auth'>,service:AcademicService,limiter:Limiter,operation?:string):Promise<void> {
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  try {
    if(policy.requireLoopback){
      if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress??''))throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
      if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`)throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
    }
    const origin=req.headers.origin;
    if(origin&&!policy.allowedOrigins.includes(origin))throw new ApiError(403,'FORBIDDEN','Origen no permitido.');
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods','POST');res.writeHead(204).end();return;
    }
    limiter.take(`ip:${req.socket.remoteAddress??'unknown'}`);
    if(policy.health&&req.method==='GET'&&req.url==='/health'){
      send(res,200,{mode:policy.mode,projectId:policy.projectId});return;
    }
    const match=operation?/^[A-Za-z]+$/.test(operation)?[operation]:null:/^\/v1\/([A-Za-z]+)$/.exec(req.url??'');
    const name=match?.[operation?0:1];
    if(req.method!=='POST'||!name)throw new ApiError(404,'NOT_FOUND','Operación no disponible.');
    if(req.headers['content-type']?.split(';')[0]!=='application/json')throw new ApiError(400,'INVALID_INPUT','Se requiere JSON.');
    const actor=await authenticate(admin.auth,req.headers.authorization,policy.projectId);limiter.take(`uid:${actor.uid}`);
    const chunks:Buffer[]=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>policy.maxBodyBytes)throw new ApiError(413,'PAYLOAD_TOO_LARGE','Solicitud demasiado grande.');chunks.push(chunk);}
    let input:unknown;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(400,'INVALID_INPUT','Solicitud no válida.');}
    const result=await service.execute(actor,name,input);
    send(res,200,result);
  }catch(error){
    const e=publicError(error);const headers:Record<string,string>=e.status===429?{'Retry-After':'60'}:{};
    send(res,e.status,{error:{code:e.code,message:e.message}},headers);
  }
}
