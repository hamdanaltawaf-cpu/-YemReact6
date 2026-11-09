const { chromium } = require('./tools/node_modules/playwright');
const { AxeBuilder } = require('./tools/node_modules/@axe-core/playwright');
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const base = 'http://localhost:3100';
const db = new Database(path.join(__dirname, '../.cache/stage4-preview-data/yemreact.sqlite'));
db.pragma('foreign_keys = ON');
const report = {
  scope: 'Local disposable preview; no live-site mutations',
  checks: [],
  widths: [],
  contrast: [],
  axe: [],
  errors: [],
  completed: false,
};
function cssColorToHex(value) {
  const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)/i);
  if (srgb) {
    return `#${srgb
      .slice(1, 4)
      .map((channel) =>
        Math.round(Math.min(1, Math.max(0, Number(channel))) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')}`;
  }
  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  assert.ok(match, `unsupported computed color: ${value}`);
  return `#${match
    .slice(1, 4)
    .map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0'))
    .join('')}`;
}
function contrastRatio(first, second) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
async function assertPageStructure(page, route) {
  const structure = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
    const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
      .filter(visible)
      .map((heading) => Number(heading.tagName.slice(1)));
    const landmarks = Array.from(
      document.querySelectorAll(
        'main,[role="main"],header[role="banner"],footer[role="contentinfo"],nav,[role="navigation"]',
      ),
    )
      .filter(visible)
      .map((element) => ({
        role:
          element.getAttribute('role') ||
          (element.tagName === 'MAIN'
            ? 'main'
            : element.tagName === 'NAV'
              ? 'navigation'
              : element.tagName === 'HEADER'
                ? 'banner'
                : 'contentinfo'),
        name:
          element.getAttribute('aria-label') ||
          (element.getAttribute('aria-labelledby') &&
            document
              .getElementById(element.getAttribute('aria-labelledby'))
              ?.textContent?.trim()) ||
          '',
      }));
    const duplicateUnnamed = [...new Set(landmarks.map((item) => item.role))].filter((role) => {
      const sameRole = landmarks.filter((item) => item.role === role);
      return (
        sameRole.length > 1 &&
        (sameRole.some((item) => !item.name) ||
          new Set(sameRole.map((item) => item.name)).size !== sameRole.length)
      );
    });
    return {
      mainCount: landmarks.filter((item) => item.role === 'main').length,
      headings,
      duplicateUnnamed,
    };
  });
  assert.equal(structure.mainCount, 1, `${route}: expected exactly one main landmark`);
  assert.deepEqual(structure.duplicateUnnamed, [], `${route}: duplicate unnamed landmarks`);
  assert.ok(structure.headings.length > 0, `${route}: page has no visible headings`);
  assert.equal(structure.headings[0], 1, `${route}: first visible heading must be h1`);
  for (let index = 1; index < structure.headings.length; index++) {
    assert.ok(
      structure.headings[index] <= structure.headings[index - 1] + 1,
      `${route}: skipped heading level ${structure.headings[index - 1]} → ${structure.headings[index]}`,
    );
  }
}
async function assertRenderedContrast(page, route, theme) {
  const samples = await page.evaluate(() => {
    const selectors = [
      ['text', 'h1'],
      ['text', '.collection-card-title'],
      ['text', '.collection-card-meta'],
      ['text', '.admin-collection-copy strong'],
      ['text', '.admin-collection-copy > span'],
      ['placeholder', '.stack-form input[placeholder]'],
      ['icon', '.reaction-menu-trigger'],
      ['border', '.library-search'],
    ];
    const backgroundOf = (element) => {
      for (let current = element; current; current = current.parentElement) {
        const value = getComputedStyle(current).backgroundColor;
        const alpha =
          value.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i) ||
          value.match(/color\(srgb\s+[\d.]+\s+[\d.]+\s+[\d.]+\s*\/\s*([\d.]+)\s*\)/i);
        if (!alpha || Number(alpha[1]) > 0.98) return value;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    return selectors.flatMap(([kind, selector]) =>
      Array.from(document.querySelectorAll(selector))
        .filter((element) => element.getClientRects().length > 0)
        .slice(0, 3)
        .map((element) => ({
          kind,
          selector,
          foreground:
            kind === 'border'
              ? getComputedStyle(element).borderTopColor
              : kind === 'placeholder'
                ? getComputedStyle(element, '::placeholder').color
                : getComputedStyle(element).color,
          background: backgroundOf(element),
        })),
    );
  });
  assert.ok(samples.length > 0, `${route}: no rendered contrast samples`);
  if (route.includes('collection editor')) {
    assert.ok(
      samples.some((sample) => sample.kind === 'placeholder'),
      `${route}: no rendered placeholder contrast sample`,
    );
  }
  const measured = samples.map((sample) => ({
    ...sample,
    ratio: Number(
      contrastRatio(cssColorToHex(sample.foreground), cssColorToHex(sample.background)).toFixed(2),
    ),
  }));
  for (const sample of measured) {
    const minimum = ['text', 'placeholder'].includes(sample.kind) ? 4.5 : 3;
    assert.ok(
      sample.ratio >= minimum,
      `${theme} ${route} ${sample.kind} ${sample.selector}: ${sample.ratio}:1 < ${minimum}:1`,
    );
  }
  if (await page.locator('.reaction-menu-trigger').count()) {
    await page.keyboard.press('Tab');
    await page.locator('.reaction-menu-trigger').first().focus();
    const focus = await page
      .locator('.reaction-menu-trigger')
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        let background = 'rgb(255, 255, 255)';
        for (let current = element; current; current = current.parentElement) {
          const value = getComputedStyle(current).backgroundColor;
          const alpha =
            value.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i) ||
            value.match(/color\(srgb\s+[\d.]+\s+[\d.]+\s+[\d.]+\s*\/\s*([\d.]+)\s*\)/i);
          if (!alpha || Number(alpha[1]) > 0.98) {
            background = value;
            break;
          }
        }
        return {
          visible: element.matches(':focus-visible'),
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
          background,
        };
      });
    assert.ok(
      focus.visible && focus.outlineStyle !== 'none' && focus.outlineWidth >= 2,
      `${theme} ${route} focus indicator: ${JSON.stringify(focus)}`,
    );
    const ratio = contrastRatio(cssColorToHex(focus.outlineColor), cssColorToHex(focus.background));
    assert.ok(ratio >= 3, `${theme} ${route} focus indicator contrast ${ratio.toFixed(2)}:1`);
  }
  const disabled = await page.evaluate(() => {
    const button = document.createElement('button');
    button.className = 'btn';
    button.disabled = true;
    button.textContent = 'اختبار معطّل';
    document.body.append(button);
    const style = getComputedStyle(button);
    const result = { opacity: Number(style.opacity), cursor: style.cursor };
    button.remove();
    return result;
  });
  assert.ok(
    disabled.opacity < 1 && disabled.cursor === 'not-allowed',
    `${theme} disabled control: ${JSON.stringify(disabled)}`,
  );
  report.contrast.push({ route, theme, samples: measured });
}
const userId = randomUUID(),
  token = randomBytes(32).toString('hex');
