const { chromium } = require('./tools/node_modules/playwright');
const { AxeBuilder } = require('./tools/node_modules/@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const base = 'http://localhost:3000';
const removed = '.card-code,.card-tag,.category-label,.category-tabs,.category-bar,.polaroid-code,.count-badge,.stats-grid,.stat-card,.chart,.tags';
(async () => {
  fs.mkdirSync('verification/clean-ui', { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block' });
  const page = await context.newPage();
  const db = new Database('data/yemreact.sqlite'); db.pragma('foreign_keys = ON');
  const reactions = db.prepare('SELECT data FROM reactions').all().map(r => JSON.parse(r.data));
  const ownerId = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
  const fixtures = [];
  const report = { pages: [], checks: [], responsive: [], axe: [], errors: [] };
  page.on('pageerror', e => report.errors.push(e.message));
  const go = async route => { const r = await page.goto(base + route, { waitUntil: 'networkidle' }); assert.equal(r.status(), 200); };
  const checkClean = async () => {
    assert.equal(await page.locator(removed).count(), 0);
    assert.ok(!/YR[—-][A-Z0-9]+|\bCLIPS\b|\bMOODS?\b|\bSAVED\b/.test(await page.locator('body').innerText()));
    assert.ok(!/YR[—-][A-Z0-9]+/.test((await page.locator('[aria-label]').evaluateAll(nodes => nodes.map(n => n.getAttribute('aria-label')))).join(' ')));
  };
  try {
    for (const route of ['/', '/library', '/saved', '/about', '/login', '/admin', '/offline', ...reactions.map(r => '/r/' + r.code)]) {
      await go(route); await checkClean(); report.pages.push(route);
    }
    report.checks.push('19 public routes have no rendered counters, category components or reaction identifiers');
    await go('/library');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(total => document.querySelectorAll('.reaction-card').length === total, reactions.length);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('.save-button').first().click();
    await go('/saved');
    assert.equal(await page.locator('.reaction-card').count(), 1); await checkClean();
    await page.locator('.card-preview').first().click();
    await page.locator('dialog[open] video').waitFor(); await checkClean();
    const before = await page.locator('.preview-copy h3').innerText();
    await page.getByRole('button', { name: 'الرياكشن التالي' }).click();
    assert.notEqual(await page.locator('.preview-copy h3').innerText(), before);
    await page.getByRole('button', { name: 'الرياكشن السابق' }).click();
    assert.equal(await page.locator('.preview-copy h3').innerText(), before);
    await page.locator('dialog[open] video').evaluate(v => v.play());
    await page.waitForFunction(() => document.querySelector('dialog[open] video').currentTime > 0);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'خذها', exact: true }).click();
    const download = await downloadPromise;
    assert.ok(!/YR[—-]/.test(download.suggestedFilename()));
    assert.equal(await download.failure(), null);
    await page.getByRole('button', { name: 'شارك', exact: true }).click();
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /\/r\/YR-/);
    await page.keyboard.press('Escape');
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    report.checks.push('Saving, preview previous/next, video playback, download and share retain internal routing; download filename is descriptive');
    await page.evaluate(() => localStorage.removeItem('yr:guest-saved'));
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/library', '/r/' + reactions[0].code, '/saved', '/admin']) {
        await go(route); await checkClean();
        const size = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(size <= width, `${route} overflow at ${width}`);
        report.responsive.push({ route, width, document: size });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [route, name] of [['/', 'home'], ['/library', 'library'], ['/r/' + reactions[0].code, 'detail']]) {
      await go(route);
      if (name === 'library') {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForFunction(total => document.querySelectorAll('.reaction-card').length === total, reactions.length);
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `verification/clean-ui/${name}.png`, fullPage: true });
      const axe = await new AxeBuilder({ page }).analyze();
      report.axe.push({ route, violations: axe.violations.map(v => v.id), incomplete: axe.incomplete.length });
      assert.equal(axe.violations.length, 0);
    }
    // Real authorization paths exercised using an isolated local test session, not external OAuth.
    db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(ownerId, 'اختبار الواجهة', ownerId + '@social.invalid', 'social-only', 'admin', new Date().toISOString());
    db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), ownerId, Date.now() + 300000);
    await context.addCookies([{ name: 'yr_session', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    await go('/admin'); await page.getByRole('button', { name: 'رياكشن جديد' }).waitFor(); await checkClean();
    for (const tab of ['الرياكشنات', 'الوسائط', 'المستخدمون', 'سجل العمليات']) {
      await page.getByRole('button', { name: tab, exact: true }).click(); await checkClean();
      assert.ok(!(await page.locator('main').innerText()).includes(ownerId));
    }
    await page.getByRole('button', { name: 'رياكشن جديد', exact: true }).click();
    assert.equal(await page.locator('dialog label').filter({ hasText: 'الفئة' }).count(), 0);
    await page.getByLabel('الاقتباس', { exact: true }).fill('اختبار نشر نظيف');
    await page.getByLabel('متى نستخدمه؟', { exact: true }).fill('موقف تجريبي للتحقق من عدم تغير الوظائف');
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('button', { name: 'التالي', exact: true }).click(); await checkClean();
    const createdRequest = page.waitForResponse(r => r.url().endsWith('/api/reactions') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'نشر القصاصة', exact: true }).click();
    const created = await createdRequest; assert.ok(created.ok());
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    const row = db.prepare("SELECT code,data FROM reactions WHERE json_extract(data,'$.caption')=?").get('اختبار نشر نظيف');
    assert.ok(row); fixtures.push(row.code); assert.equal(JSON.parse(row.data).category, 'laugh');
    await page.getByRole('button', { name: 'الرياكشنات', exact: true }).click();
    await page.getByRole('button', { name: 'تعديل اختبار نشر نظيف', exact: true }).click();
    await page.getByLabel('الاقتباس', { exact: true }).fill('اختبار نشر معدّل');
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('button', { name: 'نشر القصاصة', exact: true }).click();
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    assert.equal(JSON.parse(db.prepare('SELECT data FROM reactions WHERE code=?').get(row.code).data).category, 'laugh');
    await page.getByRole('button', { name: 'حذف اختبار نشر معدّل', exact: true }).click();
    await page.getByRole('button', { name: 'نعم، احذفها', exact: true }).click();
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    assert.equal(db.prepare('SELECT code FROM reactions WHERE code=?').get(row.code), undefined);
    report.checks.push('Owner overview/content/media/users/audit and editor are clean; create/edit/delete still work with internal category/schema preserved');
    assert.deepEqual(report.errors, []); report.completed = true;
  } catch (e) { report.failure = e.stack; process.exitCode = 1; }
  finally {
    for (const code of fixtures) { db.prepare('DELETE FROM reactions WHERE code=?').run(code); db.prepare('DELETE FROM events WHERE code=?').run(code); }
    db.prepare('DELETE FROM audit WHERE user_id=?').run(ownerId);
    db.prepare('DELETE FROM users WHERE id=?').run(ownerId);
    db.close(); await browser.close();
    fs.writeFileSync('verification/clean-ui/results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
