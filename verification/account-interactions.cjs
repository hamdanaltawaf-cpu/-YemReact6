const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('./tools/node_modules/playwright');

const base = (
  process.env.VERIFICATION_BASE_URL ||
  process.argv[2] ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

let browser;
(async () => {
  const launchOptions = { args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const systemChromium = process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium';
  if (fs.existsSync(systemChromium)) launchOptions.executablePath = systemChromium;
  browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__accountHistoryPushes = [];
    const originalPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      window.__accountHistoryPushes.push(String(args[2] || ''));
      return originalPushState(...args);
    };
  });

  const guestRouteRequests = [];
  let clickedGuest = false;
  page.on('request', (request) => {
    if (!clickedGuest || request.resourceType() !== 'fetch') return;
    const url = new URL(request.url());
    if (url.pathname === '/account' && url.searchParams.has('_rsc'))
      guestRouteRequests.push(url.href);
  });

  await page.goto(`${base}/login?next=%2Faccount`, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'الاستمرار كزائر بلا حساب' }).waitFor();
  clickedGuest = true;
  await page.getByRole('link', { name: 'الاستمرار كزائر بلا حساب' }).click();
  await page.waitForURL('**/account');
  await page.getByText('أنت زائر').waitFor();
  await page.waitForTimeout(600);
  const pushes = await page.evaluate(() => window.__accountHistoryPushes);
  assert.equal(
    pushes.filter((url) => url === '/account').length,
    1,
    'guest choice should push one route',
  );
  assert.equal(
    guestRouteRequests.length,
    1,
    'Link should request the destination once, without a second router.push',
  );
  assert.match(await page.evaluate(() => document.cookie), /(?:^|;\s*)yr_guest=1/);

  const contributeTooltip = page.locator('#account-action-contribute-tooltip');
  const settingsTooltip = page.locator('#account-action-settings-tooltip');
  assert.equal(
    await contributeTooltip.isVisible(),
    false,
    'tooltip text stays visually hidden by default',
  );
  await page.locator('.account-icon-action-primary').hover();
  await contributeTooltip.waitFor({ state: 'visible' });
  assert.equal(await contributeTooltip.isVisible(), true, 'contribution tooltip appears on hover');
  const savedTab = page.locator('#account-tab-saved');
  await savedTab.focus();
  await page.keyboard.press('Shift+Tab'); // رابط الإعدادات السابق للتبويب مباشرة
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    'الإعدادات',
  );
  await settingsTooltip.waitFor({ state: 'visible' });
  assert.equal(
    await settingsTooltip.isVisible(),
    true,
    'settings tooltip appears on keyboard focus',
  );
  assert.equal(
    await page.locator('.account-icon-action').nth(1).getAttribute('aria-label'),
    'الإعدادات',
  );

  const contributionsTab = page.locator('#account-tab-contributions');
  await savedTab.focus();
  assert.deepEqual(
    await page.locator('[role="tab"]').evaluateAll((tabs) => tabs.map((tab) => tab.tabIndex)),
    [0, -1],
    'only the active tab is in the sequential Tab order',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await page.evaluate(() => document.activeElement?.getAttribute('role')),
    null,
    'Tab leaves the tablist instead of visiting its inactive tab',
  );
  assert.equal(await savedTab.getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'account-tab-saved');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await contributionsTab.getAttribute('aria-selected'), 'true');
  await page.waitForFunction(() => document.activeElement?.id === 'account-tab-contributions');
  await page.keyboard.press('Home');
  assert.equal(await savedTab.getAttribute('aria-selected'), 'true');
  await page.waitForFunction(() => document.activeElement?.id === 'account-tab-saved');
  await page.keyboard.press('End');
  assert.equal(await contributionsTab.getAttribute('aria-selected'), 'true');
  await page.waitForFunction(() => document.activeElement?.id === 'account-tab-contributions');

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(
      pageWidth <= width + 1,
      `account overflows horizontally at ${width}px (${pageWidth}px)`,
    );
  }

  console.log(
    JSON.stringify(
      {
        result: 'PASS',
        guestRoutePushes: pushes.filter((url) => url === '/account').length,
        guestRouteRequests: guestRouteRequests.length,
        tooltipHover: true,
        tooltipKeyboardFocus: true,
        rovingTabStops: [0, -1],
        arrowAndHomeEndFocusRestored: true,
      },
      null,
      2,
    ),
  );
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  process.exitCode = 1;
});
