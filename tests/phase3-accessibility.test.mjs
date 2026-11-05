import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globals = fs.readFileSync('src/app/globals.css', 'utf8');
const navigation = fs.readFileSync('src/app/navigation.css', 'utf8');
const stage4 = fs.readFileSync('src/app/stage4.css', 'utf8');
const contribution = fs.readFileSync('src/app/contribution.css', 'utf8');
const contributionEntry = fs.readFileSync('src/app/contribution-entry.css', 'utf8');
const auth = fs.readFileSync('src/features/Auth.tsx', 'utf8');

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `missing --${name} token`);
  return match[1];
}
function luminance(hex) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

test('Error text tokens meet WCAG AA contrast on both theme error surfaces', () => {
  const light = globals.match(/:root\s*\{[^}]+\}/s)?.[0];
  const dark = globals.match(/:root\[data-theme='dark'\]\s*\{[^}]+\}/s)?.[0];
  assert.ok(light && dark, 'both theme token blocks exist');
  for (const block of [light, dark]) {
    assert.ok(contrast(token(block, 'error-text'), token(block, 'error-surface')) >= 4.5);
  }
  assert.match(
    globals,
    /\.form-error\s*\{[^}]*color: var\(--error-text\)[^}]*background: var\(--error-surface\)/s,
  );
  assert.match(
    globals,
    /\.social-error\s*\{[^}]*color: var\(--error-text\)[^}]*background: var\(--error-surface\)/s,
  );
});

test('Account surfaces use theme-aware backgrounds rather than white in dark mode', () => {
  assert.match(
    navigation,
    /\.account-surface > \.account-identity \.account-google-pending,[\s\S]*?background: var\(--surface\)/,
  );
  assert.match(navigation, /\.account-summary-card\s*\{[^}]*background: var\(--surface\)/s);
});

test('Important touch targets are at least 44px in account, search and reaction detail controls', () => {
  assert.match(navigation, /\.library-search button\s*\{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(navigation, /\.account-tabs \[role='tab'\]\s*\{[^}]*min-height: 44px;/s);
  assert.match(navigation, /\.account-utilities a,[\s\S]*?min-height: 44px;/);
  assert.match(stage4, /\.reaction-menu-trigger\s*\{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(stage4, /\.reaction-menu-panel button\s*\{[^}]*min-height: 44px;/s);
  assert.match(stage4, /\.detail-back\s*\{[^}]*min-height: 44px;/s);
  assert.match(stage4, /\.detail-collections a\s*\{[^}]*min-height: 44px;/s);
  assert.match(stage4, /\.detail-controls \.reaction-actions \.btn\s*\{[^}]*min-height: 44px;/s);
  assert.match(
    stage4,
    /\.detail-titlebar\s*\{\s*display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(contribution, /\.contribution-remove\s*\{[^}]*width: 44px;[^}]*height: 44px;/s);
});

test('Homepage makes the next step explicit and keeps unavailable login methods secondary', () => {
  assert.match(auth, /<h2>تابع إلى المكتبة<\/h2>/);
  assert.match(auth, /بحسابك، محفوظاتك معك بين الأجهزة؛ كزائر، تبقى على هذا الجهاز\./);
  assert.match(
    auth,
    /<details className="social-pending-options">[\s\S]*pendingProviders\.map\(renderProvider\)/,
  );
  assert.match(globals, /\.social-pending-options summary\s*\{[^}]*min-height: 44px;/s);
  assert.match(globals, /\.social-auth \.auth-story p\s*\{[^}]*display: none;/s);
});

test('Error hues are shared across upload, storage and rejected-submission messages', () => {
  assert.match(
    contribution,
    /\.contribution-drop-area\.has-error\s*\{[^}]*border-color: var\(--error-text\)/s,
  );
  assert.match(
    contribution,
    /\.contribution-success > p\.contribution-storage-note\s*\{[^}]*color: var\(--error-text\)/s,
  );
  assert.match(
    contribution,
    /\.submission-detail > p\.submission-reason\s*\{[^}]*color: var\(--error-text\)/s,
  );
  assert.match(
    contributionEntry,
    /\.contribute-workspace-error > svg\s*\{[^}]*color: var\(--error-text\)/s,
  );
  assert.doesNotMatch(contribution, /#a23c33\s*!important|#903d36\s*!important|#943d35/);
});
