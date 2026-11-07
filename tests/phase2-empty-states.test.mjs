import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(file, overrides = {}) {
  const module = { exports: {} };
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(javascript, {
    module,
    exports: module.exports,
    URLSearchParams,
    require: (name) => (name in overrides ? overrides[name] : require(name)),
  });
  return module.exports;
}

const stateModule = load('src/components/ui/StatePanel.tsx', {
  '@/components/AppProvider': { useApp: () => ({ reduced: false }) },
});

function renderLibrary(search, reactions = []) {
  const { default: LibraryFeed } = load('src/features/LibraryFeed.tsx', {
    '@/components/ui/StatePanel': stateModule,
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    'next/navigation': { useSearchParams: () => new URLSearchParams(search) },
    '@/components/AppProvider': { useApp: () => ({ reactions }) },
    '@/components/ReactionMasonry': {
      ReactionMasonry: ({ items }) =>
        React.createElement('div', { 'data-testid': 'reaction-masonry' }, String(items.length)),
    },
    '@/lib/reactions': {
      filterReactions: (items, query, category) =>
        items.filter(
          (item) =>
            (!query || item.title.includes(query)) && (!category || item.category === category),
        ),
    },
  });
  return renderToStaticMarkup(React.createElement(LibraryFeed));
}

function renderCollections(collections) {
  const { default: CollectionsPage } = load('src/app/collections/page.tsx', {
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }) => React.createElement('a', props, children),
    },
    '@/components/CollectionCard': {
      CollectionCard: ({ collection }) => React.createElement('article', null, collection.title),
    },
    '@/server/collections': { listCollections: () => collections },
  });
  return renderToStaticMarkup(React.createElement(CollectionsPage));
}

test('Library renders a recoverable empty search state and preserves other query parameters', () => {
  const html = renderLibrary('q=لا+يوجد&cat=memes');
  assert.match(html, /role="status" aria-live="polite"/);
  assert.match(html, /ما لقينا نتائج لـ «لا يوجد»/);
  assert.match(html, /href="\/library\?cat=memes"/);
  assert.match(html, /مسح البحث/);
  assert.doesNotMatch(html, /data-testid="reaction-masonry"/);
});

test('Library keeps results visible and offers a route back when a filter has no matches', () => {
  const results = renderLibrary('q=ضحكة', [{ title: 'ضحكة صباحية', category: 'memes' }]);
  assert.match(results, /data-testid="reaction-masonry">1<\/div>/);
  assert.doesNotMatch(results, /library-empty-state/);

  const filtered = renderLibrary('cat=missing');
  assert.match(filtered, /ما فيه رياكشنات هنا حاليًا/);
  assert.match(filtered, /href="\/library"/);
  assert.match(filtered, /عرض المكتبة كاملة/);
});

test('Collections page explains an empty public listing and links to the library', () => {
  const empty = renderCollections([]);
  assert.match(empty, /id="collections-title"/);
  assert.match(empty, /ما فيه مجموعات منشورة حاليًا/);
  assert.match(empty, /href="\/library"/);
  assert.match(empty, /استكشف المكتبة/);
  assert.doesNotMatch(empty, /collections-grid/);

  const populated = renderCollections([{ slug: 'one', title: 'مجموعة أولى' }]);
  assert.match(populated, /collections-grid/);
  assert.match(populated, /مجموعة أولى/);
  assert.doesNotMatch(populated, /collections-empty-state/);
});

test('Contribution file drop zone matches its click promise and stays keyboard reachable', () => {
  const form = fs.readFileSync('src/components/ContributionForm.tsx', 'utf8');
  const styles = fs.readFileSync('src/app/contribution.css', 'utf8');
  assert.match(form, /id="contribution-file"/);
  assert.match(form, /className=\{`contribution-drop-area[\s\S]*?htmlFor="contribution-file"/);
  assert.match(form, /اختيار ملف الرياكشن/);
  assert.match(form, /اضغط في أي مكان للاختيار/);
  assert.doesNotMatch(form, /tabIndex=\{-1\}/);
  assert.match(styles, /contribution-file-input:focus-visible \+ \.contribution-drop-area/);
  assert.match(styles, /contribution-drop-area:hover:not\(\.is-dragging\)/);
  assert.match(styles, /\.contribution-pick\s*\{[^}]*min-height: 44px/s);
  assert.match(styles, /\.contribution-remove\s*\{[^}]*width: 44px/s);
});

test('Header mirrors URL search changes so clearing q also clears the controlled input', () => {
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  assert.match(header, /useSearchParams/);
  assert.match(header, /const searchQuery = searchParams\.get\('q'\) \|\| ''/);
  assert.match(header, /setQuery\(path === '\/library' \? searchQuery : ''\)/);
  assert.match(header, /\}, \[path, searchQuery\]\)/);
});
