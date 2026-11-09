# AZ Intelligence — Product, Companion & Character Identity

**Status:** Product naming and companion direction approved; visual character not yet designed or generated.  
**Product/system name:** AZ Intelligence  
**Primary companion name:** AZI (pronounced “Ah-zee” / «آزي»)  
**Role:** The student's personal, interactive academic intelligence companion within AZ.

## 1. Naming architecture

Keep these names distinct:

- **AZ** is the overall product/platform brand.
- **AZ Intelligence** is the intelligence system and main product section.
- **AZI** is the default name of the primary student-facing companion character.

AZI is derived from AZ Intelligence. It is a friendly, memorable companion name rather than the name of the underlying AI system.

### Student-customizable nickname

Students may rename the companion with a nickname of their choice. The default is **AZI**. A custom nickname changes only the name displayed in the student's experience; it does not change the companion's underlying identity, capabilities, permissions, or system name. Students should be able to change or reset the nickname later.

Use “AZI” as the default name in product copy, design files, and implementation until a student has chosen a custom nickname. Do not call the whole system AZI; the system remains AZ Intelligence.

## 2. Product concept

AZ Intelligence is not merely a chatbot or a chat window connected to an AI API. It is the intelligence layer that helps a student understand their academic position, improve their learning, and turn evidence-based insights into practical next steps.

AZI is the student's primary personal interface to this intelligence. It should feel like a companion that is present throughout the student's academic workflow—not just a bot that appears after a button is pressed.

It should connect relevant student-authorized data from AZ's academic experience, reason over that context, and support the student across:

- **Workspace:** studying course materials, asking questions, summarizing, practicing, and reviewing mistakes.
- **Notebook:** capturing and organizing study notes and ideas.
- **Focus:** recording focus sessions and study activity.
- **Planning:** proposing and, with the student's approval, creating or adjusting study tasks and plans.

These are connected product areas; do not present them as separate competing names for AZ Intelligence.

## 3. Intelligence principles

AZ Intelligence should combine:
1. **Student data/context:** relevant subjects, documents, study activity, quiz attempts, mistakes, tasks, focus sessions, and progress, subject to permissions and data availability.
2. **Deterministic algorithms:** transparent calculations for performance, mastery estimates, trends, repetition, and scheduling.
3. **AI models via a secure API:** language understanding, contextual reasoning, explanations, and personalized suggestions.
4. **Action/integration layer:** turns approved recommendations into actions inside AZ, such as proposed training plans and Planning tasks.

The AI API is one component, not the entire intelligence system. Keep API credentials server-side; never expose secret keys in browser code.

## 4. Academic intelligence profile

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

## 5. AZI companion behavior

AZI should be available throughout the student's workflow and support three complementary interaction modes:

- **Proactive:** notices a meaningful pattern or timely opportunity and offers help without waiting for a prompt.
- **Context-aware:** understands the relevant context of the current task, question, document, quiz, or study session, subject to permissions and available data.
- **On-demand:** responds when the student directly invokes it.

Proactive behavior must be useful and restrained:
- Do not interrupt concentration or repeatedly surface low-value suggestions.
- Prefer subtle, dismissible prompts at relevant moments.
- Explain why AZI is making a suggestion and what evidence supports it.
- Let the student control notification frequency and relevant personalization settings.
- Never imply continuous surveillance; only analyze activity and data AZ legitimately collects and the student has authorized.

Examples include noticing repeated errors in a concept during practice, offering a short explanation, suggesting targeted training, or proposing a revision plan that can be added to Planning with the student's approval.

## 6. Future multi-agent direction

AZ Intelligence may later include multiple specialized AI agents or digital entities. This is a future architecture direction, not a claim that these agents currently exist.

Possible specializations include:
- **Study Agent:** course material understanding, explanations, and practice.
- **Planning Agent:** workload organization and study scheduling.
- **Research Agent:** research support and source-oriented exploration.
- **Performance Agent:** performance analysis, learning gaps, and progress insights.

AZI remains the primary student-facing companion and coherent guide to the wider AZ Intelligence system. Specialized agents should work behind or alongside AZI without creating a confusing collection of unrelated bots. Their names, personalities, permissions, and visual designs can be defined when those capabilities are actually planned.

## 7. Character / visual identity direction

Create an original, recognizable character or visual entity that represents AZI. The approved creative direction is:

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

## 8. Product and implementation boundaries

- The main section is named **AZ Intelligence**.
- The primary companion is **AZI**, with a student-customizable nickname.
- AZI works across Workspace, Notebook, Focus, and Planning rather than replacing them.
- Keep the first implementation practical and incremental; do not introduce a costly AI subscription or provider commitment without an explicit product/owner decision.
- Do not build or ship a mascot image based only on this text. The character has **not yet been generated or approved visually**.
- Preserve AZ's existing visual identity and current design reference. The character should complement the product, not introduce a conflicting visual system.
- Do not claim proactive intelligence, learning, monitoring, or agent capabilities are implemented unless the codebase demonstrably supports them.

## 9. Current decision

The following naming and product direction is approved:
- **AZ** = platform brand.
- **AZ Intelligence** = intelligence system and main section.
- **AZI** = default name of the primary personal companion.
- **Custom nickname** = student-selected display name for their own AZI.

AZI is intended to be context-aware, proactive when genuinely useful, and available on demand. AZ Intelligence may grow into a multi-agent system, with AZI remaining the primary companion and guide.

The product naming and creative direction are approved. Final character artwork, exact appearance, and implementation details remain open for review after visual concepts are produced.
