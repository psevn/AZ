# AZ Web Design Reference — AZ_promo_v5

**Status:** Primary visual/product-experience reference for the AZ web interface; AZ Projects collaboration is now explicitly approved for the V1 scope  
**Source:** User-provided video `AZ_promo_v5.mp4` (28 seconds, 910×512, 30 fps; reviewed frame-by-frame via representative samples)  
**Recorded:** 2026-11-06

> This document translates the supplied promo into an implementation-oriented design reference. Promotional concepts do not automatically expand V1 scope. AZ Projects collaboration has since been explicitly approved and is specified separately; other promotional concepts remain deferred unless explicitly approved.

## 1. Core direction

AZ should feel like **one unified academic workspace** replacing the student's scattered apps, tabs, notes, and study tools. The core message in the video is “One app. All your studying.” The experience should communicate focus, clarity, momentum, and a credible near-future academic product.

This is not merely a black website with a gradient logo. The product UI itself must carry the identity: a purposeful dark workspace, crisp hierarchy, clear task states, focused panels, restrained luminous accents, and coherent transitions between planning and studying.

## 2. Visual language

- **Overall mood:** futuristic, premium, calm, focused, spatial/immersive without sacrificing readability.
- **Base surfaces:** near-black / very deep charcoal backgrounds; layered dark panels with subtle separation rather than flat black everywhere.
- **Accent language:** electric blue, cyan/turquoise, and violet gradients consistent with the official AZ monogram. Use brighter accent colors selectively for active states, actions, timers, and subject cards.
- **Typography:** modern sans-serif; strong large page titles (e.g. “Today”, “Library”), restrained secondary text, readable task labels. Clear contrast between primary, secondary, and muted information.
- **Shapes:** rounded but not excessively pill-shaped panels and cards; compact rounded icon containers; consistent radii and spacing.
- **Depth:** subtle glow/ambient light and soft gradients can create a sense of space. Avoid heavy blur, constant animation, visual noise, or effects that compete with study content.
- **Logo:** use the user's official geometric AZ monogram and its cyan/blue/violet gradient. Do not replace it with plain text or an unrelated icon.

## 3. App shell and navigation

The promo shows a compact vertical left sidebar:
- AZ mark at the top.
- A clear active Home/Today destination represented by a highlighted rounded icon tile.
- Additional destinations represented by simple, consistent line icons (planning/list, AI/study tools, and other product areas).
- The active destination is unmistakable; inactive icons remain subdued.
- Main content occupies the remaining workspace with generous breathing room.

For the responsive web product, preserve the same visual hierarchy on smaller screens, adapting navigation to a mobile-friendly pattern rather than shrinking the desktop sidebar.

## 4. Screens and product moments shown

### 4.1 Today / Home dashboard
The main dashboard is titled **Today**, with a day/context subtitle and a count of priorities (example shown: “Thursday · 3 priorities”).
- A concise list of today's tasks.
- Clear completion affordances (checkbox/check state).
- Task rows presented as distinct dark cards/rows.
- A focus timer panel beside the task list on wide layouts.
- Supporting progress information and a next-exam countdown beneath/near the timer.
- The screen should make the next useful action obvious immediately.

This aligns with the AZ V1 Home and Focus requirements: today's tasks, overdue/upcoming context, quick focus start, next-exam countdown, and simple progress. The timer should be connected to a task and store session duration/completion as already specified.

### 4.2 Planning
The video communicates a unified task/planning experience rather than a separate disconnected to-do app. Planning should feel native to the same workspace and visual system.
- Keep subjects, tasks, deadlines, priority, estimated duration, and manual ordering/editing central.
- Provide Today, Upcoming, and Overdue views.
- Support onboarding that helps a student set up subjects, class/lecture schedule, and initial study tasks so the planner is useful immediately.
- Preserve easy manual creation for users who prefer to start from scratch.
- The video is a visual direction, not evidence that every advanced Notion/Todoist capability is in V1. Keep the agreed V1 scope and phase advanced planning features deliberately.

### 4.3 Subject/document Library
The promo shows a **Library** screen with a grid of subject/course cards (examples visible: Econ 201, Calculus II, Biology, Statistics, Chemistry, Law 101).
- Use visually distinct but coordinated subject cards, with restrained category color accents.
- Each card should identify the subject and show useful context such as chapter/question counts where available.
- A clear Open action takes the student into the relevant subject/document workspace.
- Keep card colors harmonious with AZ's overall palette; do not turn the interface into a rainbow theme.

