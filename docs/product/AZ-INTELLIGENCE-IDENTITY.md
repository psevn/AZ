# AZ Intelligence — Product & Character Identity

**Status:** Direction approved; visual character not yet designed or generated.  
**Product name:** AZ Intelligence  
**Role:** The student's personal academic intelligence layer within AZ.

## 1. Product concept

AZ Intelligence is not merely a chatbot or a chat window connected to an AI API. It is the intelligence layer that helps a student understand their academic position, improve their learning, and turn evidence-based insights into practical next steps.

It should connect relevant student-authorized data from AZ's academic experience, reason over that context, and support the student across:

- **Workspace:** studying course materials, asking questions, summarizing, practicing, and reviewing mistakes.
- **Notebook:** capturing and organizing study notes and ideas.
- **Focus:** recording focus sessions and study activity.
- **Planning:** proposing and, with the student's approval, creating or adjusting study tasks and plans.

These are connected product areas; do not present them as separate competing names for AZ Intelligence.

## 2. Intelligence principles

AZ Intelligence should combine:
1. **Student data/context:** relevant subjects, documents, study activity, quiz attempts, mistakes, tasks, focus sessions, and progress, subject to permissions and data availability.
2. **Deterministic algorithms:** transparent calculations for performance, mastery estimates, trends, repetition, and scheduling.
3. **AI models via a secure API:** language understanding, contextual reasoning, explanations, and personalized suggestions.
4. **Action/integration layer:** turns approved recommendations into actions inside AZ, such as proposed training plans and Planning tasks.

The AI API is one component, not the entire intelligence system. Keep API credentials server-side; never expose secret keys in browser code.

## 3. Academic intelligence profile

Over time, AZ Intelligence may maintain an evolving academic profile based on available evidence, including:
- Knowledge and topic-level mastery estimates.
- Quiz and practice performance.
- Repeated mistakes and possible misconceptions.
- Strengths and areas needing improvement.
- Study habits and consistency.
- Focus and task-completion patterns.
- Progress over time and upcoming learning needs.

**Trust and accuracy requirements:**
- Never claim to know information that the student has not provided or that AZ has not legitimately observed.
- Distinguish measured facts from AI-generated hypotheses and recommendations.
- Show evidence/context and confidence where useful; communicate uncertainty when data is limited.
- Do not claim to predict a professor's actual exam.
- Respect student privacy, consent, access controls, and row-level data isolation.
- Do not silently make consequential changes to the student's plan; ask for approval before creating or changing tasks/plans unless the student has explicitly enabled that behavior.

## 4. Proactive behavior

AZ Intelligence should not only wait for questions. When enough relevant data exists, it may:
- Detect meaningful changes or repeated difficulties.
- Identify likely knowledge gaps for the student to verify.
- Recommend a targeted practice sequence.
- Propose a study/revision plan and connect it to Planning.
- Reassess progress after practice and adapt the next recommendation.

Proactive analysis must be proportionate, explainable, and based on available evidence. Avoid noisy notifications or unsupported judgments.

## 5. Character / visual identity direction

Create an original, recognizable character or visual entity that represents AZ Intelligence. The approved creative direction is:

- **Form:** a distinctive blend of an advanced friendly robot and an abstract digital-intelligence entity. It should not look like a generic stock robot.
- **Personality:** combine the qualities of a brilliant analyst, thoughtful coach/guide, calm professional presence, friendly companion, and subtly mysterious advanced intelligence.
- **Visual language:** unify cinematic/futuristic 3D realism, premium stylized 3D character design, minimal geometric construction, and restrained tech/anime-inspired expressiveness. These are ingredients for one coherent identity, not disconnected styles.
- **Palette:** AZ's established cyan/turquoise → electric blue → violet gradient, against charcoal/dark backgrounds. Keep glow restrained and intentional.
- **Brand integration:** a subtle geometric detail inspired by AZ's angular monogram may be integrated into the character; do not distort or replace the official AZ logo.
- **Distinctiveness:** the silhouette and face/core should remain recognizable at small avatar sizes and work as a standalone app icon/avatar.

### Character states to support later

Design a consistent base character with adaptable expressions/poses for:
- **Analyzing:** scanning or processing academic information.
- **Conversation:** listening and responding.
- **Insight:** surfacing a useful finding.
- **Training:** guiding a practice session or plan.
- **Achievement:** acknowledging real student progress.

These are future design/animation states, not a requirement to build animation immediately.

## 6. Product and implementation boundaries

- The main section is named **AZ Intelligence**.
- It works across Workspace, Notebook, Focus, and Planning rather than replacing them.
- Keep the first implementation practical and incremental; do not introduce a costly AI subscription or provider commitment without an explicit product/owner decision.
- Do not build or ship a mascot image based only on this text. The character has **not yet been generated or approved visually**.
- Preserve AZ's existing visual identity and current design reference. The character should complement the product, not introduce a conflicting visual system.

## 7. Current decision

The product name and creative direction above are approved as the working direction. The final character artwork, exact appearance, and implementation details remain open for review after visual concepts are produced.
