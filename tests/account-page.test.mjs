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
  // بعد الدفعة 3 ذهب نموذج التحرير: تبقى useState وحيدة (المبدّل، فهرس 0) —
  // نزرع التجريبي على فهرسه فقط.
  const seeded = {};

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
    'next/navigation': {
      useRouter: () => ({ push: () => {} }),
      usePathname: () => '/account',
      useSearchParams: () => new URLSearchParams(demoStates.tab ? { tab: demoStates.tab } : {}),
    },
    './AppProvider': {
      useApp: () => ({
        user,
        authReady: true,
        authError: '',
        savedReady: true,
        savedError: '',
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
  overrides['./AccountEmptyArt'] = load('src/components/AccountEmptyArt.tsx', overrides);
  overrides['./AccountContributions'] = load('src/components/AccountContributions.tsx', overrides);
  const { AccountSurface } = load('src/components/AccountSurface.tsx', overrides);
  return renderToStaticMarkup(
    React.createElement(AccountSurface, {
      googleAuthOrigin: google ? 'https://accounts.auth' : '',
      readyProviders: google ? ['google'] : [],
      onNavigate: () => {},
    }),
  );
}

test('Guest sees verified local saves, source and login without duplicate page tools', () => {
  const html = renderSurface({ saved: ['YR-0012', 'YR-0007'], google: true });
  assert.match(html, /أنت زائر/);
  assert.match(html, /href="\/login"/);
  assert.match(html, /ضحكة فِرح/);
  assert.match(html, /تعجُّب مسرحي/);
  assert.match(html, /هذا الجهاز/);
  assert.doesNotMatch(html, /api\/auth\/oauth|account-summary|href="\/settings"/);
});
test('Guest account sign-in links open the login page with and without Google configured', () => {
  for (const google of [false, true]) {
    for (const tab of ['saved', 'contributions']) {
      const html = renderSurface({ google, demoStates: { tab } });
      const links = html.match(/<a[^>]*href="\/login"[^>]*>[\s\S]*?<\/a>/g) || [];
      assert.ok(links.length > 0, `login link for ${tab}, Google configured: ${google}`);
      for (const link of links) assert.match(link, /تسجيل الدخول/);
      assert.doesNotMatch(html, /api\/auth\/oauth|accounts\.auth|تسجيل الدخول بـ Google/);
    }
  }
});

test('Guest with an empty local save list gets a clear state ending in a browse-library action', () => {
  const html = renderSurface({ saved: [] });
  assert.match(html, /محفوظات محلية|لا محفوظات/);
  assert.match(html, /href="\/library"[^>]*>.*تصفح المكتبة/);
  assert.doesNotMatch(html, /ما عندك مساهمات حتى الآن/);
});

test('Guest contribution panel explains the local-only flow and never leaks mock records', () => {
  const html = renderSurface({ records: RECORDS, demoStates: { tab: 'contributions' } });
  assert.match(html, /التجربة المحلية/);
  assert.match(html, /href="\/contribute"/);
  assert.doesNotMatch(html, /ردّة فعل أولى|صورة معلّقة|مقطع مرفوض/);
});
test('Owner saved count appears in the Saved tab; the duplicate summary target is removed', () => {
  const html = renderSurface({ user: MEMBER, saved: ['YR-0012', 'YR-0007'], records: RECORDS });
  assert.match(
    html,
    /id="account-tab-saved"[\s\S]*?aria-selected="true"[\s\S]*?tabindex="0"[\s\S]*?المحفوظات<span class="account-tab-count"[^>]*>2<\/span>/,
  );
  assert.doesNotMatch(html, /account-summary/);
  assert.match(html, /id="account-tab-contributions"[\s\S]*?tabindex="-1"/);
  assert.equal((html.match(/class="account-tab-count"/g) || []).length, 1);
  assert.doesNotMatch(html, /المساهمات المنشورة/);
  // الحارس المصدري: لا يمكن أن تعود بطاقة رقمية للمساهمات عبر إجمالي السجلات
  const source = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.doesNotMatch(source, /<b>\{contribution\.records\.length\}<\/b>/);
  assert.match(source, /event\.key === 'Home'/);
  assert.match(source, /event\.key === 'End'/);
  assert.match(source, /params\.set\('tab', next\)/);
});

test('Account tools are moved to the header and are not duplicated in content', () => {
  const html = renderSurface();
  assert.doesNotMatch(html, /account-icon-action|href="\/settings"/);
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  assert.match(header, /account-header-tools/);
  assert.match(header, /aria-label="إرسال رياكشن"/);
  assert.match(header, /aria-label="الإعدادات"/);
  assert.match(header, /closeAccountSearch/);
});
test('Owner identity shows avatar initial and name — read-only since batch 3: no edit entry, no Google email anywhere', () => {
  const html = renderSurface({ user: MEMBER });
  assert.match(html, /class="account-profile-avatar"[^>]*>ع</);
  assert.match(html, /<strong>عضو المكتبة<\/strong>/);
  assert.doesNotMatch(html, /تحرير الهوية|اسم العرض|حفظ التغييرات|account-edit|<form/);
  assert.doesNotMatch(html, /member@site\.test/);
  assert.doesNotMatch(html, /account-profile-email/);
});

test('Owner is told real contributions are unavailable; existing mock route is retained', () => {
  const html = renderSurface({
    user: MEMBER,
    records: RECORDS,
    demoStates: { tab: 'contributions' },
  });
  assert.match(html, /الحقيقية غير متاحة/);
  assert.match(html, /href="\/account\/submissions"/);
  assert.doesNotMatch(html, /ردّة فعل أولى|صورة معلّقة|مقطع مرفوض|account-contribution-status/);
});
test('Missing contributions service is not misrepresented as an empty real account', () => {
  const html = renderSurface({ user: MEMBER, demoStates: { tab: 'contributions' } });
  assert.match(html, /تجربة محلية فقط/);
  assert.doesNotMatch(html, /ما عندك مساهمات حتى الآن/);
});
test('Owner empty saves state explains the habit and ends with the library link', () => {
  const html = renderSurface({ user: MEMBER, saved: [] });
  assert.match(html, /لا محفوظات في الحساب بعد\./);
  assert.match(html, /href="\/library"[^>]*>.*تصفح المكتبة/);
});

test('Identity editing is fully retired in batch 3: no form, no edit state, no PATCH call anywhere in the surface', () => {
  const source = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  assert.doesNotMatch(source, /تحرير الهوية|اسم العرض|حفظ التغييرات|account-identity-editing/);
  assert.doesNotMatch(source, /setEditing|saveName|cancelEdit/);
  assert.doesNotMatch(source, /method:\s*'PATCH'|fetch\('\/api\/auth'/);
  // لا بند إدخال اسم ولا ربط مزامنة عمره منطق الحفظ القديم
  assert.doesNotMatch(source, /app\.toast\('تم حفظ اسم العرض\.'\)/);
  const html = renderSurface({ user: MEMBER });
  assert.doesNotMatch(html, /<form|role="dialog"|<dialog|<input/);
});

test('Mock contribution login does not become a real account identity', () => {
  const html = renderSurface({ mockSignedIn: true, records: RECORDS, saved: ['YR-0007'] });
  assert.match(html, /أنت زائر/);
  assert.match(html, /ضحكة فِرح/);
  assert.doesNotMatch(html, /تسجيل الخروج|عضو المكتبة|account-summary/);
  const contributions = renderSurface({
    mockSignedIn: true,
    records: RECORDS,
    demoStates: { tab: 'contributions' },
  });
  assert.doesNotMatch(contributions, /ردّة فعل أولى|account-contribution-status/);
});
test('Header keeps the public top bar clean; avatar opens /account and the adjacent arrow owns the desktop popover', () => {
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  // الرأس العام نفسه بلا زرّي «إرسال رياكشن»/«الإعدادات» — وحصة إعدادات القائمة تبقى الصفحة
  assert.match(header, /accountPage \? \(/);
  // لا ورقة حساب بعد الآن: لا مكوّن سطح داخل الرأس، ولا حالة ورقة أساسًا
  assert.doesNotMatch(header, /AccountSurface/);
  assert.doesNotMatch(header, /accountSheet/);
  // الصورة ودتها صفحة /account (رابط مستقل)، والسهم المجاور عنصر منفصل يملك عقد القائمة
  assert.match(header, /<Link href="\/account" className="account-avatar"/);
  assert.match(header, /account-menu-trigger/);
  assert.match(header, /aria-label="فتح صفحة الحساب"/);
  assert.match(header, /aria-expanded=\{accountPopover\}/);
  assert.match(header, /aria-controls=\{accountPopover \? 'desktop-account-popover' : undefined\}/);
  // دعم اللوحة والإغلاق الواضح محفوظة: Escape يغلق ويعيد التركيز، والمؤشر الخارجي والتعتيم خارج قائمة التركيز يغلقان
  assert.match(header, /event\.key === 'Escape'/);
  assert.match(header, /accountTrigger\.current\?\.focus\(\)/);
  assert.match(header, /querySelector<HTMLElement>\('button, a'\)\?\.focus\(\)/);
  // قائمة الزائر: «تسجيل الدخول» لصفحة /login الكاملة — لا OAuth مباشر ولا «الاستمرار كزائر» داخل القائمة
  assert.match(header, /تسجيل الدخول/);
  assert.match(
    header,
    /<Link href="\/login" className="account-google-action" onClick=\{dismiss\}>/,
  );
  assert.doesNotMatch(header, /api\/auth\/oauth\/google|الاستمرار كزائر|account-google-pending/);
  // الشريط الزجاجي (هاتف <640px) يقود للصفحة الكاملة — matchMedia الخاص بالرأس يبقى لسلوكياته الأخرى
  assert.match(header, /router\.push\('\/account'\)/);
  assert.match(header, /matchMedia\('\(min-width: 1024px\)'\)/);
  // قائمة الحاسوب تُحفظ جزءًا من الرأس كما كانت (تُقدَّم من السهم الآن)
  assert.match(header, /<AccountActions dismiss=/);
});

test('Settings destination in every UI entry point is the /settings page; publish destination stays /contribute', () => {
  const surface = fs.readFileSync('src/components/AccountSurface.tsx', 'utf8');
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  assert.match(header, /href="\/settings"/);
  assert.match(surface, /href="\/contribute"/);
  assert.doesNotMatch(surface, /setSettings/);
  assert.match(header, /<Link href="\/settings" onClick=\{dismiss\}>/);
  assert.doesNotMatch(header, /app\.setSettings\(true\)/);
  // صفحتا /account و/settings موجودتان فعلًا على نظام الملفات وتحملان العنوانين الصحيحين
  assert.ok(fs.existsSync('src/app/account/page.tsx'), 'صفحة /account غائبة');
  assert.ok(fs.existsSync('src/app/settings/page.tsx'), 'صفحة /settings غائبة');
  assert.match(fs.readFileSync('src/app/account/page.tsx', 'utf8'), /title: 'حسابك'/);
  assert.match(fs.readFileSync('src/app/settings/page.tsx', 'utf8'), /title: 'الإعدادات'/);
});

test('Account page omits its display heading and hands the surface the same server-decided Google props as the header did', () => {
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
  assert.match(html, /<h1 class="sr-only">الحساب<\/h1>/);
  assert.doesNotMatch(html, /<h1[^>]*>حسابك<\/h1>|مساحتك الشخصية|account-title/);
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
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    'lucide-react': new Proxy({}, { get: () => () => null }),
  };
  const mod = load('src/components/Settings.tsx', overrides, { window: undefined });
  // المحتوى نفسه حي في مستويي العرض: الصفحة (SettingsPanel) والنافذة المحفوظة (Settings)
  const panel = renderToStaticMarkup(React.createElement(mod.SettingsPanel));
  assert.equal((panel.match(/<h2\b/g) || []).length, 4);
  assert.match(panel, /<h3\b/);
  for (const section of [
    /المظهر/,
    /لون الواجهة/,
    /تخفيف الحركة/,
    /التطبيق/,
    /مركز المساعدة/,
    /استعادة تفضيلات العرض/,
  ])
    assert.match(panel, section);
  const modal = renderToStaticMarkup(React.createElement(mod.Settings));
  assert.match(modal, /role="dialog" aria-label="على ذوقك"/);
  assert.match(modal, /المظهر/);
  assert.match(modal, /استعادة تفضيلات العرض/);

  const source = fs.readFileSync('src/components/Settings.tsx', 'utf8');
  assert.match(source, /export function SettingsPanel\(\)/);
  assert.match(panel, /class="settings-utility" href="\/help"/);
  // الدفعة 4: لوحة «لونك المفضّل» بلا بنفسجي — كهرماني (الافتراضي القائم)
  // وأخضر فقط، بلا توسيع ولا لون بديل، واستعادة الإعدادات ترجع الكهرماني كما كانت.
  assert.deepEqual(
    panel.match(/aria-label="(?:كهرماني|أخضر|بنفسجي)"/g) || [],
    ['aria-label="كهرماني"', 'aria-label="أخضر"'],
    'لوحة الألوان ليست كهرماني+أخضر فقط',
  );
  assert.doesNotMatch(source, /#6863ac|بنفسجي/);
  assert.match(source, /app\.setAccent\('#c1592e'\)/);
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
/* الدفعة 3: أُزيل PATCH /api/auth بعد ذهاب مستهلكه الوحيد (نموذج الاسم أعلاه).
   لم يعد للمسار معالج أصلًا: أي طلب PATCH عليه يلقى 405 تلقائيًّا من Next —
   ولا تحد أقل، حتى من يحمل جلسة حقيقية. العقود المعاكسة القديمة (401/400/200)
   استُبدلت بهذا العقد السلبي الصارم: */
test('PATCH /api/auth is retired in batch 3: the module exports GET/POST/DELETE only — any PATCH gets 405 from Next', () => {
  const { route } = authRouteWith({ user: MEMBER });
  assert.equal(typeof route.GET, 'function');
  assert.equal(typeof route.POST, 'function'); // ما زال يرد 410 «الدخول اجتماعي فقط»
  assert.equal(typeof route.DELETE, 'function');
  assert.equal(typeof route.PATCH, 'undefined', 'ما زال معالج PATCH موجودًا!');
  const source = fs.readFileSync('src/app/api/auth/route.ts', 'utf8');
  assert.doesNotMatch(source, /export async function PATCH/);
  assert.doesNotMatch(source, /DISPLAY_NAME|profile\.rename|UPDATE users SET name/);
});

test('Guest identity uses a narrow-screen grid so sign-in cannot collapse its copy at 320px', () => {
  const css = fs.readFileSync('src/app/navigation.css', 'utf8');
  assert.match(
    css,
    /@media \(max-width: 374px\) \{[\s\S]*?\.account-identity-guest \{\s*display: grid;\s*grid-template-columns: auto minmax\(0, 1fr\);/,
  );
  assert.match(
    css,
    /\.account-identity-guest > \.account-signin,\s*\.account-identity-guest > \.account-google-pending \{\s*grid-column: 1 \/ -1;\s*width: 100%;/,
  );
});
