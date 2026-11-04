import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {checkUid} from '../pilot/plan.mjs';

// Preparation only. No SDK, ADC, network, deployment, or production execution.
export const mode='single-operator-test';
// Hashes of reviewed VERSIONED FILES, not of the active production release.
export const reviewedSources={
  base:'ee7fec34e49971a847bc3e6882196fb3fed64ffe42da39f9b7802ba9cef1cf62',
  pilot:'048501565c5dc3f1eb8270a9db74c275b23c288705bd92aec6c215383ed4787e',
};
export const sha256=text=>createHash('sha256').update(text).digest('hex');
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=value=>sha256(JSON.stringify(canonical(value)));
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};
const utc=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
export function validateSession(m){
  const keys=['version','mode','project','origin','frontendSha','expectedActiveRulesSha256','uid','operator','startAt','endAt','adultAttested','fictitiousDataOnly','studentsAllowed','independentConsents','leaseMinutes','checkEveryMinutes','limits24h','retentionDaysAfterEnd','exports','risksAcknowledged','authorization'];
  requireValue(m&&typeof m==='object'&&Object.keys(m).length===keys.length&&keys.every(k=>Object.hasOwn(m,k)),'Unexpected session fields');
  requireValue(m.version===1&&m.mode===mode&&m.project==='optilab-cd829'&&m.origin==='https://optilab.club','Wrong mode or target');
  checkUid(m.uid);
  requireValue(typeof m.operator==='string'&&/^[A-Za-z0-9-]{3,39}$/.test(m.operator),'Named owner/operator required');
  requireValue(typeof m.frontendSha==='string'&&/^[a-f0-9]{40}$/.test(m.frontendSha),'Reviewed frontend SHA required');
  requireValue(typeof m.expectedActiveRulesSha256==='string'&&/^[a-f0-9]{64}$/.test(m.expectedActiveRulesSha256),'Full approved active release source SHA required');
  requireValue(utc(m.startAt)&&utc(m.endAt)&&Date.parse(m.endAt)>Date.parse(m.startAt)&&Date.parse(m.endAt)-Date.parse(m.startAt)<=7200000,'Window must be positive and at most two hours, exact UTC');
  requireValue(m.adultAttested===true&&m.fictitiousDataOnly===true&&m.studentsAllowed===false&&m.independentConsents===true,'Adult, fictitious data and separate consents required');
  requireValue(m.leaseMinutes===10&&m.checkEveryMinutes===5,'Ten-minute lease and five-minute supervision required');
  const caps={reads:5000,writes:1000,deletes:1000,documents:2000,largestAccount:500};
  requireValue(m.limits24h&&Object.keys(m.limits24h).length===5&&Object.entries(caps).every(([k,v])=>Number.isInteger(m.limits24h[k])&&m.limits24h[k]>0&&m.limits24h[k]<=v),'Bounded project-wide usage limits required');
  requireValue(m.retentionDaysAfterEnd===14,'Retention decision must retain the reviewed fourteen-day maximum');
  requireValue(m.exports&&Object.keys(m.exports).length===3&&typeof m.exports.directory==='string'&&isAbsolute(m.exports.directory)&&m.exports.encryptionVerified===true&&m.exports.removeExternalCopies===true,'Private encrypted export location and cleanup decision required');
  requireValue(m.risksAcknowledged===true&&m.authorization===null,'Preparation requires risk acknowledgement; cannot grant execution authorization');
  return {start:Date.parse(m.startAt),end:Date.parse(m.endAt),windowDigest:digest(m)};
}

