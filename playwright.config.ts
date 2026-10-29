import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './tests', testIgnore: ['**/auth/**', '**/firestore/**', '**/sync/**', '**/academic/**', '**/teacher/**', '**/activities/**', '**/original-games/**'], timeout: 45000,
  use: {baseURL: 'http://127.0.0.1:5187/optilab/', browserName: 'chromium'},
  webServer: [{
    command: 'npm run dev -- --port 5187 --strictPort',
    url: 'http://127.0.0.1:5187/optilab/', reuseExistingServer: false,
    // Never inherit the owner's real .env.local for guest/regression tests.
    // Vite's process environment takes precedence even for explicit empty values.
    env: {
      VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_AUTH_DOMAIN: '', VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_STORAGE_BUCKET: '', VITE_FIREBASE_MESSAGING_SENDER_ID: '', VITE_FIREBASE_APP_ID: '',
      VITE_FIREBASE_AUTH_EMULATOR_URL: '',
      VITE_FIRESTORE_EMULATOR_HOST: '', VITE_PROGRESS_SYNC: '',
    },
  }, ...(process.env.MEMORAMA_DIR ? [{
    command: 'python3 -m http.server 5190 --bind 127.0.0.1', cwd: process.env.MEMORAMA_DIR,
    url: 'http://127.0.0.1:5190/', reuseExistingServer: true,
  }] : [])],
  reporter: [['list'], ['html', {open: 'never'}]],
});
