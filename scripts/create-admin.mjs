import Database from 'better-sqlite3';
import path from 'node:path';
// Promote only an existing, socially authenticated account. No password provisioning.
const id = process.env.ADMIN_USER_ID?.trim();
if (!id)
  throw Error('Set ADMIN_USER_ID to an existing social account ID. See docs/SOCIAL-AUTH.md.');
const db = new Database(
  path.join(path.resolve(process.env.DATA_DIR || 'data'), 'yemreact.sqlite'),
  { fileMustExist: true },
);
db.pragma('foreign_keys = ON');
try {
  db.transaction(() => {
    const user = db
      .prepare(
        'SELECT u.id,u.name FROM users u WHERE u.id=? AND EXISTS (SELECT 1 FROM oauth_accounts a WHERE a.user_id=u.id)',
      )
      .get(id);
    if (!user)
      throw Error(
        'No socially linked account with this ID. Sign in using a configured provider first.',
      );
    db.prepare("UPDATE users SET role='admin' WHERE id=?").run(id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    db.prepare('INSERT INTO audit(user_id,action,detail,created_at) VALUES (?,?,?,?)').run(
      id,
      'admin-provision',
      'Server operator promoted a social account',
      new Date().toISOString(),
    );
    console.log('Administrator provisioned:', user.id, user.name, '— sign in again.');
  })();
} finally {
  db.close();
}
