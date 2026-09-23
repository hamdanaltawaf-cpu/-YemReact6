import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  writeFile,
  readFile,
  rm,
  copyFile,
  mkdir,
  readdir,
  stat,
  symlink,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import sharp from 'sharp';
import Database from 'better-sqlite3';
import {
  inspectMedia,
  inspectStoredMedia,
  createVideoPoster,
} from '../scripts/media-inspection.mjs';
await mkdir('.cache', { recursive: true });
const root = await mkdtemp(path.resolve('.cache/media-test-'));
after(() => rm(root, { recursive: true, force: true }));
function clip(name, duration, webm = false) {
  const file = path.join(root, name);
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=32x32:r=10',
    '-t',
    String(duration),
    '-an',
    '-threads',
    '1',
    '-c:v',
    webm ? 'libvpx-vp9' : 'libx264',
    file,
  ]);
  return file;
}
test('JPG, PNG and WebP are fully decoded; filenames cannot turn an image into a video', async () => {
  for (const format of ['jpeg', 'png', 'webp']) {
    const file = path.join(root, format + '.mp4');
    await writeFile(
      file,
      await sharp({ create: { width: 120, height: 80, channels: 3, background: '#cc9966' } })
        .toFormat(format)
        .toBuffer(),
    );
    const result = await inspectMedia(file);
    assert.equal(result.type, 'image');
    assert.equal(result.mimeType, 'image/' + format);
    assert.equal(result.duration, null);
    assert.equal(result.width, 120);
    assert.equal(result.height, 80);
    assert.equal(result.mediaVerified, true);
    assert.equal(result.mediaSha256.length, 64);
  }
});
test('Truncated and spoofed image headers are rejected, not trusted from their signature', async () => {
  for (const [format, signature] of [
    ['png', '89504e470d0a1a0a'],
    ['jpg', 'ffd8ff'],
    ['webp', '524946460000000057454250'],
  ]) {
    const file = path.join(root, 'bad.' + format);
    await writeFile(file, Buffer.from(signature, 'hex'));
    await assert.rejects(inspectMedia(file), { status: 400 });
  }
  const png = await readFile(path.join(root, 'png.mp4'));
  await writeFile(path.join(root, 'cut.png'), png.subarray(0, Math.floor(png.length * 0.7)));
  await assert.rejects(inspectMedia(path.join(root, 'cut.png')), { status: 400 });
});
test('MP4 and WebM streams verify as videos; poster is an actual decoded frame', async () => {
  for (const webm of [false, true]) {
    const file = clip(webm ? 'ok.webm' : 'ok.mp4', 2, webm),
      m = await inspectMedia(file);
    assert.equal(m.type, 'video');
    assert.equal(m.duration, 2);
    assert.equal(m.mimeType, webm ? 'video/webm' : 'video/mp4');
    const poster = file + '.jpg';
    await createVideoPoster(file, poster);
    assert.equal((await inspectMedia(poster)).type, 'image');
  }
});
test('Actual video duration boundaries are inclusive and out-of-range streams are rejected', async () => {
  assert.equal((await inspectMedia(clip('max.mp4', 60))).duration, 60);
  for (const seconds of [1.5, 60.5])
    await assert.rejects(inspectMedia(clip('bad-' + seconds + '.mp4', seconds)), { status: 400 });
});
test('Audio-only MP4, wrong EBML DocType, empty and oversized files fail closed', async () => {
  const audio = path.join(root, 'audio.mp4');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=1000',
    '-t',
    '3',
    '-c:a',
    'aac',
    audio,
  ]);
  await assert.rejects(inspectMedia(audio), { status: 400 });
  const mkv = path.join(root, 'wrong.webm');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    path.join(root, 'ok.webm'),
    '-c',
    'copy',
    '-f',
    'matroska',
    mkv,
  ]);
  await assert.rejects(inspectMedia(mkv), { status: 400 });
  for (const bytes of [0, 15 * 1024 * 1024 + 1]) {
    const f = path.join(root, 'size-' + bytes);
    await writeFile(f, Buffer.alloc(bytes));
    await assert.rejects(inspectMedia(f), { status: 400 });
  }
});
test('Stored URLs are local allowlisted files; extension mismatches and symlinks are rejected', async () => {
  const prior = process.env.DATA_DIR;
  process.env.DATA_DIR = root;
  try {
    await mkdir(path.join(root, 'uploads'));
    await copyFile(path.join(root, 'png.mp4'), path.join(root, 'uploads', 'abc.mp4'));
    await assert.rejects(inspectStoredMedia('/api/media/abc.mp4'), { status: 400 });
    await symlink(path.join(root, 'png.mp4'), path.join(root, 'uploads', 'bad.png'));
    await assert.rejects(inspectStoredMedia('/api/media/bad.png'), { status: 400 });
    for (const url of [
      'https://example.com/a.mp4',
      '/api/media/../../a.png',
      '/etc/passwd',
      '/api/media/abc.mp4?type=video',
    ])
      await assert.rejects(inspectStoredMedia(url), { status: 400 });
  } finally {
    if (prior === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = prior;
  }
});
test('Migration backs up and updates in place; preserves saved FKs and is idempotent', async () => {
  const file = path.join(root, 'yemreact.sqlite'),
    db = new Database(file);
  db.pragma('foreign_keys=ON');
  db.exec(
    'CREATE TABLE reactions(code TEXT PRIMARY KEY,data TEXT); CREATE TABLE saved(user_id TEXT,code TEXT REFERENCES reactions(code) ON DELETE CASCADE);',
  );
  const put = db.prepare('INSERT INTO reactions VALUES (?,?)');
  for (const [code, media] of [
    ['VIDEO', '/media/demo-1.mp4'],
    ['IMAGE', '/media/portrait-1.webp'],
    ['MISSING', '/api/media/eeee.mp4'],
  ]) {
    put.run(code, JSON.stringify({ code, media, poster: '/media/portrait-2.webp', duration: 999 }));
    db.prepare('INSERT INTO saved VALUES (?,?)').run('member', code);
  }
  const args = ['scripts/migrate-media.mjs'],
    env = { ...process.env, DATA_DIR: root };
  execFileSync(process.execPath, args, { env });
  const rows = db
    .prepare('SELECT data FROM reactions ORDER BY code')
    .all()
    .map((r) => JSON.parse(r.data));
  assert.equal(rows[0].type, 'image');
  assert.equal(rows[0].duration, null);
  assert.equal(rows[0].poster, rows[0].media);
  assert.equal(rows[1].type, 'unknown');
  assert.equal(rows[1].mediaVerified, false);
  assert.equal(rows[2].type, 'video');
  assert.equal(rows[2].duration, 2);
  assert.equal(db.prepare('SELECT count(*) n FROM saved').get().n, 3);
  const backups = await readdir(path.join(root, 'backups'));
  assert.equal(backups.length, 1);
  assert.equal((await stat(path.join(root, 'backups', backups[0]))).mode & 0o777, 0o600);
  const snapshot = new Database(path.join(root, 'backups', backups[0]), { readonly: true });
  assert.equal(
    JSON.parse(snapshot.prepare('SELECT data FROM reactions LIMIT 1').get().data).duration,
    999,
  );
  snapshot.close();
  execFileSync(process.execPath, args, { env });
  assert.equal((await readdir(path.join(root, 'backups'))).length, 1);
  assert.equal(db.prepare('SELECT count(*) n FROM saved').get().n, 3);
  db.close();
});
test('Unavailable ffprobe halts migration without overwriting catalog or saves', async () => {
  const dir = path.join(root, 'unavailable');
  await mkdir(dir);
  const db = new Database(path.join(dir, 'yemreact.sqlite'));
  db.exec('CREATE TABLE reactions(code TEXT PRIMARY KEY,data TEXT)');
  const original = JSON.stringify({ code: 'KEEP', media: '/media/demo-1.mp4', duration: 123 });
  db.prepare('INSERT INTO reactions VALUES (?,?)').run('KEEP', original);
  assert.throws(() =>
    execFileSync(process.execPath, ['scripts/migrate-media.mjs'], {
      env: { ...process.env, DATA_DIR: dir, FFPROBE_PATH: path.join(root, 'no-such-ffprobe') },
      stdio: 'pipe',
    }),
  );
  assert.equal(db.prepare('SELECT data FROM reactions').get().data, original);
  db.close();
});

test('Animated PNG and WebP cannot masquerade as static image publications', async () => {
  for (const format of ['apng', 'webp']) {
    const file = path.join(root, 'animated.' + (format === 'apng' ? 'png' : 'webp'));
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc2=s=32x32:r=2',
      '-frames:v',
      '2',
      '-threads',
      '1',
      '-f',
      format,
      file,
    ]);
    await assert.rejects(inspectMedia(file), { status: 400 });
  }
});

test('A forged WebM DocType embedded in Matroska padding cannot fool verification', async () => {
  const original = await readFile(path.join(root, 'wrong.webm'));
  assert.ok(original[4] >= 0x80 && original[4] < 0xf0);
  const padding = Buffer.from([0xec, 0x87, 0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]);
  const header = Buffer.from(original.subarray(0, 5));
  header[4] += padding.length;
  const file = path.join(root, 'forged.webm');
  await writeFile(file, Buffer.concat([header, padding, original.subarray(5)]));
  await assert.rejects(inspectMedia(file), { status: 400 });
});
