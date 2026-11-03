import {isAbsolute} from 'node:path';
import {hash,checkUid} from './plan.mjs';
import {admit,pauseWrites} from './admin.mjs';
const day=86400000;
const must=(ok,message)=>{if(!ok)throw Error(message);};
export const decisionDigest=manifest=>{const {authorization,...decisions}=manifest;return hash(decisions);};
export function validateProposal(m){
 must(m.version===1&&m.project==='optilab-cd829','Wrong manifest version/project');
 must(m.maxParticipants===5&&m.grantDays===7&&m.maxPilotDays===14&&m.retentionDaysAfterEnd===14,'Unexpected proposed policy');
 must(m.adultsOnly===true&&m.fictitiousDataOnly===true&&m.studentsAllowed===false&&m.independentConsents===true,'Adult/fictitious/no-student/channel policy required');
 must(m.leaseMinutes===20&&m.checkEveryMinutes===15&&m.receiptMaxAgeMinutes===10,'Unexpected operating cadence');
 must(Array.isArray(m.participants)&&m.participants.length<=5,'At most five participants');
 const uids=new Set();for(const p of m.participants){checkUid(p.uid);must(!uids.has(p.uid),'Duplicate participant');uids.add(p.uid);must(p.adultAttested===true&&p.fictitiousData===true&&p.student===false,'Operator adult/fictitious/no-student attestation required');}
 for(const [key,max]of Object.entries({reads:5000,writes:1000,deletes:1000,documents:2000,largestAccount:500}))must(Number.isInteger(m.limits24h?.[key])&&m.limits24h[key]>0&&m.limits24h[key]<=max,'Consumption limit missing/too high');
 must(m.authDeletion==='pilot-created-only-after-uid-erasure-and-confirmation','Explicit Auth erasure decision required');
 return {digest:decisionDigest(m),approved:m.authorization!==null,participants:m.participants.length,network:false,writes:false};
}
export function requireApproval(m,now=Date.now()){
 validateProposal(m);const a=m.authorization;
 must(a?.scope==='private-pilot-v1'&&a.decisionDigest===decisionDigest(m),'Second authorization missing or decisions changed');
 must(typeof a.approvedBy==='string'&&a.approvedBy.trim().length>=3&&Number.isFinite(Date.parse(a.approvedAt))&&Date.parse(a.approvedAt)<=now,'Approval identity/time required');
 must(/^[a-f0-9]{40}$/.test(m.frontendSha),'Approved frontend SHA required');
 const start=Date.parse(m.startAt),end=Date.parse(m.endAt);
 must(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=14*day,'Fixed pilot window of at most fourteen days required');
 must(now>=start&&now<end,'Pilot window not current');
 must(m.participants.length>=1,'Approved participant list empty');
 must(typeof m.operators?.primary==='string'&&m.operators.primary.trim().length>=3&&typeof m.operators.backup==='string'&&m.operators.backup.trim().length>=3&&m.operators.backup!==m.operators.primary,'Named primary and distinct backup required');
 must(typeof m.exports?.directory==='string'&&isAbsolute(m.exports.directory)&&m.exports.encryptionVerified===true&&m.exports.removeManagedAndExternalCopies===true,'Private encrypted export location/erasure receipts required');
 must(/^[a-f0-9]{64}$/.test(m.approvedServicesSha256),'Approved enabled-services inventory required');
 return {start,end,retentionDeadline:end+14*day,digest:decisionDigest(m)};
}
function fresh(receipt,m,now){must(receipt?.project===m.project&&receipt.version===1,'Receipt project/version mismatch');const at=Date.parse(receipt.observedAt);must(Number.isFinite(at)&&at<=now+30000&&now-at<=m.receiptMaxAgeMinutes*60000,'Receipt stale or future-dated');}
export function verifyReceipts(m,{platform,usage,rulesSha256},now=Date.now()){
 const window=requireApproval(m,now);fresh(platform,m,now);fresh(usage,m,now);
 must(platform.rules?.status==='PASS'&&platform.rules.candidateDeployed===true&&platform.rules.sourceSha256===rulesSha256,'Active Rules source not verified');
 must(platform.billing?.status==='PASS'&&platform.billing.billingEnabled===false,'Billing must be verified disabled');
 must(platform.services?.status==='PASS'&&hash(platform.services.enabled)===m.approvedServicesSha256,'Enabled services changed/unverified');
 must(usage.source==='console'&&usage.windowHours===24&&[m.operators.primary,m.operators.backup].includes(usage.operator)&&/^[a-f0-9]{64}$/.test(usage.evidenceSha256),'Auditable operator usage receipt required');
 const inventoryAt=Date.parse(usage.inventoryObservedAt);must(Number.isFinite(inventoryAt)&&inventoryAt<=now+30000&&now-inventoryAt<=day,'Daily document inventory receipt missing/stale');
 for(const [key,limit]of Object.entries(m.limits24h)){must(Number.isInteger(usage.counts?.[key])&&usage.counts[key]>=0,'Usage unknown; never assume zero');must(usage.counts[key]<limit,`Consumption threshold reached: ${key}`);}
 return window;
}
/** Immutable window prevents a later heartbeat or grant from extending the pilot. */
export async function prepareWindow(db,auth,Timestamp,m,receipts,now=Date.now()){
 const w=verifyReceipts(m,receipts,now);
 for(const p of m.participants){const user=await auth.getUser(p.uid);must(user.emailVerified&&!user.disabled,'Verified enabled Auth identity required');}
 await db.runTransaction(async tx=>{
  const ref=db.doc('syncPilotAudit/window'),existing=await tx.get(ref),control=db.doc('syncPilotControl/current');
  if(existing.exists)must(existing.data().digest===w.digest,'Window already belongs to other approved decisions');
  else tx.set(ref,{version:1,digest:w.digest,startAt:Timestamp.fromMillis(w.start),endAt:Timestamp.fromMillis(w.end),retentionDeadline:Timestamp.fromMillis(w.retentionDeadline),preparedAt:Timestamp.fromMillis(now)});
  tx.set(control,{version:1,readsEnabled:false,writesEnabled:false,expiresAt:Timestamp.fromMillis(w.end),updatedAt:Timestamp.fromMillis(now)});
 });
 // Partial failure leaves control paused. Repeating is safe and never opens the pilot.
 for(const p of m.participants){const existing=await db.doc(`syncPilotMembers/${p.uid}`).get();if(existing.exists){must(existing.data().status==='active'&&existing.data().expiresAt.toMillis()>now&&existing.data().expiresAt.toMillis()<=w.end&&existing.data().expiresAt.toMillis()<=existing.data().updatedAt.toMillis()+7*day,'Existing grant requires explicit review, never renew silently');continue;}await admit(db,auth,p.uid,{Timestamp,days:7,maximum:5,expiresAtLimit:Timestamp.fromMillis(w.end)});}
 return {status:'PREPARED_PAUSED',digest:w.digest,participants:m.participants.length,retentionDeadline:new Date(w.retentionDeadline).toISOString()};
}
export async function operateLease(db,auth,Timestamp,m,receipts,{renew=false,now=Date.now()}={}){
 try{
  const w=verifyReceipts(m,receipts,now);
  for(const p of m.participants){const user=await auth.getUser(p.uid);must(user.emailVerified&&!user.disabled,'Auth verification revoked/disabled');}
  return await db.runTransaction(async tx=>{
   const ref=db.doc('syncPilotControl/current'),window=await tx.get(db.doc('syncPilotAudit/window')),control=await tx.get(ref);
   must(window.data()?.digest===w.digest&&window.data().endAt.toMillis()===w.end,'Prepared immutable window mismatch');
   const grants=await tx.get(db.collection('syncPilotMembers').where('status','==','active').limit(101));
   must(grants.size<=100,'Membership inventory incomplete');
   const active=grants.docs.filter(d=>d.data().expiresAt?.toMillis()>now);const approved=new Set(m.participants.map(p=>p.uid));
   must(active.length===approved.size&&active.every(d=>approved.has(d.id)&&d.data().uid===d.id&&d.data().expiresAt.toMillis()<=w.end&&d.data().expiresAt.toMillis()<=d.data().updatedAt.toMillis()+7*day),'Exact approved active membership required');
   if(renew)must(control.data()?.writesEnabled===true&&control.data().readsEnabled===true&&control.data().expiresAt.toMillis()>now,'Expired/paused lease requires explicit reopening');
   const expiresAt=Math.min(now+m.leaseMinutes*60000,w.end);
   tx.set(ref,{version:1,readsEnabled:true,writesEnabled:true,expiresAt:Timestamp.fromMillis(expiresAt),updatedAt:Timestamp.fromMillis(now)});
   return {status:renew?'RENEWED':'OPEN',expiresAt:new Date(expiresAt).toISOString(),digest:w.digest};
  });
 }catch(error){await pauseWrites(db,Timestamp);throw error;}
}
export async function emergencyPause(db,Timestamp){
 // No manifest, billing or metadata dependency: must work when monitoring fails.
 await db.runTransaction(async tx=>{const ref=db.doc('syncPilotControl/current'),snap=await tx.get(ref),now=Timestamp.now();tx.set(ref,{version:1,readsEnabled:false,writesEnabled:false,expiresAt:snap.data()?.expiresAt??now,updatedAt:now});});
 return {status:'PAUSED',readsEnabled:false,writesEnabled:false};
}
