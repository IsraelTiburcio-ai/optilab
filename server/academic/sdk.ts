import {localConfig,PROJECT} from './config.js';
import type {Auth} from 'firebase-admin/auth';
import type {App,Credential} from 'firebase-admin/app';
import type {Firestore} from 'firebase-admin/firestore';
import {createConnection} from 'node:net';
import {verifiedRequestOidcToken} from '../vercel-oidc.js';
export type CredentialMode='none'|'service-account'|'oidc';
export const PILOT_VERCEL_SUBJECT='owner:optilab:project:optilab-api:environment:production';
export const PILOT_VERCEL_ISSUER='https://oidc.vercel.com/optilab';
export const PILOT_VERCEL_AUDIENCE='https://vercel.com/optilab';
export interface OidcConfig {projectNumber:string;serviceAccountEmail:string;poolId:string;providerId:string;vercelProjectId:string;vercelIssuer:string;vercelAudience:string;gcpAudience:string;subject:string}
export interface OidcCredentialDependencies {
  getVercelOidcToken:(options:{audience:string})=>Promise<string>;
  verifyVercelOidcToken:(token:string,options:{issuer:string;audience:string;projectId:string;environment:'production'})=>Promise<{payload:{iss?:string;aud?:string;sub?:string;project_id?:string;environment?:string}}>;
  createClient:(config:Record<string,unknown>)=>unknown;
}
export interface EmulatorAdmin {
  db:Firestore;auth:Auth;
  time:()=>unknown; timestamp:(milliseconds:number)=>unknown;
  close:()=>Promise<void>;
}
const localDatabases=new WeakSet<Firestore>(),productionDatabases=new WeakSet<Firestore>();
export function assertEmulatedDatabase(db:Firestore) {if(!localDatabases.has(db)||db.databaseId!=='(default)')throw new Error('ACADEMIC_ENV_REJECTED');}
export function assertProductionDatabase(db:Firestore) {if(!productionDatabases.has(db)||db.databaseId!=='(default)')throw new Error('ACADEMIC_ENV_REJECTED');}
export async function emulatorAdmin():Promise<EmulatorAdmin> {
  localConfig(process.env);
  await Promise.all([9099,8085].map(port=>new Promise<void>((resolve,reject)=>{
    const socket=createConnection({host:'127.0.0.1',port});
    const fail=()=>{socket.destroy();reject(new Error('ACADEMIC_EMULATORS_UNAVAILABLE'));};
    socket.setTimeout(1500,fail);socket.once('error',fail);socket.once('connect',()=>{socket.destroy();resolve();});
  })));
  const [{initializeApp,deleteApp},{getAuth},{Firestore,FieldValue,Timestamp},{GoogleAuth,PassThroughClient}]=await Promise.all([
    import('firebase-admin/app'),import('firebase-admin/auth'),import('firebase-admin/firestore'),import('google-auth-library'),
  ]);
  localConfig(process.env); // No TOCTOU reuse of a caller-provided config object.
  const app=initializeApp({projectId:PROJECT,credential:{getAccessToken:async()=>({access_token:'owner',expires_in:3600})}},`academic-${crypto.randomUUID()}`);
  // The re-exported Firestore constructor avoids applicationDefault() discovery.
  // ssl:false + emulator host uses the SDK's local "owner" marker, never OAuth/ADC.
  // google-gax otherwise resolves the universe through getClient(), which can
  // search local ADC files and probe metadata even for an insecure emulator.
  const auth=new GoogleAuth({projectId:PROJECT,authClient:new PassThroughClient(),clientOptions:{universeDomain:'googleapis.com'}});
  const settings={projectId:PROJECT,host:'127.0.0.1:8085',ssl:false,preferRest:false,auth};
  const db=new Firestore(settings);
  db.settings(settings);
  localDatabases.add(db);
  return Object.freeze({db,auth:getAuth(app),time:()=>FieldValue.serverTimestamp(),timestamp:(n:number)=>Timestamp.fromMillis(n),
    close:async()=>{await db.terminate();await deleteApp(app);}});
}

