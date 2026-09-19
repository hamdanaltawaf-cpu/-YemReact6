# Deployment and operations

## Requirements

Node.js 20.20+ or a compatible maintained LTS, pnpm 10.28.2, a persistent Linux host/container with writable storage, and HTTPS through a trusted reverse proxy. SQLite needs a persistent local disk; this is **not** a ready-made stateless Vercel/edge deployment.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set NEXT_PUBLIC_SITE_URL to your real HTTPS origin; set DATA_DIR to a mounted volume.
pnpm build
pnpm start
```

The server binds `0.0.0.0:3000`. Use a process manager/systemd/container restart policy in production. The preview platform can proxy that port. No browser code calls localhost directly; requests are relative.

For development:

```bash
pnpm dev
pnpm typecheck
pnpm test
pnpm format:check
```

`pnpm admin:create` reads process environment variables; it does not automatically load `.env.local`. Provision the owner as described in `ADMIN-GUIDE.md`.

## Origin and metadata configuration

`NEXT_PUBLIC_SITE_URL` must be the actual public HTTPS URL **before building**. The localhost default is a development placeholder, not a deployable canonical domain. This value controls metadata base, sitemap and JSON-LD search URLs. Public detail pages have canonical paths and share cards. Account/private pages are excluded from robots/indexing, which is not a substitute for authentication.

## Persistent volume

Mount one directory for `yemreact.sqlite`, its WAL/SHM files and `uploads/`. Back it up as a unit with a safe SQLite backup procedure. Do not commit it to source control. The delivered source archive excludes database contents and credentials.

## Proxy/security checklist before internet exposure

- Terminate TLS, redirect HTTP to HTTPS, and enable HSTS on your real domain.
- Strip incoming `X-Forwarded-*` headers, then set trusted host/client-IP headers.
- Enforce a 16MiB request-body limit and sensible request/upload timeouts at the proxy.
- Keep one app instance until shared database/storage/rate limiting is configured.
- Keep owner credentials unique; no seeded administrator password is shipped.
- Add distributed rate limits, suspicious-auth monitoring, password reset/email verification and preferably owner 2FA.
- Add a media quarantine/transcoding/scanning pipeline before allowing non-owner uploads.
- Set a reviewed Content Security Policy for your deployment. It is not enforced here because Next runtime/inline theme bootstrap require a deliberate nonce policy.
- Apply a reviewed `frame-ancestors` policy outside the embedded preview environment.
- Review dependency security advisories and run an independent security assessment.
- Configure encrypted backups, tested restore, retention and account deletion procedures.

Existing headers include `nosniff`, a conservative referrer policy and denied camera/microphone/geolocation. They are a baseline, not a complete security certification.

## PWA

Production builds register `/sw.js`. It precaches the offline page and its script/style references. Public navigations are network-first, static assets cache-first, with a bounded 160-entry versioned cache. Old YemReact caches are removed on activation.

No API, account page, uploaded file or video is cached by the service worker. Browser-installed PWA availability depends on HTTPS and browser support. The install button appears only when a real `beforeinstallprompt` event is received. Do not claim that all videos or account features work offline.

## Validation tooling

```bash
npm ci --prefix verification/tools
npx --prefix verification/tools playwright install --with-deps chromium
node verification/flows.cjs
node verification/a11y.cjs
node verification/responsive.cjs
```

Run on a disposable test database with the server at `http://127.0.0.1:3000`. The workflow test provisions temporary QA users, exercises admin CRUD/uploads and cleans its fixtures. Never point fixture-mutating tests at a live user database.

Testing notes and measured limitations are in `QUALITY-REPORT.md`. Lighthouse lab measurements are not field Web Vitals guarantees.
