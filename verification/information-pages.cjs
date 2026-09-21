const {chromium}=require('./tools/node_modules/playwright');
const {AxeBuilder}=require('./tools/node_modules/@axe-core/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.QA_BASE_URL||'http://localhost:3100';
const live=base.startsWith('https:');
(async()=>{
 fs.mkdirSync('verification/information',{recursive:true});
 const report={base,live,checks:[],widths:[],errors:[],completed:false};
 const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const direct=await context.request.get(base+'/about',{maxRedirects:0});
  assert.equal(direct.status(),308);assert.equal(direct.headers().location,'/help');
  const routes=[['/about','/help',''],['/about#faq','/help','#faq'],['/about#privacy','/privacy',''],['/about/#privacy','/privacy',''],['/about?from=old#privacy','/privacy',''],['/help#%70rivacy','/privacy',''],['/about#unknown','/help','#unknown']];
  for(const [from,path,hash] of routes){
   await page.goto(base+from,{waitUntil:'networkidle'});
   await page.waitForURL(url=>url.pathname===path&&url.hash===hash);
   assert.equal(await page.locator('h1').innerText(),path==='/help'?'المساعدة':'الخصوصية وحقوق المحتوى');
   assert.equal(await page.locator('a[href^="/about"]').count(),0);
  }
  report.checks.push('Permanent HTTP redirect and fragment-aware legacy links resolve to the correct new page.');
  for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:900});
   for(const route of ['/','/library','/saved','/login','/help','/privacy']){
    assert.equal((await page.goto(base+route,{waitUntil:'networkidle'})).status(),200);
    assert.equal(await page.locator('a[href^="/about"], .story-section, .footer-top, .footer-note').count(),0);
    assert.equal((await page.locator('body').innerText()).includes('حكايتنا'),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const noFooter=['/library','/saved','/login'].includes(route);
    assert.equal(await page.locator('.site-footer').count(),noFooter?0:1);
    assert.equal(await page.locator('.desktop-nav a[href="/help"], .desktop-nav a[href="/privacy"]').count(),0);
    if(noFooter){
     if(width<=650){await page.getByRole('button',{name:'فتح القائمة',exact:true}).click();await page.locator('.mobile-nav').getByRole('link',{name:'المساعدة',exact:true}).waitFor();}
     else assert.equal(await page.locator('.header-help').isVisible(),true);
    }else assert.equal(await page.locator('.header-help').count(),0);
    if(route==='/login')assert.equal(await page.locator('.social-privacy a').getAttribute('href'),'/privacy');
    if(route==='/help'){
     assert.equal(await page.locator('.site-footer a[href="/help"]').count(),0);
     const summary=page.locator('.information-faq summary').first();await summary.focus();await page.keyboard.press('Enter');
     assert.equal(await page.locator('.information-faq details[open]').count(),1);
    }
    if(route==='/privacy')assert.equal(await page.locator('.site-footer a[href="/privacy"]').count(),0);
    report.widths.push({width,route,overflow:false,noOldLinks:true});
    if([375,1440].includes(width)&&['/help','/privacy'].includes(route))await page.screenshot({path:`verification/information/${live?'live-':''}${route.slice(1)}-${width}.png`,fullPage:true});
   }
  }
  report.checks.push('Navigation prioritizes library/saved; footer is compact and stays absent on library/saved/login; contextual help and sign-in privacy remain reachable.');
  const sitemap=await (await context.request.get(base+'/sitemap.xml')).text();assert.ok(sitemap.includes('/help')&&sitemap.includes('/privacy'));assert.ok(!sitemap.includes('/about'));
  assert.equal((await context.request.get(base+'/admin',{maxRedirects:0})).status(),307);
  const sw=await (await context.request.get(base+'/sw.js')).text();assert.ok(sw.includes('v4.3-information'));assert.ok(!sw.includes('/about'));
  const nojs=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});const fallback=await nojs.newPage();
  await fallback.goto(base+'/about#privacy');assert.equal(new URL(fallback.url()).pathname,'/help');
  await fallback.locator('a#privacy').click({force:true});await fallback.waitForURL(base+'/privacy');assert.equal(await fallback.locator('h1').innerText(),'الخصوصية وحقوق المحتوى');
  await nojs.close();report.checks.push('Sitemap and cache routes updated; admin gate unchanged; no-JavaScript legacy visitors have a working privacy link.');
  report.axe=[];
  for(const route of ['/help','/privacy'])for(const theme of ['light','dark']){
   await page.goto(base+route,{waitUntil:'networkidle'});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const audit=await new AxeBuilder({page}).analyze();const result={route,theme,violations:audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))};report.axe.push(result);assert.equal(result.violations.length,0,JSON.stringify(result));
  }
  await context.close();
  if(!live){
   const swContext=await browser.newContext({serviceWorkers:'allow'});const swPage=await swContext.newPage();
   await swContext.route('**/sw.js',route=>route.fulfill({status:404,body:''}));
   await swPage.goto(base+'/help');
   await swPage.evaluate(async()=>{const cache=await caches.open('yemreact-public-v4.2');await cache.put('/about',new Response('old story',{headers:{'content-type':'text/html'}}));});
   await swContext.unroute('**/sw.js');
   await swPage.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});
   await swPage.waitForFunction(async()=>!(await caches.keys()).includes('yemreact-public-v4.2'));
   await swPage.goto(base+'/about#privacy',{waitUntil:'networkidle'});await swPage.waitForURL(base+'/privacy');
   report.checks.push('New service worker activates, removes the old about cache and follows legacy privacy URLs.');
   await swContext.close();
  }
  assert.deepEqual(report.errors,[]);report.completed=true;
 }catch(e){report.failure=e.message;process.exitCode=1;}
 finally{await browser.close();fs.writeFileSync(`verification/information/${live?'live-':''}results.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
})();
