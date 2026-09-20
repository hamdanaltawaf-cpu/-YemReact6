# Next release priorities

## P0 — before a public launch

- Replace demo zoom videos with genuinely licensed Yemeni clips, with source/rights records and a removal channel.
- Add captions/transcripts for every real audio clip; retain keyboard-native controls.
- Secure production origin/TLS, persistent volume, backups, upload quotas/body limits and operational monitoring.
- Add email verification, recovery, owner 2FA, account deletion and clear retention policy.
- Duration metadata verification is enforced on upload/publish. Add full server-side media decoding, malware scanning and thumbnail generation in a quarantined worker.
- Independent security review, assistive-technology testing, and field performance instrumentation with privacy consent where required.

## P1 — useful product growth

- More curated clips and better Arabic synonyms/ranking; indexed server search once the catalog grows.
- Intentional import/merge of guest bookmarks into an account, with confirmation.
- Collections/folders and multi-select exports, without public likes or follower systems.
- File deduplication, quotas and safe orphaned-file cleanup.
- Reviewed deployment CSP/nonces, distributed rate limiter, database migrations and automated restore testing.
- Stronger contrast/target-size audit across all themes and owner editor states; test screen readers and zoom to 400%.

## P2 — only if justified

- Social OAuth routes are implemented; configure and live-test Google/Apple/Microsoft before enabling them. See SOCIAL-AUTH.md.
- Object storage/CDN and Postgres when multi-instance deployment is required.
- Bilingual UI after Arabic content/workflows are complete.
- Privacy-preserving search quality reporting; no advertising analytics by default.

No roadmap item should add a pricing page, payments, comments or heavy 3D effects merely because the technology exists.
