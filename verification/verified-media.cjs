const {chromium}=require('./tools/node_modules/playwright');
const {AxeBuilder}=require('./tools/node_modules/@axe-core/playwright');
const Database=require('better-sqlite3');
const sharp=require('sharp');
const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomBytes,randomUUID}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const base='http://localhost:3100',root=path.resolve('.cache/media-qa-data');
const report={scope:'Disposable local production-build database and synthetic local-only uploads; no production mutations.',checks:[],widths:[],axe:[],errors:[],completed:false};
(async()=>{
 const db=new Database(path.join(root,'yemreact.sqlite'));db.pragma('foreign_keys=ON');
 const id=randomUUID(),token=randomBytes(32).toString('hex');
 const codes=[],uploads=[];
 db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id,'مراجعة الوسائط',id+'@example.invalid','social-only','admin',new Date().toISOString());
 db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+3600000);
 const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,LANG:'C.UTF-8',LC_ALL:'C.UTF-8'}});
 try{
  const admin=await browser.newContext({serviceWorkers:'block',viewport:{width:375,height:900}});
  await admin.addCookies([{name:'yr_session',value:token,url:base}]);
  const original=(await (await admin.request.get(base+'/api/reactions')).json()).reactions[0];
  const post=(url,data)=>admin.request.post(base+url,{headers:{Origin:base},data});
  const upload=async(buffer,name,mimeType,status=200)=>{
   const response=await admin.request.post(base+'/api/upload',{headers:{Origin:base},multipart:{file:{name,mimeType,buffer}}});
   const body=await response.json();assert.equal(response.status(),status,JSON.stringify(body));
   if(status===200){uploads.push(body.url,body.poster);assert.equal(body.mediaVerified,true);}
   return body;
  };
  const media=[];
  for(const [format,name,mime] of [['png','spoof.mp4','video/mp4'],['jpeg','picture.txt','text/plain'],['webp','photo.webp','image/webp']]){
   const buffer=await sharp('public/media/portrait-1.webp').toFormat(format).toBuffer();
   const m=await upload(buffer,name,mime);assert.equal(m.type,'image');assert.equal(m.duration,null);assert.equal(m.mimeType,'image/'+format);media.push(m);
  }
  for(const [file,mime] of [['public/media/demo-1.mp4','image/png']]){
   const m=await upload(fs.readFileSync(file),'pretend.png',mime);assert.equal(m.type,'video');assert.equal(m.duration,2);assert.notEqual(m.poster,m.url);media.push(m);
  }
  const webm=path.join(root,'qa.webm');execFileSync('ffmpeg',['-y','-v','error','-i','public/media/demo-1.mp4','-vf','scale=160:-2','-threads','1','-c:v','libvpx-vp9',webm]);
  const wm=await upload(fs.readFileSync(webm),'clip.webm','video/webm');media.push(wm);
  await upload(Buffer.from('89504e470d0a1a0a','hex'),'bad.png','image/png',400);
  await upload(Buffer.from('fake video file'),'fake.mp4','video/mp4',400);
  const short=path.join(root,'short.mp4');execFileSync('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=s=32x32:r=10','-t','1.5','-threads','1','-c:v','libx264',short]);
  await upload(fs.readFileSync(short),'short.mp4','video/mp4',400);
  report.checks.push('Real JPG/PNG/WebP/MP4/WebM uploads verified from bytes; misleading names/MIME canonicalized; corrupt and short files rejected; automatic video frame generated.');
  for(let i=0;i<media.length;i++){
   const m=media[i],code='YR-MEDIA-QA-'+i;codes.push(code);
   const body={...original,code,caption:i<3?'صورة هادئة':'لحظة متحركة',situation:i<3?'صورة للمعاينة':'فيديو للتشغيل',media:m.url,poster:i<3?original.poster:media[0].url,isDemo:false,duration:i<3?999:3,type:i<3?'video':'image',mimeType:'application/octet-stream',mediaVerified:false,publishedAt:'2026-09-23'};
   const res=await post('/api/reactions',body);const result=await res.json();assert.equal(res.status(),200,JSON.stringify(result));
   const r=result.reaction;assert.equal(r.type,m.type);assert.equal(r.mediaVerified,true);assert.equal(r.mimeType,m.mimeType);assert.equal(r.duration,m.duration);if(i<3)assert.equal(r.poster,m.url);
   db.prepare('INSERT INTO saved VALUES (?,?)').run(id,code);
  }
  const invalid=await post('/api/reactions',{...original,code:'YR-MEDIA-BAD',media:media[3].url,poster:media[0].url,isDemo:false,duration:61});assert.equal(invalid.status(),400);
  assert.equal(db.prepare('SELECT count(*) n FROM saved WHERE user_id=?').get(id).n,5);
  const same=db.prepare('SELECT data FROM reactions WHERE code=?').get(codes[0]);const update=await post('/api/reactions',{...JSON.parse(same.data),caption:'صورة هادئة'});assert.equal(update.status(),200);assert.equal(db.prepare('SELECT count(*) n FROM saved WHERE user_id=?').get(id).n,5);
  const unknown={...original,code:'YR-MEDIA-QA-UNKNOWN',mediaVerified:false,type:'unknown',duration:null};codes.push(unknown.code);db.prepare('INSERT INTO reactions VALUES (?,?)').run(unknown.code,JSON.stringify(unknown));
  const noDuration={...JSON.parse(db.prepare('SELECT data FROM reactions WHERE code=?').get(codes[3]).data),code:'YR-MEDIA-QA-NODURATION',duration:null};codes.push(noDuration.code);db.prepare('INSERT INTO reactions VALUES (?,?)').run(noDuration.code,JSON.stringify(noDuration));
  report.checks.push('Publish re-probes files, overrides spoofed metadata/stale image duration, rejects invalid video duration, and edits preserve saved rows. Video/image fixtures deliberately share cover artwork.');
  const guest=await browser.newContext({serviceWorkers:'block',hasTouch:true,isMobile:true,viewport:{width:375,height:900}});
  await guest.addInitScript(ids=>localStorage.setItem('yr:guest-saved',JSON.stringify(ids)),codes);
  const page=await guest.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  assert.equal((await guest.request.get(base+'/api/admin')).status(),401);
  assert.equal((await guest.request.post(base+'/api/reactions',{headers:{Origin:base},data:original})).status(),401);
  const load=async(route)=>{await page.goto(base+route,{waitUntil:'networkidle'});await page.locator('.reaction-card').first().waitFor();await page.evaluate(()=>document.fonts.ready);};
  for(const width of [320,375,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});
   for(const route of ['/library','/saved']){
    await load(route);
    const images=page.locator('[data-media-type="image"]'),videos=page.locator('[data-media-type="video"]');assert.ok(await images.count()>0);assert.ok(await videos.count()>0);
    assert.equal(await images.locator('.card-duration,.lucide-play').count(),0);
    assert.ok(await videos.locator('.card-duration').count()>0);assert.equal(await videos.locator('.card-duration svg').count(),0);
    assert.equal(await page.locator('.site-footer').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    const badges=await videos.evaluateAll(cards=>cards.filter(card=>card.querySelector('.card-duration')).map(card=>{const b=card.querySelector('.card-duration'),save=card.querySelector('.save-button'),bb=b.getBoundingClientRect(),sb=save.getBoundingClientRect();return {visible:getComputedStyle(b).opacity==='1',overlap:bb.left<sb.right&&bb.right>sb.left&&bb.top<sb.bottom&&bb.bottom>sb.top,saveWidth:sb.width,saveHeight:sb.height};}));
    assert.ok(badges.every(b=>b.visible&&!b.overlap&&b.saveWidth>=44&&b.saveHeight>=44),JSON.stringify({width,route,badges}));
    report.widths.push({width,route,badgesPermanent:true,noOverlap:true,noOverflow:true});
   }
   if([375,1440].includes(width))await page.screenshot({path:`verification/media/saved-${width}.png`,fullPage:true});
  }
  await page.setViewportSize({width:375,height:900});await load('/saved');
  const imageCard=page.locator('[data-media-type="image"]').first();const opener=imageCard.locator('.card-preview');
  await opener.tap();await page.locator('dialog[open] .clip-still').waitFor();assert.equal(await page.locator('dialog[open] video').count(),0);
  const download=page.waitForEvent('download');await page.locator('dialog[open]').getByRole('button',{name:'خذها',exact:true}).tap();const dl=await download;assert.match(dl.suggestedFilename(),/\.(png|jpg|webp)$/);assert.equal(createHash('sha256').update(fs.readFileSync(await dl.path())).digest('hex'),media[0].mediaSha256);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
  await opener.focus();await page.keyboard.press('Enter');await page.locator('dialog[open] .clip-still').waitFor();
  await page.keyboard.press('Escape');assert.equal(await opener.evaluate(el=>document.activeElement===el),true);
  const videoCard=page.locator('[data-media-type="video"]').first();await videoCard.locator('.card-preview').tap();await page.locator('dialog[open] video').waitFor();
  assert.equal(await page.locator('dialog[open] .clip-still').count(),0);
  assert.equal(await page.locator('dialog[open] video').evaluate(v=>v.paused&&v.controls&&v.playsInline&&!v.autoplay),true);
  await page.locator('dialog[open] video').evaluate(v=>v.play());await page.waitForFunction(()=>{const v=document.querySelector('dialog[open] video');return v&&!v.paused&&v.currentTime>0;});
  await page.keyboard.press('Escape');
  await page.locator('[data-media-type="unknown"] .card-preview').tap();assert.equal(await page.locator('dialog[open] video,dialog[open] .clip-still').count(),0);assert.equal(await page.locator('dialog[open]').getByRole('button',{name:'خذها',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');
  const missing=page.locator('.reaction-card').filter({has:page.locator('a[href="/r/YR-MEDIA-QA-NODURATION"]')});assert.equal(await missing.locator('.card-duration').count(),0);assert.equal(await missing.locator('.card-duration b').count(),0);
  report.checks.push('Touch and keyboard select correct viewers; Escape restores focus; actual video plays inline only after user action; image download has correct extension; unknown media never becomes a player; missing duration never invents a badge; the original seconds-only badge has no icon or visible video label.');
  for(const route of ['/saved','/library'])for(const theme of ['light','dark']){
   await page.emulateMedia({reducedMotion:'reduce',colorScheme:theme});await load(route);await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   const audit=await new AxeBuilder({page}).analyze();report.axe.push({route,theme,violations:audit.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}))});assert.equal(audit.violations.length,0,JSON.stringify(report.axe.at(-1)));
   assert.equal(await page.locator('.card-image').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  }
  for(const i of [0,3]){await page.goto(base+'/r/'+codes[i],{waitUntil:'networkidle'});assert.equal(await page.locator('.clip-player video').count(),i===3?1:0);assert.equal(await page.locator('.clip-player .clip-still').count(),i===0?1:0);}
  const editor=await admin.newPage();editor.on('pageerror',e=>report.errors.push(e.message));await editor.goto(base+'/admin',{waitUntil:'networkidle'});
  await editor.getByRole('button',{name:'رياكشن جديد',exact:true}).click();const dialog=editor.locator('dialog[open]');
  await dialog.getByLabel('الاقتباس',{exact:true}).fill('اختبار صورة من الاستوديو');await dialog.getByLabel('متى نستخدمه؟').fill('اختبار محلي فقط');await dialog.getByRole('button',{name:'التالي',exact:true}).click();
  const input=dialog.locator('input[type=file]').first();let browserUploads=0;editor.on('request',r=>{if(r.url().endsWith('/api/upload'))browserUploads++;});
  await input.setInputFiles({name:'short.mp4',mimeType:'video/mp4',buffer:fs.readFileSync(short)});await dialog.getByText('مدة الفيديو المسموح بها من ثانيتين إلى 60 ثانية.',{exact:true}).waitFor();assert.equal(browserUploads,0);
  await input.setInputFiles({name:'image.png',mimeType:'image/png',buffer:await sharp('public/media/portrait-1.webp').png().toBuffer()});
  await dialog.getByText('صورة ثابتة · تم التحقق',{exact:true}).waitFor();assert.equal(await dialog.locator('input[type=file]').count(),1);
  await dialog.getByRole('button',{name:'التالي',exact:true}).click();await dialog.locator('.clip-still').waitFor();assert.equal(await dialog.locator('video').count(),0);
  await dialog.locator('input[type=checkbox]').check();await dialog.getByRole('button',{name:'نشر القصاصة',exact:true}).click();await editor.waitForFunction(()=>!document.querySelector('dialog[open]'));
  const created=JSON.parse(db.prepare("SELECT data FROM reactions WHERE json_extract(data,'$.caption')=?").get('اختبار صورة من الاستوديو').data);codes.push(created.code);uploads.push(created.media);assert.equal(created.type,'image');assert.equal(created.duration,null);
  report.checks.push('Mobile admin rejects short video before uploading and publishes a real image with image-only review and rights confirmation; shared detail viewers remain consistent. Four light/dark reduced-motion axe audits have zero violations.');
  const desktop=await admin.newPage();await desktop.setViewportSize({width:1440,height:900});await desktop.goto(base+'/library',{waitUntil:'networkidle'});assert.ok((await desktop.locator('.card-duration').evaluateAll(items=>items.map(e=>getComputedStyle(e).opacity))).every(v=>v==='1'));
  const account=await admin.newPage();await account.goto(base+'/saved',{waitUntil:'networkidle'});assert.equal(await account.locator('.reaction-card').count(),5);
  assert.equal(await account.locator('[data-media-type=image]').count(),3);assert.equal(await account.locator('[data-media-type=video]').count(),2);
  report.checks.push('Guest and account saved collections retain mixed images/videos; admin publishing does not alter member saves.');
  assert.deepEqual(report.errors,[]);report.completed=true;
 }catch(e){report.failure=e.stack;process.exitCode=1;}
 finally{
  for(const code of codes)db.prepare('DELETE FROM reactions WHERE code=?').run(code);
  db.prepare('DELETE FROM users WHERE id=?').run(id);db.close();
  for(const url of new Set(uploads))if(url?.startsWith('/api/media/'))fs.rmSync(path.join(root,'uploads',path.basename(url)),{force:true});
  await browser.close();fs.writeFileSync('verification/media/browser-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
})();
