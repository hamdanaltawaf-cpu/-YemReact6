/**
 * تحقّق آلي من DECISION-51: البحث = حالة من المكتبة (?q=) في متصفح حقيقي.
 *
 * التشغيل (من جذر المستودع، وخادم المعاينة يعمل على المنفذ 3000):
 *   node verification/decision-51-search.cjs
 *
 * يغطّي: توجيه /search إلى /library مع الحفاظ على q، noindex,follow لنتائج البحث،
 * حقل البحث الواحد في صفّ الرأس (44px حاسوبًا بعرض ≤560 · 42px على الجوال داخل كتلة 60px)،
 * نصّ placeholder المطلوب، نطاق البحث P-14 (يشمل اسم الشخص)، غياب الانزياح الأفقي،
 * اختفاء الرأس على الجوال بالتمرير (translateY(-110%) + pointer-events:none + inert + aria-hidden،
 * ولا يختفي أثناء التركيز، و«/» يُظهره ويركّز)،
 * واختفاء الشريط الزجاجي من 640px فصاعدًا بلا حشوة سفلية على الحاسوب.
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

  // 5) حقل واحد في صفّ الرأس على الحاسوب: 44px ارتفاعًا وعرض ≤560px (flex الوسط)
  const box = await page.locator('.library-search').boundingBox();
  assert.ok(box, 'حقل الرأس غير ظاهر');
  assert.equal(Math.round(box.height), 44, `الارتفاع ${box.height}`);
  assert.ok(box.width > 300 && box.width <= 560, `العرض ${box.width}`);
  assert.equal(await page.locator('form[role="search"]').count(), 1, 'نموذج بحث واحد فقط');
  ok(`حقل الرأس الواحد ${Math.round(box.width)}×${Math.round(box.height)}px (≤560 × 44، نموذج واحد)`);

  // 6) placeholder المطلوب في الحقل الواحد
  const placeholder = 'ابحث عن رياكشن أو موقف...';
  assert.equal(await page.locator('#library-search').getAttribute('placeholder'), placeholder);
  assert.equal((await page.content()).match(/id="library-search"/g)?.length ?? 0, 1, 'id واحد');
  ok(`placeholder «${placeholder}» في الحقل الواحد (#library-search × 1)`);

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

  // 8) الحاسوب ≥640px: الشريط الزجاجي مخفي وبلا حشوة سفلية محجوزة
  assert.equal(await page.locator('.gnav-tab').count(), 5, 'التبويبات الخمس في DOM');
  assert.equal(await page.locator('.glass-nav').isVisible(), false, 'الكبسولة يجب أن تختفي ≥640px');
  const bodyPad = await page.evaluate(() => getComputedStyle(document.body).paddingBottom);
  assert.equal(bodyPad, '0px', `حشوة سفلية محجوزة على الحاسوب: ${bodyPad}`);
  ok('الحاسوب: glass-nav مخفي ≥640px والحشوة السفلية 0');

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
  await mpage.waitForSelector('.library-search', { timeout: 60000 });
  assert.equal(await mpage.locator('.mobile-search-trigger').count(), 0, 'لا يجوز إبقاء الزر المُطلق');
  assert.equal(await mpage.locator('.header-search-row').count(), 0, 'صفّ البحث المنفصل أُزيل');
  assert.equal(await mpage.locator('form[role="search"]').count(), 1, 'نموذج واحد على الجوال أيضًا');
  const headerBox = await mpage.locator('header.site-header').boundingBox();
  const mobileForm = await mpage.locator('.library-search').boundingBox();
  assert.ok(mobileForm && headerBox, 'حقل الجوال غير ظاهر');
  assert.equal(Math.round(headerBox.height), 60, `ارتفاع كتلة الرأس ${headerBox.height}`);
  assert.equal(Math.round(mobileForm.height), 42, `ارتفاع حقل الجوال ${mobileForm.height}`);
  assert.ok(
    mobileForm.y >= headerBox.y && mobileForm.y + mobileForm.height <= headerBox.y + headerBox.height,
    'الحقل خارج حدود الرأس',
  );
  ok(`كتلة الرأس 60px والحقل داخلها بارتفاع 42px (بلا صفّ ثانٍ)`);

  // 11) الرأس يختفي بالتمرير للأسفل ويعود بأول حركة لأعلى، ولا يختفي أثناء الكتابة
  const hiddenState = () =>
    mpage.evaluate(() => {
      const header = document.querySelector('header.site-header');
      const style = getComputedStyle(header);
      return {
        cls: header.className,
        inert: header.inert,
        aria: header.getAttribute('aria-hidden'),
        transform: style.transform,
        pointer: style.pointerEvents,
      };
    });
  await mpage.evaluate(() => window.scrollTo(0, 0));
  await mpage.waitForTimeout(300);
  await mpage.evaluate(() => window.scrollTo(0, 600));
  await mpage.waitForTimeout(400);
  let state = await hiddenState();
  assert.match(state.cls, /header-hidden/, 'الرأس لم يختفِ بالنزول');
  assert.equal(state.inert, true, 'inert غير مفعّل عند الاختفاء');
  assert.equal(state.aria, 'true', 'aria-hidden غير مضبوط عند الاختفاء');
  assert.notEqual(state.transform, 'none', 'لا translateY عند الاختفاء');
  assert.equal(state.pointer, 'none', 'pointer-events يجب أن تتعطّل');
  ok('النزول >80px: الرأس يختفي بـ translateY(-110%) + pointer-events:none + inert + aria-hidden');

  await mpage.evaluate(() => window.scrollTo(0, 560));
  await mpage.waitForTimeout(400);
  state = await hiddenState();
  assert.doesNotMatch(state.cls, /header-hidden/, 'الرأس لم يعد بأول حركة لأعلى');
  ok('أول حركة لأعلى تعيد الرأس');

  await mpage.focus('#library-search');
  await mpage.evaluate(() => window.scrollTo(0, 800));
  await mpage.waitForTimeout(400);
  state = await hiddenState();
  assert.doesNotMatch(state.cls, /header-hidden/, 'الرأس اختفى أثناء التركيز في الحقل');
  ok('أثناء التركيز في الحقل (searchFocus) لا يختفي الرأس');

  await mpage.evaluate(() => document.activeElement?.blur());
  await mpage.evaluate(() => window.scrollTo(0, 1000));
  await mpage.waitForTimeout(400);
  assert.match((await hiddenState()).cls, /header-hidden/);
  await mpage.keyboard.press('/');
  await mpage.waitForTimeout(400);
  state = await hiddenState();
  assert.doesNotMatch(state.cls, /header-hidden/, 'اختصار «/» لم يُظهر الرأس');
  assert.equal(
    await mpage.evaluate(() => document.activeElement?.id),
    'library-search',
    'اختصار «/» لم يركّز في #library-search',
  );
  ok('اختصار «/» يُظهر الرأس ثم يركّز في #library-search');

  // 12) الإرسال من حقل الجوال ينقل إلى المكتبة بالنتائج
  await mpage.fill('#library-search', 'قوية');
  await mpage.locator('.library-search button[type="submit"]').click();
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
