const { chromium } = require('./tools/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');
const base = 'http://localhost:3000';
(async () => {
  const directory = '.cache/video-duration'; fs.mkdirSync(directory, { recursive: true });
  const fixtures = [];
  for (const ext of ['mp4', 'webm']) for (const duration of [1.99, 2, 30, 60, 60.01]) {
    const file = path.join(directory, `${duration}.${ext}`);
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=32x32:r=100', '-t', String(duration), '-an', '-threads', '1', '-c:v', ext === 'mp4' ? 'libx264' : 'libvpx-vp9', ...(ext === 'mp4' ? ['-preset', 'ultrafast', '-pix_fmt', 'yuv420p'] : ['-deadline', 'realtime', '-cpu-used', '8']), file]);
    fixtures.push({ ext, duration, file });
  }
  const db = new Database('data/yemreact.sqlite'); db.pragma('foreign_keys = ON');
  const id = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO users VALUES (?,?,?,?,?,?)').run(id, 'اختبار حدود الفيديو', id + '@social.invalid', 'social-only', 'admin', new Date().toISOString());
  db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(crypto.createHash('sha256').update(token).digest('hex'), id, Date.now() + 600000);
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await context.addCookies([{ name: 'yr_session', value: token, domain: 'localhost', path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
  const headers = { Origin: base, Cookie: `yr_session=${token}` };
  const request = context.request, page = await context.newPage();
  const uploaded = [], codes = [];
  const report = { rawUploads: [], declaredDuration: [], checks: [], errors: [] };
  page.on('pageerror', e => report.errors.push(e.message));
  try {
    for (const fixture of fixtures) {
      const r = await request.post(base + '/api/upload', { headers, multipart: { file: { name: path.basename(fixture.file), mimeType: `video/${fixture.ext}`, buffer: fs.readFileSync(fixture.file) } } });
      const body = await r.json();
      const allowed = fixture.duration >= 2 && fixture.duration <= 60;
      assert.equal(r.status(), allowed ? 200 : 400, JSON.stringify(body));
      if (allowed) { assert.equal(body.duration, fixture.duration); uploaded.push(body.url); fixture.url = body.url; }
      else assert.match(body.error, /ثانيتين.*60/);
      report.rawUploads.push({ format: fixture.ext, duration: fixture.duration, status: r.status(), measured: body.duration });
    }
    assert.equal(fs.readdirSync('data').filter(n => n.startsWith('.video-check-')).length, 0);
    report.checks.push('Actual MP4 and WebM files: 2/30/60 accepted; 1.99/60.01 rejected; private temporary files cleaned');
    const image = await request.post(base + '/api/upload', { headers, multipart: { file: { name: 'cover.webp', mimeType: 'image/webp', buffer: fs.readFileSync('public/media/portrait-1.webp') } } });
    assert.equal(image.status(), 200); const imageBody = await image.json(); uploaded.push(imageBody.url); assert.equal(imageBody.type, 'image');
    const fake = await request.post(base + '/api/upload', { headers, multipart: { file: { name: 'fake.mp4', mimeType: 'video/mp4', buffer: Buffer.from('0000ftyp' + 'x'.repeat(80)) } } });
    assert.equal(fake.status(), 400);
    const seed = JSON.parse(db.prepare('SELECT data FROM reactions ORDER BY code LIMIT 1').get().data);
    const valid = fixtures.find(f => f.ext === 'mp4' && f.duration === 60);
    for (const duration of [1.999, 2, 30, 60, 60.001]) {
      const code = `YR-DURATION-${String(duration).replace('.', '-')}`; codes.push(code);
      const r = await request.post(base + '/api/reactions', { headers, data: { ...seed, code, duration, media: valid.url, isDemo: false } });
      const allowed = duration >= 2 && duration <= 60;
      assert.equal(r.status(), allowed ? 200 : 400);
      if (allowed) assert.equal((await r.json()).reaction.duration, 60);
      report.declaredDuration.push({ duration, status: r.status() });
    }
    // A file introduced without the upload endpoint must still be rejected during publication.
    const bypassName = crypto.randomUUID() + '.mp4';
    fs.copyFileSync(fixtures.find(f => f.ext === 'mp4' && f.duration === 60.01).file, 'data/uploads/' + bypassName);
    uploaded.push('/api/media/' + bypassName);
    const bypass = await request.post(base + '/api/reactions', { headers, data: { ...seed, code: 'YR-DURATION-BYPASS', duration: 2, media: '/api/media/' + bypassName, isDemo: false } });
    assert.equal(bypass.status(), 400);
    assert.equal(db.prepare('SELECT code FROM reactions WHERE code=?').get('YR-DURATION-BYPASS'), undefined);
    report.checks.push('Publish rejects out-of-range declared values, replaces valid claims with measured duration, and blocks oversized media even when upload is bypassed');
    // Real owner editor: reject before network upload, then accept and publish a full-minute clip.
    await page.goto(base + '/admin', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'رياكشن جديد', exact: true }).click();
    await page.getByLabel('الاقتباس', { exact: true }).fill('اختبار فيديو دقيقة');
    await page.getByLabel('متى نستخدمه؟', { exact: true }).fill('اختبار رفع ونشر فيديو مدته ستون ثانية');
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    assert.match(await page.locator('dialog[open]').innerText(), /من 2 إلى 60 ثانية/);
    let uploadRequests = 0;
    page.on('request', r => { if (r.url().endsWith('/api/upload')) uploadRequests++; });
    const input = page.locator('input[type=file][accept="video/mp4,video/webm"]');
    for (const duration of [1.99, 60.01]) {
      await input.setInputFiles(fixtures.find(f => f.ext === 'mp4' && f.duration === duration).file);
      await page.locator('dialog [role=alert]').waitFor();
      assert.match(await page.locator('dialog [role=alert]').innerText(), /ثانيتين.*60/);
      assert.equal(uploadRequests, 0);
    }
    const response = page.waitForResponse(r => r.url().endsWith('/api/upload'));
    await input.setInputFiles(valid.file);
    const uiUpload = await response; assert.equal(uiUpload.status(), 200);
    const uiBody = await uiUpload.json(); assert.equal(uiBody.duration, 60); uploaded.push(uiBody.url);
    await page.getByRole('button', { name: 'التالي', exact: true }).click();
    await page.getByRole('checkbox', { name: 'أملك حق استخدام ومشاركة هذا المحتوى.' }).check();
    const published = page.waitForResponse(r => r.url().endsWith('/api/reactions') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'نشر القصاصة', exact: true }).click();
    const publishedResponse = await published; assert.equal(publishedResponse.status(), 200);
    const clip = (await publishedResponse.json()).reaction; codes.push(clip.code); assert.equal(clip.duration, 60);
    await page.locator('dialog[open]').waitFor({ state: 'hidden' });
    await page.goto(base + '/library?q=' + encodeURIComponent('اختبار فيديو دقيقة'), { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.reaction-card').count(), 1);
    assert.equal(await page.locator('.card-duration').innerText(), '60s');
    await page.locator('.save-button').click();
    await page.goto(base + '/saved', { waitUntil: 'networkidle' });
    await page.locator('.reaction-card').first().waitFor();
    assert.equal(await page.locator('.card-duration').innerText(), '60s');
    assert.equal(await page.locator('select[aria-label="أقصى مدة"]').inputValue(), '60');
    await page.locator('select[aria-label="أقصى مدة"]').selectOption('3');
    assert.equal(await page.locator('.reaction-card').count(), 0);
    await page.locator('select[aria-label="أقصى مدة"]').selectOption('60');
    assert.equal(await page.locator('.reaction-card').count(), 1);
    report.checks.push('Owner UI blocks too-short/long files before upload; full-minute upload/publish/card badge/library discovery/saved all-durations and short filter work');
    assert.deepEqual(report.errors, []); report.completed = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally {
    for (const code of codes) { db.prepare('DELETE FROM reactions WHERE code=?').run(code); db.prepare('DELETE FROM events WHERE code=?').run(code); }
    db.prepare('DELETE FROM audit WHERE user_id=?').run(id);
    db.prepare('DELETE FROM users WHERE id=?').run(id); db.close();
    for (const url of uploaded) { try { fs.unlinkSync(path.join('data/uploads', path.basename(url))); } catch {} }
    await browser.close();
    fs.writeFileSync('verification/video-duration-results.json', JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
