# EZORD COSMOS — Project Decision

**Status:** Approved internal project name and direction  
**Owner:** EZORD  
**Primary product served initially:** AZ

## Naming and ownership

- **EZORD** is the parent company / owner.
- **COSMOS** is the AI-agent and intelligence system owned by EZORD.
- **AZ** is the academic product that COSMOS will initially support.
- Use the full name **EZORD COSMOS** in project documentation and internal references.
- Do not call the system "AZ COSMOS" or "AZ ORBIT".
- This is an internal naming decision, not confirmation that the trademark, company name, or domains are legally available. Perform appropriate trademark/domain checks before public commercial launch.

## Product vision

EZORD COSMOS is envisioned as a cloud-based, proactive intelligence and agent system that helps operate, analyze, improve, and grow EZORD products. AZ is its first supported product.

It is intended to go beyond a coding assistant: monitor relevant signals, analyze data, identify issues and opportunities, coordinate specialized AI-assisted work, and report useful findings to the owner.

## Initial agent roles

These are functional roles, not commitments to separate models or paid subscriptions:

1. **Product Intelligence** — analyze aggregated student/product usage, identify useful and underused features, and recommend product improvements.
2. **Engineering** — monitor repository activity, CI/build/test results, bugs, and propose code fixes or pull requests.
3. **Growth** — support marketing strategy, acquisition experiments, positioning, and growth analysis.
4. **Creative Studio** — develop campaign concepts, educational storytelling, and short-video scripts (for example, historically grounded stories about Einstein or Tesla connected to student learning and AZ).
5. **Research** — research competitors, technologies, market opportunities, and relevant educational trends.
6. **Strategy** — synthesize findings, prioritize work, and prepare clear recommendations and reports.

## Operating principles and safeguards

- Prefer cloud execution; do not depend on the owner's local computer being online.
- Start with useful monitoring, repository checks, and notifications before building the full agent system.
- Potential architecture: GitHub Actions for CI; Cloudflare Workers for webhooks/APIs and scheduled triggers; Cloudflare Queues/Workflows for asynchronous and durable orchestration; Supabase/Postgres for application records and agent activity; OpenAI and/or Anthropic APIs for model capabilities when approved.
- Keep provider API keys in server-side secrets, never in frontend code or the repository.
- Treat student data as sensitive: use aggregation/anonymization where possible, minimize data shared with model providers, and establish consent, retention, and access controls before analyzing personal student content.
- Agents may inspect, analyze, draft, and propose changes within granted permissions.
- Require explicit owner approval for destructive actions, production database changes, deployments, purchases, merging code, or other high-impact operations.
- Report findings and blockers clearly; do not claim a task was completed unless it was actually verified.

## Budget and implementation constraints

- No new paid subscriptions, API plans, domains, or purchases are approved by this decision.
- Revisit ChatGPT/ OpenAI API and Claude/Anthropic options only when implementation reaches the point where model APIs are needed. Consumer subscriptions and API usage are separate considerations; do not assume either includes the other.
- Begin with free or already available tooling where practical, and verify current plan limits and pricing before implementation.
- Build incrementally; do not imply that the full 24/7 autonomous system already exists. Scheduled reports and event-driven cloud agents are different capabilities.

## Immediate direction

1. Keep the existing AZ daily monitoring task distinct from the future COSMOS system.
2. Establish reliable repository monitoring and CI notifications first.
3. Design the COSMOS data model, permissions, and notification flow before connecting paid model APIs.
4. Add the internal COSMOS dashboard to AZ/EZORD products only after the foundations are stable.

This document records the approved direction and gives future contributors and AI coding assistants (including Claude) a shared source of truth. It does not authorize production changes or purchases.
