import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,readdir,readFile,lstat,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {checkUid,hash,planUid} from './plan.mjs';
export async function inventory(db,{maxDocuments=5000,maxBytes=20_000_000}={}) {
 const documents=[];let bytes=0;
 async function walk(collection){for(const ref of await collection.listDocuments()){
  const snap=await ref.get();if(snap.exists){const data=snap.data();bytes+=Buffer.byteLength(JSON.stringify(data));
   if(documents.length>=maxDocuments||bytes>maxBytes)throw Error('Inventory budget exceeded; completeness not certified');
   documents.push({path:ref.path,data,version:{seconds:snap.updateTime.seconds,nanoseconds:snap.updateTime.nanoseconds}});
  }for(const child of await ref.listCollections())await walk(child);
 }}
 for(const collection of await db.listCollections())await walk(collection);return documents;
}
export async function exportUid(db,uid,directory){
 const plan=planUid(checkUid(uid),await inventory(db));
 const payload={format:'optilab-private-export-v1',createdAt:new Date().toISOString(),uid,planHash:plan.hash,review:plan.review,documents:plan.documents,retained:plan.retainedDocuments};
 const archive={payload,digest:hash(payload)};await mkdir(directory,{recursive:true,mode:0o700});await privateDirectory(directory);
 const path=join(directory,`pilot-${hash(uid).slice(0,24)}-${randomUUID()}.json`);
 await writeFile(path,JSON.stringify(archive,null,2),{mode:0o600,flag:'wx'});return {path,digest:archive.digest,plan};
}
async function privateDirectory(directory){const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)throw Error('Private archive directory required (0700, no symlink)');}
export async function managedArchives(uid,directory){
 await privateDirectory(directory);
 const prefix=`pilot-${hash(uid).slice(0,24)}-`,files=[];
 for(const name of await readdir(directory)){if(!name.startsWith(prefix))continue;const path=join(directory,name),stat=await lstat(path);
  if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unsafe archive entry');
  const archive=JSON.parse(await readFile(path,'utf8'));
  if(archive.payload?.uid!==uid||archive.digest!==hash(archive.payload))throw Error('Archive integrity failed');files.push({path,archive});
 }return files;
}
export async function eraseUid(db,uid,{planHash,directory,Timestamp}){
 checkUid(uid);const archives=await managedArchives(uid,directory);
 let plan=planUid(uid,await inventory(db));
 if(plan.review.length||plan.hash!==planHash||!archives.some(f=>f.archive.payload.planHash===planHash))throw Error('Reviewed plan/export missing, stale, or shared references unresolved');
 // Fence first. Retain this minimal tombstone to reject old clients and prohibit re-admission.
 const ref=db.doc(`syncPilotMembers/${uid}`);await ref.set({version:1,uid,status:'erased',expiresAt:Timestamp.now(),updatedAt:Timestamp.now()});
 plan=planUid(uid,await inventory(db));if(plan.hash!==planHash||plan.review.length)throw Error('Data changed after fence; paused, no deletion attempted');
 for(const item of [...plan.documents].sort((a,b)=>b.path.split('/').length-a.path.split('/').length))
  await db.doc(item.path).delete({lastUpdateTime:new Timestamp(item.version.seconds,item.version.nanoseconds)});
 const remaining=planUid(uid,await inventory(db));if(remaining.owned.length||remaining.review.length)throw Error('Deletion incomplete; membership remains fenced');
 for(const file of archives)await unlink(file.path);
 if((await managedArchives(uid,directory)).length)throw Error('Managed archives remain');
 return {deleted:plan.documents.length,managedArchivesDeleted:archives.length,retained:remaining.retained,
  externalCopies:'UNVERIFIED: other devices, downloads, OS backups and provider backups require operator receipts',authAccount:'retained; separate authorization required'};
}
export async function admit(db,auth,uid,{Timestamp,days=7,maximum=5}={}){
 checkUid(uid);if(!Number.isInteger(days)||days<1||days>14)throw Error('Grant duration 1–14 days');
 const user=await auth.getUser(uid);if(!user.emailVerified||user.disabled)throw Error('Verified, enabled Auth account required');
 const now=Timestamp.now(),expiresAt=Timestamp.fromMillis(now.toMillis()+days*86400000);
 await db.runTransaction(async tx=>{
  // All grant changes contend on one document: cap survives concurrent operators.
  const lock=db.doc('syncPilotAudit/admissionLock'),lockSnap=await tx.get(lock);
  const ref=db.doc(`syncPilotMembers/${uid}`),existing=await tx.get(ref);
  if(existing.data()?.status==='erased')throw Error('Erasure fence prohibits re-admission');
  const grants=await tx.get(db.collection('syncPilotMembers').where('status','==','active').limit(101));
  if(grants.size>100)throw Error('Grant inventory over budget');
  const active=grants.docs.filter(s=>s.id!==uid&&s.data().expiresAt?.toMillis()>now.toMillis()).length;
  if(active>=maximum)throw Error('Private pilot admission quota reached');
  tx.set(ref,{version:1,uid,status:'active',expiresAt,updatedAt:now});
  tx.set(lock,{revision:(lockSnap.data()?.revision||0)+1,updatedAt:now});
 });return {uid,expiresAt:expiresAt.toDate().toISOString()};
}
export async function control(db,Timestamp,{readsEnabled=false,writesEnabled=false,days=1}={}){
 if(writesEnabled&&!readsEnabled)throw Error('Writes require reads');if(days<1||days>14)throw Error('Control duration 1–14 days');
 const now=Timestamp.now();await db.doc('syncPilotControl/current').set({version:1,readsEnabled,writesEnabled,expiresAt:Timestamp.fromMillis(now.toMillis()+days*86400000),updatedAt:now});
}
export async function monitor(db,{maxDocuments=2000,maxPerUid=500,execute=false,Timestamp}={}){
 let docs;try{docs=await inventory(db);}catch(error){if(execute)await pauseWrites(db,Timestamp);throw error;}const counts={};for(const d of docs){const match=/^users\/([^/]+)/.exec(d.path);if(match)counts[match[1]]=(counts[match[1]]||0)+1;}
 const exceeded=docs.length>maxDocuments||Object.values(counts).some(n=>n>maxPerUid);
 if(exceeded&&execute)await pauseWrites(db,Timestamp);
 return {scope:'stored documents; NOT billing/read/write rate quotas',documents:docs.length,accounts:Object.keys(counts).length,largestAccount:Math.max(0,...Object.values(counts)),exceeded,paused:exceeded&&execute};
}

export async function pauseWrites(db,Timestamp){
 await db.runTransaction(async tx=>{const ref=db.doc('syncPilotControl/current'),snap=await tx.get(ref);if(snap.exists)tx.update(ref,{writesEnabled:false,updatedAt:Timestamp.now()});else tx.set(ref,{version:1,readsEnabled:false,writesEnabled:false,expiresAt:Timestamp.now(),updatedAt:Timestamp.now()});});
}
