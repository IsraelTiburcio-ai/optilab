import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {academicRuntimeFlags,safeErrorCode,vercelHandler} from '../../server/academic/vercel';

const base:Record<string,string>={NODE_ENV:'production',VERCEL_ENV:'production',ACADEMIC_ADMIN_MODE:'vercel-production',
  ACADEMIC_PRODUCTION_ENABLED:'true',ACADEMIC_ADMIN_PROJECT:'optilab-cd829',ACADEMIC_ALLOWED_ORIGINS:'https://optilab.club',
  ACADEMIC_CREDENTIAL_MODE:'oidc'};
function response(){
  const headers:Record<string,string|number|string[]>={};let body='';
  return {headers,setHeader:(k:string,v:string|number|string[])=>{headers[k]=v;},writeHead:(status:number,values:Record<string,string|number|string[]>={})=>{headers.statusCode=status;Object.assign(headers,values);},end:(value?:string)=>{body=value??'';},
    get status(){return Number(headers.statusCode??0);},get body(){return body;}};
}
function request(method='POST',headers:Record<string,string>={}):IncomingMessage {return {method,url:'/api/v1/roster',headers} as unknown as IncomingMessage;}
async function withEnv<T>(env:Record<string,string|undefined>,task:()=>Promise<T>):Promise<T>{
  const original={...process.env};
  for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','GCP_PROJECT_NUMBER','GCP_SERVICE_ACCOUNT_EMAIL','GCP_WORKLOAD_IDENTITY_POOL_ID','GCP_WORKLOAD_IDENTITY_PROVIDER_ID','GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID','VERCEL_PROJECT_ID','VERCEL_OIDC_ISSUER','VERCEL_OIDC_AUDIENCE','ACADEMIC_VERCEL_SUBJECT'])delete process.env[key];
  Object.assign(process.env,base,env);
  try{return await task();}finally{process.env=original;}
}
async function withWarn<T>(task:()=>Promise<T>):Promise<{result:T;logs:string[]}>{
  const original=console.warn,logs:string[]=[];
  console.warn=(...args:unknown[])=>{logs.push(args.map(value=>String(value)).join(' '));};
  try{return {result:await task(),logs};}finally{console.warn=original;}
}
function entry(logs:string[]){const value=logs.find(line=>line.includes('"event":"academic_closed"'));assert.ok(value);return JSON.parse(value);}
test('runtime-closed diagnostics expose only booleans',async()=>{
  const {logs}=await withWarn(()=>withEnv({ACADEMIC_ADMIN_MODE:'off'},async()=>{
    const res=response();await vercelHandler(request('OPTIONS'),res as unknown as ServerResponse);assert.equal(res.status,503);
  }));
  const log=entry(logs);assert.equal(log.reason,'runtime_config_closed');assert.equal(log.stage,'runtime_config');assert.equal(log.flags.modeOff,true);
  assert.equal(Object.values(log.flags).every(value=>typeof value==='boolean'),true);
  assert.doesNotMatch(JSON.stringify(log),/optilab\.club|GCP_|VERCEL_OIDC|Bearer|@/);
});
test('missing OIDC header is distinguishable and logs no header value',async()=>{
  const {logs}=await withWarn(()=>withEnv({},async()=>{
    const res=response();await vercelHandler(request('POST'),res as unknown as ServerResponse);assert.equal(res.status,503);
  }));
  const log=entry(logs);assert.equal(log.reason,'missing_oidc_header');assert.equal(log.stage,'request_header');
  assert.equal(log.flags.modeProduction,true);assert.doesNotMatch(JSON.stringify(log),/Bearer|x-vercel-oidc-token|header-token-marker/i);
});
test('production admin failure reports only stage and safe code',async()=>{
  const {logs}=await withWarn(()=>withEnv({},async()=>{
    const res=response();await vercelHandler(request('POST',{'x-vercel-oidc-token':'header-token-marker'}),res as unknown as ServerResponse);assert.equal(res.status,503);
  }));
  const log=entry(logs);assert.equal(log.reason,'production_admin_init_failed');assert.equal(log.stage,'production_admin');assert.equal(log.code,'ACADEMIC_ENV_REJECTED');
  const serialized=JSON.stringify(log);assert.doesNotMatch(serialized,/header-token-marker|secret|private|@|https:/i);
});
test('safe runtime flags and error codes do not include configuration values',()=>{
  const flags=academicRuntimeFlags({...base,ACADEMIC_ALLOWED_ORIGINS:'https://private.example'});
  assert.equal(flags.modeProduction,true);assert.equal(flags.allowedOriginsValid,true);assert.equal(flags.projectConfigured,true);
  assert.doesNotMatch(JSON.stringify(flags),/private\.example|optilab-cd829/);
  assert.equal(safeErrorCode(Object.assign(new Error('raw secret'),{code:'firestore/invalid-credential'})),'firestore/invalid-credential');
  assert.equal(safeErrorCode(new Error('raw secret without code')),'UNCLASSIFIED');
  assert.equal(safeErrorCode(new Error('ACADEMIC_ENV_REJECTED')),'ACADEMIC_ENV_REJECTED');
});
