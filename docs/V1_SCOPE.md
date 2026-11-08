# AZ V1 — Final Product Scope (PSEVN, v1.0) + technical review

Status: scope provided by PSEVN on 2026-11-08 ("Approved Scope — Pending Technical Review"). This file records the scope, the technical review by Claude, and the proposed beta split. **Open decision: dates/hours** (see §4).

## 1. Scope (as provided)
Core: **Study Pack** (summaries, concepts, MCQ, short-answer, source pages), **Flashcards**, **Exam Mode**, **Weakness Hunter** (rule-based, by topic), **Ask Your Materials** (grounded, limited usage), **Planning + Onboarding**, **Focus Sessions**, **Weekly Review** (simplified), **OCR** (validation experiment only, no promise).
Excluded: Community/Groups (coming-soon only), Lecture Intelligence, Knowledge Graph, autonomous planning, Mini Notebook, advanced analytics, complex spaced repetition, OCR guarantees, native apps.
Principles: never invent sources/page refs, never predict the professor's exam, student stays in control, cost measurable, reliability of the core loop over feature count.

## 2. Technical review (Claude, 2026-11-08)
- **Conflicts with earlier decisions:** (a) the dates/hours differ from PSEVN's 2026-11-03 update (early-Feb web launch with beta before, 12.5–15 h/week) vs Jan 17 and 18 h/week here; (b) short-answer questions were on the cut list and return here; grading them needs its own design, so they are **not enabled** in the database yet (`question_type` is restricted to `mcq`); (c) the scope is larger than SPEC v0.2 (flashcards, exam mode, topics, onboarding schedules, weekly review, OCR).
- **Database status (applied live, tested locally + rolled-back live checks):** exam vs practice attempts (answers hidden until finish, changeable until finish, server-side time limit with 5 s grace, review only after finish), the attempt's own question set (`attempt_questions`), question metadata (`source_page`, `topic`, `difficulty`), `documents.language`, flashcards + progress (progress written only via `mark_flashcard`).
- **Not yet designed:** Ask Your Materials retrieval (start with Postgres full-text on `document_pages`; Arabic support must be verified in Stage C), topic classification quality, targeted-practice generation, OCR provider (Edge Functions' CPU limit does not fit OCR; a validation-only experiment is right), weekly review queries (derivable from existing tables).
- **Cost:** a Study Pack multiplies AI calls per document (summary, concepts, questions, cards, topics) and "regenerate" multiplies it again. Generate parts on demand and measure per-feature cost in Stage C before setting limits. No prices are assumed here.

## 3. Proposed split (recommendation, needs PSEVN's approval)
| Beta 1 | Beta 2 / before launch |
|---|---|
| Upload + processing, Study Pack (summary, concepts, MCQ with source pages), Flashcards, Exam Mode, simple Weakness Hunter (topic aggregation of mistakes), Ask Your Materials with a small limit, basic Planning + Focus, OCR validation results | Onboarding with schedules, Weekly Review, short-answer questions, targeted-practice generation, difficulty classification |
Reason: Beta 1 proves the core loop (file → trustworthy test → mistakes); Beta 2 adds convenience.

## 4. Open decisions for PSEVN
1. Dates/hours: (A) beta before Jan 17 at 18 h/week, or (B) beta before early Feb at 12.5–15 h/week.
2. Approve the Beta 1 / Beta 2 split.
3. Daily limit reset: UTC midnight (03:00 Qatar) or Qatar midnight (recommended).
