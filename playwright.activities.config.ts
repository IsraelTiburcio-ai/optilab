import {defineConfig} from '@playwright/test';
const browser=process.env.ACTIVITY_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('Unsupported activity QA browser');
export default defineConfig({testDir:'./tests/activities/ui',workers:1,timeout:60000,reporter:'list',outputDir:'activities-qa-results',
  use:{baseURL:'http://127.0.0.1:5189/optilab/',browserName:browser as 'chromium'|'webkit',reducedMotion:'reduce',trace:'off',screenshot:'off',video:'off'},
  webServer:{command:'npm run dev -- --host 127.0.0.1 --port 5189 --strictPort',url:'http://127.0.0.1:5189/optilab/',reuseExistingServer:false,
    env:{VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_AUTH_DOMAIN:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_STORAGE_BUCKET:'',VITE_FIREBASE_MESSAGING_SENDER_ID:'',VITE_FIREBASE_APP_ID:'',VITE_FIREBASE_AUTH_EMULATOR_URL:'',VITE_FIRESTORE_EMULATOR_HOST:'',VITE_PROGRESS_SYNC:'',VITE_ACADEMIC_ADMIN:''}},
});
