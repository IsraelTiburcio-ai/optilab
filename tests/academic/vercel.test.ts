import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Auth} from 'firebase-admin/auth';
import {authenticate} from '../../server/academic/authentication';
import {parseAllowedOrigins,vercelRuntimeConfig} from '../../server/academic/runtime';
import {productionAdmin} from '../../server/academic/sdk';
import {vercelHandler} from '../../server/academic/vercel';

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
  assert.equal(config.functions['api/v1/[operation].ts'].memory,512);
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
});
