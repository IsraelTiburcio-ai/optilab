import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/sync/ui',timeout:60000,workers:1,reporter:'list',outputDir:'sync-qa-results',
  use:{baseURL:'http://127.0.0.1:5195/optilab/',browserName:'chromium',reducedMotion:'reduce'},
  webServer:[{command:'npm run dev -- --port 5195 --strictPort',url:'http://127.0.0.1:5195/optilab/',reuseExistingServer:false,
    env:{VITE_FIREBASE_API_KEY:'demo-emulator-only-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-optilab-sync.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID:'demo-optilab-sync',VITE_FIREBASE_STORAGE_BUCKET:'demo-optilab-sync.example',
      VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789',VITE_FIREBASE_APP_ID:'1:123456789:web:demooptilabsync',
      VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',VITE_PROGRESS_SYNC:'emulator'},
  },...(process.env.MEMORAMA_DIR?[{command:'python3 -m http.server 5190 --bind 127.0.0.1',cwd:process.env.MEMORAMA_DIR,
    url:'http://127.0.0.1:5190/',reuseExistingServer:false}]:[])],
});
