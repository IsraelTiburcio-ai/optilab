import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getVercelOidcToken} from '@vercel/oidc';
import {currentRequestOidcToken,oidcTokenFromRequest,verifiedRequestOidcToken,withRequestOidcToken} from '../../server/vercel-oidc';

const expected={issuer:'https://oidc.vercel.com/optilab',audience:'https://vercel.com/optilab',projectId:'prj_test123',subject:'owner:optilab:project:optilab-api:environment:production',environment:'production' as const};
const claims={iss:expected.issuer,aud:expected.audience,sub:expected.subject,project_id:expected.projectId,environment:'production'};
function dependencies(overrides:Record<string,unknown>={}){
  return {verify:async()=>({payload:claims}),...overrides} as any;
}
test('plain IncomingMessage header is not visible to getVercelOidcToken without Vercel request context',async()=>{
  const symbol=Symbol.for('@vercel/request-context');
  const previousContext=(globalThis as any)[symbol],previousToken=process.env.VERCEL_OIDC_TOKEN,previousFile=process.env.VERCEL_OIDC_TOKEN_FILE;
  delete (globalThis as any)[symbol];delete process.env.VERCEL_OIDC_TOKEN;delete process.env.VERCEL_OIDC_TOKEN_FILE;
  try{
    const raw='header-delivered-token';
    assert.equal(oidcTokenFromRequest({headers:{'x-vercel-oidc-token':raw}}),raw);
    await assert.rejects(getVercelOidcToken(),/header is missing/);
  }finally{
    if(previousContext===undefined)delete (globalThis as any)[symbol];else (globalThis as any)[symbol]=previousContext;
    if(previousToken===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=previousToken;
    if(previousFile===undefined)delete process.env.VERCEL_OIDC_TOKEN_FILE;else process.env.VERCEL_OIDC_TOKEN_FILE=previousFile;
  }
});
test('request header extraction rejects arrays, missing and oversized values',()=>{
  assert.equal(oidcTokenFromRequest({headers:{}}),undefined);
  assert.equal(oidcTokenFromRequest({headers:{'x-vercel-oidc-token':['a','b'] as any}}),undefined);
  assert.equal(oidcTokenFromRequest({headers:{'x-vercel-oidc-token':'x'.repeat(8193)}}),undefined);
  assert.equal(oidcTokenFromRequest({headers:{'x-vercel-oidc-token':'valid-header-token'}}),'valid-header-token');
});
test('request token resolution verifies the raw header and never exchanges it',async()=>{
  let verifies=0;
  const token=await withRequestOidcToken('raw-token',()=>verifiedRequestOidcToken(expected,{verify:async(value:string)=>{verifies++;assert.equal(value,'raw-token');return {payload:claims};}}));
  assert.equal(token,'raw-token');assert.equal(verifies,1);
  assert.equal(currentRequestOidcToken(),undefined);
});
test('request token resolution fails closed without a context or with wrong claims',async()=>{
  await assert.rejects(verifiedRequestOidcToken(expected),/OIDC_TOKEN_UNAVAILABLE/);
  await assert.rejects(withRequestOidcToken('raw-token',()=>verifiedRequestOidcToken(expected,{verify:async()=>({payload:{...claims,aud:'https://vercel.com/other'}})})),/OIDC_TOKEN_INVALID/);
  await assert.rejects(withRequestOidcToken('raw-token',()=>verifiedRequestOidcToken(expected,{verify:async()=>({payload:{...claims,sub:'owner:other:project:optilab-api:environment:production'}})})),/OIDC_TOKEN_INVALID/);
  await assert.rejects(withRequestOidcToken('raw-token',()=>verifiedRequestOidcToken(expected,{verify:async()=>{throw new Error('signature');}})),/OIDC_TOKEN_INVALID/);
});
test('sequential request contexts never reuse or mix the previous OIDC token',async()=>{
  const seen:string[]=[];
  const verify=async(token:string)=>{seen.push(token);return {payload:claims};};
  await withRequestOidcToken('request-one',()=>verifiedRequestOidcToken(expected,{verify}));
  await withRequestOidcToken('request-two',()=>verifiedRequestOidcToken(expected,{verify}));
  assert.deepEqual(seen,['request-one','request-two']);
  await assert.rejects(verifiedRequestOidcToken(expected,{verify}),/OIDC_TOKEN_UNAVAILABLE/);
});
test('AsyncLocalStorage keeps request tokens isolated under concurrency',async()=>{
  const first=withRequestOidcToken('token-a',async()=>{await new Promise(resolve=>setTimeout(resolve,10));return currentRequestOidcToken();});
  const second=withRequestOidcToken('token-b',async()=>{await new Promise(resolve=>setTimeout(resolve,5));return currentRequestOidcToken();});
  assert.deepEqual(await Promise.all([first,second]),['token-a','token-b']);
});
test('descendant async work cannot retrieve the token after the request context is invalidated',async()=>{
  let descendant!:Promise<string|undefined>;
  await withRequestOidcToken('request-token',async()=>{
    descendant=(async()=>{await new Promise(resolve=>setTimeout(resolve,5));return currentRequestOidcToken();})();
  });
  assert.equal(await descendant,undefined);
});
test('a pending verification cannot return a token after the request context closes',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  let pending!:Promise<string>;
  await withRequestOidcToken('request-token',async()=>{
    pending=verifiedRequestOidcToken(expected,{verify:async()=>{await gate;return {payload:claims};}});
  });
  const outcome=pending.catch(error=>error);
  release();
  const error=await outcome;
  assert.ok(error instanceof Error);assert.match(error.message,/OIDC_TOKEN_UNAVAILABLE/);
});
test('finishing one concurrent request does not invalidate the other request context',async()=>{
  let releaseA!:()=>void,releaseB!:()=>void;
  const gateA=new Promise<void>(resolve=>releaseA=resolve),gateB=new Promise<void>(resolve=>releaseB=resolve);
  const first=withRequestOidcToken('token-a',async()=>{await gateA;return currentRequestOidcToken();});
  const second=withRequestOidcToken('token-b',async()=>{await gateB;return currentRequestOidcToken();});
  releaseA();assert.equal(await first,'token-a');assert.equal(currentRequestOidcToken(),undefined);
  releaseB();assert.equal(await second,'token-b');
});
test('an expired token is rejected on every attempt and never reused',async()=>{
  let verifies=0;const verify=async()=>{verifies++;throw new Error('JWTExpired');};
  await assert.rejects(withRequestOidcToken('expired-token',()=>verifiedRequestOidcToken(expected,{verify})),/OIDC_TOKEN_INVALID/);
  await assert.rejects(withRequestOidcToken('expired-token',()=>verifiedRequestOidcToken(expected,{verify})),/OIDC_TOKEN_INVALID/);
  assert.equal(verifies,2);
});
test('smoke-style token resolution completes while the context is active and closes afterwards',async()=>{
  const token=await withRequestOidcToken('smoke-token',()=>verifiedRequestOidcToken(expected,{verify:async()=>({payload:claims})}));
  assert.equal(token,'smoke-token');assert.equal(currentRequestOidcToken(),undefined);
  await assert.rejects(verifiedRequestOidcToken(expected),/OIDC_TOKEN_UNAVAILABLE/);
});
