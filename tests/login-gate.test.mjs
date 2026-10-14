import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { exports },
  );
  return exports;
}

const gate = transpile('src/lib/gate.ts');
const { decideGate, safeNext, SESSION_COOKIE, GUEST_COOKIE } = gate;
// decideGate تعمل داخل عالم vm؛ نقارن الحقول لا هوية الكائن الأجنبي
const expectGated = (decision, next) => {
  assert.equal(decision.gate, true);
  assert.equal(decision.next, next);
};
const expectOpen = (decision, label = '') => assert.equal(decision.gate, false, label);

test('Gate cookies have stable names (session is validated, guest is a plain flag)', () => {
  assert.equal(SESSION_COOKIE, 'yr_session');
  assert.equal(GUEST_COOKIE, 'yr_guest');
});

test('safeNext keeps internal paths and rejects external, protocol-relative and loop targets', () => {
  assert.equal(safeNext(undefined), '/library');
  assert.equal(safeNext(null), '/library');
  assert.equal(safeNext(''), '/library');
  assert.equal(safeNext('/library'), '/library');
  assert.equal(safeNext('/saved'), '/saved');
  assert.equal(safeNext('/collections/abc?tab=clips'), '/collections/abc?tab=clips');
  for (const rejected of [
    'https://evil.test/steal',
    '//evil.test/steal',
    '/\\evil',
    '/x\nheader: inject',
    '/x\rheader: inject',
    'javascript:alert(1)',
    '/login',
    '/login?next=/library',
    '/',
    'library',
  ])
    assert.equal(safeNext(rejected), '/library', `rejected: ${JSON.stringify(rejected)}`);
  assert.equal(safeNext(undefined, '/saved'), '/saved');
});

test('Cookie-less browser requests to content pages are gated to /login with their target', () => {
  for (const [pathname, search, next] of [
    ['/library', '', '/library'],
    ['/library', '?q=أهل', '/library?q=أهل'],
    ['/collections/abc-def', '', '/collections/abc-def'],
    ['/saved', '?tab=clips', '/saved?tab=clips'],
    ['/r/xyz', '', '/r/xyz'],
  ])
    expectGated(
      decideGate({ pathname, search, accept: 'text/html', userAgent: 'Mozilla/5.0' }),
      next,
    );
});

test('The gateway never traps: root, open paths, APIs, assets, signed-in, guests, crawlers, prefetch', () => {
  const html = 'text/html,application/xhtml+xml';
  // الجذر تصفحته تحكم الجلسة بنفسها
  expectOpen(decideGate({ pathname: '/', accept: html, userAgent: 'Mozilla/5.0' }), 'root');
  expectOpen(
    decideGate({ pathname: '/', search: '?q=خبر', accept: html, userAgent: 'Mozilla/5.0' }),
    'root?q',
  );
  // مسارات مفتوحة
  for (const pathname of ['/login', '/help', '/privacy', '/offline'])
    expectOpen(decideGate({ pathname, accept: html, userAgent: 'Mozilla/5.0' }), pathname);
  // واجهات وملفات وأصول
  expectOpen(decideGate({ pathname: '/api/auth/session', accept: html }), 'api');
  expectOpen(decideGate({ pathname: '/_next/static/chunk.js', accept: html }), '_next');
  expectOpen(decideGate({ pathname: '/media/x.webp', accept: html }), 'webp');
  expectOpen(decideGate({ pathname: '/manifest.webmanifest', accept: html }), 'webmanifest');
  // طرق غير GET/HEAD
  expectOpen(decideGate({ pathname: '/library', method: 'POST', accept: html }), 'POST');
  // مسجَّل أو اختار الزيارة
  expectOpen(
    decideGate({ pathname: '/library', hasSession: true, accept: html, userAgent: 'Mozilla/5.0' }),
    'session',
  );
  expectOpen(
    decideGate({ pathname: '/library', hasGuest: true, accept: html, userAgent: 'Mozilla/5.0' }),
    'guest',
  );
  // زواحف ومعاينات لا تُحبس خلف البوّابة
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
    'facebookexternalhit/1.1',
    'WhatsApp/2.23',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0',
    'Twitterbot/1.0',
    'Discordbot/2.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126',
    'curl/8.0',
  ])
    expectOpen(decideGate({ pathname: '/library', accept: html, userAgent: ua }), ua);
  // جلب مسبق لا يُجاب بريدايركت حتى لا تُخزّن المتصفحات الإحالة
  expectOpen(
    decideGate({ pathname: '/library', isPrefetch: true, accept: html, userAgent: 'Mozilla/5.0' }),
    'prefetch',
  );
  // طلبات بلا Accept: HTML ليست تنقّلًا بشريًا
  expectOpen(decideGate({ pathname: '/library', accept: '*/*', userAgent: 'SomeApp/1.0' }), '*/*');
  // طلبات RSC التابعة لتنقّل داخلي تُدار مثل التنقّل
  expectGated(
    decideGate({
      pathname: '/library',
      isRsc: true,
      accept: 'text/x-component',
      userAgent: 'Mozilla/5.0',
    }),
    '/library',
  );
});

test('Middleware gates every request through decideGate and answers with a temporary redirect', () => {
  const middleware = fs.readFileSync('src/middleware.ts', 'utf8');
  assert.match(middleware, /decideGate\(/);
  // NextResponse.redirect بلا status صريح = 307 مؤقتة (لا تُخزَّن كإحالة دائمة)
  assert.match(middleware, /NextResponse\.redirect\(url\)/);
  assert.doesNotMatch(middleware, /status:\s*(301|302|308)\b/);
  assert.match(middleware, /url\.pathname = '\/login'/);
  assert.match(middleware, /searchParams\.set\('next', decision\.next\)/);
  // الحارس يسأل عن هوية الجلسة وكوكي الزائر بدل كشف أسرارهما
  assert.match(middleware, /SESSION_COOKIE/);
  assert.match(middleware, /GUEST_COOKIE/);
  // matcher يستثني الأصول الثابتة وواجهات API حتى لا تمرّ عبر المصير العربي
  assert.match(middleware, /_next\/static/);
  assert.match(middleware, /manifest\.webmanifest/);
  // كشف RSC والجلب المسبق عبر ما يصل فعلًا إلى Middleware بعد معالجة طبقة Next
  assert.match(middleware, /_rsc/);
  assert.match(middleware, /purpose'\) === 'prefetch'|sec-purpose/);
});
