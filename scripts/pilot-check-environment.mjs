import {assertProtectedEnvironment} from '../server/pilot/environment.mjs';
try{
 if(process.env.GITHUB_REPOSITORY!=='IsraelTiburcio-ai/optilab'||!process.env.GH_TOKEN)throw Error('Unexpected repository/token missing');
 const response=await fetch('https://api.github.com/repos/IsraelTiburcio-ai/optilab/environments/private-pilot-approval',{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Environment metadata unavailable');assertProtectedEnvironment(await response.json());console.log('Protected private-pilot environment verified.');
}catch{console.error('Private pilot blocked: required reviewers, no self-review and no administrator bypass must be verified. No token logged.');process.exitCode=1;}
