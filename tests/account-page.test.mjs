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

/* عناصر غير متتالية وبترتيب مختلف — عدّاد المحفوظات المرئي يجب أن يطابق ما تُظهره آلية المزامنة فعلًا */
const REACTIONS = [
  {
    code: 'YR-0007',
    caption: 'ضحكة فِرح',
    situation: 'زفة أهل',
    category: 'فرح',
    duration: 4,
    keywords: [],
    publishedAt: '2026-01-02T00:00:00.000Z',
    corner: 'tr',
    gradient: '',
    poster: '/media/p1.webp',
    media: '/media/m1.mp4',
    isDemo: false,
  },
  {
    code: 'YR-0012',
    caption: 'تعجُّب مسرحي',
    situation: 'عين على الطبق',
    category: 'دهشة',
    duration: 3,
    keywords: [],
    publishedAt: '2026-02-13T00:00:00.000Z',
    corner: 'tl',
    gradient: '',
    poster: '/media/p2.webp',
    media: '/media/m2.mp4',
    isDemo: false,
  },
  {
    code: 'YR-0020',
    caption: 'همهمة رضا',
    situation: '',
    category: 'حب',
    duration: null,
    keywords: [],
    publishedAt: '2026-01-09T00:00:00.000Z',
    corner: 'tr',
    gradient: '',
    poster: '/media/p3.webp',
    media: '/media/m3.webp',
    isDemo: false,
  },
];
const RECORDS = [
  {
    id: 'YR-2026-1',
    title: 'ردّة فعل أولى',
    character: '',
    secondary: '',
    status: 'pending',
    createdAt: '٢٠٢٦/٠٤/٢٦',
    kind: 'video',
  },
  {
    id: 'YR-2026-2',
    title: 'صورة معلّقة',
    character: '',
    secondary: '',
    status: 'approved',
    createdAt: '٢٠٢٦/٠٤/٢٠',
    kind: 'image',
  },
  {
    id: 'YR-2026-3',
    title: 'مقطع مرفوض',
    character: '',
    secondary: '',
    status: 'rejected',
    createdAt: '٢٠٢٦/٠٣/١١',
    kind: 'image',
  },
];
const MEMBER = { id: 'u_member', role: 'member', name: 'عضو المكتبة', email: 'member@site.test' };

