const {chromium}=require('./tools/node_modules/playwright');
const {AxeBuilder}=require('./tools/node_modules/@axe-core/playwright');
const Database=require('better-sqlite3');
const {randomUUID,randomBytes,createHash}=require('node:crypto');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const origin='http://localhost:3100';
const report={scope:'Disposable local production-build data, including image fixtures; no production account/media is modified.',widths:[],checks:[],errors:[],completed:false};
(async()=>{
 fs.mkdirSync('verification/saved-page',{recursive:true});
 const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LANG:'C.UTF-8',LC_ALL:'C.UTF-8'}});
 const db=new Database('.cache/saved-qa-data/yemreact.sqlite');db.pragma('foreign_keys = ON');
 const codes=[];const id=randomUUID(),token=randomBytes(32).toString('hex');
 const base=JSON.parse(db.prepare('SELECT data FROM reactions LIMIT 1').get().data);
 let context;
 try{
  for(let i=0;i<19;i++){
   const code='YR-SAVED-QA-'+String(i).padStart(2,'0');codes.push(code);
   const image=i%2===0;
   const r={...base,code,caption:['يا ساتر!','معك حق','على مهلك','قوية جدًا'][i%4],situation:image?'صورة تستحق الاحتفاظ':'ردّ جاهز للموقف',isDemo:false,media:image?(i===0?'/og.png':`/media/portrait-${i%6+1}.webp`):`/media/demo-${i%6+1}.mp4`,poster:`/media/portrait-${i%6+1}.webp`,duration:image?(i===0?999:0):[2,3,4,3,5,2][i%6],publishedAt:'2026-09-'+String(i+1).padStart(2,'0')};
   db.prepare('INSERT INTO reactions(code,data) VALUES (?,?)').run(code,JSON.stringify(r));
  }
  db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(id,'اختبار المحفوظات',id+'@example.invalid','social-only','member',new Date().toISOString());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+3600000);
  for(const code of codes)db.prepare('INSERT INTO saved VALUES (?,?)').run(id,code);
  context=await browser.newContext({viewport:{width:375,height:900},serviceWorkers:'block'});
  await context.addInitScript(items=>{if(!localStorage.getItem('yr:guest-saved'))localStorage.setItem('yr:guest-saved',JSON.stringify(items));},codes);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const loadAll=async(total)=>{
   for(let attempts=0;attempts<8 && await page.locator('.reaction-card').count()<total;attempts++){
    const before=await page.locator('.reaction-card').count();
    await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await page.waitForFunction(n=>document.querySelectorAll('.reaction-card').length>n,before);
   }
   assert.equal(await page.locator('.reaction-card').count(),total);
   await page.evaluate(()=>document.fonts.ready);
  };
  assert.equal((await page.goto(origin+'/saved?q=not-found&cat=not-real&duration=1',{waitUntil:'networkidle'})).status(),200);
  await page.locator('.saved-card').first().waitFor();
  assert.equal(await page.locator('#saved-title').innerText(),'المحفوظات');
  assert.equal(await page.locator('main input, main select, main form, main .library-note, main .duration-filter, .site-footer').count(),0);
  await loadAll(19);
  assert.equal(await page.locator('[data-media-type="image"]').count(),10);
  assert.equal(await page.locator('[data-media-type="video"]').count(),9);
  assert.equal(await page.locator('[data-media-type="image"] .card-duration').count(),0);
  assert.equal(await page.locator('[data-media-type="video"] .card-duration').count(),9);
  assert.equal(await page.locator('[data-media-type="image"] .lucide-play').count(),0);
  assert.doesNotMatch(await page.locator('main').innerText(),/YR-SAVED|مجموعتك|تصدير|المدة|فئات|أظهر المزيد/);
  report.checks.push('No filters/search/footer/export/counters; obsolete query parameters cannot hide saved images or videos; automatic scrolling includes all 19 items.');
  for(const width of [320,375,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});await page.evaluate(()=>window.scrollTo(0,0));
   await page.waitForFunction(()=>[...document.querySelectorAll('.saved-card .card-image')].filter(e=>e.getBoundingClientRect().top<innerHeight).every(e=>e.complete));
   await page.waitForTimeout(180);
   const metric=await page.evaluate(()=>{
    const boxes=[...document.querySelectorAll('.saved-card')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth+1,columns:getComputedStyle(document.querySelector('.library-masonry')).gridTemplateColumns.split(' ').length,overlap:boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1))};
   });assert.equal(metric.overflow,false);assert.equal(metric.overlap,false);report.widths.push(metric);
   if([375,1440].includes(width))await page.screenshot({path:`verification/saved-page/saved-${width}.png`,fullPage:true});
  }
  const imageCard=page.locator('[data-media-type="image"]').first();
  const imageCode=(await imageCard.locator('.card-info a').getAttribute('href')).split('/').pop();
  await imageCard.locator('.card-preview').click();
  await page.locator('dialog[open] .clip-still').waitFor();
  assert.equal(await page.locator('dialog[open] video').count(),0);
  await page.evaluate(()=>{const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.__downloadCheck={name:this.download,kind:this.href.split(':',1)[0]};return click.call(this);};});
  const download=page.waitForEvent('download');await page.locator('dialog[open]').getByRole('button',{name:'خذها',exact:true}).click();
  const filename=(await download).suggestedFilename(); report.imageDownloadFilename=filename;report.downloadRequest=await page.evaluate(()=>window.__downloadCheck); assert.ok(filename.endsWith('.webp'), 'Image download must keep its format: '+filename);
  await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
  await page.locator('[data-media-type="video"]').first().locator('.card-preview').click();
  await page.locator('dialog[open] video').waitFor();
  await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
  await page.locator('.saved-card:has(a[href="/r/YR-SAVED-QA-00"]) .card-preview').click();
  await page.locator('dialog[open] .clip-still').waitFor();
  assert.equal(new URL(await page.locator('dialog[open] .clip-still').getAttribute('src'),origin).pathname,'/og.png');
  const png=page.waitForEvent('download');await page.locator('dialog[open]').getByRole('button',{name:'خذها',exact:true}).click();assert.ok((await png).suggestedFilename().endsWith('.png'));
  await page.keyboard.press('Escape');await page.locator('dialog[open]').waitFor({state:'hidden'});
  report.checks.push('Images preview as images and download as .webp/.png, including a wide image; videos use a native video player; duration badges are video-only.');
  await page.locator(`.saved-card:has(a[href="/r/${imageCode}"]) .save-button`).click();
  await page.waitForFunction(code=>!JSON.parse(localStorage.getItem('yr:guest-saved')).includes(code),imageCode);
  await page.reload({waitUntil:'networkidle'});await loadAll(18);
  assert.equal(await page.locator(`a[href="/r/${imageCode}"]`).count(),0);
  report.checks.push('Unsave removes the card and persists across reload for guests.');
  report.axe=[];
  for(const theme of ['light','dark']){
   await page.evaluate(t=>{document.documentElement.dataset.theme=t;window.scrollTo(0,0);},theme);
   const audit=await new AxeBuilder({page}).analyze();
   const result={theme,violations:audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))};report.axe.push(result);assert.equal(result.violations.length,0,JSON.stringify(result));
  }
  await page.evaluate(()=>{localStorage.setItem('yr:guest-saved','[]');document.documentElement.dataset.theme='light';});
  await page.goto(origin+'/saved/',{waitUntil:'networkidle'});await page.locator('.saved-empty').waitFor();
  assert.equal(await page.locator('.site-footer').count(),0);
  assert.equal(await page.locator('main a[href="/library"]').count(),1);
  await page.screenshot({path:'verification/saved-page/empty.png',fullPage:true});
  await page.locator('main a[href="/library"]').click();await page.waitForURL(origin+'/library');
  await page.locator('.reaction-card').first().waitFor();assert.equal(await page.locator('.site-footer').count(),0);
  await page.goto(origin,{waitUntil:'networkidle'});assert.equal(await page.locator('.site-footer').count(),1);assert.equal(await page.locator('header a[href="/saved"]').innerText(),'المحفوظات');
  report.checks.push('Empty state offers one library action; saved footer is absent including trailing slash; home footer is unchanged.');
  await context.close();context=await browser.newContext({viewport:{width:375,height:900},serviceWorkers:'block'});
  await context.addCookies([{name:'yr_session',value:token,url:origin,httpOnly:true,sameSite:'Lax'}]);
  const signed=await context.newPage();await signed.goto(origin+'/saved',{waitUntil:'networkidle'});await signed.locator('.saved-card').first().waitFor();
  assert.match(await signed.locator('.saved-heading p').innerText(),/اخترتها/);
  const code=(await signed.locator('.card-info a').first().getAttribute('href')).split('/').pop();
  await Promise.all([signed.waitForResponse(r=>r.url()===origin+'/api/saved'&&r.request().method()==='PUT'), signed.locator('.save-button').first().click()]);
  assert.equal(db.prepare('SELECT 1 FROM saved WHERE user_id=? AND code=?').get(id,code),undefined);
  await signed.reload({waitUntil:'networkidle'});assert.equal(await signed.locator(`a[href="/r/${code}"]`).count(),0);
  assert.equal(await signed.locator('header a[href="/admin"]').count(),0);
  report.checks.push('Signed-in member saved items load from the database; removal persists without changing admin access.');
  assert.deepEqual(report.errors,[]);report.completed=true;
 }catch(e){report.failure=e.message;process.exitCode=1;}
 finally{
  if(context)await context.close();await browser.close();
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  for(const code of codes)db.prepare('DELETE FROM reactions WHERE code=?').run(code);
  db.close();fs.writeFileSync('verification/saved-page/results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
})();
