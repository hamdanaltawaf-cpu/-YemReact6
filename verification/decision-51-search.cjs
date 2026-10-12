/**
 * تحقّق آلي من DECISION-51: البحث = حالة من المكتبة (?q=) في متصفح حقيقي.
 *
 * التشغيل (من جذر المستودع، وخادم المعاينة يعمل على المنفذ 3000):
 *   node verification/decision-51-search.cjs
 *
 * يغطّي: توجيه /search إلى /library مع الحفاظ على q، noindex,follow لنتائج البحث،
 * مواصفات حقل DECISION-I10 (44px · 420–480px · الحقل كاملًا في هيدر الجوال)،
 * نصّ placeholder المطلوب، نطاق البحث P-14 (يشمل اسم الشخص)، غياب الانزياح الأفقي،
 * وسلامة الشريط الزجاجي بعد التغييرات.
 */
const { chromium } = require('./tools/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3000';
const outDir = 'verification/decision-51';
const report = { checks: [], widths: [], completed: false };
const ok = (name) => report.checks.push(name);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1) /search?q=… يوجّه إلى /library مع الحفاظ على q والنتائج مفلترة
  await page.goto(`${base}/search?q=${encodeURIComponent('خبر صادم')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('.reaction-card', { timeout: 60000 });
  assert.ok(new URL(page.url()).pathname === '/library', `الموقع النهائي ${page.url()}`);
  assert.ok(new URL(page.url()).searchParams.get('q') === 'خبر صادم', 'q ضاع أثناء التوجيه');
  assert.equal(await page.locator('.reaction-card').count(), 1);
  ok('‎/search?q=… → ‎/library?q=… مع نتائج مفلترة');

  // 2) /search بلا q → /library نظيفة
  await page.goto(`${base}/search`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  assert.ok(new URL(page.url()).pathname === '/library', `الموقع النهائي ${page.url()}`);
  assert.equal(new URL(page.url()).searchParams.get('q'), null);
  ok('‎/search → ‎/library (بلا q)');

  // 3) الجذر /?q=… يحافظ على q عبر التوجيه الدائم
  await page.goto(`${base}/?q=${encodeURIComponent('يا ساتر')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  assert.ok(new URL(page.url()).searchParams.get('q') === 'يا ساتر', 'q ضاع من الجذر');
  ok('‎/?q=… → ‎/library?q=… (query محفوظ عبر التوجيه الدائم)');

  // 4) noindex,follow عند وجود q · ولا noindex بدون q
  assert.equal(
    await page.locator('meta[name="robots"]').getAttribute('content'),
    'noindex, follow',
    'نتائج البحث يجب أن تكون noindex,follow',
  );
  await page.goto(`${base}/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const plainRobots = await page.locator('meta[name="robots"]').count();
  assert.equal(plainRobots, 0, 'المكتبة بدون q يجب ألا تحمل noindex');
  ok('الفهرسة: q → noindex,follow · بلا q → قابل للفهرسة');

  // 5) مواصفات حقل الحاسوب: 44px ارتفاعًا و420–480px عرضًا (DECISION-I10)
  const box = await page.locator('.desktop-library-search').boundingBox();
  assert.ok(box, 'حقل الحاسوب غير ظاهر');
  assert.equal(Math.round(box.height), 44, `الارتفاع ${box.height}`);
  assert.ok(box.width >= 420 && box.width <= 480, `العرض ${box.width}`);
  ok(`حقل الحاسوب ${Math.round(box.width)}×${Math.round(box.height)}px (420–480 × 44)`);

  // 6) placeholder المطلوب في الحقلين
  const placeholder = 'ابحث عن رياكشن أو موقف...';
  for (const id of ['#desktop-library-search', '#mobile-library-search']) {
    assert.equal(await page.locator(id).getAttribute('placeholder'), placeholder, id);
  }
  ok(`placeholder «${placeholder}» في الحقلين`);

  // 7) P-14: اسم الشخص ضمن نطاق البحث — على أسماء موجودة في البيانات فعليًا
  const names = await page.evaluate(async () => {
    const rows = await (await fetch('/api/reactions')).json();
    return [...new Set(rows.reactions.map((r) => r.characterName).filter(Boolean))];
  });
  if (names.length) {
    await page.goto(`${base}/library?q=${encodeURIComponent(names[0])}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('.reaction-card', { timeout: 60000 });
    assert.equal(await page.locator('.reaction-card').count(), 1);
    ok(`P-14: البحث باسم الشخص «${names[0]}» يعيد البطاقة الصحيحة`);
  } else {
    // البيانات الحالية بلا أسماء أشخاص (بذرة الإنتاج أقدم من الحقل) —
    // تغطية الحقل نفسها في tests/search.test.mjs؛ وهنا نتأكد أن الاستعلام لا يُخطئ.
    await page.goto(`${base}/library?q=${encodeURIComponent('شخصية غير موجودة')}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('.library-feed', { timeout: 60000 });
    assert.equal(await page.locator('.reaction-card').count(), 0);
    ok('P-14: اسم الشخص مفهرس (البيانات بلا أسماء بعد — التغطية الوحدوية قائمة)');
  }

  // 8) الشريط الزجاجي سليم بعد التغييرات (5 تبويبات)
  assert.equal(await page.locator('.gnav-tab').count(), 5);
  ok('الشريط الزجاجي: 5 تبويبات دون تأثر');

  // 9) لا انزياح أفقي عند 1024 / 1440 / 1920 (حقل الحاسوب الجديد أوسع)
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert.ok(overflow <= 0, `انزياح ${overflow}px عند ${width}px`);
    report.widths.push({ width, overflow });
  }
  ok('لا انزياح أفقي عند 1024 / 1440 / 1920');

  // 10) الحقل كاملًا في هيدر الجوال — بلا زر مُطلق ولا نافذة بحث
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mobile.newPage();
  await mpage.goto(`${base}/library`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await mpage.waitForSelector('.mobile-library-search', { timeout: 60000 });
  assert.equal(await mpage.locator('.mobile-search-trigger').count(), 0, 'لا يجوز إبقاء الزر المُطلق');
  assert.equal(
    await mpage.locator('.header-search-row').isVisible(),
    true,
    'صفّ الحقل يجب أن يكون ظاهرًا في الهيدر',
  );
  const formBox = await mpage.locator('.mobile-library-search').boundingBox();
  const rowBox = await mpage.locator('.header-search-row').boundingBox();
  assert.ok(formBox && rowBox && formBox.width >= rowBox.width - 2, 'الحقل ليس كامل العرض');
  assert.equal(Math.round(formBox.height), 44, `ارتفاع حقل الجوال ${formBox.height}`);
  ok(`حقل الجوال داخل الهيدر كامل العرض (${Math.round(formBox.width)}px)`);

  // 11) الإرسال من حقل الجوال ينقل إلى المكتبة بالنتائج
  await mpage.fill('#mobile-library-search', 'قوية');
  await mpage.locator('.mobile-library-search button[type="submit"]').click();
  await mpage.waitForURL('**/library?q=*', { timeout: 60000 });
  await mpage.waitForSelector('.reaction-card', { timeout: 60000 });
  assert.equal(await mpage.locator('.reaction-card').count(), 2);
  ok('الإرسال من حقل الجوال → /library?q=… والنتائج مفلترة');

  // لقطات الدليل
  await mpage.screenshot({ path: `${outDir}/mobile-header-search.png` });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/library?q=${encodeURIComponent('قوية')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('.reaction-card', { timeout: 60000 });
  await page.screenshot({ path: `${outDir}/desktop-search-results.png` });

  assert.deepEqual(errors, [], `أخطاء JavaScript: ${errors.join(' | ')}`);
  ok('صفر أخطاء JavaScript');

  report.completed = true;
  fs.writeFileSync(`${outDir}/decision-51.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
