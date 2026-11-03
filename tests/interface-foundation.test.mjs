import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');
const css = read('src/app/interface-foundation.css');
const header = read('src/components/Header.tsx');

test('I08 uses the approved light and warm dark surface tokens', () => {
  const globals = read('src/app/globals.css');
  for (const token of ['#fafaf8', '#ffffff', '#121214', '#18140f', '#221c16', '#f3ece2'])
    assert.ok(globals.includes(token), token);
  assert.match(css, /1120px/);
  assert.match(read('src/app/layout.tsx'), /import '\.\/interface-foundation\.css'/);
});

test('I10 separates pressed, focus, disabled and real loading states', () => {
  assert.match(css, /:active\s*:not\(\s*:disabled\s*\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline: 2px solid var\(--accent\)/);
  assert.match(css, /\[aria-busy='true'\]::before/);
  assert.match(css, /width: 16px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /data-motion='reduce'/);
  assert.match(read('src/components/Clip.tsx'), /aria-busy=\{busy\}/);
});

test('5.2.67 changes search copy without changing submit route or q behavior', () => {
  assert.doesNotMatch(header, /ابحث عن رياكشن أو موقف/);
  assert.match(header, /placeholder="ابحث عن رياكشن\.\.\."/);
  assert.match(
    header,
    /router\.push\(term \? `\/library\?q=\$\{encodeURIComponent\(term\)\}` : '\/library'\)/,
  );
  assert.match(header, /href="\/contribute"/);
});

test('I09 preserves 250ms mobile motion and protects keyboard focus from hiding', () => {
  assert.match(
    read('src/app/navigation.css'),
    /transition: transform 250ms var\(--ease-standard\)/,
  );
  assert.match(header, /querySelector\('\.site-header'\)\?\.contains\(document.activeElement\)/);
  assert.match(header, /inert=\{hiddenOnScroll\}/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /\.site-header \{\s*transform: none/);
});

test('5B.20/21 keep Auto and interface-only reset; unresolved accent hexes stay unchanged', () => {
  const settings = read('src/components/Settings.tsx');
  assert.match(read('src/components/AppProvider.tsx'), /useState\('system'\)/);
  const reset = settings.slice(settings.indexOf("app.setTheme('system')"));
  assert.match(reset, /app.setAccent\('#c1592e'\)/);
  assert.match(reset, /app.setReduced\(false\)/);
  assert.doesNotMatch(reset, /toggleSave|fetch\(|removeItem|\.clear\(/);
  assert.match(settings, /\['#c1592e', 'كهرماني'\]/);
  assert.match(settings, /\['#367567', 'أخضر'\]/);
});
