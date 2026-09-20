const { chromium } = require('./tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const line = fs.readFileSync('.env.local','utf8').split('\n').find(l => l.startsWith('OAUTH_SITE_URL='));
const origin = JSON.parse(line.slice('OAUTH_SITE_URL='.length));
(async () => {
 const browser = await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 const context = await browser.newContext({serviceWorkers:'block'});
 const report = {scope:'Browser link behavior only. OAuth start is intercepted with a marker; real provider sign-in is NOT simulated or tested.',beforeFix:{target:'_top',sandboxNavigationBlocked:true,oauthRequests:0},checks:[],viewports:[],actualArenaStandaloneStatus:403,liveGoogleSignInCompleted:false};
 await context.route(origin + '/api/auth/oauth/*', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>OAuth start reached</title><p>Navigation test boundary</p>'}));
 try {
  for (const width of [1440,375]) {
   const page=await context.newPage();await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:3000/login',{waitUntil:'networkidle'});
   await page.setContent('<iframe sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" src="http://localhost:3000/login" style="border:0;width:100%;height:1500px"></iframe>');
   const frame=page.frameLocator('iframe');const link=frame.getByRole('link',{name:'تسجيل باستخدام Google'});await link.waitFor();
   assert.equal(await link.getAttribute('target'),'_blank');
   assert.equal(await link.getAttribute('href'),origin+'/api/auth/oauth/google');
   const pending=page.waitForEvent('popup');await link.click();const popup=await pending;
   await popup.waitForLoadState('domcontentloaded');
   assert.equal(await popup.title(),'OAuth start reached');
   assert.equal(popup.url(),origin+'/api/auth/oauth/google');
   await frame.getByRole('button',{name:'نسخ رابط الدخول'}).waitFor();
   assert.equal(await frame.locator('input').count(),0);
   report.viewports.push({width,newTabOpened:true,canonicalOAuthStartReached:true});
   await popup.close();await page.close();
  }
  const page=await context.newPage();await page.goto('http://localhost:3000/login',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>document.querySelector('.social-provider-google')?.target==='_self');
  await page.getByRole('link',{name:'تسجيل باستخدام Google'}).focus();await page.keyboard.press('Enter');
  await page.waitForURL(origin+'/api/auth/oauth/google');assert.equal(await page.title(),'OAuth start reached');
  report.checks.push('Standalone keyboard activation navigates in the same tab');await page.close();
  const blocked=await context.newPage();await blocked.goto('http://127.0.0.1:3000/login',{waitUntil:'networkidle'});
  await blocked.setContent('<iframe sandbox="allow-scripts allow-same-origin" src="http://localhost:3000/login" style="width:100%;height:1500px"></iframe>');
  const frame=blocked.frameLocator('iframe');await frame.getByRole('link',{name:'تسجيل باستخدام Google'}).click();
  await frame.getByRole('button',{name:'نسخ رابط الدخول'}).waitFor();await frame.getByRole('button',{name:'نسخ رابط الدخول'}).click();
  const fallback=frame.locator('.social-login-help > a');await fallback.waitFor();
  assert.equal(await fallback.getAttribute('href'),origin+'/api/auth/oauth/google');
  report.checks.push('Strict popup-blocked embed exposes copy/manual-open fallback rather than a silent click');await blocked.close();
  report.completed=true;
 } catch(e) {report.failure=e.message;process.exitCode=1;}
 finally {await browser.close();fs.writeFileSync('verification/google-button-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
