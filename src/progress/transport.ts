import {getApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {connectFirestoreEmulator, getFirestore, memoryLocalCache, initializeFirestore,
  doc, collection, onSnapshot, query, limit, orderBy, runTransaction, serverTimestamp, Timestamp, getDocFromServer,
  type Firestore} from 'firebase/firestore';
import {authSettings} from '../auth/config';
import {logoutBlocked} from '../auth/sessionSignals';
import {syncAllowed} from './config';
import {productionSyncAllowed,productionSyncTarget} from './productionConfig';
import {validateSyncOperation} from './validation';
import {blankSnapshot, reconcile, type Field, type Snapshot, type Operation} from './model';

export interface Transport {
  watch(next:(s:Snapshot)=>void,error:(e:unknown)=>void):()=>void;
  commit(operation:Operation):Promise<Snapshot>;
}
const fromWire=(value:unknown):unknown=>value instanceof Timestamp?value.toDate().toISOString():Array.isArray(value)
  ?value.map(fromWire):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,fromWire(v)])):value;
function valueToWire(key:string,value:Field['value']):unknown {
  if(key.startsWith('practice--'))return value===null?null:Timestamp.fromDate(new Date(value as string));
  if(key.startsWith('milestone--')) {
    const m=value as import('../lib/evolutionRules').EvolutionMilestone;
    return {...m,unlockedAt:Timestamp.fromDate(new Date(m.unlockedAt)),practice:Object.fromEntries(m.practice.map(p=>[p.gameId,Timestamp.fromDate(new Date(p.practicedAt))]))};
  }
  return value;
}
function fieldFromWire(key:string,data:Record<string,unknown>):Field {
  let value=fromWire(data.value) as Field['value'];
  if(key.startsWith('milestone--')) {
    const m=value as unknown as {stage:2|3;ruleVersion:number;unlockedAt:string;practice:Record<string,string>};
    value={...m,practice:Object.entries(m.practice).map(([gameId,practicedAt])=>({gameId,practicedAt}))};
  }
  return {value,revision:data.revision as number,operationId:data.operationId as string};
}
/** Also used by integration tests, which supply actual Auth Emulator users. */
export function firestoreTransport(db:Firestore,uid:string,sessionValid:()=>boolean):Transport {
  if(db.app.options.projectId!=='demo-optilab-sync')throw new Error('Solo se admite el proyecto demo-optilab-sync.');
  return privateProgressTransport(db,uid,sessionValid);
}
function privateProgressTransport(db:Firestore,uid:string,sessionValid:()=>boolean):Transport {
  if(!uid||uid.length>128||uid.includes('/'))throw new Error('UID incompatible con el path privado.');
  let latest=blankSnapshot();
  const head=doc(db,`users/${uid}/sync/current`);
  const path=(epoch:number,name:string,id?:string)=>`users/${uid}/epochs/${epoch}/${name}${id?`/${id}`:''}`;
  return {
    watch(next,error) {
      if(!sessionValid())throw new Error('La sesión cambió antes de abrir el progreso.');
      let alive=true,epoch=-1,children:(()=>void)[]=[],ready=new Set<string>(),sequence=0;
      const emit=()=>{if(alive&&sessionValid()&&ready.size===3){latest.confirmed=true;next(structuredClone(latest));}};
      const fail=(e:unknown)=>{if(alive&&sessionValid())error(e);};
      const stop=onSnapshot(head,{includeMetadataChanges:true},async snapshot=>{
        if(!alive||!sessionValid()||snapshot.metadata.fromCache||snapshot.metadata.hasPendingWrites)return;
        const ticket=++sequence;
        const data=snapshot.data();
        if(data&&data.schemaVersion!==2){fail(new Error('Versión Cloud no compatible.'));return;}
        if(!data) {
          try {
            const legacy=await getDocFromServer(doc(db,`users/${uid}/progress/current`));
            if(!alive||!sessionValid()||ticket!==sequence)return;
            if(legacy.exists()){fail(Object.assign(new Error('Legacy v1 requires explicit migration'),{code:'sync/legacy-v1'}));return;}
          } catch(e) {fail(e);return;}
        }
        const currentEpoch=data?.epoch??1;
        latest={...latest,epoch:currentEpoch,revision:data?.revision??0};
        if(epoch!==currentEpoch) {
          children.forEach(f=>f()); ready=new Set(); epoch=currentEpoch;
          latest={...blankSnapshot(),epoch,revision:data?.revision??0};
          for(const [name,max] of [['fields',40],['diagnostics',30],['gameRuns',50]] as const) {
            const watchedEpoch=epoch;
            const q=name==='fields'?query(collection(db,path(epoch,name)),limit(max)):
              query(collection(db,path(epoch,name)),orderBy('date','desc'),limit(max));
            children.push(onSnapshot(q,{includeMetadataChanges:true},rows=>{
              if(!alive||!sessionValid()||epoch!==watchedEpoch||rows.metadata.fromCache||rows.metadata.hasPendingWrites)return;
              if(name==='fields')latest.fields=Object.fromEntries(rows.docs.map(d=>[d.id,fieldFromWire(d.id,d.data())]));
              else {
                const values=Object.fromEntries(rows.docs.map(d=>{
                  const {schemaVersion:_v,uid:_u,trust:_t,createdAt:_c,...payload}=d.data();
                  if(name==='gameRuns') {const {result,...rest}=payload;return [d.id,fromWire({...rest,...result})];}
                  return [d.id,fromWire(payload)];
                }));
                if(name==='diagnostics')latest.diagnostics=values as Snapshot['diagnostics']; else latest.runs=values as Snapshot['runs'];
              }
              ready.add(name);emit();
            },fail));
          }
        }
        emit();
      },fail);
      return ()=>{alive=false;stop();children.forEach(f=>f());};
    },
    async commit(op) {
      if(!sessionValid())throw new Error('La sesión cambió; no se enviaron estos cambios.');
      validateSyncOperation(op);
      let observedRevision=-1;
      for(let retry=0;;retry++) {
      try {return await runTransaction(db,async tx=>{
        if(!sessionValid())throw new Error('La sesión cambió.');
        const receiptEpoch=op.kind==='reset'||op.kind==='restore'?op.epoch+1:op.epoch;
        const receipt=doc(db,path(receiptEpoch,'receipts',op.kind==='import'?`i_${op.sourceHash}`:`o_${op.id}`));
        const [h,r]=await Promise.all([tx.get(head),tx.get(receipt)]);
        const hdata=h.data();
        const current={epoch:hdata?.epoch??1,revision:hdata?.revision??0};
        observedRevision=current.revision;
        let s:Snapshot={...(latest.epoch===current.epoch?structuredClone(latest):blankSnapshot()),...current,
          confirmed:latest.epoch===current.epoch&&latest.confirmed===true};
        if(r.exists())return s;
        // Reject before merging any old-path values into a new generation's view.
        if(s.epoch!==op.epoch)return reconcile(s,op); // throws an epoch conflict with the untouched current snapshot
        const fieldEntries=Object.entries(op.changes);
        const diagEntries=Object.entries(op.diagnostics),runEntries=Object.entries(op.runs);
        const writeEpoch=op.kind==='restore'?op.epoch+1:op.epoch;
        const refs=[...fieldEntries.map(([id])=>doc(db,path(writeEpoch,'fields',id))),
          ...diagEntries.map(([id])=>doc(db,path(writeEpoch,'diagnostics',id))),
          ...runEntries.map(([id])=>doc(db,path(writeEpoch,'gameRuns',id)))];
        const rows=await Promise.all(refs.map(ref=>tx.get(ref)));
        fieldEntries.forEach(([id],i)=>{if(rows[i].exists())s.fields[id]=fieldFromWire(id,rows[i].data()!);else delete s.fields[id];});
        let offset=fieldEntries.length;
        diagEntries.forEach(([id],i)=>{if(rows[offset+i].exists()) {
          const {schemaVersion:_v,uid:_u,trust:_t,createdAt:_c,...payload}=rows[offset+i].data()!;
          s.diagnostics[id]=fromWire(payload) as Snapshot['diagnostics'][string];
        }});
        offset+=diagEntries.length;
        runEntries.forEach(([id],i)=>{if(rows[offset+i].exists()) {
          const {schemaVersion:_v,uid:_u,trust:_t,createdAt:_c,result,...payload}=rows[offset+i].data()!;
          s.runs[id]=fromWire({...payload,...result}) as Snapshot['runs'][string];
        }});
        s=reconcile(s,op);
        if(!sessionValid())throw new Error('La sesión cambió.');
        tx.set(head,{schemaVersion:2,uid,epoch:s.epoch,revision:s.revision,
          createdAt:hdata?.createdAt??serverTimestamp(),updatedAt:serverTimestamp(),operationId:op.id});
        for(const [id] of fieldEntries)tx.set(doc(db,path(s.epoch,'fields',id)),{
          schemaVersion:2,uid,epoch:s.epoch,revision:s.revision,operationId:op.id,value:valueToWire(id,s.fields[id].value),
        });
        const common={schemaVersion:1,uid,trust:'self-reported',createdAt:serverTimestamp()};
        diagEntries.forEach(([id,data],i)=>{if(!rows[fieldEntries.length+i].exists())tx.set(doc(db,path(s.epoch,'diagnostics',id)),{
          ...common,...data,date:Timestamp.fromDate(new Date(data.date)),
        });});
        runEntries.forEach(([id,data],i)=>{if(!rows[fieldEntries.length+diagEntries.length+i].exists()) {
          const {gameId,runId,date,...result}=data;
          tx.set(doc(db,path(s.epoch,'gameRuns',id)),{...common,gameId,runId,date:Timestamp.fromDate(new Date(date)),result});
        }});
        tx.set(receipt,{schemaVersion:2,uid,epoch:s.epoch,kind:op.kind,operationId:op.id,sourceHash:op.sourceHash??'',createdAt:serverTimestamp()});
        return {...s,confirmed:true};
      },{maxAttempts:3});} catch(error) {
        // Emulator can report a Rules CAS race as permission-denied rather than
        // ABORTED. Retry only after proving the head advanced, never accept denial.
        if(retry>=2||!sessionValid()||!(error&&typeof error==='object'&&'code' in error&&error.code==='permission-denied'))throw error;
        const fresh=await getDocFromServer(head);
        if((fresh.data()?.revision??0)<=observedRevision)throw error;
      }
      }
    },
  };
}
let productionDb:Firestore|undefined;
export function createProductionTransport(uid:string):Transport {
  if(!productionSyncAllowed(import.meta.env??{},authSettings,typeof location==='undefined'?'':location.origin))
    throw new Error('Sincronización productiva desactivada o configuración incompatible.');
  const app=getApp('optilab-accounts'),auth=getAuth(app);
  if(app.options.projectId!==productionSyncTarget.projectId||app.options.authDomain!=='optilab-cd829.firebaseapp.com'||auth.emulatorConfig)
    throw new Error('La instancia Firebase no coincide con el destino productivo aprobado.');
  if(auth.currentUser?.uid!==uid||auth.currentUser.isAnonymous||logoutBlocked(uid))throw new Error('La identidad cambió antes de abrir el progreso.');
  // No persistent SDK cache: the existing journal/backups stay partitioned by UID.
  productionDb??=initializeFirestore(app,{localCache:memoryLocalCache()});
  return privateProgressTransport(productionDb,uid,()=>auth.currentUser?.uid===uid&&!auth.currentUser.isAnonymous&&!logoutBlocked(uid));
}
export function createProgressTransport(uid:string):Transport {
  if(syncAllowed(import.meta.env??{},authSettings,typeof location==='undefined'?'':location.hostname))return createEmulatorTransport(uid);
  return createProductionTransport(uid); // Revalidates every production gate before SDK access.
}
let emulatorDb:Firestore|undefined;
export function createEmulatorTransport(uid:string):Transport {
  // Recheck here, not only at the UI flag. Production cannot invoke this factory.
  if(!syncAllowed(import.meta.env,authSettings,location.hostname))throw new Error('Sincronización disponible solo con ambos emuladores explícitos.');
  const app=getApp('optilab-accounts'),auth=getAuth(app);
  if(app.options.projectId!=='demo-optilab-sync'||auth.emulatorConfig?.host!=='127.0.0.1'||auth.emulatorConfig.port!==9099)
    throw new Error('La instancia Firebase activa no coincide con los emuladores autorizados. Recarga el entorno demo.');
  if(auth.currentUser?.uid!==uid||logoutBlocked(uid))throw new Error('La identidad cambió antes de abrir el progreso.');
  if(!emulatorDb) {
    emulatorDb=initializeFirestore(app,{localCache:memoryLocalCache()});
    connectFirestoreEmulator(emulatorDb,'127.0.0.1',8085);
  }
  return firestoreTransport(getFirestore(app),uid,()=>auth.currentUser?.uid===uid&&!logoutBlocked(uid));
}
