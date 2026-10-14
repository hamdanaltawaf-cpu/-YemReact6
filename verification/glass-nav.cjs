/**
 * تحقّق آلي من الشريط الزجاجي GlassNav (src/components/glass-nav) في متصفح حقيقي.
 *
 * التشغيل (من جذر المستودع، وخادم المعاينة يعمل على المنفذ 3000):
 *   node verification/glass-nav.cjs
 *
 * يغطّي: الترتيب RTL، تساوي مناطق اللمس، تمركز زر اضافة، التنقّل الحقيقي،
 * امتلاء الأيقونة النشطة فعليًا (فحص بكسلات لا خصائص CSS)، ورقة/منبثق الحساب،
 * أسهم لوحة المفاتيح بوعي RTL، تقليل الحركة، الوضع الداكن، axe للشريط وللرأس،
 * وغياب الانزياح الأفقي من 320px إلى 1920px.
 * حدّ 5.2.12: الشريط للجوال وحده (<640px) — على ≥640px يُتحقق من اختفائه،
 * ومن صِفريّة الحشوة السفلية، ومن انتقال التنقّل والحساب إلى الرأس (الرفع من 768px)،
 * مع حشوة محجوزة ما دُمنا عند 639px فأقل.
 */
const { chromium } = require('./tools/node_modules/playwright');
const AxeBuilder = require('./tools/node_modules/@axe-core/playwright').default;
const sharp = require('sharp');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3000';
const outDir = 'verification/v4';
const report = { checks: [], widths: [], axe: [], shadows: [], completed: false };

const NAV = 'nav.glass-nav';
const tab = (key) => `${NAV} .gnav-tab[data-key="${key}"]`;

/** متوسط الإضاءة ونسبة البكسلات الداكنة في منطقة — لإثبات أن الأيقونة مرسومة فعلًا. */
async function darkness(page, selector) {
  const box = await page.locator(selector).boundingBox();
  const shot = await page.screenshot({
    clip: { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4 },
  });
  const { data, info } = await sharp(shot).greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  let dark = 0;
  for (const value of data) {
    sum += value;
    if (value < 120) dark += 1;
  }
  return {
    mean: +(sum / info.width / info.height).toFixed(1),
    darkPct: +((dark / (info.width * info.height)) * 100).toFixed(1),
  };
}

async function geometry(page) {
  return page.evaluate((nav) => {
    const bar = document.querySelector(nav);
    const rect = bar.getBoundingClientRect();
    const tabs = [...bar.querySelectorAll('.gnav-tab')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        key: el.dataset.key,
        x: +r.x.toFixed(1),
        w: +r.width.toFixed(1),
        cx: r.x + r.width / 2,
      };
    });
    const style = getComputedStyle(bar);
    return {
      rect: { w: +rect.width.toFixed(1), h: +rect.height.toFixed(1), cx: rect.x + rect.width / 2 },
      tabs,
      visualLtr: [...tabs].sort((a, b) => a.x - b.x).map((t) => t.key),
      active: tabs.length
        ? document.querySelector(`${nav} .gnav-tab[data-active="true"]`)?.dataset.key
        : null,
      position: style.position,
      bottomGap: +(innerHeight - rect.bottom).toFixed(1),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }, NAV);
}