/** Uses reviewed validators, but a separate control and narrower private routes. */
export function prepareSession(m,{base,pilot}){
  const w=validateSession(m);
  requireValue(sha256(base)===reviewedSources.base&&sha256(pilot)===reviewedSources.pilot,'Rules sources changed: review impact before generating');
  const slice=(from,to)=>{const a=pilot.indexOf(from),b=pilot.indexOf(to,a+from.length);requireValue(a>=0&&b>a,'Reviewed Rules structure changed');return pilot.slice(a,b);};
  const observations=slice('      match /reportedAttempts/{eventKey} {','\n\n      allow get:').replace('reportedAttempt(request.resource.data,uid,eventKey);',"reportedAttempt(request.resource.data,uid,eventKey) && request.resource.data.activityId == 'memorama-simplex';");
  const sync=slice('      match /sync/{document} {','\n      match /epochs/{epoch} {');
  let epochs=slice('      match /epochs/{epoch} {','\n      match /diagnostics/{attemptId} {');
  epochs=epochs.replace('allow create: if pilotAccess(uid,true) && currentEpoch(uid,epoch) && id(attemptId) && diagnostic(request.resource.data,uid);','allow create: if false;')
    .replace("request.resource.data.kind in ['edit','import','reset','restore']","request.resource.data.kind in ['edit','reset','restore']");
  const admission=`    // SINGLE-OPERATOR TEST: generated privately; never changes the two-reviewer pilot.
    function singleOperatorAccess(uid,write) {
      let c=get(/databases/$(database)/documents/singleOperatorTestControl/current).data;
      return owner(uid) && request.auth.token.email_verified == true && uid == ${JSON.stringify(m.uid)}
        && request.time >= timestamp.value(${w.start}) && request.time < timestamp.value(${w.end})
        && c.keys().hasOnly(['version','mode','uid','windowDigest','startAt','endAt','readsEnabled','writesEnabled','expiresAt','updatedAt'])
        && c.version == 1 && c.mode == 'single-operator-test' && c.uid == uid
        && c.windowDigest == '${w.windowDigest}'
        && c.startAt == timestamp.value(${w.start}) && c.endAt == timestamp.value(${w.end})
        && c.readsEnabled == true && (!write || c.writesEnabled == true)
        && c.updatedAt is timestamp && c.updatedAt <= request.time && c.updatedAt >= c.startAt
        && c.expiresAt is timestamp && c.expiresAt > request.time && c.expiresAt <= c.endAt
        && c.expiresAt <= c.updatedAt + duration.value(10,'m')
        && (!exists(/databases/$(database)/documents/syncPilotMembers/$(uid))
          || get(/databases/$(database)/documents/syncPilotMembers/$(uid)).data.status != 'erased');
    }
    match /singleOperatorTestControl/{document} {
      allow get: if document == 'current' && owner(${JSON.stringify(m.uid)}) && request.auth.token.email_verified == true;
      allow list,write: if false;
    }
    match /users/{uid} {
      // Read-only probe required by the v2 transport. No legacy import/writes.
      match /progress/{document} { allow get: if document == 'current' && singleOperatorAccess(uid,false); }
${(observations+'\n'+sync+epochs).replaceAll('pilotAccess(', 'singleOperatorAccess(')}    }
`;
  const prefix=pilot.slice(0,pilot.indexOf('    // Administrative grant/config documents'));
  const tail=pilot.slice(pilot.indexOf('    function course(c) {'));
  const rules=prefix.replace('// GENERATED by scripts/build-pilot-rules.mjs from reviewed base rules.','// PRIVATE SINGLE-OPERATOR CANDIDATE; owner approval and separate release required.')+admission+tail;
  const rulesSha256=sha256(rules);
  const control={version:1,mode,uid:m.uid,windowDigest:w.windowDigest,startAt:m.startAt,endAt:m.endAt,readsEnabled:false,writesEnabled:false,expiresAt:m.startAt,updatedAt:m.startAt};
  const plan={version:1,mode,project:m.project,origin:m.origin,frontendSha:m.frontendSha,versionedBaseRulesSha256:reviewedSources.base,versionedPilotRulesSha256:reviewedSources.pilot,expectedActiveRulesSha256:m.expectedActiveRulesSha256,activeRulesVerification:'NOT_PERFORMED',rulesSha256,windowDigest:w.windowDigest,startAt:m.startAt,endAt:m.endAt,uidSha256:sha256(m.uid),limits24h:m.limits24h,
    scope:['adventure-v2','memorama-reported-attempts','own-backup-restore'],
    approvalRequired:true,executionImplemented:true,network:false,productionWrites:false,
    blockers:['Separate owner approval of SHA, Rules, scope and risks','Fresh execution receipt and explicit process acknowledgment required','Fresh live Rules/billing/services/usage verification required'],
  };
  return {rules,control,plan};
}

/** Future execution gate: no default network/ADC adapter; callers must supply live GETs.
 * Approval binds all three artifacts, including review of active-to-candidate impact.
 * A comparison PASS is NOT authorization to deploy, activate or write application data.
 */
export async function verifyActiveRules(m,sources,{get,approvedSource,approval,clock=Date.now}={}){
  const {plan}=prepareSession(m,sources),started=clock();
  requireValue(approval?.scope==='single-operator-test-rules-comparison-v1'&&approval.approvedBy===m.operator
    && utc(approval.approvedAt)&&Date.parse(approval.approvedAt)<=started&&approval.impactReviewed===true
    && approval.frontendSha===plan.frontendSha&&approval.windowDigest===plan.windowDigest
    && approval.versionedBaseRulesSha256===plan.versionedBaseRulesSha256
    && approval.candidateRulesSha256===plan.rulesSha256
    && approval.activeRulesSha256===m.expectedActiveRulesSha256,'Exact owner-approved Rules comparison and impact review required');
  requireValue(typeof approvedSource==='string'&&approvedSource.length>0&&sha256(approvedSource)===m.expectedActiveRulesSha256,'Approved active source bytes do not match the expected full hash');
  requireValue(typeof get==='function','Live Rules GET adapter required; cached metadata is insufficient');
  const releaseName='projects/optilab-cd829/releases/cloud.firestore',root='https://firebaserules.googleapis.com/v1/';
  const release=await get(root+releaseName,{method:'GET'});
  requireValue(release?.name===releaseName&&/^projects\/optilab-cd829\/rulesets\/[A-Za-z0-9_-]+$/.test(release.rulesetName)
    && typeof release.updateTime==='string'&&Number.isFinite(Date.parse(release.updateTime)),'Invalid live release metadata');
  const ruleset=await get(root+release.rulesetName,{method:'GET'}),files=ruleset?.source?.files;
  requireValue(ruleset?.name===release.rulesetName&&Array.isArray(files)&&files.length===1&&typeof files[0].content==='string','Invalid live ruleset metadata');
  requireValue(files[0].content===approvedSource&&sha256(files[0].content)===m.expectedActiveRulesSha256,'Live Rules differ from the exact approved active source');
  const after=await get(root+releaseName,{method:'GET'}),finished=clock();
  requireValue(after?.name===releaseName&&after.rulesetName===release.rulesetName&&after.updateTime===release.updateTime,'Active release changed during comparison');
  requireValue(Number.isFinite(started)&&Number.isFinite(finished)&&finished>=started&&finished-started<=300000,'Live comparison stale or invalid clock');
  return {status:'PASS',release:releaseName,ruleset:release.rulesetName,observedAt:new Date(finished).toISOString(),
    activeRulesSha256:m.expectedActiveRulesSha256,versionedBaseRulesSha256:plan.versionedBaseRulesSha256,
    candidateRulesSha256:plan.rulesSha256,windowDigest:plan.windowDigest,executionAuthorized:false};
}
