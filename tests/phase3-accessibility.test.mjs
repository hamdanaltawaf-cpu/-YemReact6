import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const globals = fs.readFileSync('src/app/globals.css', 'utf8');
const foundation = fs.readFileSync('src/app/interface-foundation.css', 'utf8');
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
function mixSrgb(first, second, firstWeight) {
  const channels = [1, 3, 5].map((start) => {
    const a = parseInt(first.slice(start, start + 2), 16);
    const b = parseInt(second.slice(start, start + 2), 16);
    return Math.round(a * firstWeight + b * (1 - firstWeight))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}
function themeColor(block, name, fallbackBlock = block) {
  const expression = new RegExp(`--${name}:\\s*([^;]+)`).exec(block)?.[1].trim();
  if (!expression) {
    if (fallbackBlock !== block) return themeColor(fallbackBlock, name);
    assert.fail(`missing --${name} token`);
  }
  if (/^#[0-9a-f]{6}$/i.test(expression)) return expression;
  const mixed = /^color-mix\(in srgb, var\(--accent\)\s+(\d+)%\s*,\s*(#[0-9a-f]{3,6})\s*\)$/i.exec(
    expression,
  );
  assert.ok(mixed, `unsupported color expression for --${name}: ${expression}`);
  const other =
    mixed[2].length === 4
      ? `#${mixed[2][1].repeat(2)}${mixed[2][2].repeat(2)}${mixed[2][3].repeat(2)}`
      : mixed[2];
  return mixSrgb(themeColor(block, 'accent', fallbackBlock), other, Number(mixed[1]) / 100);
}
function themeBlocks() {
  const light = globals.match(/:root\s*\{[^}]+\}/s)?.[0];
  const dark = globals.match(/:root\[data-theme='dark'\]\s*\{[^}]+\}/s)?.[0];
  assert.ok(light && dark, 'both theme token blocks exist');
  return { light, dark };
}

test('Error text tokens meet WCAG AA contrast on both theme error surfaces', () => {
  const { light, dark } = themeBlocks();
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

test('Central semantic text tokens meet WCAG AA across light and dark surfaces', () => {
  const { light, dark } = themeBlocks();
  for (const [theme, block] of Object.entries({ light, dark })) {
    const color = (name) => themeColor(block, name, light);
    for (const foreground of ['ink', 'muted', 'accent-text']) {
      for (const background of ['bg', 'surface', 'soft']) {
        assert.ok(
          contrast(color(foreground), color(background)) >= 4.5,
          `${theme} ${foreground} on ${background}: ${contrast(color(foreground), color(background)).toFixed(2)}:1`,
        );
      }
    }
    assert.ok(
      contrast(color('accent-text'), color('accent-soft')) >= 4.5,
      `${theme} accent text on accent surface`,
    );
    for (const background of ['bg', 'surface', 'error-surface']) {
      assert.ok(
        contrast(color('error-text'), color(background)) >= 4.5,
        `${theme} error text on ${background}`,
      );
    }
    for (const name of [
      'bg',
      'surface',
      'ink',
      'muted',
      'line',
      'soft',
      'accent',
      'accent-soft',
      'error-text',
      'error-surface',
      'error-border',
      'control-border',
      'paper',
      'accent-text',
    ]) {
      assert.match(color(name), /^#[0-9a-f]{6}$/i, `${theme} --${name} resolves to sRGB`);
    }
  }
});

test('Stack-form placeholders use opaque semantic muted text in both themes', () => {
  assert.match(
    globals,
    /\.stack-form input::placeholder,\s*\.stack-form textarea::placeholder\s*\{[^}]*color: var\(--muted\);[^}]*opacity: 1;/s,
  );
});

test('Icon, focus, button-label and control-border contrast use non-text thresholds', () => {
  const { light, dark } = themeBlocks();
  for (const [theme, block] of Object.entries({ light, dark })) {
    const color = (name) => themeColor(block, name, light);
    for (const foreground of ['muted', 'accent', 'accent-text']) {
      for (const background of ['bg', 'surface', 'soft']) {
        assert.ok(
          contrast(color(foreground), color(background)) >= 3,
          `${theme} icon ${foreground} on ${background}: ${contrast(color(foreground), color(background)).toFixed(2)}:1`,
        );
      }
    }
    for (const background of ['bg', 'surface']) {
      assert.ok(
        contrast(color('accent-text'), color(background)) >= 3,
        `${theme} focus indicator on ${background}`,
      );
      assert.ok(
        contrast(color('control-border'), color(background)) >= 3,
        `${theme} control border on ${background}`,
      );
    }
    const primary = mixSrgb(color('accent'), '#000000', 0.88);
    assert.ok(contrast('#ffffff', primary) >= 4.5, `${theme} primary button label on accent fill`);
    assert.notEqual(
      color('line'),
      color('surface'),
      `${theme} decorative divider is not invisible`,
    );
  }
  assert.match(globals, /:focus-visible[\s\S]*?outline: 2px solid var\(--accent-text\)/);
  assert.match(
    foundation,
    /:is\(\.btn, \.icon-btn, \.text-button\):is\(:disabled, \[aria-disabled='true'\]\)[\s\S]*?opacity: 0\.55/,
  );
  // WCAG exempts inactive controls from minimum contrast; keep them visibly distinct instead.
  assert.match(foundation, /button:disabled\s*\{[^}]*cursor: not-allowed/s);
});

test('Account surfaces use theme-aware backgrounds rather than white in dark mode', () => {
  assert.match(
    navigation,
    /\.account-surface > \.account-identity \.account-google-pending,[\s\S]*?background: var\(--surface\)/,
  );
  assert.match(navigation, /\.account-tabs \[role='tab'\]\s*\{[^}]*display: inline-flex/s);
  assert.match(navigation, /\.account-tab-count\s*\{[^}]*background: var\(--surface\)/s);
});

test('Important touch targets are at least 44px in account, search and reaction detail controls', () => {
  assert.match(globals, /--button-height:\s*44px/);
  assert.match(globals, /--button-height-large:\s*48px/);
  assert.match(
    navigation,
    /\.library-search button\s*\{[^}]*width: var\(--button-height\);[^}]*height: var\(--button-height\);/s,
  );
  assert.match(
    navigation,
    /\.account-tabs \[role='tab'\]\s*\{[^}]*min-height: var\(--button-height\);/s,
  );
  assert.match(
    navigation,
    /\.account-icon-action\s*\{[^}]*width: var\(--button-height-large\);[^}]*height: var\(--button-height-large\);[^}]*flex: 0 0 var\(--button-height-large\);/s,
  );
  assert.match(navigation, /\.account-icon-action:focus-visible\s*\{[^}]*outline: 3px solid/s);
  assert.match(navigation, /\.account-utilities a,[\s\S]*?min-height: var\(--button-height\);/);
  assert.match(
    stage4,
    /\.reaction-menu-trigger\s*\{[^}]*width: var\(--button-height\);[^}]*height: var\(--button-height\);/s,
  );
  assert.match(
    stage4,
    /\.reaction-menu-panel button\s*\{[^}]*min-height: var\(--button-height\);/s,
  );
  assert.match(stage4, /\.detail-back\s*\{[^}]*min-height: var\(--button-height\);/s);
  assert.match(stage4, /\.detail-collections a\s*\{[^}]*min-height: var\(--button-height\);/s);
  assert.match(
    stage4,
    /\.detail-controls \.reaction-actions \.btn\s*\{[^}]*min-height: var\(--button-height\);/s,
  );
  assert.match(
    stage4,
    /\.detail-titlebar\s*\{\s*display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    contribution,
    /\.contribution-remove\s*\{[^}]*width: var\(--button-height\);[^}]*height: var\(--button-height\);/s,
  );
});

test('Homepage makes the next step explicit and keeps unavailable login methods secondary', () => {
  assert.match(auth, /<h2>تابع إلى المكتبة<\/h2>/);
  assert.match(auth, /بحسابك، محفوظاتك معك بين الأجهزة؛ كزائر، تبقى على هذا الجهاز\./);
  assert.match(
    auth,
    /<details className="social-pending-options">[\s\S]*pendingProviders\.map\(renderProvider\)/,
  );
  assert.match(
    globals,
    /\.social-pending-options summary\s*\{[^}]*min-height: var\(--button-height\);/s,
  );
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
