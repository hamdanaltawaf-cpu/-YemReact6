# HTTP API

All endpoints are same-origin Next route handlers. JSON responses use UTF-8. Authentication uses the `yr_session` HttpOnly cookie. Protected/private GET responses are `Cache-Control: no-store`.

Mutations (except provider callbacks validated by state/nonce/browser binding) require an `Origin` host matching the request host/trusted `X-Forwarded-Host`. Behind a proxy, strip untrusted forwarding headers and set them yourself. Browser code only calls relative URLs.

| Method              | Endpoint                              | Access                  | Body / result                                                                                                                                   |
| ------------------- | ------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| GET                 | `/api/reactions`                      | public                  | `{reactions: Reaction[]}`                                                                                                                       |
| GET                 | `/api/collections`                    | public                  | `{collections: Collection[]}`; active, nonempty only                                                                                            |
| GET                 | `/api/collections?scope=admin`        | owner                   | includes inactive collections, edit members                                                                                                     |
| POST / PUT / DELETE | `/api/collections`                    | owner                   | curated collection create/update/delete; `slug`, `kind` (`thematic/person/place`), `title`, `description`, `coverCode`, `memberCodes`, `active` |
| POST                | `/api/reports`                        | public, limited         | `{code,reason,detail?}`; server-validates and stores report                                                                                     |
| GET                 | `/api/reports`                        | owner                   | most recent 100 reports                                                                                                                         |
| POST                | `/api/reactions`                      | owner                   | validated `Reaction`; create or update by `code`                                                                                                |
| DELETE              | `/api/reactions`                      | owner                   | `{code}`; deletes record and account bookmarks                                                                                                  |
| GET                 | `/api/auth`                           | public                  | `{user: {id,name,email,role} \| null}`                                                                                                          |
| POST                | `/api/auth`                           | retired                 | HTTP 410; no password authentication                                                                                                            |
| GET                 | `/api/auth/oauth/[provider]`          | public, limited         | starts configured provider authorization; 303 redirect                                                                                          |
| GET/POST            | `/api/auth/oauth/[provider]/callback` | state + browser binding | Google/Microsoft GET, Apple POST; validated OIDC then session                                                                                   |
| DELETE              | `/api/auth`                           | same-origin             | revokes current session, clears cookie                                                                                                          |
| GET                 | `/api/saved`                          | signed-in               | `{saved: string[]}`                                                                                                                             |
| PUT                 | `/api/saved`                          | signed-in               | `{code,saved:boolean}`; idempotent intent                                                                                                       |
| POST                | `/api/events`                         | public, limited         | `{kind:'play'\|'download'\|'share',code}`                                                                                                       |
| GET                 | `/api/admin`                          | owner                   | counts, last 7 days, last 100 users, last 40 audit entries                                                                                      |
| POST                | `/api/upload`                         | owner, limited          | multipart `file`; returns `{url,type,duration?}` (measured duration for videos)                                                                 |
| GET                 | `/api/media/[name]`                   | public                  | local file; supports one HTTP byte range                                                                                                        |

## Reaction schema

```ts
type Reaction = {
  code: string; // YR-[A-Z0-9-]{4,32}
  caption: string; // required primary title/description, 1..100
  situation: string; // optional secondary description; empty string if absent
  characterName?: string; // optional non-interactive detail-only chip
  category: CategoryId; // legacy storage; collections are the public curation
  type: 'image' | 'video'; // verified from bytes on publication
  duration: number | null; // video seconds; null for images
  mimeType: string;
  mediaVerified: true;
  mediaSha256: string;
  width: number;
  height: number;
  keywords: string[];
  publishedAt: string; // YYYY-MM-DD
  poster: string; // allowlisted local image path
  media: string; // allowlisted, file-verified image or video path
  isDemo: boolean;
  corner: 'tr' | 'tl'; // legacy metadata
  gradient: string; // legacy metadata
};
```

Seed media cannot be relabelled as authentic: a `/media/demo-*.mp4` record must have `isDemo:true`. Unverified types or client-supplied durations cannot produce video duration badges. All user-provided display text is rendered as text, never HTML. There is no arbitrary remote URL fetching.

## Authentication

- Registration always creates `member`, never `admin`.
- Google/Apple/Microsoft Authorization Code + signed OIDC identities; see SOCIAL-AUTH.md.
- No automatic email-based linking. Password authentication is retired.
- Random 32-byte session token; only its SHA-256 digest enters the database.
- Session duration: 7 days. Cookie: HttpOnly, SameSite=Lax, Secure in production.
- CLI social-owner provisioning or identity migration revokes that account's sessions.
- OAuth starts: 20 per 15-minute process/IP bucket; uploads: 25; events: 120.
- Collection changes: 30 per process/IP bucket; reports: 8. Buckets are in-memory and reset at restart; not distributed, not a complete abuse-prevention system.

## Uploads

Maximum file size 15MiB. JPEG, PNG and WebP are signature-checked and pixel-decoded with Sharp; MP4/WebM streams are checked with FFprobe. Animated images are rejected. SVG/HTML are rejected. Stored filenames are UUIDs, never original client paths. Client and server enforce an inclusive 2–60 second duration policy for videos; images have null duration. Uploads are probed with FFprobe before public storage; publication re-probes the local file and saves verified type, MIME, dimensions, SHA-256 and measured duration rather than trusting client metadata. Video uploads return an extracted poster; image publication uses the image itself as poster. See VERIFIED-MEDIA.md for the shared rendering contract and migration. Invalid or unreadable durations are rejected, not rounded or clamped into range. The server does **not** decode/transcode every video frame; reverse-proxy body limits and a quarantined scanner/transcoder are required before untrusted public uploads are enabled.

Media is publicly readable by URL after upload; do not upload private documents. Deleting a reaction deliberately does not delete disk media because other entries may share it.

## Error contract

`{error: string}` with appropriate status:

- 400 invalid schema/JSON/file format.
- 401 no valid session / wrong credentials.
- 403 non-owner or cross-origin mutation.
- 404 missing record/media.
- 409 unavailable registration email.
- 413 oversized declared upload.
- 416 unsupported/invalid byte range.
- 429 rate limit.
- 500 generic server failure; details are not returned to the client.

The API is REST, not GraphQL. Social login needs configured provider applications; see SOCIAL-AUTH.md.
