# AZ V1 — Final Product Scope (owner-approved) + technical review

Source: "AZ V1 Final Product Scope" v1.0 supplied by PSEVN on 2026-11-08 (status there: *Approved Scope — Pending Technical Review*). This file records the technical review by Claude and the build phasing. The product text itself is the owner's; this file only summarises it.

## Scope (summary)
Core: Study Pack (summary, concepts, MCQ, source pages; short-answer listed), Flashcards, Exam Mode, Weakness Hunter (rule-based, per topic), Ask Your Materials (grounded, limited usage), Planning + Onboarding, Focus, simplified Weekly Review, OCR as a validation experiment only.
Excluded: Community/Groups (coming-soon only), Lecture Intelligence, Knowledge Graph, autonomous planning, Mini Notebook, advanced analytics, complex spaced repetition, OCR guarantees, native apps.

## Conflicts found with earlier decisions (need PSEVN's answer)
1. Date/hours: the scope says beta before 2027-01-17 at ~18 h/week; PSEVN's 2026-11-03 update says web launch early Feb 2027, beta before it, 12.5–15 h/week. Not reconciled.
2. Short-answer questions were previously first to be cut; they are back in. Grading them needs its own design (cost, accuracy). The database currently allows only `question_type = 'mcq'`.
3. Group **Projects** exist on the live database (built by ChatGPT, 2026-11-08) although "functional student groups" are excluded from V1. Decision needed: keep hidden/coming-soon, or move into scope.

## Recommended phasing (Claude; not yet approved)
- **Beta 1:** upload + processing, Study Pack (summary, concepts, MCQ with source page), Flashcards, Exam Mode, Weakness Hunter (topic aggregation), Ask Your Materials (small limit), basic Planning + Focus, OCR test results.
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
