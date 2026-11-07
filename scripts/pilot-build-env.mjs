import {readFile,appendFile} from 'node:fs/promises';
import {verifyReceipts,decisionDigest} from '../server/pilot/activation.mjs';
import {sha256} from '../server/pilot/platform.mjs';
async function main(){
// Called only by the manually dispatched protected pilot workflow; ordinary Pages stays OFF.
const required=['PILOT_MANIFEST_FILE','PILOT_PLATFORM_FILE','PILOT_USAGE_FILE','PILOT_APPROVAL_DIGEST','PILOT_FRONTEND_SHA','GITHUB_ENV'];
if(required.some(key=>!process.env[key]))throw Error('Missing owner-approved private workflow inputs');
const m=JSON.parse(await readFile(process.env.PILOT_MANIFEST_FILE,'utf8')),platform=JSON.parse(await readFile(process.env.PILOT_PLATFORM_FILE,'utf8')),usage=JSON.parse(await readFile(process.env.PILOT_USAGE_FILE,'utf8'));
if(m.frontendSha!==process.env.PILOT_FRONTEND_SHA||decisionDigest(m)!==process.env.PILOT_APPROVAL_DIGEST)throw Error('Approved commit/decision digest mismatch');
verifyReceipts(m,{platform,usage,rulesSha256:sha256(await readFile('firestore.pilot.rules','utf8'))});
await appendFile(process.env.GITHUB_ENV,`OPTILAB_PAGES_TARGET=optilab.club\nVITE_PROGRESS_SYNC=production\nVITE_PROGRESS_SYNC_RELEASE=private-progress-and-attempts-v1\nVITE_PROGRESS_SYNC_PROJECT_ID=optilab-cd829\nVITE_PROGRESS_SYNC_ORIGIN=https://optilab.club\nVITE_SYNC_PILOT=private-admission-v1\nVITE_INTEGRATED_PROGRESS=pilot-v1\nVITE_ACADEMIC_API_MODE=production\nVITE_ACADEMIC_API_URL=https://optilab-api.vercel.app/api\nVITE_ACADEMIC_APP_ORIGIN=https://optilab.club\nVITE_FIREBASE_AUTH_EMULATOR_URL=\nVITE_FIRESTORE_EMULATOR_HOST=\n`);
console.log('Owner-approved commit and fresh Rules/billing/services/usage receipts verified. No manifest data exported to frontend.');
}
try{await main();}catch{console.error("Pilot operation blocked. Review approval, receipts and access; use emergency pause for a running pilot. No credentials logged.");process.exitCode=1;}
