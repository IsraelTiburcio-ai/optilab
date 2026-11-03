import {defineConfig} from '@playwright/test';
const browser=process.env.DOMAIN_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('Unsupported domain browser.');
const port=Number(process.env.DOMAIN_PORT??5198);if(![5198,5199].includes(port))throw new Error('Unsupported isolated domain QA port.');
export default defineConfig({testDir:'./tests/deployment',testMatch:'domain.spec.ts',timeout:60000,workers:1,reporter:'dot',outputDir:'domain-qa-results',
  use:{baseURL:'https://optilab.club/',browserName:browser as 'chromium'|'webkit',reducedMotion:'reduce'},
  webServer:{command:`npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,url:`http://127.0.0.1:${port}/`,reuseExistingServer:false,
    env:{DOMAIN_PORT:String(port),OPTILAB_PAGES_TARGET:'optilab.club',VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_AUTH_DOMAIN:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_STORAGE_BUCKET:'',VITE_FIREBASE_MESSAGING_SENDER_ID:'',VITE_FIREBASE_APP_ID:'',VITE_PROGRESS_SYNC:'disabled',VITE_PROGRESS_SYNC_RELEASE:'',VITE_PROGRESS_SYNC_PROJECT_ID:'',VITE_PROGRESS_SYNC_ORIGIN:'',VITE_FIREBASE_AUTH_EMULATOR_URL:'',VITE_FIRESTORE_EMULATOR_HOST:''}},
});
