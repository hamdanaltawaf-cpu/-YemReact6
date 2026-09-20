const { chromium } = require('./tools/node_modules/playwright');
const { AxeBuilder } = require('./tools/node_modules/@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'http://localhost:3000';
(async () => {
  fs.mkdirSync('verification/social', { recursive: true });
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const report = { checks: [], responsive: [], axe: [], runtimeErrors: [], liveProviderLoginTested: false };
  page.on('pageerror', e => report.runtimeErrors.push(e.message));
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('main input, main form, main .segmented, .site-footer').count(), 0);
    assert.equal(await page.locator('.social-provider').count(), 3);
    assert.ok(!(await page.locator('main').innerText()).match(/كلمة المرور|البريد الإلكتروني|10 أحرف|ادخل حسابك|حساب جديد|قيد الإعداد|غير مفعلة/));
    report.checks.push('No traditional form, password/email fields, old copy or footer; exactly three providers');
    assert.equal(await page.locator('.social-setup-note, .social-status-dot, [aria-disabled=true]').count(), 0);
    for (const [provider, name] of [['google', 'Google'], ['apple', 'Apple'], ['microsoft', 'Microsoft']]) {
      const link = page.getByRole('link', { name: 'تسجيل باستخدام ' + name });
      assert.equal(await link.getAttribute('href'), '/api/auth/oauth/' + provider);
      const request = page.waitForRequest(r => new URL(r.url()).pathname === '/api/auth/oauth/' + provider);
      await link.click();
      await request;
      await page.locator('main [role=alert]').waitFor();
      assert.ok((await page.locator('main [role=alert]').innerText()).includes('تعذّر إكمال الدخول'));
      assert.ok(!(await page.locator('main').innerText()).match(/قيد الإعداد|غير مفعلة/));
      await page.goto(base + '/login', { waitUntil: 'networkidle' });
    }
    report.checks.push('All three active provider links reach their OAuth routes; no readiness badges or setup copy; failures remain truthful');
    await page.screenshot({ path: 'verification/social/login-desktop.png', fullPage: true });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      await page.waitForTimeout(350);
      const axe = await new AxeBuilder({ page }).analyze();
      report.axe.push({ theme, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), incomplete: axe.incomplete.length });
      assert.equal(axe.violations.length, 0, JSON.stringify(report.axe));
      if (theme === 'dark') await page.screenshot({ path: 'verification/social/login-dark.png', fullPage: true });
    }
    await page.getByRole('link', { name: 'تسجيل باستخدام Google' }).focus();
    const keyboardRequest = page.waitForRequest(r => new URL(r.url()).pathname === '/api/auth/oauth/google');
    await page.keyboard.press('Enter');
    await keyboardRequest;
    await page.locator('main [role=alert]').waitFor();
    await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
    await page.waitForTimeout(350);
    assert.ok((await page.locator('main [role=alert]').innerText()).includes('تعذّر إكمال الدخول'));
    const errorAxe = await new AxeBuilder({ page }).analyze();
    report.axe.push({ theme: 'dark-error', violations: errorAxe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), incomplete: errorAxe.incomplete.length });
    assert.equal(errorAxe.violations.length, 0, JSON.stringify(report.axe));
    report.checks.push('Provider buttons work with keyboard; dark error state accessibility checked');
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.documentElement.dataset.theme = 'light');
    for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.social-provider')].map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }));
      assert.ok(metrics.width <= width, JSON.stringify(metrics));
      assert.ok(metrics.buttons.every(b => b.height >= 44));
      report.responsive.push(metrics);
      if (width === 390 || width === 320) await page.screenshot({ path: `verification/social/login-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/login?auth_error=cancelled', { waitUntil: 'networkidle' });
    assert.ok((await page.locator('main [role=alert]').innerText()).includes('لم يكتمل'));
    await page.goto(base + '/login?auth_error=%3Cscript%3E', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('main [role=alert]').count(), 0);
    report.checks.push('Callback errors are allowlisted and cancellation offers retry');
    await page.getByRole('link', { name: 'كمّل بدون حساب' }).click();
    await page.waitForURL('**/library');
    await page.locator('.reaction-card').first().waitFor();
    assert.equal(await page.locator('.site-footer, .library-note, .category-tabs').count(), 0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForFunction(() => document.querySelectorAll('.reaction-card').length === 12);
    assert.equal(await page.getByRole('button', { name: 'أظهر المزيد' }).count(), 0);
    await page.goto(base + '/', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.site-footer').count(), 1);
    await page.getByRole('link', { name: /^دخول/ }).click();
    await page.waitForURL('**/login');
    await page.locator('.social-provider').first().waitFor();
    assert.equal(await page.locator('.site-footer').count(), 0);
    report.checks.push('Guest browsing, library infinite scroll, and client-navigation footer behavior preserved');
    await page.keyboard.press('Tab');
    for (const provider of ['google', 'apple', 'microsoft', 'unknown']) {
      const response = await context.request.get(base + '/api/auth/oauth/' + provider, { maxRedirects: 0 });
      assert.equal(response.status(), 303);
      assert.equal(response.headers().location, '/login?auth_error=unavailable');
    }
    const retired = await context.request.post(base + '/api/auth', { data: { mode: 'register', email: 'never-created@example.invalid', password: 'not-used-now' } });
    assert.equal(retired.status(), 410);
    const user = await (await context.request.get(base + '/api/auth')).json();
    assert.equal(user.user, null);
    report.checks.push('Unconfigured OAuth fails closed; retired password endpoint returns 410; no fake session');
    assert.deepEqual(report.runtimeErrors, []);
    report.completed = true;
  } catch (error) {
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    fs.writeFileSync('verification/social/results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }
})();
