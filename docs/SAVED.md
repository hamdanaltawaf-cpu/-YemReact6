# المحفوظات

The saved page at `/saved` uses one visible name: **المحفوظات**. Header links, account copy, the homepage's existing saved link, and page metadata use the same name. The homepage layout and footer are otherwise unchanged.

## Interface

- One heading and a compact library link when populated; one library action in the empty state.
- No page footer, demo notice, breadcrumb, search, category controls, sorting menu, duration filter, export toolbar, counters, or manual load-more button.
- `ReactionMasonry` provides responsive incremental rendering for both saved media and the public library while preserving DOM/keyboard order. It has a normal-grid and scroll-listener fallback.
- Saved cards show the complete image/poster with `object-fit: contain`, bounded natural aspect ratios, readable captions below the media, preview and removal controls. Only videos have a duration badge and play icon.
- Images open as images and downloads use the real image/video extension, including MIME fallback. Existing video upload/publishing validation and admin authorization are unchanged.

## Data and behavior

`src/lib/saved.ts` selects saved IDs without category, keyword or duration gates. It retains the former default ordering by publication date; it does not claim to order by bookmark time. Legacy query parameters cannot hide content. Guest local storage and account database bookmarks remain separate; no saved records are migrated or removed by this release.

Loading waits for authentication/bookmark hydration before showing an empty state. Removal remains optimistic with the existing rollback behavior. Automatic batches include the remaining items without displaying counts.

## Verification

- `pnpm test`: media-kind/extension, saved selection, loading/empty state, footer scope, image preview and prior auth/video tests.
- `verification/saved-page.cjs`: disposable database only, mixed images/videos, wide PNG and WebP preview/download, guest and member removal persistence, widths 320–1920, light/dark axe checks. UTF-8 process locale is set for Arabic download filenames.
- `QA_BASE_URL=http://localhost:3100 QA_DATA_DIR=.cache/saved-qa-data node verification/library-feed.cjs`: public library regression, automatic batches, observer fallback and keyboard preview.

Reports describe measured cases, not a blanket accessibility or performance certification. No production accounts or media are inserted for QA.
