import {prepareSession,validateSession,sha256,verifyActiveRules} from './preparation.mjs';
import {hash} from '../pilot/plan.mjs';
import {inspectPlatform} from '../pilot/platform.mjs';
const must=(ok,message)=>{if(!ok)throw Error(message);};
export const requiredPermissions=['datastore.databases.get','datastore.entities.get','datastore.entities.list','datastore.entities.create','datastore.entities.update','firebaseauth.users.get','firebaserules.rulesets.get','firebaserules.releases.get'];
export const deploymentPermissions=['firebaserules.rulesets.create','firebaserules.releases.update'];
export const controlPath='singleOperatorTestControl/current',auditPath='singleOperatorTestAudit/window';
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function requireExecutionApproval(m,sources,approval,now=Date.now()){
 const bundle=prepareSession(m,sources),w=validateSession(m);
 must(approval?.scope==='single-operator-test-execution-v1'&&approval.approvedBy===m.operator&&iso(approval.approvedAt)&&Date.parse(approval.approvedAt)<=now,'Separate exact owner execution approval required');
 must(approval.frontendSha===m.frontendSha&&approval.windowDigest===w.windowDigest&&approval.candidateRulesSha256===bundle.plan.rulesSha256&&approval.expectedActiveRulesSha256===m.expectedActiveRulesSha256,'Approval artifact binding mismatch');
 must(approval.impactReviewed===true&&approval.singleOperatorRiskAccepted===true&&/^[a-f0-9]{64}$/.test(approval.approvedServicesSha256),'Impact, single-operator risk and services approval required');
 for(const key of ['allowRulesDeployment','allowSessionWrites','allowFrontendOn','allowFrontendOff','allowRecovery'])must(typeof approval[key]==='boolean','Explicit operation scopes required');
 must(approval.allowFrontendOff&&approval.allowRecovery,'OFF recovery and emergency pause must be approved before any session');
 return {...w,bundle,windowDigest:w.windowDigest};
}
function fresh(value,now){const at=Date.parse(value);return Number.isFinite(at)&&at<=now+30000&&now-at<=300000;}
export function verifyOperationalReceipts(m,sources,approval,receipt,now=Date.now()){
 const w=requireExecutionApproval(m,sources,approval,now);
 must(receipt?.version===1&&receipt.project==='optilab-cd829'&&receipt.windowDigest===w.windowDigest&&receipt.candidateRulesSha256===w.bundle.plan.rulesSha256&&fresh(receipt.observedAt,now),'Operational receipt missing, changed or stale');
 const p=receipt.platform;
 must(p?.rules?.status==='PASS'&&p.rules.candidateDeployed===true&&p.rules.sourceSha256===w.bundle.plan.rulesSha256,'Exact deployed candidate Rules required');
 must(p.billing?.status==='PASS'&&p.billing.billingEnabled===false,'Billing must remain disabled');
 must(p.services?.status==='PASS'&&Array.isArray(p.services.enabled)&&hash([...p.services.enabled].sort())===approval.approvedServicesSha256,'Service inventory changed or unknown');
 must(receipt.permissions?.status==='PASS'&&requiredPermissions.every(x=>receipt.permissions.granted?.includes(x)),'Effective administrative permissions unverified');
 verifyUsage(m,receipt.usage,now);
 must(receipt.control&&['PAUSED','OPEN','ABSENT'].includes(receipt.control.status)&&Number.isInteger(receipt.control.sequence)&&receipt.control.sequence>=0,'Control sequence required');
 if(receipt.control.status!=='ABSENT')must(receipt.control.windowDigest===w.windowDigest,'Control belongs to another session');
 if(receipt.control.status==='OPEN')must(Number.isFinite(Date.parse(receipt.control.expiresAt))&&Date.parse(receipt.control.expiresAt)>now&&Date.parse(receipt.control.expiresAt)<=w.end,'Open lease expired or exceeds approved window');
 return w;
}
function verifyUsage(m,u,now){
 must(u?.source==='console'&&u.operator===m.operator&&u.windowHours===24&&fresh(u.observedAt,now)&&/^[a-f0-9]{64}$/.test(u.evidenceSha256),'Fresh owner-observed Console usage evidence required');
 must(Number.isInteger(u.storageBytes)&&u.storageBytes>=0&&u.storageBytes<0.9*1073741824&&fresh(u.storageObservedAt,now),'Storage unknown, stale or above 90% Spark capacity');
 for(const [k,v]of Object.entries(m.limits24h))must(Number.isInteger(u.counts?.[k])&&u.counts[k]>=0&&u.counts[k]<v,`Usage unknown or threshold reached: ${k}`);
}
export function verifyUsageEvidence(usage,bytes){must(bytes.length<=10000000&&sha256(bytes)===usage?.evidenceSha256,'Usage evidence file integrity failed');}
/* Keep the write timestamp in the past so an immediate read cannot precede request.time. */
function controlData(m,w,Timestamp,now,open){const stamp=open?now-1000:now,expires=open?Math.min(stamp+600000,w.end):Math.min(now,w.end);return {version:1,mode:'single-operator-test',uid:m.uid,windowDigest:w.windowDigest,startAt:Timestamp.fromMillis(w.start),endAt:Timestamp.fromMillis(w.end),readsEnabled:open,writesEnabled:open,expiresAt:Timestamp.fromMillis(expires),updatedAt:Timestamp.fromMillis(stamp)};}
const operationKey=(action,receipt)=>sha256(action+JSON.stringify(receipt));
function sameWindow(a,w,m){return a?.version===1&&a.windowDigest===w.windowDigest&&a.uid===m.uid&&a.frontendSha===m.frontendSha&&a.rulesSha256===w.bundle.plan.rulesSha256&&a.startAt?.toMillis()===w.start&&a.endAt?.toMillis()===w.end;}
async function identity(auth,db,uid){const u=await auth.getUser(uid);must(u.uid===uid&&u.emailVerified&&!u.disabled,'Verified enabled exact identity required');const fence=await db.doc(`syncPilotMembers/${uid}`).get();must(fence.data()?.status!=='erased','Erased identity cannot reopen');}
export async function inspectControl(db){
 const [a,c]=await Promise.all([db.doc(auditPath).get(),db.doc(controlPath).get()]);
 const state=a.data(),control=c.data();return {status:!control?'ABSENT':control.readsEnabled&&control.writesEnabled?'OPEN':'PAUSED',windowDigest:control?.windowDigest??state?.windowDigest??null,sequence:state?.sequence??0,expiresAt:control?.expiresAt?.toDate().toISOString()??null};
}
export async function preparePaused(db,auth,Timestamp,m,sources,approval,receipt,now=Date.now()){
 const w=verifyOperationalReceipts(m,sources,approval,receipt,now);must(approval.allowSessionWrites,'Session writes not approved');must(now<w.end,'Session ended');await identity(auth,db,m.uid);
 return db.runTransaction(async tx=>{
  const ar=db.doc(auditPath),cr=db.doc(controlPath),legacy=db.doc('syncPilotControl/current');
  const [audit,control,other]=await Promise.all([tx.get(ar),tx.get(cr),tx.get(legacy)]);
  const a=audit.data();must(!((other.data()?.readsEnabled||other.data()?.writesEnabled)&&other.data()?.expiresAt?.toMillis()>now),'Original pilot currently open');
  if(a){must(sameWindow(a,w,m)&&a.phase==='prepared'&&control.exists&&!control.data().readsEnabled&&!control.data().writesEnabled,'Prepared window changed or already used');return {status:'PREPARED_PAUSED',sequence:a.sequence,replay:true};}
  must(!control.exists,'Unowned control exists; review before preparing');
  tx.create(ar,{version:1,windowDigest:w.windowDigest,uid:m.uid,frontendSha:m.frontendSha,rulesSha256:w.bundle.plan.rulesSha256,startAt:Timestamp.fromMillis(w.start),endAt:Timestamp.fromMillis(w.end),retentionDeadline:Timestamp.fromMillis(w.end+14*86400000),preparedAt:Timestamp.fromMillis(now),phase:'prepared',sequence:1,operations:{}});
  tx.create(cr,controlData(m,w,Timestamp,now,false));return {status:'PREPARED_PAUSED',sequence:1,replay:false};
 });
}
export async function operate(db,auth,Timestamp,action,m,sources,approval,receipt,now=Date.now()){
 must(['open','renew','recover'].includes(action),'Unknown session operation');
 const w=verifyOperationalReceipts(m,sources,approval,receipt,now);must(approval.allowSessionWrites&&(action!=='recover'||approval.allowRecovery),'Operation not approved');must(now>=w.start&&now<w.end,'Outside approved window');await identity(auth,db,m.uid);
 const operationId=operationKey(action,receipt);
 return db.runTransaction(async tx=>{
  const ar=db.doc(auditPath),cr=db.doc(controlPath);const [audit,control]=await Promise.all([tx.get(ar),tx.get(cr)]),a=audit.data(),c=control.data();
  must(sameWindow(a,w,m)&&(c?.windowDigest===w.windowDigest||action==='recover'&&!control.exists),'Exact prepared immutable window required');
  if(a.operations?.[operationId])return {status:'REPLAY_NO_CHANGE',phase:a.phase,sequence:a.sequence,expiresAt:c?.expiresAt?.toDate().toISOString()??null};
  must(a.sequence===receipt.control.sequence,'Stale control receipt; inspect again');
  if(action==='open')must(a.phase==='prepared'&&!c.readsEnabled&&!c.writesEnabled,'Initial opening already consumed; explicit recovery required');
  if(action==='renew')must(a.phase==='open'&&c.readsEnabled&&c.writesEnabled&&c.expiresAt.toMillis()>now,'Paused/expired lease cannot renew');
  if(action==='recover')must(!control.exists||a.phase==='paused'||a.phase==='open'&&c.expiresAt.toMillis()<=now,'Recovery requires paused or expired lease');
  const operations={...a.operations,[operationId]:action};must(Object.keys(operations).length<=100,'Operation receipt budget reached');
  const next=controlData(m,w,Timestamp,now,true);tx.set(cr,next);tx.update(ar,{phase:'open',sequence:a.sequence+1,operations,updatedAt:Timestamp.fromMillis(now)});
  return {status:action==='renew'?'RENEWED':action==='recover'?'RECOVERED':'OPEN',sequence:a.sequence+1,expiresAt:next.expiresAt.toDate().toISOString()};
 });
}
export async function pauseTotal(db,Timestamp,now=Date.now()){
 return db.runTransaction(async tx=>{
  const ar=db.doc(auditPath),cr=db.doc(controlPath),[audit,control]=await Promise.all([tx.get(ar),tx.get(cr)]),a=audit.data(),c=control.data();
  if(c)tx.update(cr,{readsEnabled:false,writesEnabled:false,updatedAt:Timestamp.fromMillis(now)});
  if(a)tx.update(ar,{phase:'paused',sequence:a.sequence+1,updatedAt:Timestamp.fromMillis(now)});
  return {status:'PAUSED',readsEnabled:false,writesEnabled:false,sequence:a?a.sequence+1:0};
 });
}
/** Read-only live platform/permission adapter; the sole POST is IAM testIamPermissions. */
export async function administrativeMetadata({loadAuth=()=>import('google-auth-library')}={}){
 const {GoogleAuth}=await loadAuth();const client=await new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']}).getClient();
 const get=async url=>{const parsed=new URL(url);must(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!parsed.hash&&['firebaserules.googleapis.com','cloudbilling.googleapis.com','serviceusage.googleapis.com'].includes(parsed.hostname),'Unexpected metadata host');return (await client.request({url,method:'GET',timeout:15000,retry:false})).data;};
 const permissions=async()=>{const response=await client.request({url:'https://cloudresourcemanager.googleapis.com/v1/projects/optilab-cd829:testIamPermissions',method:'POST',data:{permissions:[...requiredPermissions,...deploymentPermissions]},timeout:15000,retry:false});return response.data.permissions??[];};
 return {get,permissions};
}
export async function inspectExecution(db,auth,m,sources,approval,usage,{get,permissions},now=Date.now(),clock=Date.now){
 const w=requireExecutionApproval(m,sources,approval,now);await identity(auth,db,m.uid);
 const [platform,granted,control]=await Promise.all([inspectPlatform(get,w.bundle.rules),permissions(),inspectControl(db)]);
 const finished=clock();must(finished>=now&&finished-now<=300000,'Live inspection stale');
 const receipt={version:1,project:'optilab-cd829',observedAt:new Date(finished).toISOString(),windowDigest:w.windowDigest,candidateRulesSha256:w.bundle.plan.rulesSha256,platform,usage,permissions:{status:requiredPermissions.every(x=>granted.includes(x))?'PASS':'BLOCKED',granted},control};
 verifyOperationalReceipts(m,sources,approval,receipt,finished);return receipt;
}
export async function preflightBaseline(m,sources,approval,approvedSource,{get,permissions},usage,now=Date.now(),clock=Date.now){
 const w=requireExecutionApproval(m,sources,approval,now);must(approval.allowRulesDeployment,'Rules deployment not approved');
 const comparisonApproval={scope:'single-operator-test-rules-comparison-v1',approvedBy:approval.approvedBy,approvedAt:approval.approvedAt,impactReviewed:approval.impactReviewed,frontendSha:m.frontendSha,windowDigest:w.windowDigest,versionedBaseRulesSha256:w.bundle.plan.versionedBaseRulesSha256,candidateRulesSha256:w.bundle.plan.rulesSha256,activeRulesSha256:m.expectedActiveRulesSha256};
 const comparison=await verifyActiveRules(m,sources,{get,approvedSource,approval:comparisonApproval,clock});
 const platform=await inspectPlatform(get,w.bundle.rules),granted=await permissions();
 must(platform.rules?.status==='PASS'&&platform.rules.sourceSha256===m.expectedActiveRulesSha256,'Baseline changed during preflight');
 must(platform.billing?.status==='PASS'&&platform.billing.billingEnabled===false&&platform.services?.status==='PASS'&&hash([...platform.services.enabled].sort())===approval.approvedServicesSha256,'Billing/services changed or unknown');
 must([...requiredPermissions,...deploymentPermissions].every(x=>granted.includes(x)),'Deployment/session permissions missing');
 const finished=clock();must(fresh(comparison.observedAt,finished)&&finished>=now&&finished-now<=300000,'Preflight stale');verifyUsage(m,usage,finished);
 return {status:'PASS',scope:'baseline-preflight-only',comparison,observedAt:new Date(finished).toISOString(),windowDigest:w.windowDigest,candidateRulesSha256:w.bundle.plan.rulesSha256,permissions:{status:'PASS',granted},productionWrites:false};
}
