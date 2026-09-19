# Quality & performance report

Tested: **2026-09-19**. Target: local production build of Next.js 15.5.23, Chromium 153, Linux sandbox with about 2GB RAM. Results below describe the tested build and scenarios, not every browser, device or future content upload.

## Verification summary

| Check | Result |
|---|---|
| `pnpm build` | Passed, including TypeScript validity checks |
| `pnpm typecheck` | Passed |
| `pnpm test` | 7/7 pure-domain tests passed |
| `pnpm format:check` | Passed |
| Browser page routes | 19/19 returned 200 |
| Missing reaction | Real HTTP 404 with Arabic fallback |
| Browser runtime exceptions during workflow suite | 0 |
| Responsive checks | 49 cases, no document-level horizontal overflow |
| axe A/AA route audits | 0 violations on 7 routes |
| axe A/AA state audits | 0 violations in 5 tested appearance/dialog states |
| Offline PWA checks | Cached library + uncached-route fallback passed |
| Private-cache exclusion | No account/API/video responses in service-worker cache |

### Functional journeys exercised

- Arabic query from home to library; live matching, combined category/duration, load-more groups.
- Theme persistence and curated accent switching.
- Guest bookmarks, reload and navigation persistence.
- Real MP4 playback, actual downloaded bytes, link copy/share fallback, previous/next, Escape dismissal.
- Browser account registration, persistent session and server-side account bookmarks.
- Anonymous administration denied (401); member administration denied (403).
- Cross-origin mutation rejected (403).
- Owner creates, edits and deletes through the three-step UI.
- Authenticated upload, unsupported SVG rejection, HTTP Range response (206 / 32 requested bytes).
- A separate owner UI test uploaded a video and cover, validated duration, confirmed rights and published through the three-step form.
- Owner-only user list and audit log.

Temporary QA accounts, session records, test reactions, uploaded fixtures and generated test events were removed. The delivered database has the 12 demo reactions, **no preconfigured users or passwords**, and no invented usage history. Owner-dashboard screenshots reflect actual QA activity at capture time, not claimed real-user analytics.

## Lighthouse — last recorded run

| Metric | Desktop | Mobile simulation |
|---|---:|---:|
| Performance | **100** | **92** |
| Accessibility | **100** | **100** |
| Best practices | **100** | **96** |
| SEO | **100** | **100** |
| First Contentful Paint | 0.26s | 0.92s |
| Largest Contentful Paint | **0.68s** | **3.33s** |
| Total Blocking Time | 0ms | 46.5ms (~50ms displayed) |
| Cumulative Layout Shift | 0.0071 | 0 |

Lighthouse 12.8.2 mobile defaults simulated 150ms RTT / ~1.6Mbps / 4× CPU slowdown. Desktop used the desktop preset (40ms RTT / ~10Mbps / 1× CPU). These are single local lab runs; normal measurement noise exists and no score was chosen merely because it was the highest. Raw output includes the exact environment and audit details.

### Requested targets: what did and did not pass

- **LCP <1.2s:** met in the desktop run; **not met on the mobile simulation**. The hero portrait is the mobile LCP element. Render delay dominates the result; image delivery, main-thread work and real-device paint behavior need further profiling.
- **CLS <0.1:** met in both runs. This is not a promise of zero shifts for every account/content/state.
- **FID <100ms:** not asserted. FID is a legacy metric; modern field monitoring should use INP. TBT is a lab responsiveness indicator and is **not a substitute measurement of FID or INP**.
- **WCAG 2.1 AAA:** **not certified and not claimed**. Automated A/AA results and Lighthouse 100 do not establish AAA conformance.

### Size / loading changes

Next build reports home first-load JS reduced from approximately **154KB to 118KB** and detail from **154KB to 117KB** after separating media primitives from the animation bundle and loading preview/settings overlays on first use. Admin is about 122KB first load. These build estimates are not total page network weight.

Portraits are pre-encoded WebP. Videos are local faststart H.264 samples, loaded only for playback; there is no autoplay. The hero's main portrait has high fetch priority. Card images reserve their aspect ratio and lazy-load. Fonts are locally served after build. There are no external analytics/CDN/font requests from the browser.

A bounded service-worker cache is used for public pages/static assets only. Server media uses immutable URLs and Range requests. No deployment-specific CDN or edge cache is configured yet.

## Responsive coverage

Widths: **320, 375, 768, 1024, 1440, 1920 and 3840px**.

Routes per width: `/`, `/library`, `/r/YR-0001`, `/about`, `/saved`, `/login`, `/admin`.

The suite verifies `document.scrollWidth <= viewportWidth + 1`, not just a hidden overflow mask. An overflowing ambient-glow box and the administration sidebar's grid minimum width were found and fixed. Admin tables retain deliberate internal scrolling. Full screenshots exist for desktop, dark appearance and 320px home.

## Accessibility limits / remaining work

- axe reported 11 aggregate **incomplete/manual-review items** across route/state runs (some represent repeated rules/contexts, not 11 distinct defects), particularly image/video/overlay-related review. These require human assessment.
- Mobile Lighthouse still flags **small text sizes** in supporting/technical labels; Best Practices is 96, not 100. This should be addressed in a readability pass before public launch.
- Desktop 100 scores do not cover every owner-editor state, every accent, assistive technology or replacement media.
- Current clips are silent generated-photo animations. Real clips with speech require caption tracks/transcripts that are not auto-generated by the CMS.
- No independent penetration test, multi-user load test, iOS/Safari suite, 400% zoom audit or screen-reader certification was performed.

## Evidence

`verification/v4/` contains:

- `flows.json`, `flows.log`: route, workflow and 49 responsive checks.
- `accessibility.json`, `accessibility-states.json`: route/state axe results.
- `lighthouse-mobile.json`, `lighthouse-desktop.json`: complete lab audits.
- `pwa.json`: manifest, cache inspection and offline results.
- `upload-ui.json`: actual file-selection/upload/publish UI test.
- `summary.json`: compact machine-readable result summary.
- `build.log`, `typecheck.log`, `unit-tests.log`, `format-check.log`.
- Real browser screenshots, including `home-hero.png`, `home-desktop.png`, `home-dark.png`, `home-320.png`, `library.png`, `detail.png`, `admin-owner.png`.

## Release assessment

Suitable for owner evaluation and a controlled single-node demonstration. **Not yet an unconditional public/enterprise release.** Public deployment needs licensed content, security/operations hardening, recovery/verification, manual accessibility work, small-screen readability improvements and further mobile LCP optimization. See `DEPLOYMENT.md` and `ROADMAP.md`.
