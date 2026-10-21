/**
 * تحقّق حيّ بلا متصفّح من «صفّ الرأس الواحد + الشريط السفلي للجوال وحده».
 *
 * التشغيل (من جذر المستودع، وخادم المعاينة يعمل):
 *   node verification/header-single-row.cjs http://localhost:3000
 *
 * يفحص HTML المُخدَّم لصفحة ‎/library وCSS المُخدَّم المُجمَّع من كل <link rel="stylesheet">:
 *   - صفّ رأس واحد flex، والترتيب: الشعار → الحقل → التنقّل، والحقل داخل <header>
 *   - نموذج بحث واحد · role="search" واحد · id بحث واحد · لا أثر للبنى القديمة
 *   - ارتفاعات 78/60/42px · flex: 1 1 auto + min-width: 0
 *   - --header-offset (110px/74px) يقود scroll-padding وscroll-margin
 *   - .glass-nav مخفي ≥640px · حشوة body السفلية <640px فقط وبلا قاعدة غير مشروطة
 *   - translateY(-110%) + pointer-events:none داخل ≤1023 فقط
 *   - الرابطان العلويان (المكتبة/المجموعات) + زر الرفع + زر الحساب كلها في الرأس
 * ثم يطبع ملخّصًا رقميًا للعرض/الارتفاعات مشتقًّا من CSS المُخدَّم ومقاييس الخطوط
 * (Lalezar وIBM Plex Sans Arabic) — ليس قياس متصفّح.
 */
'use strict';
const assert = require('node:assert/strict');

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const checks = [];
const ok = (name) => {
  checks.push({ name, pass: true });
  console.log(`  ✓ ${String(checks.length).padStart(2)} ${name}`);
};

/** يستخرج محتوى كتلة متوازنة الأقواس تبدأ عند أول «{» بعد الفهرس. */
function extractBlock(css, fromIndex) {
  const open = css.indexOf('{', fromIndex);
  assert.ok(open !== -1, 'كتلة مفقودة');
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('أقواس غير متوازنة');
}

/** يرجع [{start, end, body}] لكل كتل @media المطابقة marker في css (بالترتيب). */
function mediaBlocks(css, marker) {
  const blocks = [];
  let at = -1;
  while ((at = css.indexOf(marker, at + 1)) !== -1) {
    const open = css.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth === 0) {
          blocks.push({ start: at, end: i, body: css.slice(open + 1, i) });
          at = i;
          break;
        }
      }
    }
  }
  return blocks;
}
/** كتلة @media التي تحتوي needle (نختار من كل الملفات، لا أول تطابق أعمى). */
function mediaBlockWith(css, marker, needle) {
  const found = mediaBlocks(css, marker).find((block) => block.body.includes(needle));
  assert.ok(found, `لا كتلة ${marker} تحتوي «${needle}»`);
  return found;
}

/** يرجع نصوص كل القواعد التي selector جزءٌ من قائمة محدّداتها (قد تتكرر عبر ملفات المصدر). */
function ruleBodies(css, selector) {
  const bodies = [];
  let at = -1;
  while ((at = css.indexOf(selector, at + 1)) !== -1) bodies.push(extractBlock(css, at));
  assert.ok(bodies.length > 0, `المحدّد مفقود: ${selector}`);
  return bodies;
}
/** أول قاعدة تحمل selector وتحتوي needle — للتعامل مع تكرار المحدّد بين الملفات. */
function ruleBody(css, selector, needle) {
  const bodies = ruleBodies(css, selector);
  if (needle === undefined) return bodies[0];
  const found = bodies.find((body) => body.includes(needle));
  assert.ok(found, `لا قاعدة ${selector} تحتوي «${needle}»`);
  return found;
}

