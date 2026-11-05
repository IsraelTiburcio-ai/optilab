import {AsyncLocalStorage} from 'node:async_hooks';
import type {IncomingMessage} from 'node:http';
import {verifyVercelOidcToken} from '@vercel/oidc';

export interface RequestOidcExpectation {issuer:string;audience:string;projectId:string;subject:string;environment:'production'}
export interface RequestOidcPayload {iss?:string;aud?:string;sub?:string;project_id?:string;environment?:string}
export interface RequestOidcDependencies {
  verify:(token:string,options:{issuer:string;audience:string;projectId:string;environment:'production'})=>Promise<{payload:RequestOidcPayload}>;
}
const requestTokens=new AsyncLocalStorage<string>();
const defaultDependencies:RequestOidcDependencies={verify:(token,options)=>verifyVercelOidcToken(token,options)};
export function oidcTokenFromRequest(req:Pick<IncomingMessage,'headers'>):string|undefined {
  const raw=req.headers['x-vercel-oidc-token'];
  if(typeof raw!=='string'||!raw||raw.length>8192)return undefined;
  return raw;
}
export function currentRequestOidcToken():string|undefined {return requestTokens.getStore();}
export function withRequestOidcToken<T>(token:string,task:()=>Promise<T>):Promise<T> {return requestTokens.run(token,task);}
async function matches(token:string,expected:RequestOidcExpectation,deps:RequestOidcDependencies):Promise<boolean> {
  try{
    const {payload}=await deps.verify(token,{issuer:expected.issuer,audience:expected.audience,projectId:expected.projectId,environment:expected.environment});
    return payload.iss===expected.issuer&&payload.aud===expected.audience&&payload.sub===expected.subject&&payload.project_id===expected.projectId&&payload.environment===expected.environment;
  }catch{return false;}
}
export async function verifiedRequestOidcToken(expected:RequestOidcExpectation,deps:RequestOidcDependencies=defaultDependencies):Promise<string> {
  const raw=currentRequestOidcToken();
  if(!raw)throw new Error('OIDC_TOKEN_UNAVAILABLE');
  if(!await matches(raw,expected,deps))throw new Error('OIDC_TOKEN_INVALID');
  return raw;
}
