# AZ Pricing — v0.1 (2026-11-15)

> Status: **assumptions, not measured.** No AI cost per PDF has been measured yet (Stage C). Do not treat any number here as a fact until Stage C produces real cost data. Payments remain deferred until the product is proven to work.

## 1. Confirmed decisions
- Subscription price: **$7.99 / month** (replaces the earlier $6.99 target).
- Early-bird discount applies **only to the first 3 months** of a subscription.
- No loss-making unlimited AI. Every AI operation has its cost logged.

## 2. Preferred, not final
- AI cost cap per paid student: **~$3 / month** (preferred by the owner). Replaces the earlier "$6–6.99 max" idea, which left a 6–18% margin in the worst case.
  - To be confirmed or adjusted after Stage C cost measurement.
- Early-bird size: **250** students (previously 500). Discounted price level (previously $4.99) not re-confirmed.
  - Discounted students get a lower AI cap (~$2) so the margin stays positive.

## 3. Free vs paid rule
One rule: **organizing and replaying = free; generating content with AI from the student's files = paid (capped).**

| Free (no AI cost) | Paid (AI, capped) |
|---|---|
| AZ Projects (tasks, sharing, collaboration) | PDF summaries |
| Planning, Focus Timer, Home | Question generation |
| Replaying already generated quizzes | Professional Mode |
| Mistake review | Ask Your Materials |
| Weakness Hunter, Weekly Review (rule-based) | AI flashcard generation |
| Manual flashcards + spaced repetition (algorithm only) | OCR |
| Library and notes (limited file count and size) | |

Free tier gets a tiny AI taste: **~$0.30 cost / user / month** (hypothesis to test, hard cap).

## 4. Rules
1. Any AI action inside a shared Project is charged to the user who triggers it, never to the Project.
2. Free storage has a file-size and file-count limit. Check Supabase plan limits before launch.
3. Every AI call goes through the credit system and logs tokens and cost.
4. Free-tier limits are fixed only after Stage C measures real cost per PDF.

## 5. Margin math (assumptions)
Assumed payment fees: ~2.9% + $0.30 per charge ≈ $0.53 on $7.99 (**unverified**; check the actual Qatar gateway). Hosting, support and taxes not included.

| AI cost cap per student | Profit after fees | Margin |
|---|---|---|
| $6.99 | ~$0.47 | ~6% |
| $6.00 | ~$1.46 | ~18% |
| $3.00 | ~$4.46 | ~56% |

- Break-even toward $10,000 / month: about **2,250 paying students** if every student uses the full $3 cap (less if average usage is lower). Fixed costs excluded.
- Early-bird cost: 250 students x $3 x 3 months = **$2,250** of foregone revenue, one time (500 students = $4,500).
- Free-tier worst case: 5,000 free users x $0.30 = **$1,500 / month**.

## 6. Open questions
- Real AI cost per PDF to questions, with page references (Stage C).
- Actual payment gateway and its fees in Qatar.
- Early-bird: 250 or 500, and the discounted price level.
- Cap behavior at the limit: stop, or slow down?
