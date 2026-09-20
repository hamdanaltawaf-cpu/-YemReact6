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
 CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
 CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires);
`);
if (!db.prepare("SELECT value FROM meta WHERE key='seeded'").get())
  db.transaction(() => {
    const put = db.prepare('INSERT OR IGNORE INTO reactions(code,data) VALUES (?,?)');
    REACTIONS.forEach((r) => put.run(r.code, JSON.stringify(r)));
    db.prepare("INSERT INTO meta(key,value) VALUES ('seeded','1')").run();
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