function check(name, fn) {
  return (async () => {
    try {
      await fn();
      report.checks.push({ name, ok: true });
      console.log(`  ok  — ${name}`);
    } catch (error) {
      report.checks.push({ name, ok: false, error: error.message });
      console.log(`  FAIL — ${name}\n        ${error.message}`);
    }
  })();
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    /* ---------------- هاتف / الوضع الفاتح ---------------- */
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      serviceWorkers: 'block',
    });
    const page = await mobile.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`${base}/library`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);

    const home = await geometry(page);
    await page.screenshot({ path: `${outDir}/glass-nav-mobile.png`, animations: 'disabled' });

    await check('الشريط ثابت أسفل الشاشة بخمس تبويبات بترتيب RTL', () => {
      assert.equal(home.tabs.length, 5);
      assert.deepEqual(home.visualLtr, ['account', 'saved', 'add', 'groups', 'library']);
      assert.equal(home.position, 'fixed');
      assert.ok(
        home.bottomGap >= 0 && home.bottomGap <= 40,
        `فراغ سفلي غير متوقع: ${home.bottomGap}`,
      );
    });

    await check('مناطق اللمس الخمس متساوية وزر اضافة في المركز تمامًا', () => {
      const widths = home.tabs.map((t) => t.w);
      assert.ok(Math.max(...widths) - Math.min(...widths) <= 1.5, `فروق عرض: ${widths.join(', ')}`);
      const add = home.tabs.find((t) => t.key === 'add');
      assert.ok(
        Math.abs(add.cx - home.rect.cx) <= 2,
        `انحراف المركز ${(add.cx - home.rect.cx).toFixed(1)}px`,
      );
    });

    await check('التبويب النشط مستنتَج من المسار (المكتبة) ومرجعه صالح', async () => {
      assert.equal(home.active, 'library');
      const gv = await page.evaluate(
        `${NAV} .gnav-ico svg linearGradient`.replace('${uid}', '') &&
          (() => {
            const gradient = document.querySelector('nav.glass-nav .gnav-ico svg linearGradient');
            return (
              gradient && { id: gradient.id, resolved: !!document.getElementById(gradient.id) }
            );
          }),
      );
      assert.ok(gv && gv.resolved, `مرجع التدرّج غير محلول: ${JSON.stringify(gv)}`);
    });

    await check('الأيقونة النشطة ممتلئة فعلًا (فحص بكسلات)', async () => {
      const { mean, darkPct } = await darkness(page, `${tab('library')} .gnav-ico svg`);
      report.shadows.push({ where: 'mobile-light', mean, darkPct });
      assert.ok(darkPct > 25, `نسبة البكسلات الداكنة ${darkPct}% — الأيقونة لا تبدو ممتلئة`);
    });

    await check('التنقّل الحقيقي: المجموعات والمحفوظات تحدّث المسار والنشط', async () => {
      // انتظر اكتمال إعادة العرض *وانتهاء* تلاشي الأيقونة (240ms) قبل القياس
      const settled = (key) =>
        page.waitForFunction((k) => {
          const button = document.querySelector('nav.glass-nav .gnav-tab[data-active="true"]');
          const fill = button?.querySelector('.gnav-ico svg .s-f');
          return button?.dataset.key === k && fill && getComputedStyle(fill).opacity === '1';
        }, key);
      await page.click(tab('groups'));
      await page.waitForURL('**/collections', { timeout: 15000 });
      await settled('groups');
      assert.equal((await geometry(page)).active, 'groups');
      await page.click(tab('saved'));
      await page.waitForURL('**/saved', { timeout: 15000 });
      await settled('saved');
      assert.equal((await geometry(page)).active, 'saved');
      const sample = await darkness(page, `${tab('saved')} .gnav-ico svg`);
      report.shadows.push({ where: 'mobile-saved', ...sample });
      assert.ok(sample.darkPct > 25, `أيقونة المحفوظات غير ممتلئة (${sample.darkPct}%)`);
    });

    await check('زر اضافة ينبض عند اللمس ثم ينتقل إلى /contribute', async () => {
      await page.click(tab('add'));
      await page.waitForURL('**/contribute', { timeout: 15000 });
      assert.equal((await geometry(page)).active, 'add');
    });

    await check('تبويب الحساب يفتح الورقة السفلية نفسها التي يفتحها Avatar', async () => {
      await page.click(tab('account'));
      await page.waitForTimeout(600);
      const open = await page.evaluate(
        () => document.querySelector('dialog.modal-sheet')?.open ?? false,
      );
      const title = await page.evaluate(
        () => document.querySelector('dialog.modal-sheet h2')?.textContent ?? '',
      );
      assert.equal(open, true, 'الورقة السفلية لم تُفتح');
      assert.match(title, /الحساب/);
      await page.keyboard.press('Escape');
    });

    await check('الجوال <640px: body يحجز حشوة سفلية بمقدار --gnav-h + 42px', async () => {
      const { padding, gnavH } = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return {
          padding: parseFloat(style.paddingBottom),
          gnavH: parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue('--gnav-h'),
          ),
        };
      });
      assert.ok(
        Math.abs(padding - (gnavH + 42)) <= 1,
        `الحشوة ${padding}px مقابل ${gnavH + 42}px المتوقع`,
      );
    });

    await check('أسهم لوحة المفاتيح تتبع اتجاه RTL مع تركيز متحرّك', async () => {
      const focused = () => page.evaluate(() => document.activeElement?.dataset?.key);
      // التبويب النشط في /library هو المكتبة؛ الأسهم تحرّك التركيز وحده بلا تنقّل
      await page.focus(tab('library'));
      await page.keyboard.press('ArrowLeft'); // في RTL: التالي بصريًا
      await page.waitForTimeout(150);
      assert.equal(await focused(), 'groups', 'ArrowLeft لم ينقل التركيز إلى المجموعات');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(150);
      assert.equal(await focused(), 'library', 'ArrowRight لم يُعد التركيز إلى المكتبة');
      await page.keyboard.press('End');
      await page.waitForTimeout(150);
      assert.equal(await focused(), 'account');
      await page.keyboard.press('Home');
      await page.waitForTimeout(150);
      assert.equal(await focused(), 'library');
      assert.equal((await geometry(page)).active, 'library', 'التركيز وحده غيّر التبويب النشط');
    });

    await check('axe: لا انتهاكات جدّية داخل الشريط على الجوال', async () => {
      const results = await new AxeBuilder({ page }).include(NAV).analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      report.axe = results.violations.map((v) => ({ id: v.id, impact: v.impact }));
      assert.deepEqual(serious, [], serious.map((v) => v.id).join(', '));
    });

    await check('لا انزياح أفقي من 320px إلى 1920px', async () => {
      for (const width of [320, 375, 414, 768, 1024, 1440, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(250);
        const { overflow } = await geometry(page);
        report.widths.push({ width, overflow });
        assert.ok(overflow <= 1, `انزياح ${overflow}px عند عرض ${width}px`);
      }
    });

    await check('بلا أخطاء JavaScript في الصفحة', () => {
      assert.deepEqual(errors, []);
    });

    await mobile.close();

    /* ---------------- هاتف / تقليل الحركة ---------------- */
    const reduced = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(`${base}/library`, { waitUntil: 'networkidle' });
    await check('تقليل الحركة يلغي انتقالات الأيقونة', async () => {
      const durations = await reducedPage.evaluate(() => {
        const nodes = [
          ...document.querySelectorAll(
            'nav.glass-nav .gnav-ico, nav.glass-nav .gnav-ico svg .s-o, nav.glass-nav .gnav-ico svg .s-f',
          ),
        ];
        return nodes.map((node) => getComputedStyle(node).transitionDuration);
      });
      assert.ok(durations.length >= 6, `عدد العُقد المقيسة ${durations.length}`);
      for (const value of durations) {
        assert.match(value, /^0s(, 0s)*$/, `مدة انتقال غير ملغاة: ${value}`);
      }
    });
    await reduced.close();

    /* ---------------- هاتف / الوضع الداكن ---------------- */
    const dark = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: 'dark',
      serviceWorkers: 'block',
    });
    const darkPage = await dark.newPage();
    await darkPage.goto(`${base}/library`, { waitUntil: 'networkidle' });
    await darkPage.evaluate(() => document.fonts.ready);
    await darkPage.waitForTimeout(400);
    await darkPage.screenshot({ path: `${outDir}/glass-nav-dark.png`, animations: 'disabled' });
    await check('الوضع الداكن يقلب تدرّج الأيقونة إلى فاتح', async () => {
      const stops = await darkPage.evaluate(() =>
        [...document.querySelectorAll('nav.glass-nav .gnav-ico svg linearGradient stop')].map(
          (node) => getComputedStyle(node).stopColor,
        ),
      );
      const [r, g, b] = stops[0].match(/\d+/g).map(Number);
      assert.ok(r > 200 && g > 200 && b > 200, `أول محطة ${stops[0]} ليست فاتحة`);
    });
    await dark.close();

    /* ---------------- سطح المكتب ---------------- */
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: 'block',
    });
    const desktopPage = await desktop.newPage();
    await desktopPage.goto(`${base}/library`, { waitUntil: 'networkidle' });
    await desktopPage.evaluate(() => document.fonts.ready);
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({
      path: `${outDir}/glass-nav-desktop.png`,
      animations: 'disabled',
    });
    await check('الحاسوب (1440): الكبسولة مخفية تمامًا ولا تحجز حشوة سفلية', async () => {
      assert.equal(await desktopPage.locator(NAV).isVisible(), false, 'الكبسولة ظاهرة ≥640px');
      const padding = await desktopPage.evaluate(
        () => getComputedStyle(document.body).paddingBottom,
      );
      assert.equal(padding, '0px', `حشوة سفلية محجوزة على الحاسوب: ${padding}`);
    });

    await check(
      'الحاسوب: الرأس يحمل الشعار وحقلًا واحدًا والروابط الثلاثة والرفع والحساب',
      async () => {
        assert.equal(await desktopPage.locator('form[role="search"]').count(), 1, 'نموذج واحد');
        assert.ok(await desktopPage.locator('.library-search').isVisible(), 'حقل الرأس غير ظاهر');
        for (const href of ['/library', '/collections', '/saved'])
          assert.ok(
            await desktopPage.locator(`.desktop-nav a[href="${href}"]`).isVisible(),
            href,
          );
        assert.ok(await desktopPage.locator('.desktop-quick-action').isVisible(), 'زر الرفع مفقود');
        assert.ok(await desktopPage.locator('.account-avatar').isVisible(), 'زر الحساب مفقود');
      },
    );

    await check('الحاسوب: Avatar الرأس يفتح المنبثق لا الورقة', async () => {
      await desktopPage.click('.account-avatar');
      await desktopPage.waitForTimeout(500);
      assert.equal(await desktopPage.locator('#desktop-account-popover').count(), 1);
      assert.equal(
        await desktopPage.evaluate(
          () => document.querySelector('dialog.modal-sheet')?.open ?? false,
        ),
        false,
      );
    });

    await check('axe: لا انتهاكات جدّية داخل رأس الحاسوب', async () => {
      const results = await new AxeBuilder({ page: desktopPage })
        .include('header.site-header')
        .analyze();
      const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      assert.deepEqual(serious, [], serious.map((v) => v.id).join(', '));
    });

    await check('نطاق 640–1023: الكبسولة مخفية والتنقّل والحساب في الرأس (الرفع من 768)', async () => {
      for (const width of [640, 768, 1023]) {
        await desktopPage.setViewportSize({ width, height: 900 });
        await desktopPage.waitForTimeout(250);
        assert.equal(
          await desktopPage.locator(NAV).isVisible(),
          false,
          `الكبسولة ظاهرة عند ${width}px`,
        );
        assert.equal(
          await desktopPage.evaluate(() => getComputedStyle(document.body).paddingBottom),
          '0px',
          `حشوة محجوزة عند ${width}px`,
        );
        assert.ok(
          await desktopPage.locator('.desktop-nav').isVisible(),
          `التنقّل مختفٍ عند ${width}px`,
        );
        assert.ok(
          await desktopPage.locator('.account-avatar').isVisible(),
          `زر الحساب مختفٍ عند ${width}px`,
        );
        assert.equal(
          await desktopPage.locator('.desktop-quick-action').isVisible(),
          width >= 768,
          `زر الرفع عند ${width}px`,
        );
      }
    });

    await check('حدّ 639px: الكبسولة ظاهرة ما دُمنا دون 640 والحشوة محجوزة', async () => {
      await desktopPage.setViewportSize({ width: 639, height: 900 });
      await desktopPage.waitForTimeout(250);
      assert.ok(await desktopPage.locator(NAV).isVisible(), 'الكبسولة يجب أن تظهر عند 639px');
      const padding = await desktopPage.evaluate(() =>
        parseFloat(getComputedStyle(document.body).paddingBottom),
      );
      assert.ok(padding > 100, `الحشوة عند 639px: ${padding}px`);
      await desktopPage.setViewportSize({ width: 1440, height: 900 });
    });
    await desktop.close();

    report.completed = true;
  } finally {
    await browser.close();
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(`${outDir}/glass-nav.json`, JSON.stringify(report, null, 2));
  const failed = report.checks.filter((c) => !c.ok);
  console.log(
    `\n${report.checks.length - failed.length}/${report.checks.length} نجحت — التقرير في ${outDir}/glass-nav.json`,
  );
  if (failed.length) {
    console.log(`فشل: ${failed.map((c) => c.name).join(' · ')}`);
    process.exitCode = 1;
  }
})();
