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
  const env={GCP_PROJECT_NUMBER:'401863964479',GCP_SERVICE_ACCOUNT_EMAIL:'optilab-api@optilab-cd829.iam.gserviceaccount.com',
    GCP_WORKLOAD_IDENTITY_POOL_ID:'optilab-vercel',GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'optilab-vercel-oidc',
    VERCEL_PROJECT_ID:'prj_test123',VERCEL_OIDC_ISSUER:'https://oidc.vercel.com/optilab',VERCEL_OIDC_AUDIENCE:'https://vercel.com/optilab',
    ACADEMIC_VERCEL_SUBJECT:'owner:optilab:project:optilab-api:environment:production'};
  const config=oidcConfig(env);assert.equal(config.subject,'owner:optilab:project:optilab-api:environment:production');
  assert.equal(config.vercelAudience,'https://vercel.com/optilab');assert.equal(config.vercelIssuer,'https://oidc.vercel.com/optilab');
  assert.equal(config.gcpAudience,'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc');
  for(const patch of [{GCP_PROJECT_NUMBER:'bad'},{GCP_SERVICE_ACCOUNT_EMAIL:'nope'},{GCP_WORKLOAD_IDENTITY_POOL_ID:''},
    {VERCEL_PROJECT_ID:'bad'},{VERCEL_OIDC_ISSUER:'https://oidc.vercel.com/other'},{VERCEL_OIDC_AUDIENCE:'https://vercel.com/other'},
    {ACADEMIC_VERCEL_SUBJECT:'owner:optilab:project:optilab-api:environment:preview'},
    {ACADEMIC_VERCEL_SUBJECT:'owner:other:project:optilab-api:environment:production'},{ACADEMIC_VERCEL_SUBJECT:'owner:optilab:project:other:environment:production'}])assert.throws(()=>oidcConfig({...env,...patch}),/ACADEMIC_ENV_REJECTED/);
  const original={...process.env};delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;
  process.env.ACADEMIC_PRODUCTION_ENABLED='false';process.env.VERCEL_ENV='production';
  try{await assert.rejects(productionAdmin('optilab-cd829','oidc'),/ACADEMIC_ENV_REJECTED/);}finally{process.env=original;}
});

test('OIDC credential renews the subject token on every access-token request without persisting the OIDC JWT',async()=>{
  const {createOidcCredential,PILOT_VERCEL_SUBJECT}=await import('../../server/academic/sdk');
  const config={projectNumber:'401863964479',serviceAccountEmail:'optilab-api@optilab-cd829.iam.gserviceaccount.com',poolId:'optilab-vercel',providerId:'optilab-vercel-oidc',vercelProjectId:'prj_test123',vercelIssuer:'https://oidc.vercel.com/optilab',vercelAudience:'https://vercel.com/optilab',gcpAudience:'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc',subject:PILOT_VERCEL_SUBJECT};
  const tokens=['token-one','token-two'];let tokenCalls=0,verifies=0,clients=0;
  const credential=createOidcCredential(config,{
    getVercelOidcToken:async()=>tokens[tokenCalls++],
    verifyVercelOidcToken:async(token,options)=>{verifies++;assert.equal(token,tokens[verifies-1]);assert.deepEqual(options,{issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,environment:'production'});return {payload:{iss:config.vercelIssuer,aud:config.vercelAudience,sub:config.subject,project_id:config.vercelProjectId}};},
    createClient:(value:any)=>{clients++;assert.equal(value.audience,config.gcpAudience);return {credentials:{expiry_date:Date.now()+60000},getAccessToken:async()=>{const subject=await value.subject_token_supplier.getSubjectToken();assert.equal(subject,tokens[clients-1]);return {token:`access-${clients}`};}};},
  });
  const first=await credential.getAccessToken();assert.equal(first.access_token,'access-1');assert.ok(first.expires_in>=59&&first.expires_in<=60);
  const second=await credential.getAccessToken();assert.equal(second.access_token,'access-2');assert.ok(second.expires_in>=59&&second.expires_in<=60);
  assert.equal(clients,2);assert.equal(tokenCalls,2);assert.equal(verifies,2);
});
test('shared limiter survives requests and concurrent requests cannot bypass the instance cap',async()=>{
  const {Readable}=await import('node:stream');
  const {Limiter}=await import('../../server/academic/handler');
  const {PILOT_VERCEL_SUBJECT}=await import('../../server/academic/sdk');
  const baseRuntime={...runtime(),rateLimit:1} as any;
  const admin={auth:{verifyIdToken:async()=>({uid:'user-1',aud:'optilab-cd829',iss:'https://securetoken.google.com/optilab-cd829',firebase:{sign_in_provider:'password'}})}};
  const service={execute:async()=>({ok:true})} as any;
  const makeReq=(body:string)=>{const q=Readable.from([Buffer.from(body)]) as any;Object.assign(q,{method:'POST',url:'/api/v1/roster',headers:{'content-type':'application/json',authorization:'Bearer token'},socket:{remoteAddress:'203.0.113.9',localPort:443},query:{operation:'roster'}});return q;};
  const makeRes=()=>{const headers:Record<string,any>={};let body='';return {headers,setHeader:(k:string,v:any)=>headers[k]=v,writeHead:(s:number,h:any={})=>Object.assign(headers,{statusCode:s},h),end:(v='')=>body=v,get status(){return Number(headers.statusCode??0);},get body(){return body;}};};
  const limiter=new Limiter(1),deps={runtime:baseRuntime,admin,service,limiter};
  const first=makeRes();await vercelHandler(makeReq('{}') as any,first as any,deps);assert.equal(first.status,200);
  const second=makeRes();await vercelHandler(makeReq('{}') as any,second as any,deps);assert.equal(second.status,429);
  const concurrentLimiter=new Limiter(1),concurrent=[makeRes(),makeRes()];await Promise.all(concurrent.map(res=>vercelHandler(makeReq('{}') as any,res as any,{...deps,limiter:concurrentLimiter})));
  assert.deepEqual(concurrent.map(res=>res.status).sort(),[200,429]);
  assert.ok(PILOT_VERCEL_SUBJECT.endsWith(':environment:production'));
});

