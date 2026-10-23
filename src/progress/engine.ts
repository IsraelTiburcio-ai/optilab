import {blankSnapshot, canonical, digest, emptyProgress, equal, fieldsOf, importProgress, optimistic,
  project, SyncConflict, type Snapshot, type Operation, type Progress, type Conflict, type Change} from './model';
import type {Transport} from './transport';

export interface BackupOperation extends Operation {restoreEligible:boolean}
export interface Backup {schemaVersion:2; ownerUid:string; source:string; createdAt:string; raw:string; checksum:string;
  journal?:BackupOperation[]; journalChecksum?:string; viewEpoch?:number}
export interface SyncView {
  progress:Progress; remoteProgress:Progress; comparison:{key:string;remote:unknown;local:unknown}[];
  reviewEpoch:number; fieldVersions:Record<string,number>;
  status:'local'|'pending'|'syncing'|'synced'|'offline'|'conflict'|'error';
  decision:'pending'|'accepted'|'cancelled'; ready:boolean; pending:number; conflict:Conflict|null;
  error:string; backups:Backup[];
}
/** UID-bound durable journal. Individual operation keys avoid whole-queue overwrite between tabs. */
export class ProgressEngine {
  private prefix:string;
  private remote=blankSnapshot();
  private decision:SyncView['decision']='pending';
  private ready=false;
  private online=true;
  private active=true;
  private busy=false;
  private error='';
  private conflict:Conflict|null=null;
  private conflictOperationId:string|null=null;
  private badCache=false;
  private rollback:Snapshot|null=null;
  private listeners=new Set<()=>void>();
  private timer:ReturnType<typeof setTimeout>|undefined;
  private stop:(()=>void)|undefined;
  private view!:SyncView;
  private volatile=new Map<string,Operation>();
  constructor(readonly uid:string,private storage:Storage,private transport:Transport,private delay=600,private durable=true) {
    this.prefix=`optilab-sync:v2:${encodeURIComponent(uid)}:`;
    try {
      const cache=JSON.parse(storage.getItem(this.prefix+'cache')||'null');
      if(cache) {
        if(cache.schemaVersion!==2||cache.uid!==uid||!cache.snapshot||!Number.isInteger(cache.snapshot.epoch)||cache.snapshot.epoch<1||cache.snapshot.epoch>1000000||
          !Number.isInteger(cache.snapshot.revision)||cache.snapshot.revision<0||cache.snapshot.revision>2147483647||
          !cache.snapshot.fields||Array.isArray(cache.snapshot.fields)||!cache.snapshot.diagnostics||Array.isArray(cache.snapshot.diagnostics)||!cache.snapshot.runs||Array.isArray(cache.snapshot.runs))throw new Error('Incompatible cache');
        project(cache.snapshot);
        this.remote=cache.snapshot;this.decision=cache.decision;this.conflict=cache.conflict??null;this.conflictOperationId=cache.conflictOperationId??null;
      }
      this.readDecision();
    } catch {this.badCache=true;this.error='Copia local incompatible. Se conserva sin sobrescribir; elige usar remoto o restaurar un respaldo tras revisar la cuenta.';}
    this.publish();
  }
  getSnapshot=()=>this.view;
  subscribe=(f:()=>void)=>{this.listeners.add(f);return ()=>{this.listeners.delete(f);};};
  start() {
    this.active=true;
    const drafts:string[]=[];
    for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i)!;if(key.startsWith(this.prefix+'recovery:'))drafts.push(key);}
    for(const key of drafts) {
      const draft=JSON.parse(this.storage.getItem(key)!);
      void this.backup(draft.raw,draft.source,draft.journal,draft.viewEpoch).then(()=>this.storage.removeItem(key)).catch(()=>{});
    }
    this.stop=this.transport.watch(s=>{
      if(!this.active)return;
      const behind=s.epoch<this.remote.epoch||(s.epoch===this.remote.epoch&&s.revision<this.remote.revision);
      if((!this.ready&&behind)||this.rollback) {
        const caughtUp=!behind&&Object.entries(this.remote.fields).every(([key,f])=>(s.fields[key]?.revision??0)>=f.revision);
        if(!caughtUp) {
          this.rollback=s;this.ready=true;this.error='Cloud reporta una versión anterior a la copia local. Exporta respaldo y elige usar remoto antes de reenviar.';this.publish();return;
        }
        this.rollback=null;this.error='';
      }
      this.mergeRemote(s);
      this.ready=true;this.persistCache();this.publish();this.schedule();
    },e=>{if(this.active){this.error=e&&typeof e==='object'&&'code' in e&&e.code==='sync/legacy-v1'
      ?'Se detectó progreso Cloud v1. No se convirtió ni sobrescribió: requiere una migración explícita del esquema.'
      :'No se pudo leer Cloud. Tu copia y operaciones locales se conservan; revisa permisos o conexión.';this.publish();}});
  }
  dispose() {this.active=false;this.stop?.();clearTimeout(this.timer);this.listeners.clear();}
  private mergeRemote(s:Snapshot) {
    if(s.confirmed===false)this.ready=false;
    if(s.epoch>this.remote.epoch) {
      void this.backupCurrent('cambio de generación').catch(()=>{});
      this.remote=s;
    } else if(s.epoch===this.remote.epoch) {
      const fields={...this.remote.fields};
      for(const [key,value] of Object.entries(s.fields))if(!fields[key]||value.revision>=fields[key].revision)fields[key]=value;
      this.remote={...s,revision:Math.max(s.revision,this.remote.revision),fields,
        diagnostics:{...this.remote.diagnostics,...s.diagnostics},runs:{...this.remote.runs,...s.runs}};
    }
  }
  setOnline(online:boolean) {if(!this.active)return;const reconnect=online&&!this.online;this.online=online;if(reconnect)this.error='';this.publish();if(online)this.schedule();}
  private readDecision() {
    const decision=this.storage.getItem(this.prefix+'decision');
    if(decision==='accepted'||decision==='pending'||decision==='cancelled')this.decision=decision;
  }
  private setDecision(decision:SyncView['decision']) {
    if(this.badCache) {
      const raw=this.storage.getItem(this.prefix+'cache');
      if(raw)this.storage.setItem(this.prefix+'quarantine:'+crypto.randomUUID(),raw);
      this.badCache=false;this.error='';
    }
    this.storage.setItem(this.prefix+'decision',decision);this.decision=decision;
  }
  refreshLocal() {if(this.active){this.readDecision();this.publish();this.schedule();}}
  private pending():Operation[] {
    const finished=(id:string)=>this.storage.getItem(this.prefix+'discard:'+id)||this.storage.getItem(this.prefix+'done:'+id);
    const found=new Map([...this.volatile].filter(([id])=>!finished(id)));
    for(let i=0;i<this.storage.length;i++) {
      const key=this.storage.key(i)!;
      if(key.startsWith(this.prefix+'op:')) {
        const op=JSON.parse(this.storage.getItem(key)!);
        if(!op||!op.id||!['edit','import','restore','reset'].includes(op.kind))throw new Error('Cola local incompatible; exporta el respaldo.');
        if(!finished(op.id))found.set(op.id,op);
      }
    }
    const result:Operation[]=[],children=new Map<string,Operation[]>();
    const ready=[...found.values()].filter(o=>!o.afterId||!found.has(o.afterId)).sort((a,b)=>a.id.localeCompare(b.id));
    for(const o of found.values())if(o.afterId&&found.has(o.afterId))children.set(o.afterId,[...(children.get(o.afterId)||[]),o]);
    while(ready.length) {const o=ready.shift()!;result.push(o);ready.push(...(children.get(o.id)||[]));ready.sort((a,b)=>a.id.localeCompare(b.id));}
    if(result.length!==found.size)throw new Error('Dependencia circular en la cola local.');
    return result;
  }
  private projected() {return this.pending().reduce(optimistic,this.remote);}
  private capture() {
    const pending=this.pending(),eligible=new Set<string>();let snapshot=this.remote;
    for(const op of pending) {
      const next=optimistic(snapshot,op);
      if(next!==snapshot){if(next.epoch!==snapshot.epoch)eligible.clear();eligible.add(op.id);}
      snapshot=next;
    }
    return {snapshot,journal:structuredClone(pending).map(op=>({...op,restoreEligible:eligible.has(op.id)}))};
  }
  private publish() {
    let pending:Operation[]=[];let progress=emptyProgress(),remoteProgress=emptyProgress();let backups:Backup[]=[];
    try {
      pending=this.pending();progress=project(pending.reduce(optimistic,this.remote));remoteProgress=project(this.remote);backups=this.backups();
      if(this.conflictOperationId&&!pending.some(o=>o.id===this.conflictOperationId)){this.conflict=null;this.conflictOperationId=null;}
      if(this.conflictOperationId) {
        const op=pending.find(o=>o.id===this.conflictOperationId);
        if(op&&this.storage.getItem(this.prefix+'resolved:'+op.id)===canonical(op)){this.conflict=null;this.conflictOperationId=null;}
      }
      if(!this.conflict) {
        const marked=pending.find(o=>this.storage.getItem(this.prefix+'review:'+o.id));
        if(marked){this.conflict=JSON.parse(this.storage.getItem(this.prefix+'review:'+marked.id)!);this.conflictOperationId=marked.id;}
      }
    }
    catch {this.error='No se pudo recuperar el almacenamiento de esta cuenta. No se enviarán cambios.';}
    const status:SyncView['status']=this.error?'error':this.conflict?'conflict':!this.online?'offline':
      this.decision!=='accepted'?'local':this.busy?'syncing':pending.length||!this.ready?'pending':'synced';
    const comparison=(this.conflict?.keys??[]).map(key=>{
      if(key.startsWith('run:')) {const id=key.slice(4);return {key,remote:this.remote.runs[id],local:pending.filter(p=>p.runs[id]).at(-1)?.runs[id]};}
      if(key.startsWith('diagnostic:')) {const id=key.slice(11);return {key,remote:this.remote.diagnostics[id],local:pending.filter(p=>p.diagnostics[id]).at(-1)?.diagnostics[id]};}
      return {key,remote:this.remote.fields[key]?.value??null,local:pending.filter(p=>p.changes[key]).at(-1)?.changes[key].value??null};
    });
    this.view={progress,remoteProgress,comparison,reviewEpoch:this.remote.epoch,
      fieldVersions:Object.fromEntries(Object.entries(this.remote.fields).map(([key,field])=>[key,field.revision])),
      status,decision:this.decision,ready:this.ready,pending:pending.length,conflict:this.conflict,error:this.error,backups};
    for(const listener of this.listeners)listener();
  }
  private persistCache() {
    if(this.badCache)return;
    try {this.storage.setItem(this.prefix+'cache',JSON.stringify({schemaVersion:2,uid:this.uid,snapshot:this.remote,decision:this.decision,conflict:this.conflict,conflictOperationId:this.conflictOperationId}));}
    catch {this.error='No se pudo guardar la copia local. Exporta un respaldo; no cierres esta pestaña.';}
  }
  private enqueue(op:Operation) {
    if(!this.active)return;
    this.volatile.set(op.id,op);
    try {this.storage.setItem(this.prefix+'op:'+op.id,JSON.stringify(op));}
    catch {this.error='Almacenamiento lleno o bloqueado. Cambios solo en memoria: exporta un respaldo y no cierres la pestaña.';}
    this.publish();this.schedule();
  }
  private discard(op:Operation) {
    this.storage.setItem(this.prefix+'discard:'+op.id,'1');
    this.storage.removeItem(this.prefix+'review:'+op.id);this.storage.removeItem(this.prefix+'resolved:'+op.id);
    this.storage.removeItem(this.prefix+'op:'+op.id);this.volatile.delete(op.id);
  }
  private operation(kind:Operation['kind']):Operation {
    const pending=this.pending();
    return {id:crypto.randomUUID(),epoch:this.projected().epoch,kind,afterId:pending.at(-1)?.id??null,changes:{},diagnostics:{},runs:{}};
  }
  captureBase(key:string):Omit<Change,'value'> {
    return {baseRevision:this.remote.fields[key]?.revision??0,predecessor:this.pending().filter(o=>o.changes[key]).at(-1)?.id??null};
  }
  change(next:Progress,bases:Record<string,Omit<Change,'value'>>={}) {
    if(!this.active)return;
    const before=this.view.progress,op=this.operation('edit'),values=fieldsOf(next),old=fieldsOf(before);
    const pending=this.pending();
    for(const [key,value] of Object.entries(values))if(!equal(old[key]??null,value)) {
      const prior=pending.filter(o=>o.epoch===op.epoch&&o.changes[key]).at(-1);
      op.changes[key]={value,...(bases[key]??{baseRevision:this.remote.fields[key]?.revision??0,predecessor:prior?.id??null})};
    }
    const previous=new Map<string,number>();for(const r of before.results)previous.set(canonical(r),(previous.get(canonical(r))||0)+1);
    for(const r of next.results) {
      const count=previous.get(canonical(r))||0;
      if(count)previous.set(canonical(r),count-1);else op.diagnostics[crypto.randomUUID()]=r;
    }
    for(const r of next.gameResults)if(!before.gameResults.some(p=>p.runId===r.runId))op.runs[r.runId]=r;
    if(Object.keys(op.changes).length||Object.keys(op.diagnostics).length||Object.keys(op.runs).length)this.enqueue(op);
  }
  private backupCurrent(source:string):Promise<Backup> {
    const {journal,snapshot}=this.capture();
    return this.backup(JSON.stringify(project(snapshot)),source,journal,snapshot.epoch);
  }
  async backup(raw:string,source:string,journal:BackupOperation[]=this.capture().journal,viewEpoch=this.projected().epoch):Promise<Backup> {
    if(!this.active)throw new Error('La sesión cambió.');
    const id=crypto.randomUUID(),draftKey=this.prefix+'recovery:'+id;
    // Persist raw bytes BEFORE asynchronous hashing, including across logout/termination.
    this.storage.setItem(draftKey,JSON.stringify({raw,source,journal,viewEpoch}));
    const [checksum,journalChecksum]=await Promise.all([digest(raw),digest(canonical({viewEpoch,journal}))]);
    if(!this.active)throw new Error('La sesión cambió.');
    const backup:Backup={schemaVersion:2,ownerUid:this.uid,source,createdAt:new Date().toISOString(),raw,checksum,journal,journalChecksum,viewEpoch};
    this.storage.setItem(this.prefix+'backup:'+id,JSON.stringify(backup));this.storage.removeItem(draftKey);
    this.publish();return backup;
  }
  backups():Backup[] {
    const result:Backup[]=[];
    for(let i=0;i<this.storage.length;i++) {
      const key=this.storage.key(i)!;if(key.startsWith(this.prefix+'backup:')) {
        const b=JSON.parse(this.storage.getItem(key)!);if(b.ownerUid===this.uid)result.push(b);
      }
    }
    return result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  }
  async importRaw(raw:string,restore=false,archive?:{journal:BackupOperation[];viewEpoch:number;diagnostics:Snapshot['diagnostics'];runs:Snapshot['runs']},expectedEpoch=this.remote.epoch) {
    if(!this.active)throw new Error('La sesión cambió.');
    if(!this.durable)throw new Error('La importación requiere respaldo local persistente. Exporta el original y habilita almacenamiento antes de importar.');
    const initialQueue=canonical(this.pending());
    // Backup precedes parsing and ALL remote mutation, including invalid legacy data.
    await this.backup(raw,restore?'origen de restauración':'invitado legado',archive?.journal??[],archive?.viewEpoch??this.remote.epoch);
    const progress=importProgress(raw),op=this.operation(restore&&this.remote.revision>0?'restore':'import');
    if(restore){op.epoch=expectedEpoch;op.afterId=null;}
    // Fingerprint the validated source, not newly derived milestone timestamps.
    op.sourceHash=await digest(canonical(JSON.parse(raw)));
    if(restore)await this.backupCurrent('antes de restaurar');
    if(!this.active)return;
    const values=fieldsOf(progress);
    for(const [key,value] of Object.entries(values)) {
      if(!restore&&key.startsWith('practice--')&&value===null)continue;
      const remote=this.remote.fields[key];
      // Imports merge additions; existing differing preferences require explicit review.
      const merged=!restore&&key.startsWith('practice--')&&typeof remote?.value==='string'&&typeof value==='string'
        ?[remote.value,value].sort()[0]:value;
      op.changes[key]={value:merged,baseRevision:remote?.revision??0,predecessor:null};
    }
    const counts=new Map<string,number>();
    for(const r of progress.results) {
      const hash=await digest(canonical(r)),ordinal=counts.get(hash)||0;counts.set(hash,ordinal+1);
      op.diagnostics[`d_${hash}_${ordinal}`]=r;
    }
    for(const r of progress.gameResults)op.runs[r.runId]=r;
    if(!this.active)return;
    if(archive) {
      // The visible diagnostic window has no IDs. Reuse original journal IDs when
      // its records match, rather than creating a second event under a legacy hash.
      const byValue=new Map<string,string[]>();
      for(const [id,data] of Object.entries(archive.diagnostics).sort(([a],[b])=>a.localeCompare(b)))byValue.set(canonical(data),[...(byValue.get(canonical(data))||[]),id]);
      for(const [id,data] of Object.entries({...op.diagnostics})) {
        const original=byValue.get(canonical(data))?.shift();
        if(original){delete op.diagnostics[id];op.diagnostics[original]=data;}
      }
      for(const [id,data] of Object.entries(archive.diagnostics))if(op.diagnostics[id]&&!equal(op.diagnostics[id],data))throw new Error('El respaldo contiene dos diagnósticos distintos con el mismo ID.');
      for(const [id,data] of Object.entries(archive.runs))if(op.runs[id]&&!equal(op.runs[id],data))throw new Error('El respaldo contiene dos partidas distintas con el mismo runId.');
    }
    if(restore) {
      if(this.remote.epoch!==expectedEpoch)throw new Error('La generación cambió mientras se preparaba la restauración. Revisa otra vez; no se descartó la cola.');
      if(canonical(this.pending())!==initialQueue)throw new Error('Hay nuevos cambios mientras se preparaba la restauración. Revisa otra vez; no se descartó la cola.');
      for(const pending of this.pending())this.discard(pending);
      this.conflict=null;this.conflictOperationId=null;this.error='';
    }
    this.setDecision('accepted');
    const keys=Object.keys(op.changes).filter(key=>!restore&&this.remote.fields[key]&&!equal(op.changes[key].value,this.remote.fields[key].value)&&
      (['nickname','route','avatarId','companionId'].includes(key)||(key.startsWith('practice--')&&this.remote.fields[key].value===null)));
    if(keys.length){this.conflict={kind:'field',keys,message:'El progreso remoto difiere del invitado. Revisa prácticas y preferencias antes de importar.'};this.conflictOperationId=op.id;
      this.storage.setItem(this.prefix+'review:'+op.id,JSON.stringify(this.conflict));}
    this.persistCache();
    this.enqueue(op);
    if(archive) {
      const diagnostics=Object.entries(archive.diagnostics).filter(([id])=>!op.diagnostics[id]);
      const runs=Object.entries(archive.runs).filter(([id])=>!op.runs[id]);
      while(diagnostics.length||runs.length) {
        const chunk=this.operation('edit');chunk.diagnostics=Object.fromEntries(diagnostics.splice(0,30));chunk.runs=Object.fromEntries(runs.splice(0,50));this.enqueue(chunk);
      }
    }
  }
  async restore(backup:Backup,expectedEpoch=this.remote.epoch) {
    if(!this.active)throw new Error('La sesión cambió.');
    if(backup.schemaVersion!==2||backup.ownerUid!==this.uid||typeof backup.raw!=='string'||await digest(backup.raw)!==backup.checksum)throw new Error('Respaldo incompatible, alterado o de otra cuenta.');
    const journal=backup.journal??[];
    const viewEpoch=backup.viewEpoch??1;
    if(!Array.isArray(journal)||!Number.isInteger(viewEpoch)||viewEpoch<1||viewEpoch>1000000||
      (backup.journal&&await digest(canonical({viewEpoch,journal}))!==backup.journalChecksum))throw new Error('El diario del respaldo fue alterado o no es compatible.');
    const diagnostics:Snapshot['diagnostics']={},runs:Snapshot['runs']={};
    for(const operation of journal) {
      if(!operation||!Number.isInteger(operation.epoch)||operation.epoch<1||operation.epoch>1000000||!['edit','import','reset','restore'].includes(operation.kind)||
        typeof operation.diagnostics!=='object'||!operation.diagnostics||Array.isArray(operation.diagnostics)||
        typeof operation.runs!=='object'||!operation.runs||Array.isArray(operation.runs))throw new Error('Diario de respaldo incompatible.');
      if(typeof operation.restoreEligible!=='boolean')throw new Error('El diario no identifica su generación activa.');
      const outputEpoch=operation.kind==='restore'||operation.kind==='reset'?operation.epoch+1:operation.epoch;
      if(!operation.restoreEligible||outputEpoch!==viewEpoch)continue; // Never replay pre-reset/stale operations into a post-reset checkpoint.
      for(const [id,data] of Object.entries(operation.diagnostics)) {
        if(!/^(?:[0-9a-f-]{36}|d_[0-9a-f]{64}_\d{1,2})$/.test(id))throw new Error('ID de diagnóstico incompatible.');
        const valid=importProgress(JSON.stringify({...emptyProgress(),results:[data]})).results[0];
        if(diagnostics[id]&&!equal(diagnostics[id],valid))throw new Error('Dos resultados distintos usan el mismo ID.');diagnostics[id]=valid;
      }
      for(const [id,data] of Object.entries(operation.runs)) {
        if(!data||typeof data!=='object'||id!==data.runId||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('ID de partida incompatible.');
        const valid=importProgress(JSON.stringify({...emptyProgress(),gameResults:[data]})).gameResults[0];
        if(runs[id]&&!equal(runs[id],valid))throw new Error('Dos partidas distintas usan el mismo runId.');runs[id]=valid;
      }
    }
    await this.importRaw(backup.raw,true,{journal,viewEpoch,diagnostics,runs},expectedEpoch);
  }
  async exportBackup():Promise<Backup> {
    const {journal,snapshot}=this.capture();
    return this.exportRaw(JSON.stringify(project(snapshot)),'exportación de cuenta',journal,snapshot.epoch);
  }
  async exportRaw(raw:string,source:string,journal:BackupOperation[]=[],viewEpoch=this.remote.epoch):Promise<Backup> {
    if(!this.active)throw new Error('La sesión cambió.');
    const [checksum,journalChecksum]=await Promise.all([digest(raw),digest(canonical({viewEpoch,journal}))]);
    if(!this.active)throw new Error('La sesión cambió.');
    return {schemaVersion:2,ownerUid:this.uid,source,createdAt:new Date().toISOString(),raw,checksum,journal,journalChecksum,viewEpoch};
  }
  reportError(message:string) {if(this.active){this.error=message;this.publish();}}
  async reset() {
    if(!this.active)return;
    if(!this.durable)throw new Error('No se reinicia sin respaldo local persistente.');
    const expectedEpoch=this.projected().epoch;
    const signature=canonical(this.pending());
    await this.backupCurrent('antes de reiniciar aventura');
    if(!this.active)return;
    if(canonical(this.pending())!==signature)throw new Error('Hay nuevos cambios mientras se preparaba el respaldo. Revisa otra vez; no se reinició la aventura.');
    if(this.remote.revision===0&&this.pending().length===0)return;
    this.enqueue({...this.operation('reset'),epoch:expectedEpoch});
  }
  async keepRemote(cancel=false) {
    if(!this.active)return;
    const pending=this.pending(),signature=canonical(pending);
    if(this.rollback||(this.conflict&&pending.length))await this.backupCurrent('cambios locales descartados por decisión');
    if(!this.active)return;
    if(canonical(this.pending())!==signature)throw new Error('Hay nuevos cambios mientras se preparaba el respaldo. Revisa otra vez; no se descartó la cola.');
    if(this.rollback) {
      for(const op of pending)this.discard(op);
      this.remote=this.rollback;this.rollback=null;
    } else if(this.conflict?.kind==='epoch') {
      for(const op of pending)if(op.epoch!==this.remote.epoch)this.discard(op);
    } else if(this.conflict) {
      const original=pending.find(o=>o.id===this.conflictOperationId);
      if(original) {
        const replacement=structuredClone(original);replacement.id=crypto.randomUUID();
        for(const key of this.conflict.keys) {
          if(key.startsWith('run:'))delete replacement.runs[key.slice(4)];
          else if(key.startsWith('diagnostic:'))delete replacement.diagnostics[key.slice(11)];
          else delete replacement.changes[key];
        }
        this.discard(original);
        if(Object.keys(replacement.changes).length||Object.keys(replacement.diagnostics).length||Object.keys(replacement.runs).length) {
          this.enqueue(replacement);
          for(const child of pending.filter(o=>o.id!==original.id)) {
            let changed=false;
            if(child.afterId===original.id){child.afterId=replacement.id;changed=true;}
            for(const [key,c] of Object.entries(child.changes))if(c.predecessor===original.id&&replacement.changes[key]){c.predecessor=replacement.id;changed=true;}
            if(changed){this.storage.setItem(this.prefix+'op:'+child.id,JSON.stringify(child));this.volatile.set(child.id,child);}
          }
        }
      }
    }
    this.conflict=null;this.conflictOperationId=null;this.error='';this.setDecision(cancel?'cancelled':'accepted');this.persistCache();this.publish();this.schedule();
  }
  resolveLocal(review:SyncView=this.view) {
    if(!this.active)return;
    if(this.conflict?.kind!=='field')return; // Never overwrite immutable history or silently cross a reset.
    if(review.reviewEpoch!==this.remote.epoch)return;
    const pending=this.pending();
    const op=pending.find(p=>p.id===this.conflictOperationId);
    if(op) {
      for(const key of this.conflict.keys)if(op.changes[key])op.changes[key].baseRevision=review.fieldVersions[key]??0;
      this.storage.setItem(this.prefix+'op:'+op.id,JSON.stringify(op));this.volatile.set(op.id,op);
      this.storage.setItem(this.prefix+'resolved:'+op.id,canonical(op));
      this.storage.removeItem(this.prefix+'review:'+op.id);
    }
    this.conflict=null;this.conflictOperationId=null;this.persistCache();this.publish();this.schedule();
  }
  retry() {if(!this.active)return;this.error='';this.ready=false;this.stop?.();this.start();this.publish();}
  private schedule() {
    clearTimeout(this.timer);
    if(this.active&&!this.busy&&this.online&&this.ready&&this.decision==='accepted'&&!this.error&&!this.conflict)
      this.timer=setTimeout(()=>void this.flush(),this.delay);
  }
  async flush() {
    this.readDecision();
    if(!this.active||this.busy||!this.online||!this.ready||this.decision!=='accepted'||this.error||this.conflict)return;
    const op=this.pending()[0];if(!op){this.publish();return;}
    const review=this.storage.getItem(this.prefix+'review:'+op.id);
    if(review){this.conflict=JSON.parse(review);this.conflictOperationId=op.id;this.publish();return;}
    this.busy=true;this.publish();
    try {
      const s=await this.transport.commit(op);
      if(!this.active)return;
      this.mergeRemote(s);
      this.storage.setItem(this.prefix+'done:'+op.id,'1');this.storage.removeItem(this.prefix+'review:'+op.id);this.storage.removeItem(this.prefix+'resolved:'+op.id);
      this.storage.removeItem(this.prefix+'op:'+op.id);this.volatile.delete(op.id);this.persistCache();
    } catch(e) {
      if(!this.active)return;
      if(e instanceof SyncConflict){this.storage.removeItem(this.prefix+'resolved:'+op.id);if(e.snapshot)this.mergeRemote(e.snapshot);this.conflict=e.conflict;this.conflictOperationId=op.id;this.persistCache();}
      else this.error='No se confirmó el envío. La operación sigue guardada; comprueba la conexión o permisos y reintenta.';
    } finally {this.busy=false;if(this.active){this.publish();this.schedule();}}
  }
}
