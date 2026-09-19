import Database from 'better-sqlite3';
import { scryptSync, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
  password = process.env.ADMIN_PASSWORD;
if (!email || !/^.+@.+\..+$/.test(email) || !password || password.length < 12)
  throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).');
const dir = path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(dir, { recursive: true });
const db = new Database(path.join(dir, 'yemreact.sqlite'));
db.exec(
  "CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'member',created_at TEXT NOT NULL)",
);
const salt = randomBytes(16).toString('hex'),
  hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
db.prepare(
  "INSERT INTO users VALUES (?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET role='admin',password_hash=excluded.password_hash",
).run(randomUUID(), 'مالك المكتبة', email, hash, 'admin', new Date().toISOString());
if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").get()) {
  db.prepare('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)').run(email);
}
console.log('Administrator provisioned:', email);
db.close();