(async () => {
  console.log(`\nHEADER SINGLE ROW — تحقّق حيّ من ${base}\n`);

  // ── 1) جلب ‎/library وHTML المُخدَّم ─────────────────────────────
  const page = await fetch(`${base}/library`, {
    signal: AbortSignal.timeout(45000),
    redirect: 'follow',
  });
  assert.equal(page.status, 200, `‎/library أجابت ${page.status}`);
  ok('‎/library تُجيب 200');
  const html = await page.text();
  const headerRegion = html.match(/<header[\s\S]*?<\/header>/)?.[0];
  assert.ok(headerRegion, 'لا <header> في HTML المُخدَّم');
  const head = headerRegion;

  // ── 2) بنية الرأس: صفّ واحد والترتيب شعار ← حقل ← تنقّل ──────────
  const rowCount = (head.match(/header-row/g) || []).length;
  assert.equal(rowCount, 1, `عدد header-row في الرأس = ${rowCount}`);
  ok('صفّ رأس واحد فقط (.header-row × 1)');

  const iBrand = head.indexOf('class="brand"');
  const iForm = head.indexOf('class="library-search"');
  const iNav = head.indexOf('desktop-nav');
  const iActions = head.indexOf('class="header-actions"');
  assert.ok(iBrand !== -1 && iForm !== -1 && iNav !== -1, 'عنصر مفقود من الصفّ');
  assert.ok(iBrand < iForm && iForm < iNav && iNav < iActions, 'الترتيب مكسور');
  ok('الترتيب: الشعار ← حقل البحث ← التنقّل ← الأدوات (صفّ flex واحد)');

  const iInput = head.indexOf('id="library-search"');
  assert.ok(iInput !== -1, 'الحقل ليس داخل <header>');
  ok('الحقل #library-search داخل <header> نفسها (لا صفّ بحث منفصل)');

  const forms = (head.match(/<form[\s>]/g) || []).length;
  const roles = (head.match(/role="search"/g) || []).length;
  const ids = (html.match(/id="library-search"/g) || []).length;
  assert.equal(forms, 1, `عدد <form> في الرأس = ${forms}`);
  assert.equal(roles, 1, `عدد role="search" = ${roles}`);
  assert.equal(ids, 1, `عدد id="library-search" في الصفحة = ${ids}`);
  ok('نموذج واحد · role="search" واحد · id بحث واحد في الصفحة كلها');

  for (const gone of ['desktop-library-search', 'mobile-library-search', 'header-search-row'])
    assert.ok(!html.includes(gone), `ما زال «${gone}» في HTML`);
  ok('لا أثر للبنى القديمة: desktop-library-search · mobile-library-search · header-search-row');

  for (const href of ['/library', '/collections'])
    assert.ok(head.includes(`href="${href}"`), `الرابط ${href} مفقود من الرأس`);
  assert.ok(!head.includes('href="/saved"'), 'رابط المحفوظات ما زال ضالًّا في الرأس');
  ok('الرابطان العلويان (المكتبة/المجموعات) في الرأس بلا «المحفوظات»');

  assert.ok(head.includes('desktop-quick-action') && head.includes('href="/contribute"'));
  assert.ok(head.includes('account-avatar'));
  ok('زر الرفع ＋ (desktop-quick-action) وزر الحساب (account-avatar) في الرأس');

  const placeholders = (head.match(/ابحث عن رياكشن أو موقف\.\.\./g) || []).length;
  assert.equal(placeholders, 1, `placeholder يتكرر ${placeholders} مرّة`);
  ok('placeholder واحد في حقل واحد');

  assert.ok(head.includes('type="search"') && head.includes('name="q"'));
  ok('الحقل type="search" باسم q');

  // ── 3) جلب CSS المُخدَّم كاملًا ─────────────────────────────────
  const hrefs = [
    ...html.matchAll(
      /<link[^>]+href="([^"]+)"[^>]*rel="stylesheet"|<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g,
    ),
  ].map((m) => m[1] || m[2]);
  assert.ok(hrefs.length > 0, 'لا <link rel="stylesheet"> مُخدَّم');
  const parts = [];
  for (const href of [...new Set(hrefs)]) {
    const res = await fetch(href.startsWith('http') ? href : `${base}${href}`, {
      signal: AbortSignal.timeout(45000),
    });
    assert.equal(res.status, 200, `CSS ${href} أجاب ${res.status}`);
    parts.push(await res.text());
  }
  const css = parts.join('\n').replace(/\s+/g, ' ');
  ok(`CSS مُخدَّم من ${new Set(hrefs).size} رابط (نُظِّف وتُطبيع)`);

  // ── 4) صفّ الرأس: flex لا grid، والارتفاعات ──────────────────────
  const rowBodies = ruleBodies(css, '.site-header .header-row');
  const baseRow = rowBodies.find((body) => body.includes('display: flex'));
  assert.ok(baseRow, 'الصفّ ليس flex');
  assert.ok(
    !rowBodies.some((body) => body.includes('grid')),
    'بقايا grid في قواعد .site-header .header-row',
  );
  ok('.site-header .header-row: display:flex (لا grid)');

  assert.match(baseRow, /height: 78px/);
  assert.match(baseRow, /gap: clamp\(10px, 1\.4vw, 20px\)/);
  ok('ارتفاع الصفّ 78px حاسوبًا بفجوة clamp(10px,1.4vw,20px)');

  assert.match(ruleBody(css, '.site-header .brand {', 'flex: none'), /flex: none/);
  ok('الشعار flex:none (يمين، لا يتمدّد)');

  const actionsRule = ruleBody(css, '.site-header .header-actions');
  assert.match(actionsRule, /flex: none/);
  assert.match(actionsRule, /display: flex/);
  ok('.header-actions: flex:none + display:flex + محاذاة');

  const searchRule = ruleBody(css, '.library-search {', 'flex: 1 1 auto');
  assert.match(searchRule, /flex: 1 1 auto/);
  assert.match(searchRule, /min-width: 0/);
  assert.match(searchRule, /max-width: 560px/);
  assert.match(searchRule, /height: 44px/);
  ok('.library-search: flex:1 1 auto + min-width:0 + 44px (بحدّ 560px)');

  const inputRule = ruleBody(css, '.library-search input {', 'flex: 1 1 auto');
  assert.match(inputRule, /flex: 1 1 auto/);
  assert.match(inputRule, /min-width: 0/);
  assert.match(inputRule, /font-size: 13px/);
  ok('.library-search input: flex:1 1 auto + min-width:0 + 13px');

  assert.match(css, /\.library-search:focus-within/);
  ok('حلقة التركيز focus-within قائمة');

  // ── 5) كتلة ≤1023: 60px · 74px · 42px · الإخفاء بالتمرير ────────
  const m1023Block = mediaBlockWith(css, '@media (max-width: 1023px)', '--header-offset: 74px');
  const m1023 = m1023Block.body;
  assert.match(ruleBody(m1023, '.site-header .header-row', 'height: 60px'), /height: 60px/);
  assert.match(ruleBody(m1023, ':root', '74px'), /--header-offset: 74px/);
  assert.match(ruleBody(m1023, '.library-search {', '42px'), /height: 42px/);
  assert.match(ruleBody(m1023, '.library-search {', '42px'), /max-width: none/);
  ok('داخل ≤1023: صفّ 60px · --header-offset:74px · حقل 42px بلا سقف عرض');

  assert.match(ruleBody(m1023, '.site-header .header-actions', 'display: none'), /display: none/);
  assert.match(ruleBody(m1023, '.site-header .header-account', 'display: none'), /display: none/);
  ok('داخل ≤1023 (افتراضي الجوال): التنقّل والأدوات والحساب مخفاة في الرأس');

  const hidden = ruleBody(m1023, '.site-header.header-hidden');
  assert.match(hidden, /transform: translateY\(-110%\)/);
  assert.match(hidden, /pointer-events: none/);
  ok('الإخفاء بالتمرير: translateY(-110%) + pointer-events:none');

  assert.match(ruleBody(m1023, '.site-header {', 'transition'), /transition: transform 250ms/);
  ok('انتقال الرأس transition: transform 250ms دائر على ≤1023');

  const hiddenCount = (css.match(/translateY\(-110%\)/g) || []).length;
  assert.equal(hiddenCount, 1, `translateY(-110%) تكرّر ${hiddenCount} مرّة`);
  assert.ok(m1023.includes('translateY(-110%)'), 'القيمة الوحيدة ليست داخل ≤1023');
  ok('translateY(-110%) موجود داخل ≤1023 فقط (لا إخفاء على الحاسوب)');

  // ── 6) نطاقات 640–1023 و768–1023 ────────────────────────────────
  const m640 = mediaBlockWith(
    css,
    '@media (min-width: 640px) and (max-width: 1023px)',
    '.desktop-nav',
  ).body;
  const midNav = ruleBody(m640, '.site-header .desktop-nav {', 'display: flex');
  assert.match(midNav, /display: flex/);
  assert.match(midNav, /gap: 14px/);
  assert.match(ruleBody(m640, '.site-header .header-actions', 'display: flex'), /display: flex/);
  assert.match(ruleBody(m640, '.site-header .header-account', 'display: block'), /display: block/);
  assert.match(ruleBody(m640, '.library-search {', '44px'), /height: 44px/);
  ok('640–1023: التنقّل (flex,14px) والأدوات والحساب تعود للرأس، والحقل 44px');

  const m768 = mediaBlockWith(
    css,
    '@media (min-width: 768px) and (max-width: 1023px)',
    '.desktop-quick-action',
  ).body;
  assert.match(ruleBody(m768, '.desktop-quick-action', 'display: grid'), /display: grid/);
  ok('768–1023: زر الرفع ＋ يعود (display:grid)');

  // ── 7) --header-offset يقود الإزاحات ────────────────────────────
  assert.match(ruleBody(css, ':root {', '--header-offset: 110px'), /--header-offset: 110px/);
  ok(':root يعرّف --header-offset: 110px (حاسوب)');

  assert.match(css, /scroll-padding-top: var\(--header-offset\)/);
  const margins = (css.match(/scroll-margin-top: var\(--header-offset\)/g) || []).length;
  assert.equal(margins, 2, `scroll-margin-top بالمتغيّر: ${margins} موضع`);
  ok('scroll-padding-top + scroll-margin-top (موضعان) كلها تتبع --header-offset');

  assert.doesNotMatch(css, /scroll-(?:padding|margin)-top: 110px/);
  assert.doesNotMatch(css, /\.header-row \{\s*height: 86px/);
  assert.doesNotMatch(css, /\.header-row \{\s*height: 72px/);
  ok('لا قواعد مثبّتة قديمة: scroll-*-top:110px ولا header-row 86/72px');

  // ── 8) الكبسولة: مخفية ≥640، الحشوة <640 فقط ────────────────────
  const mMin640 = mediaBlockWith(css, '@media (min-width: 640px)', '.glass-nav').body;
  assert.match(ruleBody(mMin640, '.glass-nav', 'display'), /display: none/);
  ok('.glass-nav: display:none من 640px فصاعدًا');

  const m639Block = mediaBlockWith(css, '@media (max-width: 639px)', 'body:has(> .glass-nav)');
  assert.match(m639Block.body, /padding-bottom: calc\(var\(--gnav-h\) \+ 42px/);
  // كل ورود body:has(> .glass-nav) يجب أن تقع داخل هذه الكتلة تحديدًا
  const paddingAt = [];
  let scanAt = -1;
  while ((scanAt = css.indexOf('body:has(> .glass-nav)', scanAt + 1)) !== -1)
    paddingAt.push(scanAt);
  assert.ok(paddingAt.length >= 1, 'قاعدة الحشوة مفقودة');
  for (const at of paddingAt)
    assert.ok(at > m639Block.start && at < m639Block.end, `قاعدة غير مشروطة عند ${at}`);
  ok('حشوة body السفلية (var(--gnav-h)+42px) محصورة في <640px — بلا قاعدة غير مشروطة');

  assert.match(css, /\.glass-nav \{ position: fixed/);
  assert.match(css, /--gnav-h: clamp\(74px, 8\.5vw, 96px\)/);
  ok('كبسولة الجوال نفسها لم تُمَسّ (fixed · --gnav-h كما هي)');

  // ── 9) سلّم ≤374 وكتب الحركة في نهاية navigation.css ────────────
  const m374 = mediaBlockWith(css, '@media (max-width: 374px)', '.library-search button').body;
  assert.match(ruleBody(m374, '.site-header .brand > svg', '30px'), /width: 30px/);
  assert.match(ruleBody(m374, '.site-header .brand b', '20px'), /font-size: 20px/);
  assert.match(ruleBody(m374, '.site-header .brand small', 'display: none'), /display: none/);
  assert.match(ruleBody(m374, '.library-search button', '30px'), /width: 30px/);
  ok('سلّم ≤374px كامل (شعار 30px/20px · حقل مضغوط) — لا تجاوز أفقي على 320px');

  // كتلتا الحركة يجب أن تكونا مُخدّمتين فعلًا، وأن تبقيا أخيرتين في ملف المصدر (مضادّ لقصّ الذيل)
  const motionBlocks = mediaBlocks(css, '@media (prefers-reduced-motion: reduce)');
  const headerMotion = motionBlocks.find((block) =>
    block.body.includes('.site-header.header-hidden'),
  );
  assert.ok(headerMotion, 'كتلة prefers-reduced-motion الخاصة بالرأس غير مُخدَّمة');
  assert.match(headerMotion.body, /transform: none/);
  assert.ok(
    css.includes(":root[data-motion='reduce'] .site-header.header-hidden"),
    "كتلة data-motion='reduce' الخاصة بالرأس غير مُخدَّمة",
  );
  const navSource = require('node:fs').readFileSync('src/app/navigation.css', 'utf8');
  const iM374 = navSource.lastIndexOf('@media (max-width: 374px)');
  const iMotion = navSource.lastIndexOf('@media (prefers-reduced-motion: reduce)');
  const iReduce = navSource.lastIndexOf(":root[data-motion='reduce']");
  assert.ok(iM374 !== -1 && iMotion !== -1 && iReduce !== -1, 'كتلة مفقودة من navigation.css');
  assert.ok(iM374 < iMotion && iMotion < iReduce, 'ترتيب نهاية الملف اختلّ');
  const sourceTail = navSource.slice(iMotion);
  assert.ok(
    !sourceTail.includes('@media (max-width') && !sourceTail.includes('@media (min-width'),
    'كتلة عرضية جاءت بعد كتلتي الحركة — ذيل navigation.css مقصوص',
  );
  ok(
    'ذيل navigation.css سليم: كتبتا الحركة (prefers-reduced-motion · data-motion) أخيرتان ومُخدَّمتان',
  );

  // ── ملخّص ────────────────────────────────────────────────────────
  console.log(`\n✅ ${checks.length}/${checks.length} — كل فحوص صفّ الرأس الواحد ناجحة`);
  console.log('\nملاحظة الأرقام: أبعاد العرض/الحقول عند نقاط الكسر مشتقّة من CSS المُخدَّم هنا');
  console.log('ومن مقاييس خطّي Lalezar وIBM Plex Sans Arabic — وهي ليست قياس متصفّح.\n');
})().catch((error) => {
  console.error(`\n❌ فشل التحقّق بعد ${checks.length} فحص ناجح:`);
  console.error(error.message || error);
  process.exit(1);
});
