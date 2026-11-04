# AZ — Decisions Log

Last updated: 2026-11-04 (v0.2). Owner: PSEVN.

## Settled (previously approved, unchanged)
- Name: **AZ** (never "AZ EZORD"). EZORD and VXNORY are separate and out of focus.
- Web-first (responsive + installable PWA), Arabic/English + RTL, dark mode first-class. **After the web launch, the next planned product delivery is native Android + iOS apps**, reusing the same backend, accounts, and data; app-specific UI is expected. This sequence does not add native apps to V1.
- V1 scope as in SPEC.md §2; Groups = "Coming soon" card only. No V1 feature removed.
- V1 is one connected loop: Plan → Study → Practice → Review → Improve, on a shared schema.
- Stage order: A plan → B foundation → C PDF→quiz experiment → D Planning+Home → E workspace+ME → F security/testing/beta. One stage at a time; owner approves each.
- Credit-based usage: daily + monthly caps, higher for subscribers, never unlimited; global monthly spend cap.
- Free: Planning, Focus, Home, library (storage-capped). Limited free AI. Professional Mode is the paid differentiator (one trial for free).
- Beta access by invite code. Country blocking only as an optional extra layer.
- Supabase project "AZ" in Mumbai (ap-south-1) for V1.
- Process: Claude Code implements, ChatGPT reviews at end of each stage, owner relays via GitHub/files; tests must pass before the next stage.
- Planning only until explicit approval: no code, repo creation, or purchases.

## Proposed in v0.2 — pending PSEVN approval
Technical corrections from the ChatGPT review (Claude agrees with all; none changes an approved decision):
1. `user_id` on every user-content table + composite foreign keys (SPEC §5).
2. Answer keys server-only; grading server-side (SPEC §7).
3. Atomic credit reserve/settle/refund, idempotency via unique `request_key`, concurrency tests for per-user and global caps (SPEC §9).
4. PDF status machine with atomic claim, retries, dedup (SPEC §6).
5. Account deletion removes Storage objects, with test (SPEC §10).
6. Backend = Supabase Edge Functions only; Cloudflare for static frontend hosting. This resolves former open decision #4 (SPEC §4.1) — **this is the only item that changes a previous proposal (Workers API layer); it was marked "not final".**
7. Provider-independent AI interface + quality metrics next to cost, incl. automatic page-reference check (SPEC §8).
8. Vertical slices, P0/P1/P2 priorities, date gated by quality (SPEC §12).

## Postponed (not rejected)
- Ambassador program: after beta; count activated users (not sign-ups), higher points for paid conversions, rewards in AI credits/free Pro months/titles, pseudonymous leaderboard, universities only (schools need legal review), start with 3–5 ambassadors.
- Cafe/library/neon concept: separate EZORD-level idea, revisit only after AZ is profitable. Cheap test later: partner discount with an existing cafe/bookstore. Coffee-redeemable points = financial liability; not in AZ.
- Payments, real Groups, Arena, Community, XP. Native apps are planned for the post-web phase, not V1.
- **AZ Connect** (students command Claude/ChatGPT to create files/quizzes inside AZ): V2 candidate. Conditions: API-first design now; scoped OAuth tokens; any path that triggers AZ's own AI goes through the credit system; prompt-injection review; verify third-party integration platforms/policies at that time; prototype on the owner's account after beta.
- **Claude ↔ ChatGPT automation** (Codex GitHub review, bridges/MCP between the tools): postponed to V1.5 (decided 2026-11-04). Until then ChatGPT only verifies: the owner relays by pasting files or sharing the repo link. No third-party bridge tools, no paid subscriptions for this. Rule when revisited: one agent per branch at a time, no auto-reply loops, check what the owner's ChatGPT plan includes before paying.

## Open (need a decision)
1. Native app implementation route after web launch: evaluate Capacitor (reuse much of the web UI) vs React Native/Expo (more native UI); decide based on V1 needs, maintenance cost, and device requirements.
2. How Stage B gets built (Claude Code needs a paid plan; deferred; owner cannot subscribe now).
3. AI provider/model and monthly spend cap (after Stage C data).
4. Final price; $4.99 promo length (3 vs 6 months).
5. Whether Edge Function free-tier invocation quotas are enough [VERIFY in Stage B].
6. Legal: registration, data law, payment gateway, usage-log retention after deletion, backups (professional required).
7. Hosting region for V2.

## Assumptions to re-check
- Time: 5 days/week × 2.5–3 h ≈ 12.5–15 h/week, alongside 4 university courses. Estimates re-planned after the first slice.
- Dev machine: Windows 10, ~3.76 GB RAM — keep tooling light; check Windows 10 security update status.
- Launch target: web launch early Feb 2027, beta before it. Gated by quality, not date.
- Name: PSEVN confirmed (the "qvfc" handle in the handoff pack is not used).