export function credentialMode(env:NodeJS.ProcessEnv=process.env):CredentialMode {
  const mode=env.ACADEMIC_CREDENTIAL_MODE;
  if(mode==='oidc'||mode==='service-account'||mode==='none')return mode;
  return env.FIREBASE_SERVICE_ACCOUNT_JSON?'service-account':'none';
}
export function oidcConfig(env:NodeJS.ProcessEnv=process.env):OidcConfig {
  const projectNumber=env.GCP_PROJECT_NUMBER??'',serviceAccountEmail=env.GCP_SERVICE_ACCOUNT_EMAIL??'',poolId=env.GCP_WORKLOAD_IDENTITY_POOL_ID??'',providerId=env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID??'',subject=env.ACADEMIC_VERCEL_SUBJECT??'',vercelProjectId=env.VERCEL_PROJECT_ID??'',vercelIssuer=env.VERCEL_OIDC_ISSUER??'',vercelAudience=env.VERCEL_OIDC_AUDIENCE??'';
  if(!/^\d{6,20}$/.test(projectNumber)||!/^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(serviceAccountEmail)||
    !/^[A-Za-z0-9_-]{1,64}$/.test(poolId)||!/^[A-Za-z0-9_-]{1,64}$/.test(providerId)||
    !/^prj_[A-Za-z0-9]+$/.test(vercelProjectId)||vercelIssuer!==PILOT_VERCEL_ISSUER||vercelAudience!==PILOT_VERCEL_AUDIENCE||
    subject!==PILOT_VERCEL_SUBJECT)throw new Error('ACADEMIC_ENV_REJECTED');
  const gcpAudience=`//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
  return Object.freeze({projectNumber,serviceAccountEmail,poolId,providerId,vercelProjectId,vercelIssuer,vercelAudience,gcpAudience,subject});
}
export function createOidcCredential(config:OidcConfig,deps:OidcCredentialDependencies):Credential {
  const supplier=async()=>{
    const token=await deps.getVercelOidcToken({audience:config.vercelAudience});
    const verified=await deps.verifyVercelOidcToken(token,{issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,environment:'production'});
    if(verified.payload.iss!==config.vercelIssuer||verified.payload.aud!==config.vercelAudience||verified.payload.sub!==config.subject||verified.payload.project_id!==config.vercelProjectId)throw new Error('ACADEMIC_ENV_REJECTED');
    return token;
  };
  return {getAccessToken:async()=>{
    const client=await deps.createClient({type:'external_account',audience:config.gcpAudience,
      subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url:`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
      subject_token_supplier:{getSubjectToken:supplier}}) as {getAccessToken:()=>Promise<{token?:string|null}>;credentials:{expiry_date?:number}};
    if(!client)throw new Error('ACADEMIC_ENV_REJECTED');
    const result=await client.getAccessToken();if(!result.token)throw new Error('ACADEMIC_ENV_REJECTED');
    const expiry=client.credentials.expiry_date;return {access_token:result.token,expires_in:expiry?Math.max(1,Math.floor((expiry-Date.now())/1000)):3600};
  }};
}
export async function cleanupProductionApp(app:App,db?:Firestore):Promise<void> {
  if(db){try{await db.terminate();}catch{}}
  try{const {deleteApp}=await import('firebase-admin/app');await deleteApp(app);}catch{}
}
export async function productionAdmin(projectId:string,mode:CredentialMode=credentialMode()):Promise<EmulatorAdmin> {
  if(process.env.ACADEMIC_PRODUCTION_ENABLED!=='true'||process.env.VERCEL_ENV!=='production'||
    projectId!=='optilab-cd829'||process.env.FIREBASE_AUTH_EMULATOR_HOST||process.env.FIRESTORE_EMULATOR_HOST||mode==='none')throw new Error('ACADEMIC_ENV_REJECTED');
  let credentialValue:unknown;
  if(mode==='oidc'){
    const config=oidcConfig(process.env);
    const {ExternalAccountClient}=await import('google-auth-library');
    credentialValue=createOidcCredential(config,{getVercelOidcToken:options=>{if(options.audience!==config.vercelAudience)throw new Error('ACADEMIC_ENV_REJECTED');return verifiedRequestOidcToken({issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,subject:config.subject,environment:'production'});},
      verifyVercelOidcToken:(token,options)=>import('@vercel/oidc').then(({verifyVercelOidcToken})=>verifyVercelOidcToken(token,options)),
      createClient:config=>ExternalAccountClient.fromJSON(config as unknown as Parameters<typeof ExternalAccountClient.fromJSON>[0])});
  }else{
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw||raw.length>20000)throw new Error('ACADEMIC_ENV_REJECTED');
    let parsed:Record<string,unknown>;try{parsed=JSON.parse(raw);}catch{throw new Error('ACADEMIC_ENV_REJECTED');}
    if(parsed.project_id!==projectId||typeof parsed.private_key!=='string'||typeof parsed.client_email!=='string')throw new Error('ACADEMIC_ENV_REJECTED');
    const {cert}=await import('firebase-admin/app');credentialValue=cert(parsed as Parameters<typeof cert>[0]);
  }
  const [{initializeApp,deleteApp},{getAuth}]=await Promise.all([import('firebase-admin/app'),import('firebase-admin/auth')]);
  const app=initializeApp({projectId,credential:credentialValue as Credential},`academic-prod-${crypto.randomUUID()}`);
  let db:Firestore|undefined;
  let time:()=>unknown;
  let timestamp:(milliseconds:number)=>unknown;
  try{
    if(mode==='oidc'){
      const [{GoogleAuth,ExternalAccountClient},{Firestore,FieldValue,Timestamp}]=await Promise.all([
        import('google-auth-library'),import('@google-cloud/firestore'),
      ]);
      const config=oidcConfig(process.env);
      const external=ExternalAccountClient.fromJSON({type:'external_account',audience:config.gcpAudience,
        subject_token_type:'urn:ietf:params:oauth:token-type:jwt',token_url:'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url:`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
        subject_token_supplier:{getSubjectToken:()=>verifiedRequestOidcToken({issuer:config.vercelIssuer,audience:config.vercelAudience,projectId:config.vercelProjectId,subject:config.subject,environment:'production'})},
      } as unknown as Parameters<typeof ExternalAccountClient.fromJSON>[0]);
      if(!external)throw new Error('ACADEMIC_ENV_REJECTED');
      const authClient=new GoogleAuth({projectId,authClient:external});
      db=new Firestore({projectId,auth:authClient});
      time=()=>FieldValue.serverTimestamp();timestamp=(n:number)=>Timestamp.fromMillis(n);
    }else{
      const {getFirestore,FieldValue,Timestamp}=await import('firebase-admin/firestore');
      db=getFirestore(app);time=()=>FieldValue.serverTimestamp();timestamp=(n:number)=>Timestamp.fromMillis(n);
    }
    if(!db)throw new Error('ACADEMIC_ENV_REJECTED');
    productionDatabases.add(db);
    return Object.freeze({db,auth:getAuth(app),time,timestamp,
      close:async()=>{await db!.terminate();await deleteApp(app);}});
  }catch(error){
    await cleanupProductionApp(app,db);
    throw error;
  }
}
