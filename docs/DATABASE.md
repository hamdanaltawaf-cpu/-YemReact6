# SQLite schema and operational notes

Location: `${DATA_DIR || './data'}/yemreact.sqlite`. WAL journaling, foreign keys and a 5-second busy timeout are enabled by the application. A fresh database seeds twelve demo media records and three curated collections (3 + 3 + 2 memberships), each exactly once using separate `meta` markers; clearing them does not silently recreate them.

```sql
users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL
);
sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
reactions (code TEXT PRIMARY KEY, data TEXT NOT NULL);
collections (
  slug TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'thematic',
  cover_code TEXT REFERENCES reactions(code) ON DELETE SET NULL,
  active INTEGER NOT NULL, created_at TEXT NOT NULL
);
collection_items (
  slug TEXT REFERENCES collections(slug) ON DELETE CASCADE,
  code TEXT REFERENCES reactions(code) ON DELETE CASCADE,
  position INTEGER NOT NULL, PRIMARY KEY(slug, code)
);
reports (id INTEGER PRIMARY KEY, code TEXT, reason TEXT, detail TEXT, created_at TEXT);
saved (
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  code TEXT REFERENCES reactions(code) ON DELETE CASCADE,
  PRIMARY KEY (user_id, code)
);
events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, code TEXT, created_at TEXT);
audit (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, action TEXT, detail TEXT, created_at TEXT);
meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

Indexes: `events(created_at)`, `sessions(expires)`, `collection_items(code)`, `reports(created_at)`, unique email, and primary keys. Actual nullability and DDL are defined in `src/server/db.ts`; the block above is a relationship overview.

`reactions.data` is validated JSON, keeping the current catalog simple. The catalog is small enough to render as a whole without infinite scrolling; a larger dataset should gain indexed fields and explicit pagination rather than load every item into every layout indefinitely. A reaction may belong to multiple collections independently of its legacy category.

Only public media identifiers are stored in reaction records. Passwords never appear in API responses; plaintext passwords are never stored. Events store no user ID or IP. IP-derived rate-limit keys are transient process memory, not analytics records.

## Backup

Use SQLite's backup API or stop the process before copying. Do not copy only the main `.sqlite` file while WAL writes are in flight. Back up `uploads/` together with the database and keep encrypted off-host copies. Test restore on a separate instance. No automatic backup scheduler is configured in this preview.

## Removal / retention

- Reactions: owner HTTP delete, bookmarks cascade.
- Accounts: no self-service deletion flow yet; an authorized operator must perform a transaction and clear related sessions/bookmarks.
- Media: retained until an operator confirms it is unreferenced.
- Events/audit/reports: no automatic retention job yet; configure one before a public deployment. Reports deliberately keep a code even if its reaction is deleted, for manual investigation.
- Existing preview databases add the `collections.kind` column on startup if absent; future schema changes should introduce numbered migrations. The current bootstrap is not a mature migration system.

## Social-only authentication update

`oauth_accounts(provider,issuer,subject,user_id,created_at)` has a composite identity primary key and a cascading user FK. `oauth_flows(state_hash,provider,browser_hash,nonce,verifier,expires)` stores ten-minute single-use transactions. Raw state/browser binding values, OAuth access tokens and refresh tokens are not persisted. The legacy `users.password_hash` column remains to preserve data compatibility; new accounts store the unusable `social-only` sentinel, and no password endpoint exists. See SOCIAL-AUTH.md for safe legacy migration and unverified/missing email handling.
