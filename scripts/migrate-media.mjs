import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { mkdir, chmod } from 'node:fs/promises';
import path from 'node:path';
import { inspectStoredMedia, MEDIA_METADATA_VERSION } from './media-inspection.mjs';
import { loadAppEnvironment } from './load-env.mjs';
loadAppEnvironment(process.argv.includes('--dev'));
const root = path.resolve(process.env.DATA_DIR || 'data'),
  file = path.join(root, 'yemreact.sqlite');
if (existsSync(file)) {
  const db = new Database(file, { fileMustExist: true });
  db.pragma('busy_timeout = 15000');
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='reactions'")
      .get();
    if (table) {
      const pending = db
        .prepare('SELECT code,data FROM reactions')
        .all()
        .filter((row) => JSON.parse(row.data).mediaMetadataVersion !== MEDIA_METADATA_VERSION);
      if (pending.length) {
        const backups = path.join(root, 'backups');
        await mkdir(backups, { recursive: true, mode: 0o700 });
        await chmod(backups, 0o700);
        const backup = path.join(backups, 'before-media-v1-' + Date.now() + '.sqlite');
        await db.backup(backup);
        await chmod(backup, 0o600);
        const cache = new Map(),
          updates = [];
        let verified = 0,
          unavailable = 0;
        for (const row of pending) {
          const reaction = JSON.parse(row.data);
          let metadata;
          try {
            if (!cache.has(reaction.media))
              cache.set(reaction.media, await inspectStoredMedia(reaction.media));
            metadata = cache.get(reaction.media);
            verified++;
          } catch (e) {
            if (e.status === 503) throw e; // Do not rewrite valid records when the verifier is unavailable.
            metadata = {
              type: 'unknown',
              mimeType: null,
              duration: null,
              width: null,
              height: null,
              mediaVerified: false,
              mediaMetadataVersion: MEDIA_METADATA_VERSION,
            };
            unavailable++;
          }
          updates.push({
            ...row,
            next: JSON.stringify({
              ...reaction,
              ...metadata,
              ...(metadata.type === 'image' ? { poster: reaction.media } : {}),
            }),
          });
        }
        db.transaction(() => {
          const update = db.prepare('UPDATE reactions SET data=? WHERE code=? AND data=?');
          for (const row of updates) update.run(row.next, row.code, row.data);
        })();
        console.log(
          `Media migration: ${verified} verified, ${unavailable} unavailable. IDs and bookmarks preserved; pre-migration snapshot created.`,
        );
      }
    }
  } finally {
    db.close();
  }
}
