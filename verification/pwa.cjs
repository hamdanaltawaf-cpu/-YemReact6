const {chromium}=require('./tools/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();const report={};try{
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle'});report.controlled=await page.evaluate(()=>!!navigator.serviceWorker.controller);assert.equal(report.controlled,true);
 await page.goto('http://127.0.0.1:3000/library',{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
 report.manifest=await page.evaluate(()=>fetch('/manifest.webmanifest').then(r=>r.json()));assert.equal(report.manifest.display,'standalone');
 report.cacheUrls=await page.evaluate(async()=>{const c=await caches.open('yemreact-public-v4.2');return (await c.keys()).map(k=>new URL(k.url).pathname);});assert.ok(!report.cacheUrls.some(u=>u.startsWith('/api/')||u.endsWith('.mp4')||u==='/login'||u==='/saved'||u==='/admin'));
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'دوّر على موقفك.'}).waitFor();report.cachedLibraryOffline=true;
 await page.goto('http://127.0.0.1:3000/r/UNCACHED-OFFLINE',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'النت راح... والردّ ما راح.'}).waitFor();report.fallbackOffline=true;
 await context.setOffline(false);report.completed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync('verification/v4/pwa.json',JSON.stringify(report,null,2));console.log(report);await browser.close();}})();
