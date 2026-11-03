import {readFile} from 'node:fs/promises';
import {inspectPlatform,adcReader,project} from '../server/pilot/platform.mjs';
const args=process.argv.slice(2);if(args.length!==1||!['--dry-run','--inspect'].includes(args[0]))throw Error('Use --dry-run or --inspect (metadata GET only)');
if(args[0]==='--dry-run'){console.log(JSON.stringify({project,mode:'DRY-RUN',network:false,writes:false}));process.exit(0);}
let result;
try{result=await inspectPlatform(await adcReader(),await readFile('firestore.pilot.rules','utf8'));}
catch{result={version:1,project,observedAt:new Date().toISOString(),rules:{status:'BLOCKED'},billing:{status:'BLOCKED'},services:{status:'BLOCKED'},reason:'ADC/IAM metadata access unavailable; verify with owner console. No APIs enabled.'};}
console.log(JSON.stringify(result,null,2));
if(result.rules.status!=='PASS'||result.billing.status!=='PASS'||result.services.status!=='PASS')process.exitCode=2;
