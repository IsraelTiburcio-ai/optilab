import {spawnSync} from 'node:child_process';
if(process.argv.length!==2||process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST)
  throw new Error('Use npm run test:sync without overrides or inherited emulator hosts.');
const browser=process.env.SYNC_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('SYNC_BROWSER must be chromium or webkit.');
const result=spawnSync('npx',['--yes','firebase-tools@15.0.0','emulators:exec','--only','auth,firestore',
  '--project','demo-optilab-sync','--config','firebase.sync-emulator.json',
  `npm run test:sync:core && npm run test:sync:ui -- --browser ${browser}`],{stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-optilab-sync',GOOGLE_CLOUD_PROJECT:'demo-optilab-sync'}});
process.exit(result.status??1);
