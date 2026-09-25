import 'server-only';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { REACTIONS, type Reaction } from '@/lib/reactions';
const dir = path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(dir, { recursive: true });
const globalDb = globalThis as unknown as { yemDb?: Database.Database };
/** Single-node SQLite. A persistent DATA_DIR is required in production. */
export const db = globalDb.yemDb ?? new Database(path.join(dir, 'yemreact.sqlite'));
if (process.env.NODE_ENV !== 'production') globalDb.yemDb = db;
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS oauth_accounts(provider TEXT NOT NULL,issuer TEXT NOT NULL,subject TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at TEXT NOT NULL,PRIMARY KEY(provider,issuer,subject));
 CREATE TABLE IF NOT EXISTS oauth_flows(state_hash TEXT PRIMARY KEY,provider TEXT NOT NULL,browser_hash TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_oauth_flows_expiry ON oauth_flows(expires);
 CREATE TABLE IF NOT EXISTS reactions(code TEXT PRIMARY KEY,data TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS saved(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,code TEXT NOT NULL REFERENCES reactions(code) ON DELETE CASCADE,PRIMARY KEY(user_id,code));
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,code TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS collections(slug TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',cover_code TEXT REFERENCES reactions(code) ON DELETE SET NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'thematic');
 CREATE TABLE IF NOT EXISTS collection_items(slug TEXT NOT NULL REFERENCES collections(slug) ON DELETE CASCADE,code TEXT NOT NULL REFERENCES reactions(code) ON DELETE CASCADE,position INTEGER NOT NULL,PRIMARY KEY(slug,code));
 CREATE INDEX IF NOT EXISTS idx_collection_items_code ON collection_items(code);
 CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL,reason TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
 CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
 CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires);
`);
// Existing preview databases may have been created before curated kinds were introduced.
if (
  !(db.pragma('table_info(collections)') as { name: string }[]).some(
    (column) => column.name === 'kind',
  )
)
  db.exec("ALTER TABLE collections ADD COLUMN kind TEXT NOT NULL DEFAULT 'thematic'");
if (!db.prepare("SELECT value FROM meta WHERE key='seeded'").get())
  db.transaction(() => {
    const put = db.prepare('INSERT OR IGNORE INTO reactions(code,data) VALUES (?,?)');
    REACTIONS.forEach((r) => put.run(r.code, JSON.stringify(r)));
    db.prepare("INSERT INTO meta(key,value) VALUES ('seeded','1')").run();
  })();
// Only curated links to the existing demo clips: no synthetic public reactions are created.
// The marker prevents deleted example collections from reappearing after a restart.
if (!db.prepare("SELECT value FROM meta WHERE key='collections-curated-v1'").get())
  db.transaction(() => {
    const examples = [
      {
        slug: 'students',
        title: 'طلاب',
        description: 'ردود لدوام الدراسة، والتفاجؤ، والنجاح.',
        codes: ['YR-0002', 'YR-0005', 'YR-0009'],
      },
      {
        slug: 'groups',
        title: 'قروبات',
        description: 'لقطات جاهزة لمحادثات القروبات.',
        coverCode: 'YR-0006',
        codes: ['YR-0003', 'YR-0006', 'YR-0011'],
      },
      {
        slug: 'out-of-context',
        title: 'بلا سياق',
        description: 'ردود مختصرة تشتغل في أكثر من حكاية.',
        codes: ['YR-0001', 'YR-0007'],
      },
    ];
    const put = db.prepare(
      'INSERT OR IGNORE INTO collections(slug,title,description,cover_code,active,created_at) VALUES (?,?,?,?,1,?)',
    );
    const join = db.prepare(
      'INSERT OR IGNORE INTO collection_items(slug,code,position) VALUES (?,?,?)',
    );
    examples.forEach((example, index) => {
      if (
        !example.codes.every((code) => db.prepare('SELECT 1 FROM reactions WHERE code=?').get(code))
      )
        return;
      const result = put.run(
        example.slug,
        example.title,
        example.description,
        example.coverCode || example.codes[0],
        new Date(Date.now() + index).toISOString(),
      );
      if (result.changes)
        example.codes.forEach((code, position) => join.run(example.slug, code, position));
    });
    db.prepare("INSERT INTO meta(key,value) VALUES ('collections-curated-v1','1')").run();
  })();
export const listReactions = () =>
  (db.prepare('SELECT data FROM reactions ORDER BY code').all() as { data: string }[]).map(
    (r) => JSON.parse(r.data) as Reaction,
  );
export const findReaction = (code: string) => {
  const r = db.prepare('SELECT data FROM reactions WHERE code=?').get(code) as
    { data: string } | undefined;
  return r ? (JSON.parse(r.data) as Reaction) : undefined;
};
export const audit = (id: string, action: string, detail: string) =>
  db
    .prepare('INSERT INTO audit(user_id,action,detail,created_at) VALUES (?,?,?,?)')
    .run(id, action, detail, new Date().toISOString());