const slug = `stage4-qa-${Date.now()}`;
let browser,
  reportStartId = db.prepare('SELECT COALESCE(MAX(id),0) as id FROM reports').get().id;
(async () => {
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(
    userId,
    'مراجعة محلية',
    `${userId}@example.invalid`,
    'social-only',
    'admin',
    new Date().toISOString(),
  );
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(
    createHash('sha256').update(token).digest('hex'),
    userId,
    Date.now() + 3600000,
  );
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
  });
  try {
    const guest = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 900 },
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    const desktop = await guest.newPage();
    desktop.on('pageerror', (error) => report.errors.push(error.message));
    const load = async (page, route) => {
      const response = await page.goto(base + route, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await page.evaluate(() => document.fonts.ready);
    };
    const collectionResponse = await guest.request.get(base + '/api/collections');
    assert.equal(collectionResponse.status(), 200);
    const collections = (await collectionResponse.json()).collections;
    assert.deepEqual(
      collections.map((group) => [group.slug, group.count]),
      [
        ['students', 3],
        ['groups', 3],
        ['out-of-context', 2],
      ],
    );
    assert.equal((await guest.request.get(base + '/api/collections?scope=admin')).status(), 401);
    assert.equal((await guest.request.get(base + '/api/reports')).status(), 401);
    assert.equal(
      (
        await guest.request.post(base + '/api/collections', {
          headers: { Origin: base },
          data: { slug: 'forbidden' },
        })
      ).status(),
      401,
    );
    report.checks.push(
      'Three curated groups have correct membership and public counts; admin-only collection and report APIs reject guests.',
    );

    const rootPage = await guest.request.get(base + '/', { maxRedirects: 0 });
    assert.equal(rootPage.status(), 200);
    await load(desktop, '/');
    assert.equal(new URL(desktop.url()).pathname, '/');
    await desktop.getByRole('link', { name: 'الاستمرار كزائر بلا حساب', exact: true }).click();
    await desktop.waitForURL('**/library');
    assert.equal(new URL(desktop.url()).pathname, '/library');
    assert.equal(await desktop.locator('.brand[href="/library"]').count(), 1);
    assert.equal(await desktop.getByRole('link', { name: 'الرئيسية' }).count(), 0);
    report.checks.push(
      'Root renders the guest-first access gateway; choosing guest access opens the canonical library.',
    );

    for (const width of [320, 360, 375, 414, 640, 768, 850, 1024, 1280, 1440, 1920]) {
      await desktop.setViewportSize({ width, height: 900 });
      for (const route of ['/library', '/collections', '/collections/students', '/r/YR-0001']) {
        await load(desktop, route);
        if (width === 320) await assertPageStructure(desktop, route);
        assert.equal(
          await desktop.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          `${width} ${route}: horizontal overflow`,
        );
        if (route === '/library') {
          assert.equal(await desktop.locator('.reaction-card').count(), 12);
          assert.equal(await desktop.locator('.library-sentinel').count(), 0);
          const rows = await desktop.locator('.reaction-card').evaluateAll((cards) =>
            cards.map((card) => {
              const badge = card.querySelector('.card-duration');
              const visual = card.querySelector('.card-visual').getBoundingClientRect();
              const box = badge?.getBoundingClientRect();
              const button = card.querySelector('.reaction-menu-trigger');
              const title = card.querySelector('.card-title');
              const style = getComputedStyle(title);
              return {
                kind: card.dataset.mediaType,
                seconds: badge?.textContent,
                badgeWidth: box?.width,
                badgeHeight: box?.height,
                badgeRight: box ? Math.round(visual.right - box.right) : null,
                menuWidth: button?.getBoundingClientRect().width,
                titleClamp: style.getPropertyValue('-webkit-line-clamp'),
                titleWhiteSpace: style.whiteSpace,
                titleText: title.textContent,
                extra: !!card.querySelector('.card-caption,.save-button,.card-expand,.card-shade'),
              };
            }),
          );
          for (const item of rows) {
            assert.equal(item.kind, 'video');
            assert.match(item.seconds, /^\d+(\.\d+)?s$/);
            assert.ok(
              item.badgeWidth >= 32 &&
                item.badgeHeight === 20 &&
                item.badgeRight >= 8 &&
                item.badgeRight <= 12,
              JSON.stringify({ width, item }),
            );
            assert.equal(item.menuWidth, 44);
            assert.equal(item.titleClamp, '2');
            assert.equal(item.titleWhiteSpace, 'normal');
            assert.equal(item.extra, false);
          }
          if (width <= 375) {
            const cards = desktop.locator('.reaction-card');
            for (let index = 0; index < (await cards.count()); index++) {
              await cards.nth(index).locator('.reaction-menu-trigger').click();
              const box = await desktop.locator('.reaction-menu-panel').evaluate((element) => {
                const rect = element.getBoundingClientRect();
                return { left: rect.left, right: rect.right };
              });
              assert.ok(
                box.left >= 0 && box.right <= width,
                `Mobile menu clipped: ${width} ${index} ${JSON.stringify(box)}`,
              );
              await desktop.keyboard.press('Escape');
            }
          }
        }
        if (route === '/r/YR-0001') {
          assert.ok((await desktop.locator('.detail-page .card-duration').count()) > 0); // related cards only, never on main media
          assert.equal(await desktop.locator('.detail-media-stage .card-duration').count(), 0);
          assert.equal(await desktop.locator('.detail-meta .character-chip').count(), 1);
          assert.equal(await desktop.locator('.detail-meta-description').count(), 0);
          assert.equal(
            await desktop.locator('.character-chip a, .character-chip button').count(),
            0,
          );
          assert.equal(await desktop.locator('.detail-secondary').count(), 1);
          assert.equal(
            await desktop.locator('.detail-secondary').evaluate((node) => node.open),
            false,
          );
          assert.equal(await desktop.locator('.detail-collections a').count(), 1);
          assert.equal(
            await desktop
              .locator('.detail-recommendations')
              .first()
              .locator('.reaction-card')
              .count(),
            10,
          );
          assert.equal(
            await desktop
              .locator('.detail-recommendations')
              .nth(1)
              .locator('.reaction-card')
              .count(),
            1,
          );
          const bounds = await desktop
            .locator(
              '.detail-titlebar h1, .detail-controls .reaction-actions button, .detail-menu .reaction-menu-trigger',
            )
            .evaluateAll((nodes) =>
              nodes.map((el) => {
                const rect = el.getBoundingClientRect();
                return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
              }),
            );
          if (width <= 650) {
            assert.ok(
              bounds.slice(1).every((item) => item.top >= bounds[0].bottom - 2),
              `Mobile controls must follow the title: ${width} ${JSON.stringify(bounds)}`,
            );
            const actions = await desktop
              .locator('.detail-controls .reaction-actions .btn')
              .evaluateAll((buttons) =>
                buttons.map((button) => {
                  const rect = button.getBoundingClientRect();
                  const label = button.querySelector('span')?.getBoundingClientRect();
                  return {
                    width: rect.width,
                    height: rect.height,
                    labelWidth: label?.width ?? 0,
                    labelHeight: label?.height ?? 0,
                  };
                }),
              );
            assert.equal(actions.length, 3);
            assert.ok(
              actions.every(
                (item) =>
                  item.width >= 44 &&
                  item.height >= 44 &&
                  item.labelWidth > 0 &&
                  item.labelHeight > 0,
              ),
              `Mobile action labels/touch targets: ${width} ${JSON.stringify(actions)}`,
            );
          } else {
            assert.ok(
              bounds.every((item) => Math.abs(item.top - bounds[0].top) <= 3),
              `Desktop H1/actions should share a row: ${width} ${JSON.stringify(bounds)}`,
            );
          }
        }
        report.widths.push({ width, route, noOverflow: true });
      }
    }
    report.checks.push(
      'Eleven viewport widths from 320px to 1920px: no horizontal overflow, all 12 cards render immediately, titles clamp to two lines, menus are 44×44, mobile detail actions remain labeled, and optional sections follow the title.',
    );

    await desktop.setViewportSize({ width: 1440, height: 900 });
    await load(desktop, '/library');
    const font = await desktop.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      logo: getComputedStyle(document.querySelector('.brand b')).fontFamily,
      mono: getComputedStyle(document.querySelector('.card-duration')).fontFamily,
      h1: getComputedStyle(
        document.querySelector('.detail-titlebar h1') || document.querySelector('h1'),
      ).fontFamily,
    }));
    assert.match(font.body, /^Inter,/);
    assert.match(font.body, /"IBM Plex Sans Arabic"/);
    assert.match(font.logo, /Lalezar/);
    assert.match(font.mono, /IBM Plex Mono/);
    assert.doesNotMatch(font.h1, /Lalezar/);
    const anchor = desktop.locator('.card-preview[href="/r/YR-0001"]');
    const movie = anchor.locator('video');
    await anchor.hover();
    await desktop.waitForFunction(
      () => {
        const video = document.querySelector('.card-preview[href="/r/YR-0001"] .card-hover-video');
        return video && video.muted && !video.paused && video.currentTime > 0;
      },
      undefined,
      { timeout: 10000 },
    );
    await desktop.mouse.move(0, 0);
    assert.equal(await movie.evaluate((video) => video.paused), true);
    await anchor.click();
    await desktop.waitForURL('**/r/YR-0001');
    assert.equal(await desktop.locator('.detail-media-stage video[controls]').count(), 1);
    assert.equal(await desktop.locator('.detail-back').count(), 1);
    await desktop.locator('.detail-secondary summary').click();
    assert.equal(await desktop.locator('.detail-secondary').evaluate((node) => node.open), true);
    await desktop.getByRole('button', { name: 'رجوع إلى الصفحة السابقة' }).click();
    await desktop.waitForURL('**/library');
    report.checks.push(
      'Video hover actually plays muted on desktop, stops on exit, click opens details, and overlay back works. Plex Arabic/Inter/Mono and logo-only Lalezar are loaded.',
    );

    await desktop.getByRole('button', { name: 'خيارات يا ساتر!' }).click();
    const menu = desktop.locator('.reaction-menu-panel');
    assert.equal(await menu.getByRole('menuitem').count(), 4);
    await desktop.keyboard.press('ArrowDown');
    assert.equal(
      await menu
        .getByRole('menuitem', { name: 'مشاركة' })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await desktop.keyboard.press('Escape');
    assert.equal(
      await desktop
        .getByRole('button', { name: 'خيارات يا ساتر!' })
        .evaluate((node) => node === document.activeElement),
      true,
    );
    await desktop.getByRole('button', { name: 'خيارات يا ساتر!' }).click();
    await menu.getByRole('menuitem', { name: 'حفظ' }).click();
    await desktop.waitForFunction(() =>
      JSON.parse(localStorage.getItem('yr:guest-saved') || '[]').includes('YR-0001'),
    );
    await desktop.getByRole('button', { name: 'خيارات يا ساتر!' }).click();
    await menu.getByRole('menuitem', { name: 'نسخ الرابط' }).click();
    assert.ok(
      (await desktop.evaluate(() => navigator.clipboard.readText())).endsWith('/r/YR-0001'),
    );
    await desktop.getByRole('button', { name: 'خيارات يا ساتر!' }).click();
    await menu.getByRole('menuitem', { name: 'إبلاغ' }).click();
    const reportForm = desktop.locator('dialog[open]');
    await reportForm.getByLabel('سبب البلاغ').selectOption('رابط لا يعمل');
    await reportForm.getByLabel('توضيح إضافي (اختياري)').fill('اختبار معاينة محلي');
    await reportForm.getByRole('button', { name: 'إرسال البلاغ' }).click();
    await desktop.waitForFunction(() => !document.querySelector('dialog[open]'));
    await load(desktop, '/saved');
    assert.equal(new URL(desktop.url()).pathname, '/account');
    assert.equal(await desktop.locator('.account-row-list .account-row').count(), 1);
    const touchscreen = await browser.newContext({
      serviceWorkers: 'block',
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    });
    const mobile = await touchscreen.newPage();
    mobile.on('pageerror', (error) => report.errors.push(error.message));
    await load(mobile, '/');
    await mobile.getByRole('link', { name: 'الاستمرار كزائر بلا حساب', exact: true }).click();
    await mobile.waitForURL('**/library');
    await mobile.locator('.card-preview[href="/r/YR-0001"]').tap();
    await mobile.waitForURL('**/r/YR-0001');
    assert.ok((await mobile.locator('.card-hover-video').count()) > 0); // related cards exist, none auto-play
    assert.equal(await mobile.locator('.card-hover-video.is-playing').count(), 0);
    report.checks.push(
      'Keyboard menu, guest save, link copy, report form, mobile detail navigation and reduced-motion no-hover playback pass.',
    );

    // Temporarily publish a real, file-verified static image in the disposable database.
    // Remove it before final screenshots so no demonstration image is added to the catalog.
    const imageCode = 'YR-STAGE4-IMAGE';
    const original = JSON.parse(
      db.prepare('SELECT data FROM reactions WHERE code=?').get('YR-0001').data,
    );
    const verifiedImage = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../src/lib/seed-media.json'), 'utf8'),
    )['/media/portrait-1.webp'];
    const longCaption =
      'وصف عربي طويل لاختبار بقاء الأزرار بمحاذاة العنوان على شاشة الهاتف الضيقة. '
        .repeat(2)
        .slice(0, 100);
    db.prepare('INSERT INTO reactions(code,data) VALUES (?,?)').run(
      imageCode,
      JSON.stringify({
        ...original,
        ...verifiedImage,
        code: imageCode,
        caption: longCaption,
        situation: longCaption,
        characterName: 'شخصية اختبارية',
        media: '/media/portrait-1.webp',
        poster: '/media/portrait-1.webp',
        isDemo: true,
      }),
    );
    const imagePage = await guest.newPage();
    imagePage.on('pageerror', (error) => report.errors.push(error.message));
    await load(imagePage, '/library');
    const imageCard = imagePage.locator(`[data-media-type="image"]:has(a[href="/r/${imageCode}"])`);
    assert.equal(await imageCard.count(), 1);
    assert.equal(await imageCard.locator('.card-duration,video').count(), 0);
    const cardTitle = await imageCard.locator('.card-title').evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clamp: style.getPropertyValue('-webkit-line-clamp'),
        height: element.getBoundingClientRect().height,
        lineHeight: parseFloat(style.lineHeight),
        textLength: element.textContent.trim().length,
      };
    });
    assert.equal(cardTitle.clamp, '2');
    assert.ok(cardTitle.height <= cardTitle.lineHeight * 2 + 1, JSON.stringify(cardTitle));
    assert.equal(cardTitle.textLength, 100);
    await imageCard.locator('.card-preview').click();
    await imagePage.waitForURL(`**/r/${imageCode}`);
    await imagePage.setViewportSize({ width: 320, height: 800 });
    assert.ok(await imagePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const mobileDetail = await imagePage.evaluate(() => {
      const title = document.querySelector('.detail-titlebar h1').getBoundingClientRect();
      const controls = document.querySelector('.detail-controls').getBoundingClientRect();
      const actions = [...document.querySelectorAll('.detail-controls .reaction-actions .btn')].map(
        (button) => {
          const rect = button.getBoundingClientRect();
          const label = button.querySelector('span').getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            labelWidth: label.width,
            labelHeight: label.height,
          };
        },
      );
      return { titleBottom: title.bottom, controlsTop: controls.top, actions };
    });
    assert.ok(
      mobileDetail.controlsTop >= mobileDetail.titleBottom - 1,
      JSON.stringify(mobileDetail),
    );
    assert.equal(mobileDetail.actions.length, 3);
    assert.ok(
      mobileDetail.actions.every(
        (item) =>
          item.width >= 44 && item.height >= 44 && item.labelWidth > 0 && item.labelHeight > 0,
      ),
      JSON.stringify(mobileDetail.actions),
    );
    assert.equal(await imagePage.locator('.detail-media-stage .clip-still').count(), 1);
    assert.equal(await imagePage.locator('.detail-media-stage video').count(), 0);
    assert.equal(await imagePage.locator('.detail-secondary').count(), 0);
    assert.equal(await imagePage.locator('.detail-meta').count(), 1);
    assert.equal(await imagePage.locator('.detail-meta-description').count(), 0);
    assert.equal(await imagePage.locator('.detail-collections').count(), 0);
    assert.ok((await imagePage.locator('.detail-demo-note').innerText()).includes('صورة مولّدة'));
    const downloadPromise = imagePage.waitForEvent('download');
    await imagePage.getByRole('button', { name: 'تنزيل', exact: true }).click();
    const downloaded = await downloadPromise;
    assert.match(downloaded.suggestedFilename(), /\.webp$/);
    assert.equal(
      createHash('sha256')
        .update(fs.readFileSync(await downloaded.path()))
        .digest('hex'),
      verifiedImage.mediaSha256,
    );
    await imagePage.close();
    db.prepare('DELETE FROM reactions WHERE code=?').run(imageCode);
    report.checks.push(
      'Verified static image has no video badge/player, its two-line card title stays clamped, mobile action labels follow the long H1 with 44px targets, duplicate descriptions are omitted, and downloaded bytes match SHA-256; the local fixture is deleted.',
    );

    const adminContext = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1440, height: 900 },
    });
    await adminContext.addCookies([{ name: 'yr_session', value: token, url: base }]);
    const admin = await adminContext.newPage();
    admin.on('pageerror', (error) => report.errors.push(error.message));
    await load(admin, '/admin');
    await admin.setViewportSize({ width: 375, height: 850 });
    await admin.getByRole('button', { name: 'المجموعات', exact: true }).click();
    await admin.locator('.admin-collection').first().waitFor();
    assert.equal(await admin.locator('.admin-collection').count(), 3);
    assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const adminAudit = await new AxeBuilder({ page: admin }).analyze();
    report.axe.push({
      route: '/admin (collections, mobile)',
      theme: 'light',
      violations: adminAudit.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
    });
    assert.equal(adminAudit.violations.length, 0, JSON.stringify(report.axe.at(-1)));
    await admin.screenshot({
      path: path.join(__dirname, 'stage4', 'admin-collections-mobile.png'),
      fullPage: true,
    });
    await admin.getByRole('button', { name: 'مجموعة جديدة' }).click();
    const editor = admin.locator('dialog[open]');
    const box = await editor.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 375, JSON.stringify(box));
    const checkboxHeight = await editor
      .locator('.collection-members input')
      .first()
      .evaluate((node) => node.getBoundingClientRect().height);
    assert.ok(checkboxHeight <= 20, `Studio checkbox oversized: ${checkboxHeight}`);
    const dialogAudit = await new AxeBuilder({ page: admin }).analyze();
    report.axe.push({
      route: '/admin (collection editor, mobile)',
      theme: 'light',
      violations: dialogAudit.violations.map((item) => ({
        id: item.id,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      })),
    });
    assert.equal(dialogAudit.violations.length, 0, JSON.stringify(report.axe.at(-1)));
    await admin.screenshot({ path: path.join(__dirname, 'stage4', 'admin-editor-mobile.png') });
    await editor.getByLabel('عنوان المجموعة').fill('مجموعة محلية');
    await editor.getByLabel('الرابط المختصر (أحرف لاتينية)').fill(slug);
    await editor.getByLabel('نوع المجموعة').selectOption('person');
    await editor.locator('.collection-members input').nth(0).check();
    await editor.locator('.collection-members input').nth(1).check();
    await editor.getByRole('button', { name: 'حفظ المجموعة' }).click();
    await admin.waitForFunction(() => !document.querySelector('dialog[open]'));
    const created = await adminContext.request.get(base + '/api/collections?scope=admin');
    assert.equal(created.status(), 200);
    const newGroup = (await created.json()).collections.find((group) => group.slug === slug);
    assert.equal(newGroup.count, 2);
    assert.equal(newGroup.kind, 'person');
    await load(admin, `/collections/${slug}`);
    assert.equal(await admin.locator('.reaction-card').count(), 2);
    const archive = await adminContext.request.put(base + '/api/collections', {
      headers: { Origin: base },
      data: {
        slug,
        kind: 'place',
        title: newGroup.title,
        description: newGroup.description,
        memberCodes: newGroup.memberCodes,
        coverCode: newGroup.coverCode,
        active: false,
      },
    });
    assert.equal(archive.status(), 200);
    assert.equal((await archive.json()).collection.kind, 'place');
    assert.equal((await adminContext.request.get(base + `/collections/${slug}`)).status(), 404);
    assert.equal(
      (await (await adminContext.request.get(base + '/api/collections')).json()).collections.some(
        (group) => group.slug === slug,
      ),
      false,
    );
    const invalidCover = await adminContext.request.post(base + '/api/collections', {
      headers: { Origin: base },
      data: {
        slug: `${slug}-invalid`,
        kind: 'thematic',
        title: 'غطاء غريب',
        description: '',
        memberCodes: ['YR-0001'],
        coverCode: 'YR-0002',
        active: true,
      },
    });
    assert.equal(invalidCover.status(), 400);
    await load(admin, '/admin');
    await admin.getByRole('button', { name: 'البلاغات', exact: true }).click();
    await admin.getByText('اختبار معاينة محلي').waitFor();
    report.checks.push(
      'Admin studio creates a curated collection with two members, renders its public page, and sees the submitted report; guest APIs remain blocked.',
    );

    for (const [route, theme, page] of [
      ['/library', 'light', desktop],
      ['/collections', 'light', desktop],
      ['/library', 'dark', desktop],
      ['/r/YR-0001', 'dark', desktop],
      ['/library', 'light', mobile],
      ['/admin', 'light', admin],
      ['/admin', 'dark', admin],
    ]) {
      await page.addInitScript((t) => localStorage.setItem('yr:theme', JSON.stringify(t)), theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await load(page, route);
      if (route === '/admin') {
        await page.getByRole('button', { name: 'المجموعات', exact: true }).click();
        await page.locator('.admin-collection').first().waitFor();
        await page.getByRole('button', { name: 'مجموعة جديدة' }).click();
        const editorRoute = `${route} collection editor`;
        await assertPageStructure(page, editorRoute);
        await assertRenderedContrast(page, editorRoute, theme);
        const editorAudit = await new AxeBuilder({ page }).analyze();
        report.axe.push({
          route: editorRoute,
          theme,
          violations: editorAudit.violations.map((item) => ({
            id: item.id,
            nodes: item.nodes.map((node) => ({
              target: node.target,
              failureSummary: node.failureSummary,
            })),
          })),
        });
        assert.equal(editorAudit.violations.length, 0, JSON.stringify(report.axe.at(-1)));
        await page.keyboard.press('Escape');
        await page.locator('dialog[open]').waitFor({ state: 'detached' });
      }
      await assertPageStructure(page, route);
      await assertRenderedContrast(page, route, theme);
      const audit = await new AxeBuilder({ page }).analyze();
      report.axe.push({
        route,
        theme,
        violations: audit.violations.map((item) => ({
          id: item.id,
          impact: item.impact,
          nodes: item.nodes.length,
        })),
      });
      assert.equal(audit.violations.length, 0, JSON.stringify(report.axe.at(-1)));
    }
    report.checks.push(
      'Eleven axe audits plus live color-pair, placeholder and focus-ring checks across public pages, admin collections and the collection editor in light/dark + reduced-motion contexts: no violations.',
    );
    await desktop.setViewportSize({ width: 375, height: 900 });
    for (const [route, filename] of [
      ['/library', 'library-mobile.png'],
      ['/collections', 'collections-mobile.png'],
      ['/r/YR-0001', 'detail-mobile.png'],
    ]) {
      await load(desktop, route);
      await desktop.screenshot({ path: path.join(__dirname, 'stage4', filename), fullPage: true });
    }
    assert.deepEqual(report.errors, []);
    report.completed = true;
  } catch (failure) {
    report.failure = failure.stack;
    process.exitCode = 1;
  } finally {
    db.prepare('DELETE FROM reactions WHERE code=?').run('YR-STAGE4-IMAGE');
    try {
      db.prepare('DELETE FROM collections WHERE slug=?').run(slug);
    } catch {}
    db.prepare('DELETE FROM reports WHERE id>?').run(reportStartId);
    db.prepare('DELETE FROM users WHERE id=?').run(userId);
    db.close();
    if (browser) await browser.close();
    fs.mkdirSync(path.join(__dirname, 'stage4'), { recursive: true });
    fs.writeFileSync(
      path.join(__dirname, 'stage4', 'results.json'),
      JSON.stringify(report, null, 2) + '\n',
    );
    console.log(
      JSON.stringify(
        {
          completed: report.completed,
          responsive: report.widths.length,
          axe: report.axe,
          checks: report.checks.length,
          errors: report.errors,
          failure: report.failure,
        },
        null,
        2,
      ),
    );
  }
})().catch((error) => {
  console.error(error);
  db.close();
  process.exitCode = 1;
});
