import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const browser=process.env.DOMAIN_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('Unsupported browser.');
const env={...process.env,OPTILAB_PAGES_TARGET:'optilab.club',VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_AUTH_DOMAIN:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_STORAGE_BUCKET:'',VITE_FIREBASE_MESSAGING_SENDER_ID:'',VITE_FIREBASE_APP_ID:'',VITE_PROGRESS_SYNC:'disabled',VITE_PROGRESS_SYNC_RELEASE:'',VITE_PROGRESS_SYNC_PROJECT_ID:'',VITE_PROGRESS_SYNC_ORIGIN:'',VITE_FIREBASE_AUTH_EMULATOR_URL:'',VITE_FIRESTORE_EMULATOR_HOST:''};
const steps=[['node',['--import','tsx','--test','tests/deployment/pages-base.test.mjs']],['npm',['run','build']],[resolve('node_modules/.bin/playwright'),['test','--config','playwright.domain.config.ts']]];
for(const [command,args] of steps){const result=spawnSync(command,args,{env:{...env,DOMAIN_BROWSER:browser},stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
