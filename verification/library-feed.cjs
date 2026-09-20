const { chromium } = require('./tools/node_modules/playwright');
const { AxeBuilder } = require('./tools/node_modules/@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Database = require('better-sqlite3');
const base = process.env.QA_BASE_URL || 'http://localhost:3000';
(async () => {
  fs.mkdirSync('verification/library-feed', { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 375, height: 650 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const report = { checks: [], widths: [], batches: [], errors: [] };
  page.on('pageerror', e => report.errors.push(e.message));
  const db = new Database((process.env.QA_DATA_DIR || 'data') + '/yemreact.sqlite');
  db.pragma('foreign_keys = ON');
  const original = db.prepare('SELECT data FROM reactions ORDER BY code').all().map(r => JSON.parse(r.data));
  const fixtureCodes = [];
  const go = async route => { const r = await page.goto(base + route, { waitUntil: 'networkidle' }); assert.equal(r.status(), 200); };
  try {
    await go('/library');
    await page.locator('.library-masonry[data-masonry=true]').waitFor();
    assert.equal(await page.locator('.reaction-card').count(), 8);
    assert.equal(await page.locator('main input, main select, main form, .page-breadcrumb, .page-heading, .library-toolbar, .results-row, .category-tabs, .center-action, .site-footer, .library-note').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'أظهر المزيد' }).count(), 0);
    assert.ok(!(await page.locator('main').innerText()).match(/دوّر على موقفك|كل المواقف تبدأ|خلّ الباقي|CLIPS|MOODS|ريا?كشن في انتظارك|عرض 8 من/));
    report.checks.push('Library starts with cards only; all upper content and manual pagination removed');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(total => document.querySelectorAll('.reaction-card').length === total, original.length);
    assert.equal(await page.locator('.library-sentinel').count(), 0);
    assert.equal(new Set(await page.locator('.card-info a').evaluateAll(links => links.map(link => link.getAttribute('href')))).size, original.length);
    report.checks.push('8 initial cards; scrolling appends all remaining cards once and removes sentinel at end');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.card-preview').first().click();
    await page.locator('dialog[open] video').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.locator('.save-button').first().click();
    assert.equal(await page.locator('.save-button').first().getAttribute('aria-pressed'), 'true');
    await go('/saved');
    assert.equal(await page.locator('#library-q, #sort, .duration-filter').count(), 0);
    assert.equal(await page.locator('.category-tabs').count(), 0);
    assert.equal(await page.locator('.reaction-card').count(), 1);
    assert.equal(await page.locator('.site-footer').count(), 0);
    report.checks.push('Preview, keyboard Escape and save actions preserved; redesigned saved page has no filter controls or footer');
    await go('/library?q=' + encodeURIComponent('خبر صادم'));
    assert.equal(await page.locator('.reaction-card').count(), 1);
    assert.equal(await page.locator('.library-sentinel, .library-toolbar').count(), 0);
    await go('/library?cat=laugh');
    assert.equal(await page.locator('.reaction-card').count(), 2);
    await go('/library?q=no-such-reaction');
    assert.equal(await page.locator('.reaction-card').count(), 0);
    await page.getByRole('link', { name: 'تصفّح كل الرياكشنات' }).click();
    await page.waitForURL('**/library');
    await page.locator('.reaction-card').first().waitFor();
    report.checks.push('Home search/category deep links and recoverable empty results still work');
    for (const width of [320, 375, 768, 1024, 1440, 1920, 3840]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(total => document.querySelectorAll('.reaction-card').length === total, original.length);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('.reaction-card')].map(el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom }; });
        const overlap = cards.some((a, i) => cards.slice(i + 1).some(b => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1));
        return { width: innerWidth, document: document.documentElement.scrollWidth, columns: getComputedStyle(document.querySelector('.library-masonry')).gridTemplateColumns.split(' ').length, overlap };
      });
      assert.ok(metrics.document <= width); assert.equal(metrics.overlap, false);
      report.widths.push(metrics);
      await page.evaluate(() => window.scrollTo(0, 0));
      if ([375, 1440].includes(width)) await page.screenshot({ path: `verification/library-feed/library-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    report.axe = [];
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      await page.waitForTimeout(350);
      const a = await new AxeBuilder({ page }).analyze();
      report.axe.push({ theme, violations: a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), incomplete: a.incomplete.length });
      assert.equal(a.violations.length, 0, JSON.stringify(report.axe));
    }
    // A larger temporary catalog verifies more than one automatic append. Cleaned in finally.
    for (let i = 0; i < 25; i++) {
      const code = `QA-INF-${String(i).padStart(3, '0')}`;
      const item = { ...original[i % original.length], code, caption: 'اختبار تمرير ' + i };
      db.prepare('INSERT INTO reactions(code,data) VALUES (?,?)').run(code, JSON.stringify(item));
      fixtureCodes.push(code);
    }
    await page.setViewportSize({ width: 375, height: 650 });
    await go('/library');
    assert.equal(await page.locator('.reaction-card').count(), 8);
    const total = original.length + fixtureCodes.length;
    for (let count = 16; count < total + 8; count += 8) {
      const target = Math.min(count, total);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(n => document.querySelectorAll('.reaction-card').length >= n, target);
      report.batches.push(await page.locator('.reaction-card').count());
    }
    assert.equal(await page.locator('.reaction-card').count(), total);
    assert.equal(new Set(await page.locator('.card-info a').evaluateAll(links => links.map(link => link.getAttribute('href')))).size, total);
    assert.equal(await page.locator('.library-sentinel').count(), 0);
    report.checks.push('Larger catalog loads across multiple batches with no duplicates and a finite end');
    const fallback = await browser.newContext({ viewport: { width: 375, height: 650 }, serviceWorkers: 'block' });
    await fallback.addInitScript(() => { window.IntersectionObserver = undefined; window.ResizeObserver = undefined; });
    const fallbackPage = await fallback.newPage();
    await fallbackPage.goto(base + '/library', { waitUntil: 'networkidle' });
    await fallbackPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await fallbackPage.waitForFunction(() => document.querySelectorAll('.reaction-card').length >= 16);
    assert.equal(await fallbackPage.locator('.library-masonry[data-masonry=true]').count(), 0);
    assert.ok(await fallbackPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await fallback.close();
    report.checks.push('Automatic scroll fallback works without IntersectionObserver/ResizeObserver');
    assert.deepEqual(report.errors, []);
    report.completed = true;
  } catch (e) { report.failure = e.stack; process.exitCode = 1; }
  finally {
    for (const code of fixtureCodes) db.prepare('DELETE FROM reactions WHERE code=?').run(code);
    db.close();
    fs.writeFileSync('verification/library-feed/results.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
})();