### 4.4 PDF import and AI study workspace
The video shows a PDF drop/import moment followed by study content:
- Make importing slides/PDFs feel simple and prominent.
- Provide a clear processing/generation state and an obvious next step.
- The summary example uses a document/page preview beside a structured summary panel.
- Summary content should be sourced from the student's uploaded slides, with page references visible and traceable.
- The workspace should feel like a focused study desk, not a generic chat screen.

This maps to V1: PDF upload and extraction with page numbers, summaries with source pages, Ask with a small usage cap, and generated practice questions with correct answers, explanations, and source pages.

### 4.5 Practice exam / question generation
The promo positions AZ as turning uploaded material into practice exams. Keep the product promise accurate:
- Generate practice from the student's own slides and past exams.
- Show question format, answer choices, explanations, results, and source-page traceability.
- Include retry and mistake review.
- **Never claim to predict the professor's real exam** or guarantee what will appear on it.

### 4.6 Collaboration / QR attendance moment
A scene shows an event/class screen with a QR code and participant submission statuses (e.g. submitted / joined). This is a promotional concept only.
- **Not part of AZ V1:** community, groups, live gatherings, or collaboration/attendance flows remain excluded per the current scope decision.
- Do not build these screens or expose them as working V1 functionality without a new explicit product decision.
- If retained in future vision, treat as a later-stage capability, not a current MVP promise.

## 5. Motion and atmosphere

- Use subtle ambient light/gradient movement in selected hero or transition areas.
- Use purposeful transitions between workspace states and screens; interactions should feel responsive and polished.
- Hover/focus states should be noticeable but restrained.
- Motion must never delay core actions or make the app feel heavy, especially on the user's modest Windows development hardware and on student devices.
- Prioritize accessible reduced-motion behavior, keyboard focus visibility, and touch-friendly hit targets.
- Do not interpret the promo's video editing effects as a requirement to animate every UI element.

## 6. Brand and customization guardrails

- Official AZ monogram and cyan → blue → violet identity remain the brand anchor.
- User customization may offer curated, harmonious color palettes while preserving contrast and brand coherence.
- Avoid Pride/LGBTQ+-coded rainbow palettes or rainbow presentation as a theme direction. This does not prohibit ordinary user-selected colors; palettes must remain curated and visually coherent.
- Dark-first is the dominant visual direction shown in this reference. Any light theme should be a considered alternative, not a different product identity.

## 7. V1 implementation priorities

Use the reference to guide implementation in this order:
1. App shell, responsive navigation, typography, dark surfaces, spacing, and brand tokens.
2. Today dashboard with task list, priority context, focus timer, countdown, and progress.
3. Planning experience, including a useful onboarding/setup flow for subjects and class schedule while preserving manual setup.
4. Subject/document Library.
5. PDF import and source-aware summary/Ask/Quiz workspace.
6. Question results, retry, and mistake review.
7. Subtle motion, glow, hover, and polish after the core flows are reliable.

Do not let visual polish displace authentication/data isolation, RLS, upload reliability, AI usage limits/cost logging, account deletion, or other MVP requirements.

## 8. What this reference does and does not decide

**It decides / strongly guides:** the overall web visual direction, dark futuristic workspace, sidebar shell, Today dashboard composition, library-card language, PDF-to-summary presentation, and the unified “one app” product feeling.

**It does not automatically decide:** final exact pixel measurements, final component implementation, every icon, every animation, expanded Notion/Todoist parity, collaboration features, or any feature excluded from V1. Those require implementation review and/or an explicit product decision.

## 9. Review checklist for future design work

Before accepting a new AZ screen, ask:
- Does it look and feel like it belongs to the same unified AZ workspace?
- Is the AZ logo and gradient identity respected?
- Is the hierarchy immediately clear, especially the next action?
- Are task, study, and source-reference details readable?
- Are color, glow, and motion restrained enough for long study sessions?
- Does it work responsively and with keyboard/touch accessibility?
- Does it stay within the approved V1 scope?
- Does it preserve the core loop: **Plan → Study → Practice → Review mistakes → Improve**?

---
**Decision note:** When discussing or implementing AZ web design, use `AZ_promo_v5` as the primary current reference unless the user explicitly supersedes it. Earlier references may remain useful for specific motion/atmosphere details, but must not override this newer overall web direction.


