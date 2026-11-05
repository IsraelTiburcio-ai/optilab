import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {IncomingMessage,ServerResponse} from 'node:http';
import smokeHandler from '../../api/internal/oidc-smoke';
import {authorizedSmokeRequest,oidcSmokeConfig,OidcSmokeError,runOidcSmoke} from '../../server/oidc-smoke';

const base:Record<string,string>={NODE_ENV:'production',VERCEL_ENV:'production',OIDC_SMOKE_ENABLED:'true',OIDC_SMOKE_TOKEN:'s'.repeat(48),
  ACADEMIC_ADMIN_MODE:'off',ACADEMIC_PRODUCTION_ENABLED:'false',
  GCP_PROJECT_NUMBER:'401863964479',GCP_SERVICE_ACCOUNT_EMAIL:'optilab-api@optilab-cd829.iam.gserviceaccount.com',
  GCP_WORKLOAD_IDENTITY_POOL_ID:'optilab-vercel',GCP_WORKLOAD_IDENTITY_PROVIDER_ID:'optilab-vercel-oidc',
  GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID:'optilab-vercel-oidc',VERCEL_PROJECT_ID:'prj_test123',
  VERCEL_OIDC_ISSUER:'https://oidc.vercel.com/optilab',VERCEL_OIDC_AUDIENCE:'https://vercel.com/optilab',
  ACADEMIC_VERCEL_SUBJECT:'owner:optilab:project:optilab-api:environment:production'};
