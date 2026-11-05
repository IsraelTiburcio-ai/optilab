import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Auth} from 'firebase-admin/auth';
import {authenticate} from '../../server/academic/authentication';
import {parseAllowedOrigins,vercelRuntimeConfig} from '../../server/academic/runtime';
import {productionAdmin} from '../../server/academic/sdk';
import {vercelHandler} from '../../server/academic/vercel';
import {rateLimitKey} from '../../server/academic/handler';

const base={NODE_ENV:'production',VERCEL_ENV:'production',ACADEMIC_ADMIN_MODE:'vercel-production',ACADEMIC_PRODUCTION_ENABLED:'true',
  ACADEMIC_ADMIN_PROJECT:'optilab-cd829',ACADEMIC_ALLOWED_ORIGINS:'https://optilab.club'};
function runtime(patch:Record<string,string|undefined>={}){
  const original={...process.env};delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;Object.assign(process.env,base,patch);try{return vercelRuntimeConfig(process.env);}finally{process.env=original;}
}
function response(){
  const headers:Record<string,string|number|string[]>={};let body='';
  return {headers,setHeader:(key:string,value:string|number|string[])=>{headers[key]=value;},writeHead:(status:number,values:Record<string,string|number|string[]>={})=>{headers.statusCode=status;Object.assign(headers,values);},end:(value?:string)=>{body=value??'';},
    get status(){return Number(headers.statusCode??0);},get body(){return body;}};
}
function request():IncomingMessage{return {method:'POST',url:'/api/v1/roster',headers:{},socket:{remoteAddress:'203.0.113.10',localPort:443},query:{operation:'roster'}} as unknown as IncomingMessage;}
test('Vercel production open only with explicit activation and exact HTTPS origin',()=>{
  const open=runtime();assert.equal(open.open,true);assert.equal(open.mode,'vercel-production');assert.deepEqual(open.allowedOrigins,['https://optilab.club']);
  assert.equal(runtime({ACADEMIC_PRODUCTION_ENABLED:'false'}).open,false);
  assert.equal(runtime({VERCEL_ENV:'preview'}).open,false);
  assert.equal(runtime({NODE_ENV:'development'}).open,false);
  assert.equal(runtime({ACADEMIC_ADMIN_PROJECT:'other'}).open,false);
  assert.equal(runtime({ACADEMIC_ALLOWED_ORIGINS:'*'}).open,false);
  assert.equal(runtime({ACADEMIC_ALLOWED_ORIGINS:'http://optilab.club'}).open,false);
  assert.equal(runtime({ACADEMIC_ALLOWED_ORIGINS:'https://optilab.club/path'}).open,false);
  assert.equal(runtime({FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'}).open,false);
});
test('Vercel Preview and off never open; handler closes without a backend',async()=>{
  for(const mode of ['vercel-preview','off'] as const){
    const original={...process.env};delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;Object.assign(process.env,base,{VERCEL_ENV:'preview',ACADEMIC_ADMIN_MODE:mode,ACADEMIC_PRODUCTION_ENABLED:'false'});
    try{
      const res=response();await vercelHandler(request(),res as unknown as ServerResponse);
      assert.equal(res.status,503);assert.equal(JSON.parse(res.body).error.code,'ACADEMIC_DISABLED');
      assert.equal(String(res.headers['Cache-Control']),'no-store');
    }finally{process.env=original;}
  }
});
test('token project/issuer are checked before authorization',async()=>{
  const auth={verifyIdToken:async()=>({uid:'user-1',aud:'other-project',iss:'https://securetoken.google.com/other-project',firebase:{sign_in_provider:'password'}})} as unknown as Auth;
  await assert.rejects(authenticate(auth,'Bearer abc','optilab-cd829'));
  const good={verifyIdToken:async()=>({uid:'user-1',aud:'optilab-cd829',iss:'https://securetoken.google.com/optilab-cd829',firebase:{sign_in_provider:'password'}})} as unknown as Auth;
  assert.equal((await authenticate(good,'Bearer abc','optilab-cd829')).uid,'user-1');
  await assert.rejects(authenticate({verifyIdToken:async()=>({uid:'anon',aud:'optilab-cd829',iss:'https://securetoken.google.com/optilab-cd829',firebase:{sign_in_provider:'anonymous'}})} as unknown as Auth,'Bearer abc','optilab-cd829'));
});
test('production admin refuses activation without explicit environment and protected credential',async()=>{
  const original={...process.env};delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;process.env.ACADEMIC_PRODUCTION_ENABLED='false';
  try{await assert.rejects(productionAdmin('optilab-cd829'),/ACADEMIC_ENV_REJECTED/);}finally{process.env=original;}
});
test('Vercel function declaration is bounded and has no production credential in source',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.functions['api/v1/[operation].ts'].maxDuration,15);
  assert.equal('memory' in config.functions['api/v1/[operation].ts'],false);
  const source=readFileSync('api/v1/[operation].ts','utf8');
  assert.doesNotMatch(source,/private_key|service_account|firebase-tools/);
  assert.match(source,/vercelHandler/);
});
test('allowed origin parser rejects wildcard, credentials, ports and non-root paths',()=>{
  assert.deepEqual(parseAllowedOrigins('https://optilab.club,https://preview.example.test'),['https://optilab.club','https://preview.example.test']);
  for(const value of ['*','http://optilab.club','https://user:pass@optilab.club','https://optilab.club:8443','https://optilab.club/path','https://optilab.club/?x=1','https://optilab.club,https://optilab.club'])assert.deepEqual(parseAllowedOrigins(value),[]);
});
test('open Vercel handler routes /api/v1/:operation through the shared HTTP handler without production services',async()=>{
  const {Readable}=await import('node:stream');
  const {Limiter}=await import('../../server/academic/handler');
  const env:Record<string,string>={...base};const original={...process.env};delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;Object.assign(process.env,env);
  let runtime;try{runtime=vercelRuntimeConfig(process.env);}finally{process.env=original;}
  assert.equal(runtime.open,true);
  const req=Readable.from([Buffer.from(JSON.stringify({courseId:'c'}))]) as unknown as IncomingMessage;
  Object.assign(req,{method:'POST',url:'/api/v1/roster',headers:{'content-type':'application/json',authorization:'Bearer token',origin:'https://optilab.club'},socket:{remoteAddress:'203.0.113.10',localPort:443},query:{operation:'roster'}});
  const res=response();
  const admin={auth:{verifyIdToken:async()=>({uid:'user-1',aud:'optilab-cd829',iss:'https://securetoken.google.com/optilab-cd829',firebase:{sign_in_provider:'password'}})}};
  const service={execute:async(actor:{uid:string},name:string)=>({ok:true,operation:name,uid:actor.uid})} as unknown as import('../../server/academic/service').AcademicService;
  await vercelHandler(req,res as unknown as ServerResponse,{runtime,admin:admin as never,service,limiter:new Limiter(60)});
  assert.equal(res.status,200);assert.equal(JSON.parse(res.body).operation,'roster');assert.equal(res.headers['Access-Control-Allow-Origin'],'https://optilab.club');
  const badReq=Readable.from([Buffer.from('not-json')]) as unknown as IncomingMessage;
  Object.assign(badReq,{method:'POST',url:'/api/v1/roster',headers:{'content-type':'application/json',authorization:'Bearer token'},socket:{remoteAddress:'203.0.113.11',localPort:443},query:{operation:'roster'}});
  const badRes=response();
  await vercelHandler(badReq,badRes as unknown as ServerResponse,{runtime,admin:admin as never,service,limiter:new Limiter(60)});
  assert.equal(badRes.status,400);assert.equal(JSON.parse(badRes.body).error.code,'INVALID_INPUT');
});

test('proxy-aware rate keys use the forwarded client, not the Vercel proxy address',()=>{
  const forwarded={headers:{'x-forwarded-for':'203.0.113.7, 10.0.0.2'},socket:{remoteAddress:'10.0.0.1'}} as unknown as IncomingMessage;
  assert.equal(rateLimitKey(forwarded,true),'203.0.113.7');
  assert.equal(rateLimitKey(forwarded,false),'10.0.0.1');
  assert.equal(rateLimitKey({headers:{'x-forwarded-for':'not-an-ip'},socket:{remoteAddress:'10.0.0.1'}} as unknown as IncomingMessage,true),'10.0.0.1');
});
test('OIDC configuration is explicit, production-only and validates the Vercel subject shape',async()=>{
  const {credentialMode,oidcConfig,productionAdmin}=await import('../../server/academic/sdk');
  assert.equal(credentialMode({}),'none');
  assert.equal(credentialMode({FIREBASE_SERVICE_ACCOUNT_JSON:'{}'}),'service-account');
  assert.equal(credentialMode({ACADEMIC_CREDENTIAL_MODE:'oidc',FIREBASE_SERVICE_ACCOUNT_JSON:'{}'}),'oidc');
  const env={GCP_PROJECT_NUMBER:'123456789012',GCP_SERVICE_ACCOUNT_EMAIL:'vercel@optilab-cd829.iam.gserviceaccount.com',
    GCP_WORKLOAD_IDENTITY_POOL_ID:'vercel',GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'vercel',
    GCP_AUDIENCE:'https://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/vercel/providers/vercel',
    ACADEMIC_VERCEL_SUBJECT:'owner:Optilab:project:optilab-api:environment:production'};
  const config=oidcConfig(env);assert.equal(config.subject,'owner:Optilab:project:optilab-api:environment:production');
  for(const patch of [{GCP_PROJECT_NUMBER:'bad'},{GCP_SERVICE_ACCOUNT_EMAIL:'nope'},{GCP_WORKLOAD_IDENTITY_POOL_ID:''},
    {GCP_AUDIENCE:'http://iam.googleapis.com/x'},{ACADEMIC_VERCEL_SUBJECT:'owner:Optilab:project:optilab-api:environment:preview'},
    {ACADEMIC_VERCEL_SUBJECT:'owner:Other:project:other:environment:production'}])assert.throws(()=>oidcConfig({...env,...patch}),/ACADEMIC_ENV_REJECTED/);
  const original={...process.env};delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;
  process.env.ACADEMIC_PRODUCTION_ENABLED='false';process.env.VERCEL_ENV='production';
  try{await assert.rejects(productionAdmin('optilab-cd829','oidc'),/ACADEMIC_ENV_REJECTED/);}finally{process.env=original;}
});
