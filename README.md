# AZ Web

AZ is a web-first academic workspace. This repository starts with the Stage B foundation slice: email/password authentication and an authenticated subject list backed by Supabase.

## Requirements

- Node.js 20.19+ (the project owner currently has Node 26 installed)
- npm
- Access to the AZ Supabase project

## Local setup

1. Clone the repository and enter the project folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local`.
4. In Supabase Dashboard → Project Settings → API, copy the Project URL and the **Publishable** key into `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
   ```

   Never put a `service_role` key or secret key in a `VITE_*` variable or browser code.

5. In Supabase Dashboard → Authentication → URL Configuration, allow the local redirect URL `http://localhost:5173` (and `http://127.0.0.1:5173` if you use that host).
6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open the URL printed by Vite.

## Current slice

- Arabic-first UI with an English toggle and RTL/LTR support.
- Dark/light theme toggle.
- Supabase email/password sign-up and sign-in.
- Email-confirmation message when Supabase requires confirmation.
- Authenticated read/create for the user's own `subjects`, relying on database RLS.
- No service-role key in the frontend.

## Design direction

The primary current visual/product reference is [AZ Promo V5 — Web Design Reference](docs/design/AZ-PROMO-V5-WEB-DESIGN-REFERENCE.md). It documents the dark futuristic unified workspace, navigation, Today dashboard, Library, PDF/AI study workspace, motion principles, and V1 scope guardrails.

## Approved V1 addition — AZ Projects

AZ Projects is approved as a V1 collaboration capability. The MVP scope, user journeys, security requirements, and proposed architecture are documented in [AZ Projects — MVP Product & Technical Specification](docs/product/AZ-PROJECTS-MVP.md).

This is an approved product direction, not an implemented feature yet. The original QR attendance/live-gathering concept remains out of scope.

## Not complete yet

- Invite-code gating.
- Full Stage B navigation and remaining screens.
- Full end-to-end tests with two separate users.
- Production deployment and PWA offline service worker.
- Credit reservation/settlement/refund RPCs.
- Complete V1 schema and Edge Functions.

After installing dependencies, commit the generated `package-lock.json` so installs remain reproducible.
