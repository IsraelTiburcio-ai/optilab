import {defineConfig} from '@playwright/test';
const browser=process.env.TEACHER_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('ACADEMIC_ENV_REJECTED');
export default defineConfig({testDir:'./tests/teacher/ui',workers:1,timeout:60000,reporter:'list',outputDir:'teacher-qa-results',
  use:{baseURL:'http://127.0.0.1:5195/optilab/',browserName:browser as 'chromium'|'webkit',reducedMotion:'reduce',trace:'off',screenshot:'off',video:'off'},
  webServer:{command:'npm run dev:academic-ui',url:'http://127.0.0.1:5195/optilab/',reuseExistingServer:process.env.TEACHER_REUSE_VITE==='1'&&!process.env.CI},
});
