import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/contributions.ts', 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(code, context);
const api = context.exports;
const sample = (name, type, size = 1024) => ({ name, type, size });

test('contribution accepts only the specified image and video combinations', () => {
  for (const [name, type] of [
    ['photo.jpg', 'image/jpeg'],
    ['photo.PNG', 'image/png'],
    ['photo.webp', 'image/webp'],
    ['clip.mp4', 'video/mp4'],
    ['clip.mov', 'video/quicktime'],
    ['clip.webm', 'video/webm'],
  ])
    assert.equal(api.validateContributionFile(sample(name, type)), null, name);
  assert.equal(api.fileKind(sample('clip.MOV', 'video/quicktime')), 'video');
  assert.equal(
    api.validateContributionFile(sample('fake.mp4', 'image/png')).title,
    'نوع الملف غير مدعوم',
  );
  assert.equal(
    api.validateContributionFile(sample('script.svg', 'image/svg+xml')).title,
    'نوع الملف غير مدعوم',
  );
});

test('mock maximum size is 80 MiB, not the conflicting 20MB example', () => {
  assert.equal(api.MAX_CONTRIBUTION_BYTES, 80 * 1024 * 1024);
  assert.equal(
    api.validateContributionFile(sample('clip.mp4', 'video/mp4', 80 * 1024 * 1024)),
    null,
  );
  assert.match(
    api.validateContributionFile(sample('clip.mp4', 'video/mp4', 80 * 1024 * 1024 + 1)).message,
    /80MB/,
  );
  assert.equal(
    api.validateContributionFile(sample('empty.png', 'image/png', 0)).title,
    'الملف فارغ',
  );
});

test('client-side duration bounds are inclusive and explain every rejection', () => {
  assert.equal(api.validateContributionDuration(2), null);
  assert.equal(api.validateContributionDuration(60), null);
  assert.match(api.validateContributionDuration(1.99).title, /قصير جدًا/);
  assert.match(api.validateContributionDuration(60.01).title, /طويل جدًا/);
  assert.match(api.validateContributionDuration(NaN).message, /مدة/);
});

test('text is one required primary field with optional 50/300-character fields', () => {
  assert.match(api.validateContributionText('   ', '', '').message, /الأساسي/);
  assert.equal(api.validateContributionText('عنوان', 'ش'.repeat(50), 'ث'.repeat(300)), null);
  assert.equal(api.validateContributionText('ع'.repeat(100), '', ''), null);
  assert.match(api.validateContributionText('ع'.repeat(101), '', '').message, /100/);
  assert.match(api.validateContributionText('عنوان', 'ش'.repeat(51), '').message, /50/);
  assert.match(api.validateContributionText('عنوان', '', 'ث'.repeat(301)).message, /300/);
});

test('fixture has pending/approved/rejected, safe local records, working approved route and next SUB id', () => {
  assert.equal(api.mockSubmissions.length, 3);
  assert.deepEqual(
    Array.from(api.mockSubmissions, (item) => item.status),
    ['pending', 'approved', 'rejected'],
  );
  assert.equal(api.mockSubmissions[1].reactionUrl, '/r/YR-0001');
  assert.equal(api.nextSubmissionId(api.mockSubmissions), 'SUB-2026-0004');
  const stored = JSON.stringify([
    {
      id: 'SUB-2026-0004',
      title: 'تجربة',
      status: 'approved',
      reactionUrl: 'javascript:alert(1)',
      character: '',
      kind: 'image',
      createdAt: '2026-09-26',
    },
  ]);
  const saved = api.readDemoSubmissions({ getItem: () => stored });
  assert.equal(saved.length, 4);
  assert.equal(saved[0].status, 'pending');
  assert.equal(saved[0].reactionUrl, undefined);
  assert.equal(api.readDemoSubmissions({ getItem: () => null }).length, 3);
  assert.throws(() => api.readDemoSubmissions({ getItem: () => '{bad' }));
});

test('contribution UI is isolated from real auth, uploads and public feed', () => {
  const provider = fs.readFileSync('src/components/ContributionProvider.tsx', 'utf8');
  const form = fs.readFileSync('src/components/ContributionForm.tsx', 'utf8');
  const listing = fs.readFileSync('src/app/account/submissions/page.tsx', 'utf8');
  assert.match(provider, /محاكاة واجهة فقط/);
  assert.match(provider, /sessionStorage/);
  assert.doesNotMatch(provider, /fetch\(|\/api\/auth\/oauth|\/api\/upload|FormData\(/);
  assert.match(form, /inspectContributionMedia/);
  assert.match(form, /onDragOver|onDrop/);
  assert.match(listing, /معاينة الحالة الفارغة/);
  assert.doesNotMatch(listing, /Qusasa|watermark/);
});
