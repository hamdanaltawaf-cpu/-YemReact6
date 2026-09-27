# Architecture & scope decisions

## Product boundary

YemReact is a situation-indexed reaction library, not a social network or shop. The rebuild adds the missing discovery → detail → save → download/share workflow and an actual owner CMS. It deliberately does **not** add payments, pricing, a blog, comments, public follower counts, invented testimonials, WebGL, an external analytics SDK, or AI API calls. None helps the core workflow enough to justify its cost or privacy/accessibility burden here.

This is a tested **single-node full-stack preview**, not a claim of audited enterprise readiness.

## Stack

- Next.js 15.5.23, App Router, React 19.2, strict TypeScript.
- IBM Plex Sans Arabic for Arabic UI, Inter for Latin, IBM Plex Mono for numeric/technical labels, and Lalezar for the Header wordmark only; bundled locally after build.
- Semantic CSS tokens, Tailwind v4 available for utilities; explicit source directory avoids scanning logs/tooling.
- Framer Motion remains available for the admin-only media lightbox; public card hover uses CSS and silent video playback only when motion is allowed.
- React context for app-wide state. Unused Zustand and React Compiler dependencies from the baseline were removed.
- SQLite (`better-sqlite3`), WAL, parameterized SQL, foreign-key enforcement.
- Local filesystem media with bounded-size upload acceptance and HTTP byte ranges.
- Zod validation; jose for provider-signed OIDC tokens; social-only authentication.

## Component boundaries

```text
src/app/                 routing, metadata, API route adapters
src/features/            page-level workflows (Library, Collections, Contribution, Detail, Auth, Admin)
src/components/          shared organisms and molecules
src/components/ui/       native-dialog primitive
src/lib/                 domain types, collections, legacy categories, seed records, pure search
src/server/              server-only database, sessions, authorization, errors
public/media/            clearly identified demo images and videos
public/sw.js             public-content-only service worker
scripts/create-admin.mjs privileged owner provisioning, outside public HTTP
```

The exact folder names are not the architecture: domain logic, persistence, HTTP boundaries and UI state are deliberately separated.

## Data flow

1. The root server layout loads the public library and passes serializable records to `AppProvider`.
2. Clients never import database/auth modules; `server-only` enforces the boundary.
3. The public library renders its curated complete catalog without infinite scrolling, sorting controls or category filters. Legacy search/category query URLs still resolve; server-backed collections are the primary public curation.
4. Anonymous bookmarks live in `yr:guest-saved`. Account bookmarks use `/api/saved`. These are separate collections, not silently merged.
5. Mutations use same-origin requests, then session and role checks, then schema validation and SQL.
6. The editor refreshes the catalog after success. Admin-managed collection membership is independent of legacy categories; reaction deletion cascades collection membership and account bookmarks. Reports are stored for admin review only. Unreferenced media remain on disk pending deliberate cleanup.
7. Aggregate events contain kind/code/timestamp only. They are approximate action counts, **not unique people or trusted billing metrics**.

## Important limitations

- This deployment is not horizontally scalable: local SQLite, local uploads and process-local rate-limit buckets assume one application instance.
- OAuth routes are implemented for Google/Apple/Microsoft but need provider credentials and live testing. No local passwords, self-service provider linking, site-managed 2FA, account deletion or external object storage. See SOCIAL-AUTH.md.
- The user management view lists the latest 100 accounts. Owner promotion is CLI-only, not an unrestricted browser endpoint.
- File bytes determine server-verified image/video metadata. Sharp decodes images, FFprobe checks video structure/duration, and FFmpeg extracts video covers. Upload and publication both verify files. A startup migration updates existing JSON in place with a SQLite snapshot, preserving saves. Shared viewers use verified metadata, never extensions. See VERIFIED-MEDIA.md. This is not malware scanning, complete video decoding or a sandboxed transcoder.
- The seeded MP4s animate original AI-generated portraits; they are not authentic footage. Disclosure is present in the detail player text, help and privacy copy, but not as a watermark or label overlay on cards/media.
- No WCAG AAA certificate, global performance SLA, independent penetration test or load-test claim is made.

## Scaling path

Move uploads to object storage/CDN, use signed uploads + a quarantined transcoding/rights-review queue, replace local buckets with distributed limiting, and migrate SQL to Postgres only when multiple nodes are actually needed. Keep the existing public UI/domain contract. Module federation and a monorepo are not justified for this application size.
