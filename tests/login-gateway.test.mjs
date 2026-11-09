import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file, overrides, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    {
      module,
      exports: module.exports,
      require: (name) => (name in overrides ? overrides[name] : require(name)),
      ...globals,
    },
  );
  return module.exports;
}
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

function renderAuth(
  props = {},
  { user = null, onGuestLink = () => {}, routerPushes = [], globals = {} } = {},
) {
  const { default: Auth } = load(
    'src/features/Auth.tsx',
    {
      'next/navigation': { useRouter: () => ({ push: (target) => routerPushes.push(target) }) },
      'next/link': {
        __esModule: true,
        default: ({ children, ...rest }) => {
          if (rest.className === 'social-guest-card') onGuestLink(rest);
          return React.createElement('a', rest, children);
        },
      },
      '@/components/AppProvider': { useApp: () => ({ user, logout: () => {}, toast: () => {} }) },
      '@/components/SocialIcon': { SocialIcon: () => null },
      '@/lib/gate': transpile('src/lib/gate.ts'),
      '@/lib/social': transpile('src/lib/social.ts'),
      'lucide-react': new Proxy({}, { get: () => () => null }),
    },
    globals,
  );
  return renderToStaticMarkup(React.createElement(Auth, props));
}

test('Keyless gateway: every provider is visibly pending, no dead OAuth link ships to the DOM', () => {
  const html = renderAuth({});
  assert.equal((html.match(/social-provider-pending/g) || []).length, 3);
  assert.equal((html.match(/aria-disabled="true"/g) || []).length, 3);
  assert.equal((html.match(/social-provider-badge/g) || []).length, 3);
  assert.match(html, /يُفتح بعد إضافة مفاتيح الخدمة/);
  assert.doesNotMatch(html, /api\/auth\/oauth\//);
  assert.match(html, /قيد التجهيز — ويمكنك الاستمرار كزائر الآن/);
});

test('Gateway with Google ready: one real entry and two pending, with the partial note', () => {
  const html = renderAuth({ authOrigin: 'https://oauth.test', readyProviders: ['google'] });
  assert.match(html, /href="https:\/\/oauth\.test\/api\/auth\/oauth\/google"/);
  assert.equal((html.match(/social-provider-pending/g) || []).length, 2);
  assert.match(html, /الدخول متاح عبر الخدمات المفعّلة أعلاه/);
  // عناصر غير الجاهزة ليست روابط حتى مع authOrigin
  assert.doesNotMatch(html, /oauth\/(apple|microsoft)/);
});

test('Guest card is the full path to a browsing session with the server-safe next target', () => {
  const html = renderAuth({ next: '/saved?tab=clips' });
  assert.match(
    html,
    /class="social-guest-card"[^>]*href="\/saved\?tab=clips"|href="\/saved\?tab=clips"[^>]*class="social-guest-card"/,
  );
  assert.match(html, /aria-label="الاستمرار كزائر بلا حساب"/);
  assert.match(html, /<b>الاستمرار كزائر<\/b>/);
  assert.match(html, /بلا حساب\. محفوظاتك تبقى على هذا الجهاز\./);
  const fallback = renderAuth({});
  assert.match(fallback, /href="\/library"/);
});

test('Guest choice follows an available provider and precedes providers still in preparation', () => {
  const html = renderAuth({ authOrigin: 'https://oauth.test', readyProviders: ['google'] });
  const availableIndex = html.indexOf('social-provider-google');
  const guestIndex = html.indexOf('social-guest-card');
  const pendingIndex = html.indexOf('social-pending-options');

  assert.ok(availableIndex >= 0 && availableIndex < guestIndex);
  assert.ok(guestIndex < pendingIndex);
  assert.match(html, /<summary>خيارات دخول أخرى قيد التجهيز<\/summary>/);
  assert.match(html, /بحسابك، محفوظاتك معك بين الأجهزة؛ كزائر، تبقى على هذا الجهاز\./);

  const noProvider = renderAuth({});
  assert.ok(
    noProvider.indexOf('social-guest-card') < noProvider.indexOf('social-provider-pending'),
  );
});

test('Guest click sets a session cookie and delegates the sole route transition to Link', () => {
  let guestLink;
  let cookie = '';
  const routerPushes = [];
  const html = renderAuth(
    { next: '/account' },
    {
      onGuestLink: (props) => (guestLink = props),
      routerPushes,
      globals: {
        window: { location: { protocol: 'https:' } },
        document: {
          set cookie(value) {
            cookie = value;
          },
        },
      },
    },
  );
  assert.match(
    html,
    /class="social-guest-card"[^>]*href="\/account"|href="\/account"[^>]*class="social-guest-card"/,
  );
  guestLink.onClick();
  assert.match(cookie, /^yr_guest=1; path=\/; SameSite=Lax; Secure$/);
  assert.deepEqual(routerPushes, [], 'custom handler must not start a second navigation');

  const source = fs.readFileSync('src/features/Auth.tsx', 'utf8');
  assert.match(source, /GUEST_COOKIE\}=1; path=\/; SameSite=Lax\$\{secure\}/);
  assert.match(source, /'https:' \? '; Secure' : ''/);
  // لا صلاحية زمنية على الكوكي: كوكي جلسة صرفة (ذكر الاسم في تعليق ليس تعيينًا)
  assert.doesNotMatch(source, /Max-Age\s*=|Expires\s*=/i);
  assert.doesNotMatch(source, /router\.push\(next\)/);
  // النسخة السابقة (رابط نصّي صغير) لم تعد موجودة — البطاقة بديلها
  assert.doesNotMatch(source, /className="social-guest"/);
  assert.doesNotMatch(source, /كمّل بدون حساب/);
});

test('Gateway HTML errors and identity tokens stay on-brand', () => {
  const html = renderAuth({ initialError: 'تعذّر إكمال الدخول.' });
  assert.match(html, /تعذّر إكمال الدخول\./);
  assert.match(html, /class="[^\"]*social-error/);
  const globals = fs.readFileSync('src/app/globals.css', 'utf8');
  for (const selector of [
    /\.social-provider\.social-provider-pending\b/,
    /\.social-provider-badge\b/,
    /\.social-pending-note\b/,
    /\.social-pending-options summary\b/,
    /\.social-guest-card\b/,
  ])
    assert.match(globals, selector);
  // البطاقات والشارات تستخدم رموز أنصاف الأقطار المركزية — لا ألوان دخيلة
  const guestBlock = globals.match(/\.social-guest-card \{[^}]+\}/s)[0];
  assert.match(guestBlock, /border-radius: var\(--radius-compact\);/);
  const badgeBlock = globals.match(/\.social-provider-badge \{[^}]+\}/s)[0];
  assert.match(badgeBlock, /border-radius: var\(--radius-pill\);/);
  const nav = fs.readFileSync('src/app/navigation.css', 'utf8');
  assert.match(nav, /\.account-google-pending\b/);
  assert.match(nav, /\.account-pending-chip\b/);
});
