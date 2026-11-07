import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const sha=process.env.GITHUB_SHA;
if(!/^[a-f0-9]{40}$/.test(sha??''))throw Error('Exact deployed commit required');
const rulesSha256=createHash('sha256').update(readFileSync('firestore.production.rules')).digest('hex');
writeFileSync('dist/production-release.json',JSON.stringify({version:1,sha,release:'general-progress-v1',sync:'production',integrated:true,rulesSha256,api:'https://optilab-api.vercel.app/api'})+'\n');
