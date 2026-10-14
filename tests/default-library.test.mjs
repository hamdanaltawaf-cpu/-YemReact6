import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function transpile(file) {
  const exports = {};
  const javascript = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(javascript, { exports });
  return exports;
}

test('Only library is the public default; the root is now the login gateway page', async () => {
  const config = transpile('next.config.ts').default;
  const redirects = await config.redirects();
  // الجذر لم يعد إحالة إلى /library — صفحته بوّابة الدخول (src/app/page.tsx)
  assert.equal(
    redirects.find((rule) => rule.source === '/'),
    undefined,
  );
  assert.equal(fs.existsSync('src/app/page.tsx'), true);
  assert.equal(fs.existsSync('src/features/Home.tsx'), false);
  for (const file of [
    'src/app/globals.css',
    'src/app/stage4.css',
    'src/app/contribution-entry.css',
  ])
    assert.doesNotMatch(
      fs.readFileSync(file, 'utf8'),
      /\.hero\b|\.home-contribute\b|\.word-ribbon\b/,
    );
  const library = fs.readFileSync('src/app/library/page.tsx', 'utf8');
  assert.match(library, /canonical: '\/library'/);
  assert.match(library, /LibraryFeed/);
});

test('Brand, responsive navigation, PWA start and sitemap no longer advertise Home', () => {
  const header = fs.readFileSync('src/components/Header.tsx', 'utf8');
  assert.match(header, /href="\/library" className="brand"/);
  assert.doesNotMatch(header, /href="\/"|الرئيسية/);
  const manifest = transpile('src/app/manifest.ts').default();
  assert.equal(manifest.start_url, '/library');
  const sitemap = fs.readFileSync('src/app/sitemap.ts', 'utf8');
  assert.doesNotMatch(sitemap, /\{ url: base, priority: 1 \}/);
  assert.match(sitemap, /base \+ '\/library', priority: 1/);
  const worker = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(worker, /الجذر صار بوّابة الدخول/);
  assert.doesNotMatch(worker, /\['\/', '\/library'/);
});
