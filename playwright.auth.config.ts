import {defineConfig} from '@playwright/test';
const emulator=process.env.AUTH_QA_EMULATOR_URL??'http://127.0.0.1:9099';
if(!/^http:\/\/127\.0\.0\.1:(9099|9299)$/.test(emulator))throw new Error('Auth QA requires an explicitly allowed isolated loopback emulator.');

export default defineConfig({
  testDir: './tests/auth', timeout: 60000, workers: 1,
  reporter: [['list']], outputDir: 'auth-qa-results',
  use: {baseURL: 'http://127.0.0.1:5188/optilab/', browserName: 'chromium'},
  webServer: {
    command: 'npm run dev -- --port 5188 --strictPort',
    url: 'http://127.0.0.1:5188/optilab/', reuseExistingServer: !process.env.CI,
    env: {
      // Synthetic demo-only configuration. These are not production credentials.
      VITE_FIREBASE_API_KEY: 'demo-emulator-only-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'demo-optilab-auth.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'demo-optilab-auth',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-optilab-auth.example',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789',
      VITE_FIREBASE_APP_ID: '1:123456789:web:demooptilabauth',
      VITE_FIREBASE_AUTH_EMULATOR_URL: emulator,
    },
  },
});
