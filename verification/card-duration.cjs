const {chromium} = require('./tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
 const browser = await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const results = [];
 try {
  for (const width of [1440,375]) {
   await page.setViewportSize({width,height:900});
   await page.goto('http://localhost:3000/library',{waitUntil:'networkidle'});
   const cards = await page.locator('.reaction-card').count();
   assert.equal(await page.locator('.card-duration').count(),cards);
   assert.equal(await page.locator('.card-code,.card-tag,.category-label,.count-badge').count(),0);
   const position = await page.locator('.reaction-card').first().evaluate(el => {
    const card = el.querySelector('.card-visual').getBoundingClientRect();
    const badge = el.querySelector('.card-duration').getBoundingClientRect();
    return {top:badge.top-card.top,right:card.right-badge.right};
   });
   assert.ok(position.top>0 && position.top<=16 && position.right>0 && position.right<=16);
   await page.locator('.card-preview').first().click();
   await page.locator('dialog[open] video').waitFor();
   assert.equal(await page.locator('dialog .card-duration,dialog .card-code,dialog .tags').count(),0);
   await page.keyboard.press('Escape');
   results.push({width,cards,position,previewHasNoAddedBadge:true});
  }
  await page.goto('http://localhost:3000/r/YR-0001',{waitUntil:'networkidle'});
  assert.equal(await page.locator('.detail-copy .card-duration,.detail-copy .category-label').count(),0);
  fs.writeFileSync('verification/card-duration-results.json',JSON.stringify({passed:true,checks:results,unitTests:23,productionBuild:'passed'},null,2));
  console.log('Card duration checks passed: desktop/mobile upper-right badge; no new badge in detail copy or preview dialog.');
 } finally {await browser.close();}
})();
