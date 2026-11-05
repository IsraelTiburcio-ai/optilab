import {createHash,timingSafeEqual} from 'node:crypto';
import {createOidcCredential,oidcConfig,type OidcConfig,type OidcCredentialDependencies} from './academic/sdk.js';

export type OidcSmokeStage='CONFIG'|'TOKEN'|'SIGNATURE'|'CLAIMS'|'STS'|'IMPERSONATION'|'ACCESS_TOKEN'|'NETWORK'|'EXCHANGE';
export type OidcSmokeCode='OIDC_SMOKE_DISABLED'|'OIDC_SMOKE_MISCONFIGURED'|'OIDC_SMOKE_UNAUTHORIZED'|'OIDC_SMOKE_BAD_REQUEST'|'OIDC_SMOKE_METHOD'|
  'OIDC_TOKEN_UNAVAILABLE'|'OIDC_TOKEN_INVALID'|'OIDC_CLAIMS_MISMATCH'|'STS_REJECTED'|'IAM_IMPERSONATION_REJECTED'|
  'ACCESS_TOKEN_INVALID'|'GOOGLE_NETWORK_ERROR'|'GOOGLE_EXCHANGE_FAILED'|'OIDC_SMOKE_INTERNAL';
export interface OidcSmokeConfig {oidc:OidcConfig;secret:string}
export interface OidcSmokeDependencies extends OidcCredentialDependencies {now?:()=>number}
export interface OidcSmokeResult {
  ok:true;
  checks:{oidcToken:'PASS';signature:'PASS';claims:'PASS';sts:'PASS';impersonation:'PASS';accessToken:'PASS';academicBackend:'CLOSED'};
  claims:{issuer:string;audience:string;projectId:string;environment:'production';subject:string};
  accessTokenExpiresInSeconds:number;
  checkedAt:string;
}
export class OidcSmokeError extends Error {
  constructor(public code:OidcSmokeCode,public status:number,public stage:OidcSmokeStage) {super(code);this.name='OidcSmokeError';}
}
function digest(value:string):Buffer {return createHash('sha256').update(value,'utf8').digest();}
export function oidcSmokeConfig(env:NodeJS.ProcessEnv=process.env):OidcSmokeConfig {
  if(env.OIDC_SMOKE_ENABLED!=='true'||env.VERCEL_ENV!=='production'||env.NODE_ENV!=='production'||
    env.ACADEMIC_ADMIN_MODE!=='off'||env.ACADEMIC_PRODUCTION_ENABLED==='true'||
    env.FIREBASE_AUTH_EMULATOR_HOST||env.FIRESTORE_EMULATOR_HOST)throw new OidcSmokeError('OIDC_SMOKE_DISABLED',404,'CONFIG');
  const secret=env.OIDC_SMOKE_TOKEN??'';
  if(Buffer.byteLength(secret,'utf8')<32||Buffer.byteLength(secret,'utf8')>256)throw new OidcSmokeError('OIDC_SMOKE_MISCONFIGURED',503,'CONFIG');
  let oidc:OidcConfig;
  try{oidc=oidcConfig(env);}catch{throw new OidcSmokeError('OIDC_SMOKE_MISCONFIGURED',503,'CONFIG');}
  return {oidc,secret};
}
export function authorizedSmokeRequest(header:string|undefined,secret:string):boolean {
  if(typeof header!=='string'||!header.startsWith('Bearer '))return false;
  const supplied=header.slice(7);
  if(Buffer.byteLength(supplied,'utf8')<32)return false;
  return timingSafeEqual(digest(supplied),digest(secret));
}
function exchangeFailure(error:unknown):OidcSmokeError {
  if(error instanceof Error&&error.message==='ACADEMIC_ENV_REJECTED')return new OidcSmokeError('ACCESS_TOKEN_INVALID',502,'ACCESS_TOKEN');
  const value=error as {response?:{config?:{url?:string}};config?:{url?:string};code?:string};
  const url=String(value.response?.config?.url??value.config?.url??'');
  if(url.includes('sts.googleapis.com'))return new OidcSmokeError('STS_REJECTED',502,'STS');
  if(url.includes('iamcredentials.googleapis.com'))return new OidcSmokeError('IAM_IMPERSONATION_REJECTED',502,'IMPERSONATION');
  if(value.code&&/^(ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ECONNREFUSED|UND_ERR_)/.test(value.code))return new OidcSmokeError('GOOGLE_NETWORK_ERROR',503,'NETWORK');
  return new OidcSmokeError('GOOGLE_EXCHANGE_FAILED',502,'EXCHANGE');
}
export async function runOidcSmoke(config:OidcConfig,deps:OidcSmokeDependencies):Promise<OidcSmokeResult> {
  const now=deps.now??Date.now;
  let token:string;
  try{token=await deps.getVercelOidcToken({audience:config.vercelAudience});}catch{throw new OidcSmokeError('OIDC_TOKEN_UNAVAILABLE',502,'TOKEN');}
  if(!token)throw new OidcSmokeError('OIDC_TOKEN_UNAVAILABLE',502,'TOKEN');
  let verified:{payload:{iss?:string;aud?:string;sub?:string;project_id?:string;environment?:string}};
  try{verified=await deps.verifyVercelOidcToken(token,{issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,environment:'production'});}
  catch{throw new OidcSmokeError('OIDC_TOKEN_INVALID',502,'SIGNATURE');}
  const payload=verified.payload;
  if(payload.iss!==config.vercelIssuer||payload.aud!==config.vercelAudience||payload.sub!==config.subject||payload.project_id!==config.vercelProjectId||payload.environment!=='production')
    throw new OidcSmokeError('OIDC_CLAIMS_MISMATCH',502,'CLAIMS');
  const credential=createOidcCredential(config,{
    getVercelOidcToken:async()=>token,
    verifyVercelOidcToken:async()=>verified,
    createClient:deps.createClient,
  });
  let access:{access_token:string;expires_in:number};
  try{access=await credential.getAccessToken();}catch(error){throw exchangeFailure(error);}
  if(!access.access_token||!Number.isFinite(access.expires_in)||access.expires_in<=0||access.expires_in>3600)
    throw new OidcSmokeError('ACCESS_TOKEN_INVALID',502,'ACCESS_TOKEN');
  return {ok:true,
    checks:{oidcToken:'PASS',signature:'PASS',claims:'PASS',sts:'PASS',impersonation:'PASS',accessToken:'PASS',academicBackend:'CLOSED'},
    claims:{issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,environment:'production',subject:config.subject},
    accessTokenExpiresInSeconds:Math.floor(access.expires_in),checkedAt:new Date(now()).toISOString()};
}
