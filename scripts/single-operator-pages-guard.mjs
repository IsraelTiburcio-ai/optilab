import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const timestamp=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value);
const must=(ok,message)=>{if(!ok)throw Error(message);};

/** A Pages deployment newer than the operator receipt means an OFF was published after approval. */
export function latestPagesDeploymentAllowed(latest,receipt){
  must(Array.isArray(latest),'Pages deployment list required');
  must(receipt&&timestamp(receipt.observedAt),'Fresh receipt timestamp required');
  if(latest.length===0)return {allowed:true,reason:'no-prior-deployment'};
  must(latest.length===1,'Exactly one latest Pages deployment required');
  const deployment=latest[0];
  must(deployment&&deployment.environment==='github-pages','Unexpected Pages deployment environment');
  must(Number.isInteger(deployment.id)&&deployment.id>0,'Invalid Pages deployment id');
  must(timestamp(deployment.created_at),'Invalid Pages deployment timestamp');
  const created=Date.parse(deployment.created_at),observed=Date.parse(receipt.observedAt);
  must(created<=observed,'A newer Pages deployment exists; publish OFF and regenerate the receipt before ON');
  return {allowed:true,reason:'not-newer',deploymentCreatedAt:deployment.created_at,receiptObservedAt:receipt.observedAt};
}

async function main(){
  const args=process.argv.slice(2),options={};
  for(let i=0;i<args.length;i+=2){
    const key=args[i];
    if(!['--latest','--receipt'].includes(key)||Object.hasOwn(options,key)||!args[i+1]||args[i+1].startsWith('--'))throw Error('Options: --latest FILE --receipt FILE');
    options[key]=args[i+1];
  }
  if(!options['--latest']||!options['--receipt'])throw Error('Both latest deployment and receipt are required');
  const latest=JSON.parse(await readFile(options['--latest'],'utf8'));
  const receipt=JSON.parse(await readFile(options['--receipt'],'utf8'));
  const result=latestPagesDeploymentAllowed(latest,receipt);
  console.log(JSON.stringify({status:'PASS',...result}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{
  console.error('BLOCKED: Pages ON refused because a newer deployment exists or deployment metadata is unavailable. No deployment occurred.');
  process.exitCode=1;
});
