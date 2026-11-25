import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import Database from 'better-sqlite3';
const require = createRequire(import.meta.url);

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function makeDatabase() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yemreact-reports-'));
  const databasePath = path.join(directory, 'yemreact.sqlite');
  const legacy = new Database(databasePath);
  legacy.exec(`
    CREATE TABLE oauth_flows(
      state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,browser_hash TEXT NOT NULL,
      nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL
    );
    CREATE TABLE reports(
      id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL,reason TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL
    );
  `);
  legacy
    .prepare('INSERT INTO reports(code,reason,detail,created_at) VALUES (?,?,?,?)')
    .run('YR-0007', 'بلاغ قديم', 'سجل سابق للترقية', '2025-01-02T03:04:05.000Z');
  legacy.close();

  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = directory;
  const module = { exports: {} };
  try {
    vm.runInNewContext(transpile('src/server/db.ts'), {
      module,
      exports: module.exports,
      process,
      console,
      require: (name) => {
        if (name === 'server-only') return {};
        if (name === 'better-sqlite3') return { default: Database };
        if (name === 'node:fs') return fs;
        if (name === 'node:path') return { default: path };
        if (name === '@/lib/reactions') return { REACTIONS: [] };
        return require(name);
      },
    });
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }
  return {
    ...module.exports,
    close() {
      module.exports.db.close();
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

function makeApi(data, authorized = true) {
  class ApiError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }
  const auth = {
    ApiError,
    requireAdmin: async () => {
      if (!authorized) throw new ApiError(403, 'غير مصرح.');
      return { id: 'admin-1' };
    },
    sameOrigin: (request) => {
      if (request.headers.get('origin') !== 'https://yemreact.test')
        throw new ApiError(403, 'مصدر غير مسموح.');
    },
    rateLimit: () => {},
    apiError: (error) =>
      Response.json(
        { error: error instanceof Error ? error.message : 'فشل' },
        { status: error instanceof ApiError ? error.status : 500 },
      ),
  };
  const module = { exports: {} };
  vm.runInNewContext(transpile('src/app/api/reports/route.ts'), {
    module,
    exports: module.exports,
    URL,
    URLSearchParams,
    Response,
    Request,
    Date,
    JSON,
    require: (name) => {
      if (name === 'zod') return require('zod');
      if (name === '@/server/db') return data;
      if (name === '@/server/auth') return auth;
      throw Error(`Unexpected import: ${name}`);
    },
  });
  return module.exports;
}

const request = (url, { method = 'GET', body } = {}) =>
  new Request(url, {
    method,
    headers: {
      origin: 'https://yemreact.test',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

function insertReaction(db, code = 'YR-0001') {
  const reaction = {
    code,
    caption: 'يا ساتر',
    situation: 'خبر مفاجئ',
    category: 'shock',
    duration: 1,
    keywords: [],
    publishedAt: '2026-01-01',
    corner: 'tr',
    gradient: 'linear-gradient(155deg,#392b24,#171211)',
    poster: '/media/portrait-1.webp',
    media: '/media/demo-1.mp4',
    isDemo: true,
  };
  db.prepare('INSERT INTO reactions(code,data) VALUES (?,?)').run(code, JSON.stringify(reaction));
  return reaction;
}

test('SQLite upgrades legacy OAuth/report tables without losing report history', () => {
  const data = makeDatabase();
  try {
    const oauthColumns = data.db.pragma('table_info(oauth_flows)').map((column) => column.name);
    const reportColumns = data.db.pragma('table_info(reports)').map((column) => column.name);
    assert.ok(oauthColumns.includes('next'));
    for (const column of ['status', 'resolution', 'reviewed_by', 'reviewed_at', 'review_note'])
      assert.ok(reportColumns.includes(column), `missing ${column}`);
    const oldReport = data.db.prepare('SELECT * FROM reports').get();
    assert.equal(oldReport.code, 'YR-0007');
    assert.equal(oldReport.reason, 'بلاغ قديم');
    assert.equal(oldReport.detail, 'سجل سابق للترقية');
    assert.equal(oldReport.created_at, '2025-01-02T03:04:05.000Z');
    assert.equal(oldReport.status, 'open');
    assert.equal(oldReport.resolution, '');
  } finally {
    data.close();
  }
});

test('Admin report lifecycle filters, audits, hides from public readers, restores and deletes with confirmation flow', async () => {
  const data = makeDatabase();
  try {
    const route = makeApi(data);
    insertReaction(data.db);
    data.db
      .prepare(
        'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('member-1', 'عضو', 'member@example.test', 'unused', 'member', new Date().toISOString());
    data.db
      .prepare(
        'INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)',
      )
      .run('admin-1', 'مشرف', 'admin@example.test', 'unused', 'admin', new Date().toISOString());
    insertReaction(data.db, 'YR-0002');
    data.db.prepare('INSERT INTO saved(user_id,code) VALUES (?,?)').run('member-1', 'YR-0001');
    data.db
      .prepare('INSERT INTO collections(slug,title,created_at) VALUES (?,?,?)')
      .run('test', 'مجموعة اختبار', new Date().toISOString());
    data.db
      .prepare('INSERT INTO collection_items(slug,code,position) VALUES (?,?,?)')
      .run('test', 'YR-0001', 0);

    const created = await route.POST(
      request('https://yemreact.test/api/reports', {
        method: 'POST',
        body: { code: 'YR-0001', reason: 'محتوى غير مناسب', detail: 'يرجى المراجعة' },
      }),
    );
    assert.equal(created.status, 200);
    const id = data.db.prepare("SELECT id FROM reports WHERE code='YR-0001'").get().id;
    assert.equal(data.findReaction('YR-0001').caption, 'يا ساتر');

    const startReview = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id, action: 'review', note: 'جارٍ التحقق' },
      }),
    );
    assert.equal(startReview.status, 200);
    let report = data.db.prepare('SELECT * FROM reports WHERE id=?').get(id);
    assert.equal(report.status, 'reviewing');
    assert.equal(report.review_note, 'جارٍ التحقق');
    assert.equal(report.reviewed_by, 'admin-1');
    assert.ok(report.reviewed_at);
    const reviewing = await (
      await route.GET(request('https://yemreact.test/api/reports?status=reviewing'))
    ).json();
    assert.equal(reviewing.reports[0].status, 'reviewing');
    assert.equal(reviewing.reports[0].reviewed_by_name, 'مشرف');

    const hidden = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id, action: 'hide', note: 'إخفاء مؤقت للمراجعة' },
      }),
    );
    assert.equal(hidden.status, 200);
    assert.equal(data.findReaction('YR-0001'), undefined);
    assert.equal(
      data.listReactions().some((item) => item.code === 'YR-0001'),
      false,
    );
    assert.equal(data.findReactionIncludingHidden('YR-0001').caption, 'يا ساتر');
    let list = await (await route.GET(request('https://yemreact.test/api/reports'))).json();
    assert.equal(list.reports[0].hidden, true);
    assert.equal(list.reports[0].caption, 'يا ساتر');

    const restored = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id, action: 'restore', note: 'تمت المعالجة وإعادة الإظهار' },
      }),
    );
    assert.equal(restored.status, 200);
    assert.equal(data.findReaction('YR-0001').caption, 'يا ساتر');

    const deleted = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id, action: 'delete', note: 'حذف بعد التحقق' },
      }),
    );
    assert.equal(deleted.status, 200);
    assert.equal(data.findReactionIncludingHidden('YR-0001'), undefined);
    assert.equal(data.db.prepare('SELECT COUNT(*) AS count FROM saved').get().count, 0);
    assert.equal(data.db.prepare('SELECT COUNT(*) AS count FROM collection_items').get().count, 0);
    report = data.db.prepare('SELECT * FROM reports WHERE id=?').get(id);
    assert.equal(report.status, 'resolved');
    assert.equal(report.resolution, 'delete');
    assert.equal(report.review_note, 'حذف بعد التحقق');
    assert.equal(
      data.db.prepare("SELECT COUNT(*) AS count FROM audit WHERE action='report-delete'").get()
        .count,
      1,
    );
    list = await (
      await route.GET(request('https://yemreact.test/api/reports?status=resolved'))
    ).json();
    assert.equal(list.reports[0].resolution, 'delete');

    const kept = await route.POST(
      request('https://yemreact.test/api/reports', {
        method: 'POST',
        body: { code: 'YR-0002', reason: 'أخرى' },
      }),
    );
    assert.equal(kept.status, 200);
    const keepId = data.db.prepare("SELECT id FROM reports WHERE code='YR-0002'").get().id;
    const keepResponse = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id: keepId, action: 'keep', note: 'المحتوى مناسب' },
      }),
    );
    assert.equal(keepResponse.status, 200);
    const keepReport = data.db.prepare('SELECT * FROM reports WHERE id=?').get(keepId);
    assert.equal(keepReport.status, 'resolved');
    assert.equal(keepReport.resolution, 'keep');
    assert.equal(keepReport.review_note, 'المحتوى مناسب');
    assert.equal(data.findReaction('YR-0002').caption, 'يا ساتر');
  } finally {
    data.close();
  }
});

test('Report mutations reject cross-origin requests and non-admin callers', async () => {
  const data = makeDatabase();
  try {
    insertReaction(data.db);
    data.db
      .prepare('INSERT INTO reports(code,reason,detail,created_at) VALUES (?,?,?,?)')
      .run('YR-0001', 'أخرى', '', new Date().toISOString());
    const id = data.db.prepare('SELECT id FROM reports').get().id;
    const route = makeApi(data, false);
    const forbidden = await route.PATCH(
      request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        body: { id, action: 'hide' },
      }),
    );
    assert.equal(forbidden.status, 403);
    const crossOrigin = await route.PATCH(
      new Request('https://yemreact.test/api/reports', {
        method: 'PATCH',
        headers: { origin: 'https://attacker.test', 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'hide' }),
      }),
    );
    assert.equal(crossOrigin.status, 403);
    assert.equal(data.findReaction('YR-0001').caption, 'يا ساتر');
    assert.equal(data.db.prepare('SELECT status FROM reports WHERE id=?').get(id).status, 'open');
  } finally {
    data.close();
  }
});