function renderSurface({
  user = null,
  saved = [],
  records = [],
  mockSignedIn = false,
  google = false,
  demoStates = {},
} = {}) {
  let index = 0;
  // استدعاءات useState داخل AccountSurface بالترتيب: المبدّل (0)، وضع التحرير (1)،
  // الاسم (2)، حفظ جارٍ (3)، خطأ (4) — نزرع التجريبي على فهرسه فقط.
  const seeded = {};
  if (demoStates.tab !== undefined) seeded[0] = demoStates.tab;
  if (demoStates.editing !== undefined) seeded[1] = demoStates.editing;
  const overrides = {
    react: {
      ...React,
      useState: (initial) => {
        const at = index++;
        return React.useState(at in seeded ? seeded[at] : initial);
      },
    },
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    './AppProvider': {
      useApp: () => ({
        user,
        authReady: true,
        reactions: REACTIONS,
        saved,
        reduced: false,
        syncUser: async () => {},
        setSettings: () => {},
        setPreview: () => {},
        toast: () => {},
      }),
    },
    './ContributionProvider': {
      useContribution: () => ({ mockSignedIn, records, endMockSession: () => {} }),
    },
    './SocialIcon': { SocialIcon: () => null },
    '@/lib/saved': load('src/lib/saved.ts', {}),
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const { AccountSurface } = load('src/components/AccountSurface.tsx', overrides);
  return renderToStaticMarkup(
    React.createElement(AccountSurface, {
      googleAuthOrigin: google ? 'https://accounts.auth' : '',
      readyProviders: google ? ['google'] : [],
      onNavigate: () => {},
    }),
  );
}

test('Guest sees welcome, sign-in, direct actions and his local saves — with zero counters', () => {
  const html = renderSurface({ saved: ['YR-0012', 'YR-0007'], google: true });
  assert.match(html, /أنت زائر/);
  assert.match(html, /href="https:\/\/accounts\.auth\/api\/auth\/oauth\/google"/);
  assert.match(html, /class="btn btn-dark" href="\/contribute"[^>]*>.*إرسال رياكشن/);
  assert.match(html, /الإعدادات/);
  assert.match(html, /المحفوظات/);
  assert.match(html, /مساهماتي/);
  assert.match(html, /ضحكة فِرح/);
  assert.match(html, /تعجُّب مسرحي/);
  assert.doesNotMatch(html, /account-summary/);
  assert.doesNotMatch(html, /تحرير الهوية/);
  assert.doesNotMatch(html, /ما عندك مساهمات/);
  assert.doesNotMatch(html, /ردّة فعل أولى|account-status/);
});

test('Guest with an empty local save list gets a clear state ending in a browse-library action', () => {
  const html = renderSurface({ saved: [] });
  assert.match(html, /محفوظات محلية|لا محفوظات/);
  assert.match(html, /href="\/library"[^>]*>.*تصفح المكتبة/);
  assert.doesNotMatch(html, /ما عندك مساهمات حتى الآن/);
});

test('Guest cannot be shown contribution records; مساهماتي explains the login requirement clearly', () => {
  const html = renderSurface({ records: RECORDS, demoStates: { tab: 'contributions' } });
  assert.match(html, /إرسال المساهمات ومتابعتها يتطلب تسجيل الدخول/);
  assert.match(html, /قيد التجهيز|تسجيل الدخول بـ Google/);
  assert.doesNotMatch(html, /ما عندك مساهمات حتى الآن/);
  assert.doesNotMatch(html, /ردّة فعل أولى|صورة معلّقة|مقطع مرفوض/);
  assert.doesNotMatch(html, /account-status/);
});

test('Owner summary is ONE truthful card — saved only; the contributions number is hidden until a trusted published source exists', () => {
  const html = renderSurface({ user: MEMBER, saved: ['YR-0012', 'YR-0007'], records: RECORDS });
  assert.match(
    html,
    /"account-summary-card"[^>]*data-active="true"[^>]*><b>2<\/b><span>المحفوظات<\/span>/,
  );
  // بطاقة واحدة في الملخّص: لا بطاقة فارغة ولا إجمالي سجلات يدّعي «منشورًا»
  assert.equal((html.match(/class="account-summary-card"/g) || []).length, 1);
  const summary = html.slice(
    html.indexOf('class="account-summary"'),
    html.indexOf('account-actions-row'),
  );
  assert.doesNotMatch(summary, /مساهماتي/);
  assert.doesNotMatch(summary, /<b>3<\/b>|<b>0<\/b>/);
  assert.doesNotMatch(html, /المساهمات المنشورة/);
  // الحارس المصدري: لا يمكن أن تعود بطاقة رقمية للمساهمات عبر إجمالي السجلات
  const source = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.doesNotMatch(source, /<b>\{contribution\.records\.length\}<\/b>/);
});

test('Owner identity shows avatar initial and name with an inline edit entry — no Google email anywhere', () => {
  const html = renderSurface({ user: MEMBER });
  assert.match(html, /class="account-profile-avatar"[^>]*>ع</);
  assert.match(html, /<strong>عضو المكتبة<\/strong>/);
  assert.match(html, /تحرير الهوية/);
  assert.doesNotMatch(html, /member@site\.test/);
  assert.doesNotMatch(html, /account-profile-email/);
});

test('Owner contributions tab lists each item with its visible status chip', () => {
  const html = renderSurface({
    user: MEMBER,
    records: RECORDS,
    demoStates: { tab: 'contributions' },
  });
  assert.match(html, /ردّة فعل أولى[\s\S]*?id="account-tab-panel"|ردّة فعل أولى/);
  for (const row of [
    /ردّة فعل أولى[\s\S]*account-status account-status-pending">قيد المراجعة/,
    /صورة معلّقة[\s\S]*account-status account-status-approved">مقبولة/,
    /مقطع مرفوض[\s\S]*account-status account-status-rejected">مرفوضة/,
  ])
    assert.match(html, row);
  assert.match(html, /href="\/account\/submissions"/);
});

test('Owner with no contributions gets the mandated copy followed by the publish action', () => {
  const html = renderSurface({ user: MEMBER, records: [], demoStates: { tab: 'contributions' } });
  assert.match(html, /ما عندك مساهمات حتى الآن/);
  assert.match(html, /ساهم بأول رياكشن في إثراء المكتبة اليمنية\./);
  assert.match(html, /href="\/contribute"[^>]*>.*إرسال رياكشن/);
});

test('Owner empty saves state explains the habit and ends with the library link', () => {
  const html = renderSurface({ user: MEMBER, saved: [] });
  assert.match(html, /لا محفوظات بعد\./);
  assert.match(html, /href="\/library"[^>]*>.*تصفح المكتبة/);
});

test('Identity editing is an inline form with save and cancel — never a dialog', () => {
  const html = renderSurface({ user: MEMBER, demoStates: { editing: true } });
  assert.match(html, /<form class="account-identity /);
  assert.match(html, /<input[^>]*maxlength="40"/i);
  assert.match(html, /حفظ التغييرات/);
  assert.match(html, /إلغاء/);
  assert.match(html, /لا يُزامَن مع اسم حساب خدمة الدخول/);
  assert.doesNotMatch(html, /role="dialog"|<dialog/);
});

test('Saving the display name PATCHes the session endpoint then resyncs the user and closes the form', () => {
  const source = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.match(source, /method:\s*'PATCH'/);
  assert.match(source, /fetch\('\/api\/auth'/);
  assert.match(source, /body:\s*JSON\.stringify\(\{\s*name:\s*cleaned\s*\}\)/);
  assert.match(source, /await app\.syncUser\(\)/);
  assert.match(source, /app\.toast\('تم حفظ اسم العرض\.'\)/);
  assert.match(source, /setEditing\(false\)/);
  assert.match(source, /min length|cleaned\.length < 2/);
});

test('Trial session is NOT an account owner: zero counters, zero records, a login explainer under مساهماتي', () => {
  const html = renderSurface({ mockSignedIn: true, records: [RECORDS[0]], saved: ['YR-0007'] });
  // بلا ملخّص ولا عدّادات كأنها صاحبة حساب
  assert.doesNotMatch(html, /account-summary/);
  // وفي قسم مساهماتي حتى مع بيانات تجريبية قائمة: توضيح تسجيل الدخول، لا سجلات ولا حالات
  const contributions = renderSurface({
    mockSignedIn: true,
    records: [RECORDS[0]],
    demoStates: { tab: 'contributions' },
  });
  assert.match(contributions, /إرسال المساهمات ومتابعتها يتطلب تسجيل الدخول/);
  assert.doesNotMatch(contributions, /ردّة فعل أولى|account-status/);
  assert.doesNotMatch(contributions, /ما عندك مساهمات حتى الآن/);
  // جلسة التجربة تبقى بإنهائها المعتاد أسفل الصفحة، بلا أي «حساب»
  assert.match(html, /إنهاء جلسة التجربة/);
  assert.doesNotMatch(html, /تحرير الهوية|تسجيل الخروج|member@site\.test/);
  // محفوظاته المحلية — جهاز لا حساب — تبقى يظهرها مثل أي زائر
  assert.match(html, /ضحكة فِرح/);
  const source = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.match(source, /const owner = !!app\.user;/);
});

test('Header keeps the public top bar clean; the phone account button now routes to the full /account page', () => {
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  // الرأس العام نفسه بلا زرّي «إرسال رياكشن»/«الإعدادات» — وحصة إعدادات القائمة تبقى الصفحة
  assert.doesNotMatch(header, /إرسال رياكشن/);
  // لا ورقة حساب بعد الآن: لا مكوّن سطح داخل الرأس، ولا حالة ورقة أساسًا
  assert.doesNotMatch(header, /AccountSurface/);
  assert.doesNotMatch(header, /accountSheet/);
  // الشريط الزجاجي + أزرار الحساب على الهاتف (أقل من 1024px) يقودان للصفحة الكاملة
  assert.match(header, /router\.push\('\/account'\)/);
  assert.match(header, /matchMedia\('\(min-width: 1024px\)'\)/);
  assert.match(header, /aria-expanded=\{accountPopover\}/);
  // قائمة الحاسوب تُحفظ جزءًا من الرأس كما كانت
  assert.match(header, /<AccountActions/);
});

test('Settings destination in every UI entry point is the /settings page; publish destination stays /contribute', () => {
  const surface = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  assert.match(surface, /href="\/settings"/);
  assert.match(surface, /href="\/contribute"/);
  assert.doesNotMatch(surface, /setSettings|router\.push/s);
  assert.match(header, /<Link href="\/settings" onClick=\{dismiss\}>/);
  assert.doesNotMatch(header, /app\.setSettings\(true\)/);
  // صفحتا /account و/settings موجودتان فعلًا على نظام الملفات وتحملان العنوانين الصحيحين
  assert.ok(fs.existsSync('src/app/account/page.tsx'), 'صفحة /account غائبة');
  assert.ok(fs.existsSync('src/app/settings/page.tsx'), 'صفحة /settings غائبة');
  assert.match(fs.readFileSync('src/app/account/page.tsx', 'utf8'), /title: 'حسابك'/);
  assert.match(fs.readFileSync('src/app/settings/page.tsx', 'utf8'), /title: 'الإعدادات'/);
});

test('Account page renders its head and hands the surface the same server-decided Google props as the header did', () => {
  let seenProps = null;
  const page = load('src/app/account/page.tsx', {
    'next/navigation': {},
    '@/components/AccountSurface': {
      AccountSurface: (props) => {
        seenProps = props;
        return React.createElement('div', { 'data-stub': 'surface' }, props.googleAuthOrigin);
      },
    },
    '@/server/oauth-config': {
      oauthConfig: (provider) =>
        provider === 'google' ? { origin: 'https://identity.test' } : null,
    },
    '@/lib/social': { SOCIAL_PROVIDERS: ['google', 'github'] },
  });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /<h1 id="account-title">حسابك<\/h1>/);
  assert.match(html, /aria-labelledby="account-title"/);
  assert.match(html, /data-stub="surface">https:\/\/identity\.test/);
  assert.equal(seenProps.googleAuthOrigin, 'https://identity.test');
  assert.deepEqual(seenProps.readyProviders, ['google']);
});

test('Settings page renders its head and the shared panel as-is', () => {
  const page = load('src/app/settings/page.tsx', {
    '@/components/Settings': {
      SettingsPanel: () => React.createElement('div', { 'data-stub': 'panel' }),
    },
  });
  const html = renderToStaticMarkup(React.createElement(page.default));
  assert.match(html, /<h1 id="settings-title">الإعدادات<\/h1>/);
  assert.match(html, /aria-labelledby="settings-title"/);
  assert.match(html, /data-stub="panel"/);
});

test('SettingsPanel keeps all five sections working on the page; the legacy modal wrapper is untouched internally', () => {
  const overrides = {
    './AppProvider': {
      useApp: () => ({
        theme: 'system',
        setTheme: () => {},
        accent: '#c1592e',
        setAccent: () => {},
        reduced: false,
        setReduced: () => {},
        settings: true,
        setSettings: () => {},
        toast: () => {},
      }),
    },
    './ui/Modal': {
      Modal: ({ open, title, children }) =>
        open ? React.createElement('div', { role: 'dialog', 'aria-label': title }, children) : null,
    },
    'next/navigation': {},
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const mod = load('src/components/Settings.tsx', overrides, { window: undefined });
  // المحتوى نفسه حي في مستويي العرض: الصفحة (SettingsPanel) والنافذة المحفوظة (Settings)
  const panel = renderToStaticMarkup(React.createElement(mod.SettingsPanel));
  for (const section of [
    /المظهر/,
    /لونك المفضّل/,
    /تخفيف الحركة/,
    /المكتبة معك/,
    /استعادة الإعدادات/,
  ])
    assert.match(panel, section);
  const modal = renderToStaticMarkup(React.createElement(mod.Settings));
  assert.match(modal, /role="dialog" aria-label="على ذوقك"/);
  assert.match(modal, /المظهر/);
  assert.match(modal, /استعادة الإعدادات/);

  const source = fs.readFileSync('src/components/Settings.tsx', 'utf8');
  assert.match(source, /export function SettingsPanel\(\)/);
  assert.match(source, /<Modal open=\{app\.settings\}/);
  assert.match(source, /<SettingsPanel \/>/);
  // حالة app.settings بلا أي نداء تفعيل لها في الواجهة اليوم
  for (const file of ['src/components/Header.tsx', 'src/components/AccountSurface.tsx'])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /setSettings\(true\)/);
});

function authRouteWith({ user }) {
  const calls = { update: [], audit: [] };
  const route = load(
    'src/app/api/auth/route.ts',
    {
      'next/headers': {
        cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
      },
      '@/server/db': {
        db: {
          prepare: (sql) => ({
            run: (...args) => {
              if (sql.startsWith('UPDATE users')) calls.update.push(args);
              else calls.audit.push([sql, ...args]);
              return { changes: 1 };
            },
          }),
        },
      },
      '@/server/auth': {
        currentUser: async () => user,
        digest: () => 'x',
        sameOrigin: () => {},
        apiError: (error) =>
          Response.json({ error: String(error?.error || error) }, { status: error?.status || 500 }),
      },
    },
    { Response },
  );
  return { route, calls };
}
const patchReq = (name) =>
  new Request('https://site.test/api/auth', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', origin: 'https://site.test' },
    body: JSON.stringify({ name }),
  });

test('PATCH /api/auth rejects guests with 401 and never touches the database', async () => {
  const { route, calls } = authRouteWith({ user: null });
  const response = await route.PATCH(patchReq('اسم جديد'));
  assert.equal(response.status, 401);
  assert.equal(calls.update.length, 0);
  assert.equal(calls.audit.length, 0);
});

test('PATCH /api/auth validates the display name boundaries', async () => {
  const { route, calls } = authRouteWith({ user: MEMBER });
  for (const bad of ['ن', ' ', '', 'أ'.repeat(41), 'اسم\u0007بريء']) {
    const response = await route.PATCH(patchReq(bad));
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(calls.update.length, 0);
});

test('PATCH /api/auth trims, persists and echoes the cleaned name — locally in YemReact only', async () => {
  const { route, calls } = authRouteWith({ user: MEMBER });
  const response = await route.PATCH(patchReq('  حمدان   التواف  '));
  assert.equal(response.status, 200);
  assert.deepEqual(calls.update[0], ['حمدان التواف', MEMBER.id]);
  assert.equal(calls.audit.length, 1);
  const data = await response.json();
  assert.equal(data.user.name, 'حمدان التواف');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  // لا إنشاء ملف عام ولا مزامنة لاي خدمة خارجية — تحديث جلسة محلي فقط
  assert.doesNotMatch(fs.readFileSync('src/app/api/auth/route.ts', 'utf8'), /fetch\(|api\/oauth/);
});