test('OIDC verifier rejects wrong issuer, audience, project or subject before creating Google credentials',async()=>{
  const {createOidcCredential,PILOT_VERCEL_SUBJECT,PILOT_VERCEL_ISSUER,PILOT_VERCEL_AUDIENCE}=await import('../../server/academic/sdk');
  const config={projectNumber:'401863964479',serviceAccountEmail:'optilab-api@optilab-cd829.iam.gserviceaccount.com',poolId:'optilab-vercel',providerId:'optilab-vercel-oidc',vercelProjectId:'prj_test123',vercelIssuer:PILOT_VERCEL_ISSUER,vercelAudience:PILOT_VERCEL_AUDIENCE,gcpAudience:'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc',subject:PILOT_VERCEL_SUBJECT};
  for(const payload of [
    {iss:'https://oidc.vercel.com/other',aud:PILOT_VERCEL_AUDIENCE,sub:PILOT_VERCEL_SUBJECT,project_id:'prj_test123'},
    {iss:PILOT_VERCEL_ISSUER,aud:'https://vercel.com/other',sub:PILOT_VERCEL_SUBJECT,project_id:'prj_test123'},
    {iss:PILOT_VERCEL_ISSUER,aud:PILOT_VERCEL_AUDIENCE,sub:'owner:other:project:optilab-api:environment:production',project_id:'prj_test123'},
    {iss:PILOT_VERCEL_ISSUER,aud:PILOT_VERCEL_AUDIENCE,sub:'owner:optilab:project:other:environment:production',project_id:'prj_test123'},
    {iss:PILOT_VERCEL_ISSUER,aud:PILOT_VERCEL_AUDIENCE,sub:PILOT_VERCEL_SUBJECT,project_id:'prj_other'},
  ]){
    let created=0,access=false;
    const credential=createOidcCredential(config,{getVercelOidcToken:async()=> 'token',verifyVercelOidcToken:async()=>({payload}),createClient:(value:any)=>{created++;return {credentials:{},getAccessToken:async()=>{await value.subject_token_supplier.getSubjectToken();access=true;return {token:'access'};}};}});
    await assert.rejects(credential.getAccessToken(),/ACADEMIC_ENV_REJECTED/);assert.equal(created,1);assert.equal(access,false);
  }
});
test('actual @vercel/oidc verifier validates locally signed JWTs and rejects tampered, expired or wrong claims',async()=>{
  const {createRequire}=await import('node:module'),{EventEmitter}=await import('node:events'),{Readable}=await import('node:stream');
  const {generateKeyPair,exportJWK,SignJWT}=await import('jose');
  const {createOidcCredential,PILOT_VERCEL_SUBJECT,PILOT_VERCEL_ISSUER,PILOT_VERCEL_AUDIENCE}=await import('../../server/academic/sdk');
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk=await exportJWK(publicKey);jwk.kid='test-key';jwk.use='sig';jwk.alg='RS256';
  const jwks={keys:[jwk]};
  const https=createRequire(import.meta.url)('node:https'),originalGet=https.get;
  https.get=((_url:unknown,_options:unknown)=>{
    const req=new EventEmitter() as any;req.destroy=()=>{};req.setTimeout=()=>req;
    const res=Readable.from([Buffer.from(JSON.stringify(jwks))]) as any;res.statusCode=200;
    queueMicrotask(()=>req.emit('response',res));return req;
  }) as typeof https.get;
  const issue=async(claims:Record<string,unknown>,expiresIn:number|string='5m')=>new SignJWT(claims)
    .setProtectedHeader({alg:'RS256',kid:'test-key'}).setIssuedAt().setExpirationTime(expiresIn as any).sign(privateKey);
  const config={projectNumber:'401863964479',serviceAccountEmail:'optilab-api@optilab-cd829.iam.gserviceaccount.com',poolId:'optilab-vercel',providerId:'optilab-vercel-oidc',vercelProjectId:'prj_test123',vercelIssuer:PILOT_VERCEL_ISSUER,vercelAudience:PILOT_VERCEL_AUDIENCE,gcpAudience:'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc',subject:PILOT_VERCEL_SUBJECT};
  try{
    const {verifyVercelOidcToken}=await import('@vercel/oidc');
    const claims={iss:PILOT_VERCEL_ISSUER,aud:PILOT_VERCEL_AUDIENCE,sub:PILOT_VERCEL_SUBJECT,project_id:'prj_test123',environment:'production'};
    const valid=await issue(claims);
    assert.equal((await verifyVercelOidcToken(valid,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'})).payload.sub,PILOT_VERCEL_SUBJECT);
    let accesses=0;
    const credential=createOidcCredential(config,{
      getVercelOidcToken:async()=>valid,
      verifyVercelOidcToken:(token,options)=>verifyVercelOidcToken(token,options),
      createClient:(value:any)=>({credentials:{expiry_date:Date.now()+60000},getAccessToken:async()=>{accesses++;await value.subject_token_supplier.getSubjectToken();return {token:'access-local'};}}),
    });
    const localAccess=await credential.getAccessToken();assert.equal(localAccess.access_token,'access-local');assert.ok(localAccess.expires_in>=59&&localAccess.expires_in<=60);assert.equal(accesses,1);
    const tampered=valid.slice(0,-4)+'AAAA';
    await assert.rejects(verifyVercelOidcToken(tampered,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/signature|verification/i);
    const expired=await issue(claims,Math.floor(Date.now()/1000)-60);
    await assert.rejects(verifyVercelOidcToken(expired,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/expired|exp/i);
    const badIssuer=await issue({...claims,iss:'https://oidc.vercel.com/other'});
    await assert.rejects(verifyVercelOidcToken(badIssuer,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/issuer|claim/i);
    const badAudience=await issue({...claims,aud:'https://vercel.com/other'});
    await assert.rejects(verifyVercelOidcToken(badAudience,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/audience|claim/i);
    const badProject=await issue({...claims,project_id:'prj_other'});
    await assert.rejects(verifyVercelOidcToken(badProject,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/project_id|claim/i);
    const preview=await issue({...claims,environment:'preview'});
    await assert.rejects(verifyVercelOidcToken(preview,{issuer:PILOT_VERCEL_ISSUER,audience:PILOT_VERCEL_AUDIENCE,projectId:'prj_test123',environment:'production'}),/environment|claim/i);
  }finally{https.get=originalGet;}
});
