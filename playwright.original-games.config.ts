import {defineConfig} from '@playwright/test';
import activityConfig from './playwright.activities.config';
const browser=process.env.ORIGINAL_GAME_BROWSER??'chromium';
if(!['chromium','webkit'].includes(browser))throw new Error('Unsupported original game QA browser');
// Reuse the Firebase-free QA server on 5189. Run these suites sequentially.
export default defineConfig({...activityConfig,testDir:'./tests/original-games/ui',outputDir:'original-game-qa-results',
  use:{...activityConfig.use,browserName:browser as 'chromium'|'webkit'}});
