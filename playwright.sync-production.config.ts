import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/sync/production',workers:1,timeout:45000,reporter:'list',outputDir:'sync-qa-results/production',
  use:{baseURL:'http://127.0.0.1:5196/optilab/',browserName:'chromium'},
  webServer:{command:'npm run preview -- --host 127.0.0.1 --port 5196 --strictPort',url:'http://127.0.0.1:5196/optilab/',reuseExistingServer:false},
});
