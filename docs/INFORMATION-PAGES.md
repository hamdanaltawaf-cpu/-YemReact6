# Information architecture: help and privacy

## Impact reviewed before implementation

The retired story page was referenced by the desktop/mobile header, homepage story section, footer, sign-in privacy link, sitemap and service-worker public-page allowlist. All are updated together.

## New destinations

- `/help`: concise native-disclosure FAQs about anonymous use, separate guest/account bookmarks, saving versus downloading/sharing, removal, generated content, offline limitations, account logout and admin-only publishing.
- `/privacy`: identity data, session cookies, browser/server storage, content usage events, content rights, generated media and current account-management limitations.
- Header primary navigation stays library/saved plus the admin-only studio. On pages without a footer, help is available through a secondary desktop icon or the mobile menu. Other pages use the compact footer instead. Sign-in retains its contextual privacy link.
- Footer consists of a wordmark and utility links (with the existing admin-only studio link). It avoids self-links. No footer is reintroduced on library, saved or sign-in pages.
- The homepage story block and its CTA are removed, not replaced by another brand narrative. No story page remains.

## Legacy links

`next.config.ts` permanently redirects `/about` to `/help` (HTTP 308). Browsers retain the fragment, which is not sent in an HTTP request:

- `/about` → `/help`
- `/about#faq` → `/help#faq`
- `/about#privacy` → `/help#privacy` → `/privacy`

The last hop uses `LegacyInformationLink` and a fixed-destination fragment mapper. It accepts no external redirect target. Without JavaScript, the help footer contains a visible privacy link with `id="privacy"`, so the old fragment leads to a working one-click fallback instead of a missing page. Direct new links need no JavaScript.

The sitemap lists `/help` and `/privacy`, not `/about`. The service-worker cache version changes to `yemreact-public-v4.3-information`, clears previous YemReact caches and lists the new public routes. APIs, account pages, admin pages and video files remain excluded from its content cache.

## Content preservation

Information about non-merged bookmarks, browser-data deletion, file downloads versus shared links, generated/silent demo media, offline limits, identity-provider passwords, aggregate usage events, administrative access, rights obligations and absent self-service account deletion/provider linking is retained in the appropriate destination. Obsolete local-preview wording and lengthy brand-story/design-mark explanations are removed. Privacy wording describes implemented behavior, not a security/compliance certification or an invented support/deletion workflow.

## Verification

- `pnpm test`: fragment allowlisting, configured redirect, sitemap/source-link audit, content coverage, compact-footer behavior and service-worker version checks, alongside prior auth/media tests.
- `node verification/information-pages.cjs`: local production build; legacy URL variants, six routes at four widths, native FAQ keyboard use, no-JavaScript fallback, light/dark accessibility checks, and service-worker activation/old-cache cleanup.
- `QA_BASE_URL=https://yemreact-production.up.railway.app node verification/information-pages.cjs`: public live checks; no production account or content mutations.

Reports cover measured cases only, not universal browser or accessibility certification.
