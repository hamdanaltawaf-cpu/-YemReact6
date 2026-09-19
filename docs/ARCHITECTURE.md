# Architecture & scope decisions

## Product boundary

YemReact is a situation-indexed reaction library, not a social network or shop. The rebuild adds the missing discovery → preview → save → download/share workflow and an actual owner CMS. It deliberately does **not** add payments, pricing, a blog, comments, public follower counts, invented testimonials, WebGL, an external analytics SDK, or AI API calls. None helps the core workflow enough to justify its cost or privacy/accessibility burden here.

This is a tested **single-node full-stack preview**, not a claim of audited enterprise readiness.

## Stack

- Next.js 15.5.23, App Router, React 19.2, strict TypeScript.
- Cairo variable body font, Lalezar display font, IBM Plex Mono technical labels; self-hosted by `next/font` after build.
- Semantic CSS tokens, Tailwind v4 available for utilities; explicit source directory avoids scanning logs/tooling.
- Framer Motion in the on-demand media lightbox; compositor-friendly CSS for the hero and other motion.
- React context for app-wide state. Unused Zustand and React Compiler dependencies from the baseline were removed.
- SQLite (`better-sqlite3`), WAL, parameterized SQL, foreign-key enforcement.
- Local filesystem media with bounded-size upload acceptance and HTTP byte ranges.
- Zod validation; Node scrypt for password derivation.

## Component boundaries

```text
src/app/                 routing, metadata, API route adapters
src/features/            page-level workflows (Home, Library, Detail, Auth, Admin)
src/components/          shared organisms and molecules
src/components/ui/       native-dialog primitive
src/lib/                 domain types, categories, seed records, pure search
src/server/              server-only database, sessions, authorization, errors
public/media/            clearly identified demo images and videos
public/sw.js             public-content-only service worker
scripts/create-admin.mjs privileged owner provisioning, outside public HTTP
```

The exact folder names are not the architecture: domain logic, persistence, HTTP boundaries and UI state are deliberately separated.

## Data flow

1. The root server layout loads the public library and passes serializable records to `AppProvider`.
2. Clients never import database/auth modules; `server-only` enforces the boundary.
3. Search/filter/sort run locally for this small catalog. Query and category have shareable URLs; sorting and duration are session UI state.
4. Anonymous bookmarks live in `yr:guest-saved`. Account bookmarks use `/api/saved`. These are separate collections, not silently merged.
5. Mutations use same-origin requests, then session and role checks, then schema validation and SQL.
6. The editor refreshes the catalog after success. Database deletion cascades account bookmarks. Unreferenced media remain on disk pending deliberate cleanup.
7. Aggregate events contain kind/code/timestamp only. They are approximate action counts, **not unique people or trusted billing metrics**.

## Important limitations

- This deployment is not horizontally scalable: local SQLite, local uploads and process-local rate-limit buckets assume one application instance.
- No email verification, password-reset service, OAuth providers, 2FA, self-service account deletion or external object storage is configured.
- The user management view lists the latest 100 accounts. Owner promotion is CLI-only, not an unrestricted browser endpoint.
- File signatures and client-side video duration are checked; this is not malware scanning, a sandboxed transcoder, or server-side codec/duration verification.
- Photos and demo MP4s are original AI-generated still portraits animated by a zoom, not authentic footage. Labeling is present in hero, gallery, player, details and policy copy.
- No WCAG AAA certificate, global performance SLA, independent penetration test or load-test claim is made.

## Scaling path

Move uploads to object storage/CDN, use signed uploads + a quarantined transcoding/rights-review queue, replace local buckets with distributed limiting, and migrate SQL to Postgres only when multiple nodes are actually needed. Keep the existing public UI/domain contract. Module federation and a monorepo are not justified for this application size.
