export const PROJECT='demo-optilab-sync';
export interface LocalConfig {projectId:typeof PROJECT;host:'127.0.0.1';port:number;rateLimit:number;maxTtlSeconds:number}
/** Pure and synchronous. Must run before importing/initializing privileged SDKs. */
export function localConfig(env:NodeJS.ProcessEnv):LocalConfig {
  const incompatible=Object.entries(env).some(([key,value])=>!!value&&(
    /CREDENTIAL|PRIVATE_KEY|SERVICE_ACCOUNT|FIREBASE_TOKEN/i.test(key)||
    ['FIREBASE_CONFIG','GCE_METADATA_HOST','GCE_METADATA_IP','GOOGLE_CLOUD_QUOTA_PROJECT','K_SERVICE','FUNCTION_TARGET','FUNCTION_NAME','GAE_SERVICE','GRPC_TRACE','GRPC_VERBOSITY'].includes(key)));
  if(incompatible||env.NODE_ENV!=='development'||env.ACADEMIC_ADMIN_MODE!=='emulator'||
    env.ACADEMIC_ADMIN_HOST!=='127.0.0.1'||env.ACADEMIC_ADMIN_PROJECT!==PROJECT||
    env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099'||env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085'||
    [env.GCLOUD_PROJECT,env.GOOGLE_CLOUD_PROJECT,env.GCP_PROJECT,env.FIREBASE_PROJECT_ID,env.VITE_FIREBASE_PROJECT_ID].some(v=>!!v&&v!==PROJECT))throw new Error('ACADEMIC_ENV_REJECTED');
  const port=Number(env.ACADEMIC_ADMIN_PORT??5200),rateLimit=Number(env.ACADEMIC_RATE_LIMIT??60),maxTtlSeconds=Number(env.ACADEMIC_MAX_TTL_SECONDS??604800);
  if(!Number.isInteger(port)||port<0||port>65535||!Number.isInteger(rateLimit)||rateLimit<1||rateLimit>10000||
    !Number.isInteger(maxTtlSeconds)||maxTtlSeconds<1||maxTtlSeconds>604800)throw new Error('ACADEMIC_ENV_REJECTED');
  return Object.freeze({projectId:PROJECT,host:'127.0.0.1',port,rateLimit,maxTtlSeconds});
}
