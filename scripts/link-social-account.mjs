import Database from 'better-sqlite3';
import path from 'node:path';
// Operator-only migration. Verify the provider subject independently; email alone is insufficient.
const userId = process.env.LINK_USER_ID?.trim();
const provider = process.env.LINK_PROVIDER?.trim();
let issuer = process.env.LINK_ISSUER?.trim();
const subject = process.env.LINK_SUBJECT?.trim();
if (provider === 'google' && issuer === 'accounts.google.com')
  issuer = 'https://accounts.google.com';
const validIssuer =
  provider === 'google'
    ? issuer === 'https://accounts.google.com'
    : provider === 'apple'
      ? issuer === 'https://appleid.apple.com'
      : provider === 'microsoft' &&
        /^https:\/\/login\.microsoftonline\.com\/[a-f0-9-]{36}\/v2\.0$/.test(issuer || '');
if (
  !userId ||
  !validIssuer ||
  !subject ||
  subject.length > 512 ||
  process.env.LINK_CONFIRMED !== 'yes'
) {
  throw Error(
    'Provide LINK_USER_ID, LINK_PROVIDER, LINK_ISSUER, LINK_SUBJECT and LINK_CONFIRMED=yes after independently verifying account ownership.',
  );
}
const db = new Database(
  path.join(path.resolve(process.env.DATA_DIR || 'data'), 'yemreact.sqlite'),
  { fileMustExist: true },
);
db.pragma('foreign_keys = ON');
try {
  db.transaction(() => {
    if (!db.prepare('SELECT id FROM users WHERE id=?').get(userId))
      throw Error('Existing local user not found.');
    const existing = db
      .prepare('SELECT user_id FROM oauth_accounts WHERE provider=? AND issuer=? AND subject=?')
      .get(provider, issuer, subject);
    if (existing && existing.user_id !== userId)
      throw Error('Identity already belongs to another account; refusing to reassign it.');
    db.prepare('INSERT OR IGNORE INTO oauth_accounts VALUES (?,?,?,?,?)').run(
      provider,
      issuer,
      subject,
      userId,
      new Date().toISOString(),
    );
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    db.prepare('INSERT INTO audit(user_id,action,detail,created_at) VALUES (?,?,?,?)').run(
      userId,
      'social-link-migration',
      provider,
      new Date().toISOString(),
    );
    console.log('Social identity linked to existing user:', userId, '— sign in again.');
  })();
} finally {
  db.close();
}
