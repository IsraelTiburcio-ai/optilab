import {readFileSync} from 'node:fs';
import {buildPilotPlan} from '../server/pilot/provision.mjs';
function args(){const out={};const values=process.argv.slice(2);for(let i=0;i<values.length;i++){const key=values[i];if(key==='--execute'){if(out.execute)throw Error('PILOT_ARGUMENT_REJECTED');out.execute=true;continue;}if(key!=='--manifest'||i+1>=values.length)throw Error('PILOT_ARGUMENT_REJECTED');out.manifest=values[++i];}return out;}
try {
  const input=args();if(!input.manifest)throw Error('PILOT_MANIFEST_REQUIRED');
  const raw=JSON.parse(readFileSync(input.manifest,'utf8'));
  const plan=buildPilotPlan(raw);
  if(input.execute)throw Error('PILOT_EXECUTION_DISABLED: owner approval and a separate controlled activation are required; no writes were made.');
  console.log(JSON.stringify(plan,null,2));
} catch(error){console.error(error instanceof Error?error.message:'PILOT_MANIFEST_REJECTED');process.exitCode=1;}
