import {admissionAllowed,admissionWatch} from '../progress/admissionSignal';
import {syncMode} from '../progress/config';
import type {Ledger} from './model';
import {collection,doc,onSnapshot,query,limit,runTransaction,serverTimestamp,type Firestore} from 'firebase/firestore';
import {attemptId,AttemptConflict,mergeLedgers,validateLedger,type AttemptTransport} from './cloudModel';
import {createAttemptChannel} from '../progress/transport';
import {empty,type Attempt} from './model';
/** Explicit database injected only by gated factories or isolated emulator tests. */
function privateAttemptTransport(db:Firestore,uid:string,valid:()=>boolean):AttemptTransport{
 if(!['demo-optilab-sync','optilab-cd829'].includes(db.app.options.projectId??'')||!uid||uid.includes('/'))throw Error('Destino de intentos inválido');
 const channel=collection(db,`users/${uid}/reportedAttempts`);
 return {
  watch(next,error){if(!valid())throw Error('Sesión obsoleta');return onSnapshot(query(channel,limit(2000)),{includeMetadataChanges:true},snapshot=>{
   if(!valid()||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
   try{if(snapshot.size===2000)throw Error('Historial Cloud en el límite: pausa y solicita exportación al operador.');const ledger=empty();for(const row of snapshot.docs){const {uid:owner,serverReceivedAt:_time,...event}=row.data();if(owner!==uid||row.id!==attemptId(event as Attempt))throw Error('Registro remoto incompatible');ledger.entries.push(event as Attempt);}next(validateLedger(ledger));}catch(e){error(e);}
  },error);},
  async put(event){validateLedger({version:1,entries:[event]});if(!valid())throw Error('Sesión obsoleta');const ref=doc(channel,attemptId(event));await runTransaction(db,async tx=>{
   const previous=await tx.get(ref);if(!valid())throw Error('Sesión obsoleta');
   if(previous.exists()){const {uid:_uid,serverReceivedAt:_time,...old}=previous.data();try{mergeLedgers({version:1,entries:[old as Attempt]},{version:1,entries:[event]});}catch{throw new AttemptConflict();}return;}
   tx.set(ref,{...event,uid,serverReceivedAt:serverTimestamp()});
  });}
 };
}

export function attemptTransport(db:Firestore,uid:string,valid:()=>boolean):AttemptTransport{
 if(db.app.options.projectId!=='demo-optilab-sync')throw Error('Solo se admite el proyecto demo en el constructor de pruebas');
 return privateAttemptTransport(db,uid,valid);
}
export function createCloudAttemptTransport(uid:string):AttemptTransport{const create=()=>{const {db,valid}=createAttemptChannel(uid);return privateAttemptTransport(db,uid,valid);};if(syncMode!=='production')return create();return {watch:(next,error)=>admissionWatch<Ledger>(uid,create,next,error),put:event=>{if(!admissionAllowed(uid))return Promise.reject(Error('Admisión pausada; conserva el historial local.'));return create().put(event);}};}
