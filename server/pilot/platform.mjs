import {createHash} from 'node:crypto';
export const project='optilab-cd829';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
/** Metadata-only GETs. Never reads application documents or enables APIs/billing. */
export async function inspectPlatform(get,candidateRules){
 const result={version:1,project,observedAt:new Date().toISOString(),rules:{status:'BLOCKED'},billing:{status:'BLOCKED'},services:{status:'BLOCKED'}};
 const requests=[
  (async()=>{const release=await get(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/firebase.firestore`);
   if(!new RegExp(`^projects/${project}/rulesets/[^/]+$`).test(release.rulesetName))throw Error('Unexpected ruleset project');
   const ruleset=await get(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
   const files=ruleset.source?.files;if(!Array.isArray(files)||files.length!==1||typeof files[0].content!=='string')throw Error('Cannot compare single Rules file');
   result.rules={status:'PASS',release:release.name,ruleset:release.rulesetName,updatedAt:release.updateTime,sourceSha256:sha256(files[0].content),candidateSha256:sha256(candidateRules),candidateDeployed:files[0].content===candidateRules};})(),
  (async()=>{const billing=await get(`https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`);if(typeof billing.billingEnabled!=='boolean')throw Error('Missing billing status');result.billing={status:'PASS',billingEnabled:billing.billingEnabled};})(),
  (async()=>{const services=[];let token='';for(let page=0;page<10;page++){
   const url=new URL(`https://serviceusage.googleapis.com/v1/projects/${project}/services`);url.searchParams.set('filter','state:ENABLED');url.searchParams.set('pageSize','200');if(token)url.searchParams.set('pageToken',token);
   const data=await get(url.href);if(!Array.isArray(data.services))throw Error('Missing services');for(const s of data.services)services.push(s.config?.name??s.name);token=data.nextPageToken||'';if(!token){result.services={status:'PASS',enabled:services.sort()};return;}
  }throw Error('Service inventory truncated');})(),
 ];
 await Promise.allSettled(requests);return result;
}
export async function adcReader(){
 const {GoogleAuth}=await import('google-auth-library');
 const auth=new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform.read-only','https://www.googleapis.com/auth/cloud-billing.readonly','https://www.googleapis.com/auth/firebase.readonly']});
 const client=await auth.getClient();
 return async url=>{if(!['firebaserules.googleapis.com','cloudbilling.googleapis.com','serviceusage.googleapis.com'].includes(new URL(url).hostname))throw Error('Unexpected metadata endpoint');
  const response=await client.request({url,method:'GET',timeout:15000,retry:false});return response.data;};
}
