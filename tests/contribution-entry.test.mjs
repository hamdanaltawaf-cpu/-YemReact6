import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const require = createRequire(import.meta.url);

function renderHub(mockSignedIn, loadError = '') {
  const file = fs.readFileSync('src/features/ContributeHub.tsx', 'utf8');
  const module = { exports: {} };
  const records = [{ status: 'pending' }, { status: 'approved' }, { status: 'rejected' }];
  const overrides = {
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/components/AppProvider': { useApp: () => ({ user: null, authReady: true }) },
    '@/components/ContributionProvider': {
      useContribution: () => ({
        mockSignedIn,
        ready: true,
        records,
        loadError,
        requestOpen: () => {},
        requestSubmissions: () => {},
        reload: () => {},
      }),
    },
  };
  vm.runInNewContext(
    ts.transpileModule(file, {
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
    },
  );
  return renderToStaticMarkup(React.createElement(module.exports.default));
}

test('Three primary destinations stay separate from the active mock-upload quick action', () => {
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  const primary = header.match(/const primaryLinks = \[([\s\S]*?)\] as const;/)?.[1];
  assert.ok(primary);
  assert.deepEqual(
    [...primary.matchAll(/href: '(\/[^']+)'/g)].map((match) => match[1]),
    ['/library', '/collections', '/saved'],
  );
  assert.match(header, /function UploadQuickAction/);
  assert.match(header, /href="\/contribute"/);
  assert.match(header, /aria-label="رفع رياكشن — تجربة محلية"/);
  assert.match(header, /mobile-quick-action/);
  // الشريط السفلي صار مكوّن GlassNav الزجاجي: خمسة تبويبات بترتيب RTL وبصيغة المستخدم
  assert.match(header, /<GlassNav onSelect=/);
  const glassNav = fs.readFileSync('src/components/glass-nav/GlassNav.tsx', 'utf8');
  assert.deepEqual(
    [...glassNav.matchAll(/key: '(library|groups|add|saved|account)'/g)].map((match) => match[1]),
    ['library', 'groups', 'add', 'saved', 'account'],
  );
  for (const label of ['المكتبة', 'المجموعات', 'اضافة', 'المحفوظات', 'الحساب']) {
    assert.ok(glassNav.includes(`label: '${label}'`), `التبويب «${label}» مفقود`);
  }
  assert.match(header, /desktop-library-search/);
  // DECISION-I10: الحقل كاملًا في الهيدر على الجوال — بلا زر مُطلق ولا نافذة بحث
  assert.match(header, /mobile-library-search/);
  assert.match(header, /header-search-row/);
  assert.doesNotMatch(header, /mobile-search-trigger/);
  // زر الحساب في الهيدر مقصور على الحاسوب — على الجوال الحساب من تبويب الشريط الزجاجي
  const navCss = fs.readFileSync('src/app/navigation.css', 'utf8');
  const mobileCss = navCss.split('@media (max-width: 1023px)')[1] ?? '';
  assert.match(mobileCss, /\.site-header \.header-account \{[^}]*display: none/);
  assert.doesNotMatch(header, /nav-contribute|contribute-trigger|mobile-menu/);
  assert.equal(fs.existsSync('src/features/Home.tsx'), false);
  assert.equal(fs.existsSync('src/app/page.tsx'), false);
  assert.match(header, /className="brand" aria-label="يمن رياكت\. YEMREACT — المكتبة"/);
  assert.doesNotMatch(header, /href="\/"|الرئيسية/);
});

test('Guest hub explains its mock status before asking for sign-in, signed-in hub shows example counts', () => {
  const guest = renderHub(false);
  assert.match(guest, /المساهمة|نموذج محلي فقط/);
  assert.match(guest, /Google/);
  assert.match(guest, /استكشف إرسالات التجربة/);
  assert.match(guest, /80MB/);
  assert.doesNotMatch(guest, /contribute-trigger/);
  const contributor = renderHub(true);
  assert.match(contributor, /عرض إرسالاتي/);
  assert.match(contributor, /ملخّص الإرسالات التجريبية/);
  assert.match(contributor, /قيد المراجعة/);
  const broken = renderHub(true, 'تعذّر قراءة إرسالات التجربة');
  assert.match(broken, /تعذّر قراءة إرسالات التجربة/);
  assert.match(broken, /حاول مرة ثانية/);
  assert.doesNotMatch(broken, /ملخّص الإرسالات التجريبية/);
});

test('Guest viewing submissions does not accidentally enter the upload form', () => {
  const provider = fs.readFileSync('src/components/ContributionProvider.tsx', 'utf8');
  const submissions = fs.readFileSync('src/app/account/submissions/page.tsx', 'utf8');
  assert.match(provider, /afterSignIn === 'submissions'/);
  assert.match(provider, /router\.push\('\/account\/submissions'\)/);
  assert.match(submissions, /onClick=\{contribution\.requestSubmissions\}/);
  assert.match(submissions, /href="\/contribute"/);
  assert.doesNotMatch(provider, /fetch\(|FormData\(|\/api\/upload/);
});

test('Accepted motion avoids fake progress and keeps the mobile bar fixed with reduced-motion support', () => {
  const form = fs.readFileSync('src/components/ContributionForm.tsx', 'utf8');
  const navigationCSS = fs.readFileSync('src/app/navigation.css', 'utf8');
  const formCSS = fs.readFileSync('src/app/contribution.css', 'utf8');
  const global = fs.readFileSync('src/app/globals.css', 'utf8');
  assert.doesNotMatch(form, /<progress|setInterval\(/);
  assert.match(form, /جارٍ فحص المدة وحواف الفيديو/);
  assert.match(global, /--motion-micro: 120ms/);
  assert.match(global, /--motion-medium: 240ms/);
  const glassNavCSS = fs.readFileSync('src/components/glass-nav/glass-nav.css', 'utf8');
  assert.match(navigationCSS, /max-width: 1023px/);
  // الشريط الزجاجي: خمس مناطق تفاعلية متساوية + تثبيت أسفل الشاشة + دعم تقليل الحركة
  assert.match(glassNavCSS, /flex: 1 1 0/);
  assert.match(glassNavCSS, /position: fixed/);
  assert.match(glassNavCSS, /prefers-reduced-motion: reduce/);
  assert.match(glassNavCSS, /data-motion='reduce'/);
  assert.match(formCSS, /contribution-shimmer/);
  assert.doesNotMatch(formCSS, /progress::/);
});

test('Mock entry routes opt out of indexing and public offline HTML caching', () => {
  const hubPage = fs.readFileSync('src/app/contribute/page.tsx', 'utf8');
  const submissions = fs.readFileSync('src/app/account/submissions/layout.tsx', 'utf8');
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(hubPage, /index: false/);
  assert.match(submissions, /index: false/);
  assert.doesNotMatch(sw, /'\/contribute'|'\/account\/submissions'/);
});
