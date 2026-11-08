# AZ V1 — Final Product Scope (owner-approved) + technical review

Source: "AZ V1 Final Product Scope" v1.0 supplied by PSEVN on 2026-11-08 (status there: *Approved Scope — Pending Technical Review*). This file records the technical review by Claude and the build phasing. The product text itself is the owner's; this file only summarises it.

## Scope (summary)
Core: Study Pack (summary, concepts, MCQ, source pages; short-answer listed), Flashcards, Exam Mode, Weakness Hunter (rule-based, per topic), Ask Your Materials (grounded, limited usage), Planning + Onboarding, Focus, simplified Weekly Review, OCR as a validation experiment only.
Excluded: Community and live gatherings (coming-soon only), Lecture Intelligence, Knowledge Graph, autonomous planning, Mini Notebook, advanced analytics, complex spaced repetition, OCR guarantees, native apps.

## Conflicts found with earlier decisions (need PSEVN's answer)
1. Date/hours: the scope says beta before 2027-01-17 at ~18 h/week; PSEVN's 2026-11-03 update says web launch early Feb 2027, beta before it, 12.5–15 h/week. Not reconciled.
2. Short-answer questions were previously first to be cut; they are back in. Grading them needs its own design (cost, accuracy). The database currently allows only `question_type = 'mcq'`.
3. ~~Group Projects excluded from V1~~ — **DECIDED by PSEVN 2026-11-08: collaborative group Projects are necessary and ARE part of V1.** See the next section.

## Decision 2026-11-08: Group Projects are in V1 (PSEVN)
Supersedes the earlier "functional student groups" exclusion and the "Group projects postponed" note. Community, live gatherings and a general Groups social feature stay out.
Already on the live database (built by ChatGPT, audited by Claude): projects, members (lead/member), tasks with assignees, documents, activity log, attachments metadata, invitations (server-only), unified `planning_items` view, realtime on planning/documents/activity.
Still required before it counts as done (quality gate): (1) the exact SQL of the applied project migrations committed to the repo and the project tables added to the local test suite; (2) invitation flow through a server function (invitations are intentionally closed to clients); (3) attachments via server-signed uploads like personal documents (storage stays server-only); (4) a rule for what happens to a member's shared data on account deletion (lead leaves/deletes account); (5) two-user and three-user tests through the real API; (6) per-project limits (members, tasks, attachments size) so one project cannot consume the free tier.
Effect on the plan: V1 grows, so the beta date question matters more (see conflict 1). Suggested trade: keep Projects in Beta 1 at a minimal level (create project, invite, tasks with assignees, shared notes/files, deadline in Planning) and move short-answer questions and Weekly Review to the second part.

## Recommended phasing (Claude; not yet approved)
- **Beta 1:** upload + processing, Study Pack (summary, concepts, MCQ with source page), Flashcards, Exam Mode, Weakness Hunter (topic aggregation), Ask Your Materials (small limit), basic Planning + Focus, **minimal group Projects**, OCR test results.
- **Before/after launch:** onboarding with timetable generation, Weekly Review, short-answer questions, targeted practice generation, difficulty classification.

## What the database already supports (live, tested)
| Need | Status |
|---|---|
| Exam Mode: hidden answers until submit, changeable answers, server-enforced timer (+5 s grace), N random questions, review after finish | done — migration `20261108121410` |
| Source page / topic / difficulty per question, document language | done (columns nullable; the generation pipeline must fill them) |
| Flashcards + known/needs-review progress (written only via `mark_flashcard`) | done |
| Credits, spend cap, idempotency, sweep (pg_cron every 5 min) | done |
| Planning foundation (terms, class meetings, setup state) | done (ChatGPT; isolation tested by Claude) |
| Weakness Hunter | derivable from `attempt_answers` + `quiz_questions.topic`; needs a view/RPC later |
| Ask Your Materials retrieval | open: start with Postgres full-text on `document_pages.text`; Arabic support must be verified in Stage C |
| Weekly Review | derivable from tasks, focus sessions, attempts; no new tables needed |
| OCR | needs an external provider (Edge Functions have ~2 s CPU); validation only in V1 |

## Cost note
Per document the platform may generate summary, concepts, MCQ, flashcards and topic labels, and regeneration multiplies it. Generate parts on demand and measure cost per feature in Stage C before setting credit costs (no prices are assumed here).
