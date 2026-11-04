# Guest access to the account shell

## Narrow routing correction

`/account` serves both guest-local saved reactions and the current signed-in account. It is not a public profile directory. Requiring `yr_guest` or `yr_session` just to render this shell sent a fresh visitor to `/login?next=%2Faccount`, while the guest entry linked back to `/account`.

The correction makes **the exact `/account` path** an open page in the existing middleware decision. The page remains reachable if the guest cookie is absent or unavailable, including full navigation, HEAD and RSC navigation. Query strings do not change that decision. The guest entry keeps its existing return target and cookie behavior; it is not redirected elsewhere as a workaround.

Reference, read-only: `Nibras-Conversation@21cc96188ad1903d3f349f6af38d007887cc8fe4`, `canonical/DECISION-5B.24-GUEST-SAVE-RECONCILIATION.md`, decision 6 and acceptance criterion “Guest saves remain accessible without login.” This implements only the account-shell access portion, not the decision's merge/synchronization/account-isolation requirements.

## Boundaries

- No account identity or server-side saved data is granted by opening this page. The private saved API continues to require authentication.
- No prefix exemption for `/account/*`; other paths retain their previous gate behavior.
- No change to `/saved`, `/settings`, `/contribute`, submission preparation, OAuth, session validation, API handlers, database or local save persistence.
- No edits to Nibras. No new routes, identity providers or account fields.
- The read-only deployment verification now requires anonymous `/account` to return 200 with its own content. Its `/settings` gate assertion remains unchanged.

## Review checks

1. With an ordinary browser UA, no cookies and existing guest-local saves, open `/account`: expect 200, the guest account surface and local saved items; no login detour.
2. Open `/login?next=%2Faccount` and select the guest entry: expect `/account`, not another login page. Clear the guest cookie and reload: the account surface remains reachable.
3. An unauthenticated GET to `/api/saved` must still return 401, including with a guest flag. Do not sign in or submit forms to test this.
4. Verify that anonymous `/settings`, `/contribute` and `/account/submissions` keep their existing gate responses. Do not submit a contribution.
5. `tests/login-gate.test.mjs` covers the exact-path exception and guest return target. Existing account-surface and API authorization tests remain applicable.

These checks do not establish that all guest/auth flows are correct. In particular, hydration #418 remains an open warning observed before and after the previous UI batch, with cause unresolved. Purple/Teal remain unimplemented/unresolved; neither is changed or claimed fixed by this routing PR.

This correction is submitted separately for review; it does not authorize PR merge, Render configuration changes or Manual Deploy.
