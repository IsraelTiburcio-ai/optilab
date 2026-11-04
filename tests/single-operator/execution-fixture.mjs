import {session,sources} from './fixture.mjs';
import {prepareSession} from '../../server/single-operator/preparation.mjs';
import {hash} from '../../server/pilot/plan.mjs';
import {requiredPermissions,deploymentPermissions} from '../../server/single-operator/execution.mjs';
export {sources};
export function executionFixture(now=Date.now()){
 const m=session(now),bundle=prepareSession(m,sources),services=['firestore.googleapis.com'];
 const approval={scope:'single-operator-test-execution-v1',approvedBy:m.operator,approvedAt:new Date(now-1000).toISOString(),frontendSha:m.frontendSha,windowDigest:bundle.plan.windowDigest,candidateRulesSha256:bundle.plan.rulesSha256,expectedActiveRulesSha256:m.expectedActiveRulesSha256,approvedServicesSha256:hash(services),impactReviewed:true,singleOperatorRiskAccepted:true,allowRulesDeployment:true,allowSessionWrites:true,allowFrontendOn:true,allowFrontendOff:true,allowRecovery:true};
 const usage={source:'console',operator:m.operator,windowHours:24,observedAt:new Date(now).toISOString(),evidenceSha256:'a'.repeat(64),counts:{reads:10,writes:5,deletes:0,documents:10,largestAccount:5},storageBytes:1024,storageObservedAt:new Date(now).toISOString()};
 const release={name:'projects/optilab-cd829/releases/cloud.firestore',rulesetName:'projects/optilab-cd829/rulesets/single-test-fixture',updateTime:new Date(now-60000).toISOString()};
 const platform={release,ruleset:{name:release.rulesetName,source:{files:[{name:'firestore.rules',content:bundle.rules}]}},billing:{billingEnabled:false},services:{services:services.map(name=>({config:{name}}))},permissions:[...requiredPermissions,...deploymentPermissions]};
 const receipt={version:1,project:'optilab-cd829',observedAt:new Date(now).toISOString(),windowDigest:bundle.plan.windowDigest,candidateRulesSha256:bundle.plan.rulesSha256,platform:{rules:{status:'PASS',sourceSha256:bundle.plan.rulesSha256,candidateDeployed:true},billing:{status:'PASS',billingEnabled:false},services:{status:'PASS',enabled:services}},usage,permissions:{status:'PASS',granted:platform.permissions},control:{status:'ABSENT',sequence:0}};
 return {m,bundle,approval,usage,platform,receipt};
}
