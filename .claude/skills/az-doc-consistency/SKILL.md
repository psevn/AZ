---
name: az-doc-consistency
description: Use before finishing any change to AZ docs (SPEC, DECISIONS, TASKS, PRICING, IMPLEMENTATION_STATUS, AZI/Planning/Projects specs) or when a decision, price, scope item or status changes. Finds and resolves conflicts across documents.
---

# AZ document consistency check

AZ's documents are read by the owner (PSEVN), ChatGPT and Claude. A number or scope claim that differs between files causes wrong decisions. Run this check whenever a fact in the docs changes.

## 1. Know which file wins
1. `CLAUDE.md` and `docs/product/AZ-INTELLIGENCE-IDENTITY.md` win on naming, trust, privacy and consent.
2. `docs/DECISIONS.md`: the latest dated entry wins over older text. Do not resurrect a reversed decision.
3. `docs/SPEC.md` is the V1 specification, `docs/TASKS.md` the stage plan.
4. Proposal documents (`AZI-V1-LITE.md`, `PLANNING-V1.md`, `PROJECTS-SPEC.md`, `PRICING.md` where present) must not contradict items 1 to 3. If they need to, the change goes into DECISIONS.md first and the owner approves it.

## 2. Procedure
1. Write down the fact(s) you are changing (for example a price, a cap, a count, a V1 scope item, a name, an applied/pending status).
2. Search the whole repo for every mention, including old spellings: use `rg` on numbers, names and key words. List each hit with file and line.
3. For each hit decide: update, keep (still true), or mark as historical. Do not leave two different current values.
4. Label every statement as one of: **confirmed** (owner decision on record), **proposed**, or **assumption/unmeasured**. Never present a proposal as settled.
5. Status words need evidence. "Implemented", "applied", "tested", "deployed" require code, test output, or a live check you ran. Otherwise write "proposed" or "not yet verified".
6. When a decision reverses an older one, add a dated entry in `DECISIONS.md` that names what it reverses, and bump its "Last updated" line.
7. Cross-links: if a document now depends on another (or on an unmerged PR), say so in the text.

## 3. Names and wording rules (from CLAUDE.md)
- **AZ** = platform. **AZ Intelligence** = the intelligence system and section (never "AZ Core"). **AZI** = default name of the companion; students may set a nickname.
- Never "AZ EZORD". EZORDOM, VXNORY and ELYSERA are separate projects.
- No claim that AZI/AZ Intelligence capabilities exist unless the codebase demonstrably supports them. "AZ المطلق" is a long-term vision only.
- No guarantee or prediction of a professor's real exam.

## 4. Facts that have conflicted before (verify against DECISIONS.md; do not trust this list)
Snapshot from 2026-11-15, may be stale: subscription price; early-bird length and size; AI cost cap per student; whether group Projects are in V1; whether Community is deferred; stage and quality-gate wording; migration status (applied vs pending); table names (`quiz_questions` vs `questions`).

## 5. Output
End your work with a short list for the PR description: conflicts found, what you changed, what you left and why, and any open question for the owner. If you could not resolve a conflict, say so; do not hide it by rewording.
