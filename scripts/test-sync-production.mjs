import {spawnSync} from 'node:child_process';
if(process.argv.length!==2)throw new Error('No production/project overrides allowed.');
const built=spawnSync('npm',['run','build'],{stdio:'inherit',env:{...process.env,
  VITE_FIREBASE_API_KEY:'demo-emulator-only-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-optilab-sync.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'demo-optilab-sync',VITE_FIREBASE_STORAGE_BUCKET:'demo-optilab-sync.example',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789',VITE_FIREBASE_APP_ID:'1:123456789:web:demooptilabsync',
  VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',VITE_PROGRESS_SYNC:'emulator',
}});
if(built.status!==0)process.exit(built.status??1);
const result=spawnSync('npx',['playwright','test','--config','playwright.sync-production.config.ts'],{stdio:'inherit'});
process.exit(result.status??1);
