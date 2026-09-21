import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',timeout:process.env.CI?180000:90000,expect:{timeout:15000},fullyParallel:false,workers:1,
 reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:5173',channel:process.env.CI?undefined:'chrome',headless:true,viewport:{width:1440,height:960},screenshot:'only-on-failure',trace:'retain-on-failure',actionTimeout:10000,launchOptions:process.env.CI?{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}},
 webServer:{command:'pnpm dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000},
});
