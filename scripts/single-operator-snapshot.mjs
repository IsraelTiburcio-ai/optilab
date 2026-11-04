import {captureBaseline,saveSnapshot} from '../server/single-operator/snapshot.mjs';
import {administrativeTarget,withAdministrativeProcess} from '../server/pilot/admin-process.mjs';
import {adcReader} from '../server/pilot/platform.mjs';

async function main(){
  const args=process.argv.slice(2),o={};
  for(let i=0;i<args.length;i++){const k=args[i];if(!['--target','--project','--out','--execute','--confirm'].includes(k)||Object.hasOwn(o,k))throw Error('Invalid options');o[k]=k==='--execute'?true:args[++i];}
  const scope=administrativeTarget(o['--target'],o['--project']);
  if(scope.target!=='production')throw Error('Rules snapshot has only an explicit production metadata target');
  if(!o['--execute']){console.log(JSON.stringify({action:'snapshot',mode:'DRY-RUN',network:false,productionWrites:false,filesWritten:false}));return;}
  if(o['--confirm']!=='snapshot:optilab-cd829'||process.env.SINGLE_OPERATOR_SNAPSHOT_APPROVAL!=='read-only-approved'||!o['--out'])throw Error('Separate owner read-only snapshot authorization required');
  await withAdministrativeProcess(scope,async()=>{
    const snapshot=await captureBaseline(await adcReader());await saveSnapshot(snapshot,o['--out']);
    console.log(JSON.stringify({action:'snapshot',sourceSha256:snapshot.receipt.sourceSha256,observedAt:snapshot.receipt.observedAt,productionWrites:false,privateFilesWritten:true}));
  });
}
try{await main();}catch{console.error('BLOCKED: snapshot target, approval, metadata or private output invalid. No production writes.');process.exitCode=1;}
