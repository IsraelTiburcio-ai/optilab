import {readFile,mkdir,writeFile,realpath,rm,lstat} from 'node:fs/promises';
import {resolve,dirname,basename,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareSession} from '../server/single-operator/preparation.mjs';

// Deliberately no --execute, credentials, Firebase SDK, fetch, or workflow dispatch.
async function main(){
  const args=process.argv.slice(2),o={};
  for(let i=0;i<args.length;i+=2){if(!['--manifest','--out'].includes(args[i])||o[args[i]]||!args[i+1]||args[i+1].startsWith('--'))throw Error('Options: --manifest FILE [--out NEW_PRIVATE_DIRECTORY]');o[args[i]]=args[i+1];}
  if(!o['--manifest'])throw Error('Explicit private manifest required');
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const m=JSON.parse(await readFile(o['--manifest'],'utf8'));
  const [base,pilot]=await Promise.all(['firestore.rules','firestore.pilot.rules'].map(p=>readFile(resolve(root,p),'utf8')));
  const bundle=prepareSession(m,{base,pilot});
  if(o['--out']){
    const out=resolve(o['--out']),parent=await realpath(dirname(out)),repo=await realpath(root);
    for(let cursor=parent;;cursor=dirname(cursor)){
      try{await lstat(resolve(cursor,'.git'));throw Error('Private output cannot be inside any Git checkout');}
      catch(error){if(error.code!=='ENOENT')throw error;}
      if(dirname(cursor)===cursor)break;
    }
    // Resolve symlinked parents before checking containment. Never write UID-bearing files into Git.
    const outside=relative(repo,parent);
    if(outside===''||(!isAbsolute(outside)&&outside!=='..'&&!outside.startsWith('..'+sep)))throw Error('Output must be outside the repository');
    const approved=await realpath(m.exports.directory),within=relative(approved,parent);
    if(isAbsolute(within)||within==='..'||within.startsWith('..'+sep))throw Error('Output must be inside the declared private export location');
    const destination=resolve(parent,basename(out));
    await mkdir(destination,{mode:0o700});
    try{for(const [file,content] of Object.entries({'candidate.rules':bundle.rules,'control-paused.json':JSON.stringify(bundle.control,null,2),'approval-plan.json':JSON.stringify(bundle.plan,null,2),'session.json':JSON.stringify(m,null,2)}))await writeFile(resolve(destination,file),content,{mode:0o600,flag:'wx'});}
    catch(error){await rm(destination,{recursive:true,force:true});throw error;}
  }
  console.log(JSON.stringify({mode:bundle.plan.mode,frontendSha:bundle.plan.frontendSha,rulesSha256:bundle.plan.rulesSha256,approvalRequired:true,executionImplemented:false,network:false,productionWrites:false,privateBundleWritten:!!o['--out']}));
}
try{await main();}catch{console.error('BLOCKED: invalid single-operator preparation, changed sources or unsafe output. No network or production actions.');process.exitCode=1;}
