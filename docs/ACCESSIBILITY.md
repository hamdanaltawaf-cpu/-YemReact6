# Accessibility checklist — measured, not certified

Target: accessible Arabic RTL workflows with native HTML semantics and a practical WCAG 2.1 A/AA baseline. **WCAG 2.1 AAA conformity is not certified or claimed.** Automated scores cannot establish conformance by themselves.

## Implemented

- [x] `lang="ar"`, `dir="rtl"`, meaningful heading hierarchy and page landmarks.
- [x] Skip-to-content link and visible keyboard focus styles.
- [x] Native links/buttons/form controls rather than generic click-only divs.
- [x] Search and account/editor fields labelled; native required/min/max validation and server validation.
- [x] Separate media preview, bookmark and detail controls — no nested interactive anchors/buttons.
- [x] Native dialog focus containment and Escape closing; dialogs retained after first load for focus restoration.
- [x] Native video controls and explicit accessible player names; no autoplay or sound surprise.
- [x] Fixed media ratios, responsive layouts and intentionally scrollable category/table regions.
- [x] Save state through `aria-pressed`; action feedback through live `role=status`.
- [x] Reduced motion respects both OS preference and explicit setting.
- [x] Touch-oriented controls receive at least 44px minimum dimensions on coarse-pointer devices where covered by shared classes.
- [x] Decorative SVGs hidden from accessibility tree; content images/captions are described.
- [x] Meaning does not depend solely on category color — visible category names remain present.
- [x] Dark/light appearance tested, including saved-state preview and settings.
- [x] URL-not-found state returns an actual HTTP 404 after removing the root streaming loading boundary.

## Test coverage

The original V4 `verification/a11y.cjs` and `verification/a11y-states.cjs` reports are historical: they covered seven routes and five states, including the now-retired homepage. The current library-first experience is audited in `verification/navigation/browser.cjs`, `verification/stage4.cjs` and `verification/contribution/browser.cjs`, including the 1023/1024 breakpoint, account popover, bottom sheet, search, motion settings and upload demo. Automated results do not replace manual assistive-technology testing.

The workflow test exercises keyboard Escape, labelled forms and functional actions. Lighthouse provides a separate browser audit. See the quality report and raw JSON for final results and incomplete/manual-review items.

## Still requires manual assessment

- [ ] Full NVDA/JAWS/VoiceOver/TalkBack testing on real devices.
- [ ] Voice-control navigation with Arabic labels and mixed-direction codes.
- [ ] Zoom/reflow at 200% and 400%, custom text spacing and platform high-contrast modes.
- [ ] Complete owner-editor state audit, error announcements and asynchronous focus recovery.
- [ ] Every curated accent/theme/state combination, hover states and image-overlay contrast under replacement media.
- [ ] Complete WCAG AAA criteria assessment, including enhanced contrast, all target-size exceptions and reading/assistance criteria.
- [ ] Human Arabic readability review: decorative/technical micro-labels are intentionally small and are not proof of legibility for every user.

The shipped demo clips have no audio and are explicitly described as still-image animations. Real uploaded clips containing speech will need proper caption tracks/transcripts; the owner-upload workflow does not generate them automatically.
