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
  axe: [],
  errors: [],
  completed: false,
};
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

    const rootRedirect = await guest.request.get(base + '/', { maxRedirects: 0 });
    assert.equal(rootRedirect.status(), 308);
    assert.equal(new URL(rootRedirect.headers().location, base).pathname, '/library');
    await load(desktop, '/');
    assert.equal(new URL(desktop.url()).pathname, '/library');
    assert.equal(await desktop.locator('.brand[href="/library"]').count(), 1);
    assert.equal(await desktop.getByRole('link', { name: 'الرئيسية' }).count(), 0);
    report.checks.push(
      'Root redirects permanently to the canonical library, with no Home navigation.',
    );

    for (const width of [320, 375, 768, 1024, 1440, 1920]) {
      await desktop.setViewportSize({ width, height: 900 });
      for (const route of ['/library', '/collections', '/collections/students', '/r/YR-0001']) {
        await load(desktop, route);
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
                titleLines: style.whiteSpace,
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
            assert.equal(item.menuWidth, 34);
            assert.equal(item.titleLines, 'nowrap');
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
          const positions = await desktop
            .locator(
              '.detail-titlebar h1, .detail-controls .reaction-actions button, .detail-menu .reaction-menu-trigger',
            )
            .evaluateAll((nodes) => nodes.map((el) => Math.round(el.getBoundingClientRect().top)));
          assert.ok(
            positions.every((position) => Math.abs(position - positions[0]) <= 3),
            `H1/actions different rows: ${width} ${positions}`,
          );
        }
        report.widths.push({ width, route, noOverflow: true });
      }
    }
    report.checks.push(
      'Six viewport widths: no horizontal overflow, all 12 cards rendered immediately, top-right 32×20s-only video badges and 34×34 menus; details have a same-row H1/action group and optional sections.',
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
    assert.match(font.body, /^Inter, "IBM Plex Sans Arabic"/);
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
    assert.equal(await desktop.locator('.reaction-card').count(), 1);
    const touchscreen = await browser.newContext({
      serviceWorkers: 'block',
      hasTouch: true,
      isMobile: true,
      viewport: { width: 375, height: 812 },
      reducedMotion: 'reduce',
    });
    const mobile = await touchscreen.newPage();
    mobile.on('pageerror', (error) => report.errors.push(error.message));
    await load(mobile, '/library');
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
    db.prepare('INSERT INTO reactions(code,data) VALUES (?,?)').run(
      imageCode,
      JSON.stringify({
        ...original,
        ...verifiedImage,
        code: imageCode,
        caption: 'وصف عربي طويل لاختبار بقاء الأزرار بمحاذاة العنوان على شاشة الهاتف الضيقة. '
          .repeat(2)
          .slice(0, 100),
        situation: '',
        characterName: '',
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
    assert.ok(
      await imageCard
        .locator('.card-title')
        .evaluate((element) => element.scrollWidth > element.clientWidth),
    );
    await imageCard.locator('.card-preview').click();
    await imagePage.waitForURL(`**/r/${imageCode}`);
    await imagePage.setViewportSize({ width: 320, height: 800 });
    assert.ok(await imagePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const titleRow = await imagePage
      .locator('.detail-titlebar h1, .detail-controls button')
      .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
    assert.ok(
      titleRow.every((top) => Math.abs(top - titleRow[0]) < 4),
      JSON.stringify(titleRow),
    );
    assert.equal(await imagePage.locator('.detail-media-stage .clip-still').count(), 1);
    assert.equal(await imagePage.locator('.detail-media-stage video').count(), 0);
    assert.equal(
      await imagePage.locator('.detail-secondary,.detail-meta,.detail-collections').count(),
      0,
    );
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
      'Verified static image has no video badge/player, a long title stays on the H1/action row at 320px, absent fields are omitted, and downloaded bytes match SHA-256; the local fixture is deleted.',
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
      violations: adminAudit.violations.map((item) => ({ id: item.id, nodes: item.nodes.length })),
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
      violations: dialogAudit.violations.map((item) => ({ id: item.id, nodes: item.nodes.length })),
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
    ]) {
      await page.addInitScript((t) => localStorage.setItem('yr:theme', JSON.stringify(t)), theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await load(page, route);
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
      'Seven axe audits across public pages and the admin collection studio/editor in light/dark + reduced-motion contexts: no violations.',
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