## 10. Appearance system — confirmed product decisions

AZ offers two selectable appearance systems in Settings. Students can switch between them at any time; changing appearance must not change product functionality, navigation, or information architecture.

### 10.1 Universe

- Free appearance.
- Dark mode only; do not provide a white/light mode variant.
- Distinctive immersive space-inspired atmosphere: deep cosmic surfaces, restrained stars/nebula imagery, ambient cyan/blue/violet light, and carefully controlled motion.
- Keep study content, task surfaces, and text highly readable. Background effects must remain subordinate to content.

### 10.2 AZ Signature

- Free appearance.
- Supports both Light Mode and Dark Mode.
- Uses the official AZ identity: cyan/turquoise → electric blue → violet.
- More restrained and clean than Universe while remaining recognizably AZ; it is not a generic default theme.

### 10.3 Premium academic backgrounds

- Premium subscribers may unlock a curated library of high-quality academic/discipline-inspired backgrounds, initially including concepts such as Medicine, Engineering, and Computer Science, with room to expand to other disciplines.
- During onboarding, ask the student for their field/major and use it to recommend relevant backgrounds. The student may browse backgrounds from other disciplines too.
- Allow a preview of premium backgrounds without a subscription. Require an explicit subscription upgrade when the student tries to apply/unlock one.
- Keep the free Universe and AZ Signature appearances fully usable; premium backgrounds are an optional customization layer, not a usability restriction.
- Backgrounds must be art-directed, premium-quality, and subtle enough to preserve contrast and long-session readability. They should adapt appropriately to the selected appearance where applicable.
- Do not imply that every student in a discipline must use that discipline's background.

### 10.4 Upgrade messaging and social proof

- The premium prompt should explain the benefit clearly, show the selected background preview, display the actual current price and subscription terms, and provide a clear way to continue with the free experience.
- Use encouraging community-oriented copy, e.g. “Join the next generation of students”, while the verified active-student count is below 10,000.
- Only show “10,000+ students” (or another numeric social-proof claim) after the count is genuinely reached and supported by reliable product analytics. Never fabricate or prematurely round up the user count.
- The onboarding and upgrade flow must feel encouraging, not coercive; do not block access to the free AZ experience.



## 11. Responsive navigation — confirmed product decision

The navigation model must adapt to the device rather than compressing the desktop sidebar onto smaller screens. This is an approved product decision for AZ.

### 11.1 Mobile — five-item bottom navigation

- Use a fixed or safely inset bottom navigation bar with exactly five primary destinations:
  1. **Home**
  2. **Planning**
  3. **Study**
  4. **AZ Projects**
  5. **More**
- Place secondary destinations and utilities inside **More**. Community belongs there and remains visibly marked **Coming Soon** until it is implemented.
- Keep icons, labels, active-state indication, and touch targets clear and comfortable. Respect device safe areas and ensure the bar does not cover page content, forms, or the on-screen keyboard.
- Do not simply shrink or horizontally scroll the desktop sidebar on mobile.

### 11.2 Tablet / iPad — collapsible sidebar

- Retain the vertical sidebar pattern, but make it collapsible to an icon-only rail and expandable to the full labeled navigation.
- Choose the initial expanded/collapsed state based on available viewport width; preserve the user's ability to toggle it.
- Ensure the main workspace receives sufficient width and touch targets remain comfortable.

### 11.3 Desktop — collapsible full sidebar

- Keep the full vertical sidebar as the primary desktop navigation, with labels and the established AZ visual hierarchy.
- Allow the sidebar to collapse into a compact icon rail and expand again without disrupting the current page or losing navigation state.

### 11.4 Responsive quality requirements

- Use responsive breakpoints based on available layout width, not device-name assumptions alone.
- Preserve consistent destinations and information architecture across all three form factors.
- Verify the experience at representative phone, tablet, and desktop widths, including RTL and LTR layouts.
- Test safe-area spacing, keyboard overlap, scrolling, active states, and keyboard/touch accessibility before accepting the implementation.
- The five-item mobile bar is a navigation simplification, not a reduction in AZ functionality; secondary areas remain accessible through **More**.

**Approval:** Explicitly approved by the user on 2026-11-08. Treat this navigation model as the source of truth unless the user changes it.
