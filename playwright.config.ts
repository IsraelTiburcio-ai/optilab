import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:45000,use:{baseURL:'http://127.0.0.1:5187/optilab/',browserName:'chromium'},webServer:{command:'npm run dev -- --port 5187 --strictPort',url:'http://127.0.0.1:5187/optilab/',reuseExistingServer:true},reporter:[['list'],['html',{open:'never'}]]});
