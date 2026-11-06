import {readFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {buildPilotPlan} from '../server/pilot/provision.mjs';
const root=process.cwd();
const checks=[];
const check=(name,ok,detail='')=>checks.push({name,ok:Boolean(ok),detail});
async function read(path){return readFile(join(root,path),'utf8');}
async function sourceFiles(dir){
  const out=[];for(const entry of await readdir(join(root,dir),{withFileTypes:true})){
    const path=join(dir,entry.name);if(entry.isDirectory())out.push(...await sourceFiles(path));else if(entry.name.endsWith('.ts'))out.push(path);
  }return out;
}
export async function runPreflight({remote=true,manifest=null}={}){
  checks.length=0;
  const indexes=JSON.parse(await read('firestore.indexes.json'));
  const wildcard=indexes.fieldOverrides?.find(row=>row.collectionGroup==='reportedAttempts'&&row.fieldPath==='*');
  const observed=indexes.fieldOverrides?.find(row=>row.collectionGroup==='reportedAttempts'&&row.fieldPath==='observedAt');
  check('reportedAttempts wildcard exemption',wildcard&&wildcard.indexes?.length===0);
  check('reportedAttempts.observedAt collection DESC index',JSON.stringify(observed?.indexes)==='[{"order":"DESCENDING","queryScope":"COLLECTION"}]');
  check('production API configuration',JSON.parse(await read('firebase.production.json')).firestore?.indexes==='firestore.indexes.json');
  check('Pages CNAME', (await read('public/CNAME')).trim()==='optilab.club');
  const deploy=await read('.github/workflows/deploy.yml');
  check('Pages workflow enables academic production',/VITE_PROGRESS_SYNC: disabled/.test(deploy)&&/VITE_ACADEMIC_API_MODE:\s*production/.test(deploy)&&/VITE_ACADEMIC_API_URL:\s*https:\/\/optilab-api\.vercel\.app\/api/.test(deploy)&&/VITE_ACADEMIC_APP_ORIGIN:\s*https:\/\/optilab\.club/.test(deploy));
  check('ESM relative imports carry extensions',(await Promise.all((await sourceFiles('server/academic')).concat(await sourceFiles('api')).map(async file=>{
    const source=await read(file);const matches=[...source.matchAll(/(?:from\s+|import\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)].map(match=>match[1]);
    return matches.filter(spec=>!spec.endsWith('.js')&&!spec.endsWith('.json')&&!spec.endsWith('.mjs')&&!spec.endsWith('.cjs'));
  }))).flat().length===0);
  check('JSON module attribute',/with\s*\{\s*type:\s*['"]json['"]\s*\}/.test(await read('server/academic/catalog.ts')));
  if(manifest){const plan=buildPilotPlan(manifest);check('pilot plan is exactly 10 documents and dry-run',plan.mode==='DRY-RUN'&&plan.writes.length===10);}
  if(remote){
    try{
      const options=await fetch('https://optilab-api.vercel.app/api/v1/roster',{method:'OPTIONS',headers:{Origin:'https://optilab.club','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'},signal:AbortSignal.timeout(8000)});
      check('production API CORS preflight',options.status===204&&options.headers.get('access-control-allow-origin')==='https://optilab.club',`HTTP ${options.status}`);
      const response=await fetch('https://optilab-api.vercel.app/api/v1/roster',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://optilab.club'},body:'{}',signal:AbortSignal.timeout(8000)});
      const body=await response.json().catch(()=>({}));
      check('production API requires authentication',response.status===401&&body?.error?.code==='UNAUTHENTICATED',`HTTP ${response.status}`);
    }catch(error){check('production API checks',false,error instanceof Error?error.message:'network error');}
  }
  return {ok:checks.every(item=>item.ok),checks};
}
if(import.meta.url===`file://${process.argv[1]}`){
  try{const result=await runPreflight();console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}catch(error){console.error(error instanceof Error?error.message:'PILOT_PREFLIGHT_FAILED');process.exitCode=1;}
}
