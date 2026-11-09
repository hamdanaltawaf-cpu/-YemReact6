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

const css = fs.readFileSync('src/app/stage4.css', 'utf8');
const detail = fs.readFileSync('src/features/Detail.tsx', 'utf8');
const preview = fs.readFileSync('src/components/Preview.tsx', 'utf8');
const reactionCard = fs.readFileSync('src/components/ReactionCard.tsx', 'utf8');
const designSystem = fs.readFileSync('docs/DESIGN-SYSTEM.md', 'utf8');

test('A situation is omitted only when its normalized text duplicates the title', () => {
  const { distinctSituation } = transpile('src/lib/reaction-copy.ts');
  assert.equal(distinctSituation('يا ساتر!', '  يا   ساتر!  '), null);
  assert.equal(distinctSituation('إستجابة', 'استجابة'), null);
  assert.equal(distinctSituation('يا ساتر!', 'لما تسمع خبر صادم'), 'لما تسمع خبر صادم');
  assert.equal(distinctSituation('يا ساتر!', '   '), null);
  assert.equal(distinctSituation('يا ساتر!', null), null);
});

test('Reaction card titles can occupy up to two lines without losing their second line', () => {
  const rule = css.match(
    /\.reaction-card \.card-info \.card-title,\s*\.saved-card \.card-info \.card-title\s*\{([^}]+)\}/s,
  )?.[1];
  assert.ok(rule, 'reaction card title rule exists');
  assert.match(rule, /display:\s*-webkit-box/);
  assert.match(rule, /-webkit-line-clamp:\s*2/);
  assert.match(rule, /-webkit-box-orient:\s*vertical/);
  assert.doesNotMatch(rule, /white-space:\s*nowrap/);
});

test('Detail action labels are visible on mobile while each touch target remains at least 44px', () => {
  assert.match(
    css,
    /\.detail-controls \.reaction-actions \.btn\s*\{[^}]*min-height:\s*var\(--button-height\);/s,
  );
  assert.match(
    css,
    /\.detail-controls \.reaction-actions \.btn\s*\{[^}]*min-width:\s*var\(--button-height\);/s,
  );
  assert.match(
    css,
    /\.detail-controls \.reaction-actions \.btn span\s*\{[^}]*position:\s*static;/s,
  );
  assert.match(css, /\.detail-controls \.reaction-actions \.btn span\s*\{[^}]*width:\s*auto;/s);
  assert.match(css, /\.detail-controls \.reaction-actions \.btn span\s*\{[^}]*clip:\s*auto;/s);
});

test('Detail and Preview share duplicate-description suppression; title is not repeated as metadata', () => {
  assert.match(detail, /distinctSituation\(reaction\.caption, reaction\.situation\)/);
  assert.match(preview, /distinctSituation\(r\.caption, r\.situation\)/);
  assert.doesNotMatch(detail, /detail-meta-description/);
});

test('Reaction cards expose an independent preview button and a single details link', () => {
  assert.match(reactionCard, /<button[\s\S]*?className="card-preview"/);
  assert.match(
    reactionCard,
    /aria-label=\{`معاينة \$\{reaction\.caption\}`}[\s\S]*?onClick=\{\(\) => app\.setPreview\(reaction\.code\)\}/,
  );
  assert.equal(
    (reactionCard.match(/href=\{`\/r\/\$\{encodeURIComponent\(reaction\.code\)\}`\}/g) || [])
      .length,
    1,
  );
  assert.match(reactionCard, /className="card-title"/);
  assert.match(
    css,
    /\.reaction-card \.card-preview-label\s*\{[^}]*min-height:\s*var\(--button-height\);/s,
  );
});

test('Preview swipes start in media and are cancelled by interactive controls', () => {
  assert.match(preview, /startsOnMedia[\s\S]*?startsOnControl/);
  assert.match(
    preview,
    /document\.elementFromPoint\([\s\S]*?target\.closest\(interactiveTouchTarget\)/,
  );
  assert.match(preview, /onTouchCancel=\{\(\) =>\s*\{\s*touch\.current = null;/);
});

test('Design-system guidance matches implemented colors, titles, controls, and masonry behavior', () => {
  assert.match(designSystem, /--bg[\s|`#]*.*#fafaf8/);
  assert.match(designSystem, /--surface[\s|`#]*.*#ffffff/);
  assert.match(designSystem, /--ink[\s|`#]*.*#121214/);
  assert.match(designSystem, /two lines|سطرين/);
  assert.match(designSystem, /44×44/);
  assert.match(designSystem, /cyclic|periodic|دوري/);
  assert.doesNotMatch(designSystem, /عنوان بسطر واحد|34×34 menus|34×34`/);
});
