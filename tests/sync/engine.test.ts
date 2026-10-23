import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MemoryStorage} from '../../src/progress/storage';
import {ProgressEngine} from '../../src/progress/engine';
import {blankSnapshot,reconcile,type Operation,type Snapshot} from '../../src/progress/model';
import type {Transport} from '../../src/progress/transport';
const wait=async(fn:()=>boolean)=>{for(let i=0;!fn();i++){if(i>100)throw new Error('Timeout');await new Promise(r=>setTimeout(r,10));}};
const service=():Transport=>({watch(next){next(blankSnapshot());return ()=>{};},async commit(op){return reconcile(blankSnapshot(),op);}});
test('memory-only storage blocks destructive/import operations and still exports a recoverable file',async()=>{
  const e=new ProgressEngine('a',new MemoryStorage(),service(),100000,false);
  await assert.rejects(()=>e.importRaw('{}'),/respaldo local persistente/);
  await assert.rejects(()=>e.reset(),/respaldo local persistente/);
  const backup=await e.exportBackup();assert.equal(backup.ownerUid,'a');assert.equal(backup.checksum.length,64);e.dispose();
});
test('quota failure preserves pending changes in memory and export does not require another storage write',async()=>{
  class FullStorage extends MemoryStorage {override setItem(){throw new Error('Quota exceeded');}}
  const e=new ProgressEngine('a',new FullStorage(),service(),100000);e.start();
  e.change({...e.getSnapshot().progress,nickname:'Conservar en archivo'});
  assert.equal(e.getSnapshot().status,'error');assert.equal(e.getSnapshot().pending,1);
  assert.equal(JSON.parse((await e.exportBackup()).raw).nickname,'Conservar en archivo');e.dispose();
});
test('late completion and snapshot callbacks after logout cannot mutate B or erase A journal',async()=>{
  const storage=new MemoryStorage();let callback:(s:Snapshot)=>void=()=>{},finish:(s:Snapshot)=>void=()=>{};let sent:Operation|undefined;
  const slow:Transport={watch(next){callback=next;next(blankSnapshot());return ()=>{};},commit(op){sent=op;return new Promise(resolve=>{finish=resolve;});}};
  const a=new ProgressEngine('a',storage,slow,100000);a.start();await a.keepRemote();
  a.change({...a.getSnapshot().progress,nickname:'Solo A'});const flushing=a.flush();assert.ok(sent);
  a.dispose();const b=new ProgressEngine('b',storage,service(),100000);b.start();
  const committed=reconcile(blankSnapshot(),sent!);callback(committed);finish(committed);await flushing;
  assert.equal(b.getSnapshot().progress.nickname,'Entrenador OptiLab');assert.equal(b.getSnapshot().pending,0);
  assert.ok([...Array(storage.length)].map((_,i)=>storage.key(i)).some(k=>k?.includes(':a:op:')));b.dispose();
});
test('raw backup survives interruption before asynchronous checksum and is finalized on next session',async()=>{
  const storage=new MemoryStorage(),a=new ProgressEngine('a',storage,service(),100000);
  const raw='{"nickname":"Recuperación exacta"}',saving=a.backup(raw,'interrupción');a.dispose();await assert.rejects(()=>saving);
  const resumed=new ProgressEngine('a',storage,service(),100000);resumed.start();
  await wait(()=>resumed.getSnapshot().backups.length===1);
  assert.equal(resumed.getSnapshot().backups[0].raw,raw);resumed.dispose();
});
test('new edits during a discard backup abort the discard rather than deleting unbacked changes',async()=>{
  const remote={...blankSnapshot(),revision:1,fields:{nickname:{value:'Remoto',revision:1,operationId:crypto.randomUUID()}}};
  const e=new ProgressEngine('a',new MemoryStorage(),{watch(next){next(remote);return ()=>{};},async commit(op){return reconcile(remote,op);}},100000);e.start();
  await e.importRaw('{"nickname":"Local"}');assert.equal(e.getSnapshot().status,'conflict');
  const choosing=e.keepRemote();e.change({...e.getSnapshot().progress,avatarId:'avatar-02'});
  await assert.rejects(()=>choosing,/nuevos cambios/);assert.equal(e.getSnapshot().pending,2);e.dispose();
});
test('a foreign UID cache is never rendered or exported as this account and is not overwritten automatically',async()=>{
  const storage=new MemoryStorage(),raw=JSON.stringify({schemaVersion:2,uid:'a',snapshot:{...blankSnapshot(),
    fields:{nickname:{value:'Privado A',revision:1,operationId:crypto.randomUUID()}}},decision:'accepted'});
  storage.setItem('optilab-sync:v2:b:cache',raw);
  const b=new ProgressEngine('b',storage,service(),100000);b.start();
  assert.equal(b.getSnapshot().progress.nickname,'Entrenador OptiLab');assert.equal(b.getSnapshot().backups.length,0);
  assert.equal(storage.getItem('optilab-sync:v2:b:cache'),raw);
  await b.keepRemote();assert.equal(b.getSnapshot().progress.nickname,'Entrenador OptiLab');b.dispose();
});
test('a post-reset checkpoint keeps old journal bytes but never replays its pre-reset history',async()=>{
  const e=new ProgressEngine('a',new MemoryStorage(),service(),100000);e.start();await e.keepRemote();e.setOnline(false);
  e.change({...e.getSnapshot().progress,results:[{date:'2026-01-01T00:00:00.000Z',answers:[1,0,1,1,0],score:5}]});
  await e.reset();const checkpoint=await e.exportBackup();
  assert.equal(JSON.parse(checkpoint.raw).results.length,0);
  assert.ok(checkpoint.journal!.some(op=>Object.keys(op.diagnostics).length===1&&!op.restoreEligible));
  await e.restore(checkpoint);assert.equal(e.getSnapshot().progress.results.length,0);e.dispose();
});
test('same-browser actors share consent and durable review/ACK markers without bypassing import review',async()=>{
  const storage=new MemoryStorage();let remote:Snapshot={...blankSnapshot(),revision:1,fields:{nickname:{value:'Remoto',revision:1,operationId:crypto.randomUUID()}}};
  const listeners=new Set<(s:Snapshot)=>void>();let commits=0;
  const shared:Transport={watch(next){listeners.add(next);next(structuredClone(remote));return ()=>{listeners.delete(next);};},async commit(op){
    commits++;remote=reconcile(remote,op);for(const next of listeners)next(structuredClone(remote));return structuredClone(remote);
  }};
  const a=new ProgressEngine('a',storage,shared,100000),b=new ProgressEngine('a',storage,shared,100000);a.start();b.start();
  await a.importRaw('{"nickname":"Local"}');b.refreshLocal();assert.equal(b.getSnapshot().status,'conflict');
  await b.flush();assert.equal(commits,0);
  b.resolveLocal();a.refreshLocal();await a.flush();b.refreshLocal();
  assert.equal(commits,1);assert.equal(b.getSnapshot().pending,0);assert.equal(b.getSnapshot().progress.nickname,'Local');a.dispose();b.dispose();
});
test('an empty/rolled-back emulator never labels a newer owned cache synced or uploads it automatically',async()=>{
  const storage=new MemoryStorage();storage.setItem('optilab-sync:v2:a:cache',JSON.stringify({schemaVersion:2,uid:'a',decision:'accepted',
    snapshot:{...blankSnapshot(),revision:3,fields:{nickname:{value:'Cache propio',revision:3,operationId:crypto.randomUUID()}}}}));
  let commits=0;
  const e=new ProgressEngine('a',storage,{watch(next){next(blankSnapshot());return ()=>{};},async commit(op){commits++;return reconcile(blankSnapshot(),op);}},100000);e.start();
  assert.equal(e.getSnapshot().status,'error');assert.equal(e.getSnapshot().progress.nickname,'Cache propio');await e.flush();assert.equal(commits,0);
  await e.keepRemote();assert.equal(e.getSnapshot().progress.nickname,'Entrenador OptiLab');
  assert.equal(JSON.parse(e.getSnapshot().backups[0].raw).nickname,'Cache propio');e.dispose();
});
test('choosing remote for one import conflict preserves independent changes and their descendant causality',async()=>{
  let remote:Snapshot={...blankSnapshot(),revision:1,fields:{nickname:{value:'Remoto',revision:1,operationId:crypto.randomUUID()}}};
  let publish:(s:Snapshot)=>void=()=>{};
  const e=new ProgressEngine('a',new MemoryStorage(),{watch(next){publish=next;next(remote);return ()=>{};},async commit(op){remote=reconcile(remote,op);publish(structuredClone(remote));return remote;}},100000);e.start();
  await e.importRaw('{"nickname":"Local","avatarId":"avatar-02"}');
  e.change({...e.getSnapshot().progress,visited:[3]});e.change({...e.getSnapshot().progress,avatarId:'avatar-03'});
  await e.keepRemote();await e.flush();await e.flush();await e.flush();
  assert.equal(e.getSnapshot().progress.nickname,'Remoto');assert.equal(e.getSnapshot().progress.avatarId,'avatar-03');
  assert.deepEqual(e.getSnapshot().progress.visited,[3]);assert.equal(e.getSnapshot().status,'synced');e.dispose();
});
