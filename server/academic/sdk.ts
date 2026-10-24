import {localConfig,PROJECT} from './config';
import type {Auth} from 'firebase-admin/auth';
import type {Firestore} from 'firebase-admin/firestore';
import {createConnection} from 'node:net';
export interface EmulatorAdmin {
  db:Firestore;auth:Auth;
  time:()=>unknown; timestamp:(milliseconds:number)=>unknown;
  close:()=>Promise<void>;
}
const localDatabases=new WeakSet<Firestore>();
export function assertEmulatedDatabase(db:Firestore) {if(!localDatabases.has(db)||db.databaseId!=='(default)')throw new Error('ACADEMIC_ENV_REJECTED');}
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
