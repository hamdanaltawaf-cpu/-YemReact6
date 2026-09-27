import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/collections.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const { collectionMembers, detailRecommendations } = context.exports;
const reactions = Array.from({ length: 34 }, (_, index) => ({
  code: `YR-${String(index + 1).padStart(4, '0')}`,
  category: index % 2 ? 'laugh' : 'shock',
  keywords: index % 3 ? ['short'] : ['school'],
}));
const collections = [
  { slug: 'students', memberCodes: ['YR-0001', 'YR-0002', 'YR-0003'] },
  { slug: 'groups', memberCodes: ['YR-0001', 'YR-0003', 'YR-0004'] },
];

test('Curated multi-membership selects exactly the same reactions across groups', () => {
  assert.deepEqual(
    Array.from(collectionMembers(collections[0], reactions), (item) => item.code),
    ['YR-0001', 'YR-0002', 'YR-0003'],
  );
  assert.ok(collectionMembers(collections[1], reactions).some((item) => item.code === 'YR-0003'));
});
test('Related has up to 10; more has 10–20 when the catalog is large enough and no duplicates', () => {
  const { related, more } = detailRecommendations(reactions[0], reactions, collections);
  assert.equal(related.length, 10);
  assert.equal(more.length, 20);
  assert.equal(related[0].code, 'YR-0003'); // Shared membership in two groups.
  assert.equal(new Set([...related, ...more].map((item) => item.code)).size, 30);
  assert.ok([...related, ...more].every((item) => item.code !== reactions[0].code));
});
test('Small demo catalogs never fabricate more cards, duplicate reactions or show empty recommendation sections', () => {
  const { related, more } = detailRecommendations(
    reactions[0],
    reactions.slice(0, 12),
    collections,
  );
  assert.equal(related.length, 10);
  assert.equal(more.length, 1);
  const empty = detailRecommendations(reactions[0], reactions.slice(0, 1), collections);
  assert.equal(empty.related.length, 0);
  assert.equal(empty.more.length, 0);
});
test('Public card/masonry and logo preserve Stage 4 constraints', () => {
  const card = fs.readFileSync('src/components/ReactionCard.tsx', 'utf8');
  const masonry = fs.readFileSync('src/components/ReactionMasonry.tsx', 'utf8');
  const fonts = fs.readFileSync('src/app/layout.tsx', 'utf8');
  assert.match(card, /ReactionMenu/);
  assert.match(card, /videoSeconds\(reaction\.duration\)/);
  assert.doesNotMatch(card, /reaction\.characterName|reaction\.situation|save-button|card-caption/);
  assert.doesNotMatch(masonry, /IntersectionObserver|PAGE_SIZE|library-sentinel/);
  assert.match(fonts, /IBM_Plex_Sans_Arabic|Inter|Lalezar|IBM_Plex_Mono/);
  for (const file of [
    'src/features/ContributeHub.tsx',
    'src/features/Admin.tsx',
    'src/features/Auth.tsx',
    'src/features/Detail.tsx',
    'src/components/Clip.tsx',
  ])
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /Qusasa|watermark|demo-label/);
});
