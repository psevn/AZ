# AZ Stage B — Frontend and acceptance audit

Date: 2026-11-05  
Reviewed baseline: `main` at the current repository state; approved SPEC v0.2 and TASKS v0.2.  
Status: static source review plus owner-reported local command results from the project conversation. No browser, auth, deployment, or two-user test was executed by ChatGPT in this review.

## Executive result

The repository contains a useful **auth + subject CRUD prototype**, not a Stage B-complete walking skeleton.

The owner has already reported:
- `npm install` completed successfully (33 packages added; 34 audited; 0 vulnerabilities).
- `npm run build` completed successfully after a fix.
- `npm run dev` started Vite successfully at `http://127.0.0.1:5173/`.

These are meaningful local setup/build checks, but they do not verify that the browser renders correctly, that Supabase Auth works with the live project, or that user isolation holds through real JWTs.

## Source review findings

| Area | Current evidence in `main` | Result |
|---|---|---|
| React/Vite app | `src/main.tsx`, `src/App.tsx`, `src/styles.css` | Present |
| Supabase browser client | Uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; no service-role key in the reviewed frontend source | Good security boundary for the browser client; still inspect built bundle and repository history |
| Auth | Sign-up, password sign-in, getUser, auth-state listener, sign-out | Implemented in UI source; not live-tested |
| Session persistence | Supabase client enables auto-refresh, persistSession, detectSessionInUrl | Configured; not browser-tested |
| Subject list/create | Select own visible subjects; insert subject with authenticated user's ID; relies on RLS | Implemented in UI source; not tested against real user JWTs |
| Two-user isolation | No browser/E2E test or test-user JWT evidence in this review | Not verified |
| Invite-code gate | No invite-code field or validation in `src/App.tsx` | Missing |
| App navigation | No router or tab navigation; current authenticated screen only shows subjects | Missing against TASKS Stage B app-shell requirement |
| App shell | Auth + subject screen, top bar, theme/language controls | Partial |
| Arabic/English | Copy dictionary, language toggle, dynamic `dir` and `lang` | Implemented in source; needs RTL/LTR visual test |
| Dark/light | Local React state toggles CSS variables | Implemented in source; preference is not persisted |
| Responsive | CSS breakpoint at 760px and responsive auth layout | Implemented in source; needs device/browser test |
| PWA manifest | `public/manifest.webmanifest` linked from `index.html` | Present |
| PWA install/offline | No service-worker registration or offline cache found in reviewed source; no install test | Manifest alone is not proof of installability/offline support |
| Deployment | No verified deployed URL or production smoke test in the evidence reviewed | Missing/unverified |
| Credit RPCs/sweep | No Edge Functions or reserve/settle/refund implementation in repository | Missing |
| Mock-provider concurrency | No test evidence for idempotency/caps/refunds | Missing |
| Email redirect settings | Not verified | Open |
| Dependency lockfile | `package-lock.json` is absent from `main` (owner generated it locally with npm install, but it is not committed) | Commit after checking local Git status |
| Brand asset | Current `public/az-mark.svg` is a lime rounded-square with a simple A, while approved AZ identity is the angular AZ monogram with cyan→blue→violet gradient on black | Placeholder; replace only as part of approved design implementation |
| Error localization | Supabase error messages are displayed directly; they may be English even in Arabic mode | Improve before beta |
| Sign-out on small screens | CSS hides `.signout-button` under 760px | Mobile user may not have a visible sign-out action; fix in app-shell pass |

## Important scope clarification

`TASKS.md` explicitly calls for an app shell with four tabs, AR/EN + RTL, dark mode, responsive layout, and a PWA manifest. The current source has no routing/tab shell. The exact final tab labels and destinations should be taken from the approved product scope, not invented in this audit. Build placeholders only if the approved design/IA specifies them.

The current scaffold should remain a foundation. Do not spend time polishing the temporary lime accent or orbit illustration as if they were the final AZ brand; the approved logo and design direction are different.

## Prioritized Stage B implementation checklist

### B1 — Owner-side browser smoke test (first, no code changes)
- [ ] Start the dev server from the project folder.
- [ ] Open `http://127.0.0.1:5173/` and confirm the page renders without a blank screen or console errors.
- [ ] Confirm the app shows the Supabase setup state when env vars are absent; do not paste secrets into chat.
- [ ] With the local `.env.local` configured, confirm sign-up/sign-in, session refresh, subject create/list, and sign-out.
- [ ] Check browser Network/Console for failed requests and inspect that only the publishable key is sent from the browser.

### B2 — Complete the foundation app shell
- [ ] Implement invite-code gating according to the approved beta access decision; validate server-side, not with a client-only hard-coded code.
- [ ] Add the approved navigation shell and four tab destinations; avoid implementing out-of-scope features just to fill tabs.
- [ ] Ensure sign-out remains reachable on mobile.
- [ ] Persist language/theme only if this is consistent with the approved UX; do not introduce a new settings system.
- [ ] Localize user-facing Auth/API errors into Arabic and English without leaking sensitive backend detail.
- [ ] Replace the placeholder mark with the approved AZ asset during the design implementation pass; don't redesign the logo.

### B3 — Auth and isolation evidence
- [ ] Verify Auth email confirmation and redirect URLs for localhost and the intended deployment host.
- [ ] Create two real test users (A and B).
- [ ] Test A creates a subject; B cannot read/update/delete it by direct API request or guessed UUID.
- [ ] Test anonymous requests are rejected.
- [ ] Test subject insert cannot spoof another user's `user_id`; RLS must reject it.
- [ ] Record exact test commands/steps, outcomes, and any failed cases.

### B4 — PWA and deployment
- [ ] Commit the generated `package-lock.json` after local `git status` review.
- [ ] Confirm manifest, icon, start URL, standalone display, and production asset paths.
- [ ] Add service worker/offline behavior only to the level approved by SPEC and test update/cache behavior; a manifest is not an offline implementation.
- [ ] Deploy the static frontend to the chosen approved host and run production sign-up/sign-in/subject smoke tests.
- [ ] Verify install prompt/installation on a supported browser/device.

### B5 — Credit skeleton and Stage B closeout
- [ ] Design reserve/settle/refund and sweep functions from SPEC §9; do not add a real AI provider yet.
- [ ] Implement mock-provider integration with one idempotency key.
- [ ] Test same key ×50 concurrent requests → exactly one mock provider call.
- [ ] Test user daily/monthly caps, global cap, provider failure refund, and interrupted-call sweep.
- [ ] Obtain ChatGPT security/permission/cost review and attach test report.

## Recommended immediate next action

Do **B1 browser smoke test first** on the owner's Windows machine. It is the fastest way to discover whether the existing prototype behaves as expected before adding more code. After that, implement the missing app shell/invite gate and then run two-user isolation tests.

## Non-actions

No repository source code was modified in this audit. No SQL or Supabase settings were changed. No deployment was performed. No test is marked passed unless supported by the owner's reported command result or an executed test.
