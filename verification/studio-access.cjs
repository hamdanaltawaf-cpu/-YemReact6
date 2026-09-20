const { chromium } = require('./tools/node_modules/playwright');
const Database = require('better-sqlite3');
const {randomBytes,createHash,randomUUID}=require('node:crypto');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const origin='http://localhost:3100';
const report={scope:'Disposable local production-build database only; no production users or sessions are created.',cases:[],completed:false};
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 const db=new Database('.cache/studio-qa-data/yemreact.sqlite');
 const fixtures=[];
 try{
  for(const role of ['member','admin']){
   const id=randomUUID(),token=randomBytes(32).toString('hex');
   db.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)').run(id,'QA '+role,id+'@example.invalid','social-only',role,new Date().toISOString());
   db.prepare('INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+3600000);
   fixtures.push({id,role,token});
  }
  for(const role of ['guest','member','admin'])for(const width of [1440,375]){
   const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
   const user=fixtures.find(f=>f.role===role);
   if(user)await ctx.addCookies([{name:'yr_session',value:user.token,url:origin,httpOnly:true,sameSite:'Lax'}]);
   const page=await ctx.newPage();
   await page.goto(origin,{waitUntil:'networkidle'});
   if(width===375)await page.getByRole('button',{name:'فتح القائمة',exact:true}).click();
   assert.equal(await page.locator('a[href="/admin"]').count(),role==='admin'?(width===375?3:2):0);
   const direct=await ctx.request.get(origin+'/admin',{maxRedirects:0});
   assert.equal(direct.status(),role==='guest'?307:role==='member'?404:200);
   if(role==='guest')assert.equal(direct.headers().location,'/login');
   const api=await ctx.request.get(origin+'/api/admin');
   assert.equal(api.status(),role==='guest'?401:role==='member'?403:200);
   await page.goto(origin+'/admin',{waitUntil:'networkidle'});
   if(role==='admin'){
    await page.locator('.admin-shell').waitFor();
    await page.locator('.account-chip').click();
    await page.waitForFunction(()=>!document.querySelector('.account-chip'));
    assert.equal(await page.locator('.admin-shell').count(),0);
    assert.equal(await page.locator('a[href="/admin"]').count(),0);
    // Restore this disposable session for the next viewport only.
    db.prepare('INSERT OR REPLACE INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)').run(createHash('sha256').update(user.token).digest('hex'),user.id,Date.now()+3600000);
   }else assert.equal(await page.locator('.admin-shell').count(),0);
   report.cases.push({role,width,studioLinksOnlyForAdmin:true,directRouteStatus:direct.status(),adminApiStatus:api.status(),logoutClearsStudio:role==='admin'?true:undefined});
   await ctx.close();
  }
  const admin=fixtures.find(f=>f.role==='admin');
  db.prepare("UPDATE users SET role='member' WHERE id=?").run(admin.id);
  const ctx=await browser.newContext();await ctx.addCookies([{name:'yr_session',value:admin.token,url:origin,httpOnly:true,sameSite:'Lax'}]);
  assert.equal((await ctx.request.get(origin+'/admin',{maxRedirects:0})).status(),404);
  assert.equal((await ctx.request.get(origin+'/api/admin')).status(),403);
  report.roleRevocationChecked=true;await ctx.close();
  report.completed=true;
 }catch(e){report.failure=e.message;process.exitCode=1;}
 finally{
  for(const f of fixtures){db.prepare('DELETE FROM sessions WHERE user_id=?').run(f.id);db.prepare('DELETE FROM users WHERE id=?').run(f.id);}
  db.close();await browser.close();fs.writeFileSync('verification/studio-access-results.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }
})();
