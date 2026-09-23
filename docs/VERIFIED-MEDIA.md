# Verified images and videos

## User-facing contract

- Cards use **server-verified `type` and MIME**, not file extensions, duration, poster, or browser MIME. The same helper governs the library, saved items, shared preview/detail player and admin previews.
- Videos always have a top-right **Play + فيديو** badge. A positive known duration appears in seconds; missing/invalid duration never removes video identity or invents a value. Images have an expand affordance, never Play or duration.
- Image → contained image preview. Video → inline native controls, no autoplay. Unknown/unverified metadata → an unavailable message, never a guessed video player; downloading is disabled.
- Type-specific accessible button names, visible keyboard focus, native-dialog focus restoration, 44px save targets, permanent touch cues and reduced-motion handling. Existing public counters/categories/toolbars remain absent.
- The shipped catalog is still twelve demo **videos**. Their static covers were not converted into public image records. Mixed-media verification uses disposable local-only fixtures.

## Data and validation

`Reaction` now carries `type`, `mimeType`, `mediaVerified`, `mediaMetadataVersion`, `mediaSha256`, `width`, `height` and nullable `duration`. Missing/legacy metadata is deliberately unknown to the UI. Optional fields allow old data to fail closed while the startup migration upgrades it.

`/api/upload` remains admin-only, origin-guarded, rate-limited and capped at 15MiB. Bytes are privately staged, signatures classified and then checked with the real decoder/prober:

- JPEG/PNG/WebP: Sharp reads metadata **and decodes pixels**, with a 40-megapixel cap and malformed-image errors. Multi-page/animated inputs are not an accepted publication format.
- MP4/WebM: bounded FFprobe subprocess, local-only protocol and format allowlist, real non-attached-picture video stream and strict inclusive **2–60 seconds**, without pre-validation rounding. An EBML file must identify itself as WebM, not arbitrary Matroska.
- Browser duration preflight uses byte hints, not the browser MIME/filename; a finite out-of-range value fails early. Unreadable/unsupported browser metadata defers to server verification. It is not a security boundary.
- FFmpeg extracts and decodes a thumbnail for new video uploads. The admin can replace it with a verified image. Image publications use the image itself as the canonical poster.
- The upload response includes canonical URLs and metadata. Misleading filenames/MIME are normalized to the detected format. Publication separately verifies the stored local file and poster again; client type/MIME/verification flags are ignored. Image duration becomes `null`, even if stale data contains seconds.
- Stored paths are allowlisted, symlinks/path traversal/remote URLs and extension-content mismatches are rejected. SVG/HTML/GIF are not accepted uploads. Upload/media authorization was not broadened.

FFprobe verifies structure and duration; this is **not** complete frame-by-frame decoding, codec normalization, malware scanning or a sandboxed transcoder. Native playback still depends on the browser's codec support. Existing owner-only uploads and reverse-proxy body limits remain important. Keep Sharp/FFmpeg patched.

## Migration and startup

`scripts/verify-seed-media.mjs` regenerates the checked-in seed manifest from shipped files before build/dev. Do not hand-edit it. FFmpeg/FFprobe are required during **build and runtime**; the Docker stages install them. Sharp is a direct production dependency.

`scripts/migrate-media.mjs` runs before the application starts, after privilege drop in Docker. `pnpm start`/`pnpm dev` also run it. It uses Next's environment-file precedence, with explicit process environment taking priority. `DATA_DIR` must point at the persistent volume. `FFPROBE_PATH` and `FFMPEG_PATH` can override installed binaries.

1. Find pre-v1 reaction JSON rows.
2. Create a SQLite online backup under `DATA_DIR/backups/` (private directory; snapshot mode 0600).
3. Verify local media, caching repeated paths. Valid images get null duration and self-poster. Missing/corrupt files become unavailable, not guessed videos. An unavailable FFprobe **aborts startup**, rather than mislabeling the catalog.
4. Update JSON **in place**, in one transaction, matching original code and data. Never delete/reinsert rows; reaction codes, accounts and saved foreign keys remain intact.
5. Already-v1 rows are untouched on subsequent starts. The verified immutable-file hash is retained for auditing; it is not rehashed on every public read. Repair unavailable records by re-uploading and republishing in the studio.

The automatic snapshot is a rollout safeguard, not an off-host backup strategy. Back up DB and uploads together, and manage snapshot retention operationally. Failed uploads clean their private staging directories. Successfully uploaded but abandoned files still need the existing administrative orphan cleanup policy.

## Verification

- `pnpm test`: server inspection with real JPEG/PNG/WebP/MP4/WebM, corruption, spoofed paths/names, duration boundaries, audio-only and Matroska rejection, migration snapshot/idempotency/bookmark preservation and missing FFprobe behavior; rendering tests cover misleading/extensionless URLs, stale image duration and absent video duration.
- `verification/verified-media.cjs`: uses a disposable production-build DATA_DIR, actual admin sessions/APIs, local-only mixed fixtures with identical covers; 320/375/768/1024/1440/1920 layouts, touch/keyboard/Escape focus, actual video playback and downloaded-byte hash, shared detail viewers, admin image publication, guest/member saves, unknown media and four light/dark reduced-motion axe audits.
- Evidence: `verification/media/`. Browser/device emulation is not a physical iOS/Android certification. Docker is not built locally; production rollout must separately confirm container startup and the live catalog metadata.

Run the browser test against a production build started on port 3100 with `DATA_DIR=$PWD/.cache/media-qa-data` and an explicitly local OAuth origin. Never run fixture-writing scripts against production. The script removes its test records/uploads; the retained screenshots intentionally show synthetic local examples.