const claims={iss:base.VERCEL_OIDC_ISSUER,aud:base.VERCEL_OIDC_AUDIENCE,sub:base.ACADEMIC_VERCEL_SUBJECT,project_id:base.VERCEL_PROJECT_ID,environment:'production'};
function codeOf(fn:()=>unknown):string|undefined {
  try{fn();return undefined;}catch(error){return error instanceof OidcSmokeError?error.code:undefined;}
}
function config(){return oidcSmokeConfig(base).oidc;}
function response(){
  const headers:Record<string,string|number|string[]>={};let body='';
  return {headers,setHeader:(k:string,v:string|number|string[])=>{headers[k]=v;},writeHead:(status:number,values:Record<string,string|number|string[]>={})=>{headers.statusCode=status;Object.assign(headers,values);},end:(value?:string)=>{body=value??'';},
    get status(){return Number(headers.statusCode??0);},get body(){return body;}};
}
function request(method='POST',headers:Record<string,string>={},url='/api/internal/oidc-smoke'):IncomingMessage {
  return {method,url,headers} as unknown as IncomingMessage;
}
function deps(overrides:Record<string,unknown>={}){
  return {
    getVercelOidcToken:async()=> 'oidc-token',
    verifyVercelOidcToken:async()=>({payload:claims}),
    createClient:(value:any)=>({credentials:{expiry_date:Date.now()+60000},getAccessToken:async()=>{const token=await value.subject_token_supplier.getSubjectToken();assert.equal(token,'oidc-token');return {token:'temporary-access-token'};}}),
    ...overrides,
  } as any;
}
test('smoke is disabled by default and requires closed academic configuration',()=>{
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,OIDC_SMOKE_ENABLED:'false'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,VERCEL_ENV:'preview'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,NODE_ENV:'development'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,ACADEMIC_ADMIN_MODE:'vercel-production'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,ACADEMIC_PRODUCTION_ENABLED:'true'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099'})),'OIDC_SMOKE_DISABLED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,OIDC_SMOKE_TOKEN:''})),'OIDC_SMOKE_MISCONFIGURED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,OIDC_SMOKE_TOKEN:'short'})),'OIDC_SMOKE_MISCONFIGURED');
  assert.equal(codeOf(()=>oidcSmokeConfig({...base,GCP_PROJECT_NUMBER:'bad'})),'OIDC_SMOKE_MISCONFIGURED');
  assert.equal(oidcSmokeConfig(base).oidc.gcpAudience,'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc');
});
test('smoke authorization uses a fixed independent secret and rejects malformed headers',()=>{
  const secret=base.OIDC_SMOKE_TOKEN;
  assert.equal(authorizedSmokeRequest(`Bearer ${secret}`,secret),true);
  assert.equal(authorizedSmokeRequest(`Bearer ${'x'.repeat(47)}`,secret),false);
  assert.equal(authorizedSmokeRequest(undefined,secret),false);
  assert.equal(authorizedSmokeRequest(`Basic ${secret}`,secret),false);
  assert.equal(authorizedSmokeRequest(`Bearer ${secret}extra`,secret),false);
});
test('smoke runner validates token, claims, STS, impersonation and returns no credentials',async()=>{
  let created=0,accesses=0;
  const result=await runOidcSmoke(config(),deps({createClient:(value:any)=>{created++;assert.equal(value.audience,'//iam.googleapis.com/projects/401863964479/locations/global/workloadIdentityPools/optilab-vercel/providers/optilab-vercel-oidc');return {credentials:{expiry_date:Date.now()+60000},getAccessToken:async()=>{accesses++;await value.subject_token_supplier.getSubjectToken();return {token:'temporary-access-token'};}};}}));
  assert.deepEqual(result.checks,{oidcToken:'PASS',signature:'PASS',claims:'PASS',sts:'PASS',impersonation:'PASS',accessToken:'PASS',academicBackend:'CLOSED'});
  assert.equal(result.claims.subject,base.ACADEMIC_VERCEL_SUBJECT);assert.ok(result.accessTokenExpiresInSeconds>=59&&result.accessTokenExpiresInSeconds<=60);assert.equal(created,1);assert.equal(accesses,1);
  const serialized=JSON.stringify(result);assert.doesNotMatch(serialized,/temporary-access-token|oidc-token|eyJ/);assert.doesNotMatch(serialized,/access_token|Authorization/i);
});
test('smoke runner fails closed for token, signature, claims, STS, IAM, network and access-token errors',async()=>{
  const cases:[Record<string,unknown>,string][]=[
    [{getVercelOidcToken:async()=>{throw new Error('provider secret');}},'OIDC_TOKEN_UNAVAILABLE'],
    [{verifyVercelOidcToken:async()=>{throw new Error('signature');}},'OIDC_TOKEN_INVALID'],
    [{verifyVercelOidcToken:async()=>({payload:{...claims,iss:'https://oidc.vercel.com/other'}})},'OIDC_CLAIMS_MISMATCH'],
    [{verifyVercelOidcToken:async()=>({payload:{...claims,aud:'https://vercel.com/other'}})},'OIDC_CLAIMS_MISMATCH'],
    [{verifyVercelOidcToken:async()=>({payload:{...claims,sub:'owner:other:project:optilab-api:environment:production'}})},'OIDC_CLAIMS_MISMATCH'],
    [{verifyVercelOidcToken:async()=>({payload:{...claims,project_id:'prj_other'}})},'OIDC_CLAIMS_MISMATCH'],
    [{verifyVercelOidcToken:async()=>({payload:{...claims,environment:'preview'}})},'OIDC_CLAIMS_MISMATCH'],
    [{createClient:()=>{throw {response:{config:{url:'https://sts.googleapis.com/v1/token'}}};}},'STS_REJECTED'],
    [{createClient:()=>{throw {response:{config:{url:'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/x:generateAccessToken'}}};}},'IAM_IMPERSONATION_REJECTED'],
    [{createClient:()=>{throw {code:'ENOTFOUND'};}},'GOOGLE_NETWORK_ERROR'],
    [{createClient:()=>({credentials:{expiry_date:Date.now()+60000},getAccessToken:async()=>({token:''})})},'ACCESS_TOKEN_INVALID'],
  ];
  for(const [override,code] of cases){
    await assert.rejects(runOidcSmoke(config(),deps(override)),(error:unknown)=>error instanceof OidcSmokeError&&error.code===code);
  }
});
test('smoke handler rejects disabled, unauthorized, wrong method, query and body before Google',async()=>{
  const original={...process.env};
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;delete process.env.FIRESTORE_EMULATOR_HOST;
  try{
    Object.assign(process.env,base,{OIDC_SMOKE_ENABLED:'false'});
    const disabled=response();await smokeHandler(request('POST',{},'/api/internal/oidc-smoke?x=1'),disabled as unknown as ServerResponse);
    assert.equal(disabled.status,404);assert.equal(JSON.parse(disabled.body).error.code,'OIDC_SMOKE_DISABLED');
    Object.assign(process.env,base);
    const noHeader=response();await smokeHandler(request('POST',{'authorization':`Bearer ${base.OIDC_SMOKE_TOKEN}`}),noHeader as unknown as ServerResponse);
    assert.equal(noHeader.status,502);assert.equal(JSON.parse(noHeader.body).error.code,'OIDC_TOKEN_UNAVAILABLE');
    assert.doesNotMatch(noHeader.body,/Bearer|oidc-token|temporary-access-token/);
    const unauthorized=response();await smokeHandler(request('POST'),unauthorized as unknown as ServerResponse);
    assert.equal(unauthorized.status,401);assert.equal(JSON.parse(unauthorized.body).error.code,'OIDC_SMOKE_UNAUTHORIZED');
    const method=response();await smokeHandler(request('GET',{'authorization':`Bearer ${base.OIDC_SMOKE_TOKEN}`}),method as unknown as ServerResponse);
    assert.equal(method.status,405);assert.equal(method.headers.Allow,'POST');
    const query=response();await smokeHandler(request('POST',{'authorization':`Bearer ${base.OIDC_SMOKE_TOKEN}`},'/api/internal/oidc-smoke?x=1'),query as unknown as ServerResponse);
    assert.equal(query.status,400);assert.equal(JSON.parse(query.body).error.code,'OIDC_SMOKE_BAD_REQUEST');
    const body=response();await smokeHandler(request('POST',{'authorization':`Bearer ${base.OIDC_SMOKE_TOKEN}`,'content-length':'1'}),body as unknown as ServerResponse);
    assert.equal(body.status,400);assert.equal(JSON.parse(body.body).error.code,'OIDC_SMOKE_BAD_REQUEST');
    for(const res of [disabled,unauthorized,method,query,body]){assert.equal(res.headers['Access-Control-Allow-Origin'],undefined);assert.doesNotMatch(res.body,/Bearer|oidc-token|temporary-access-token/);}
    Object.assign(process.env,base,{VERCEL_ENV:'preview'});
    const preview=response();await smokeHandler(request('POST',{'authorization':`Bearer ${base.OIDC_SMOKE_TOKEN}`}),preview as unknown as ServerResponse);
    assert.equal(preview.status,404);
  }finally{process.env=original;}
});
test('smoke endpoint is bounded in Vercel and source contains no token literal',()=>{
  const config=JSON.parse(readFileSync('vercel.json','utf8'));
  assert.equal(config.functions['api/internal/oidc-smoke.ts'].maxDuration,15);
  const source=readFileSync('api/internal/oidc-smoke.ts','utf8');
  assert.doesNotMatch(source,/private_key|service_account|firebase-tools/);
  assert.match(source,/runOidcSmoke/);
});
