# AZ Staging Web Setup

This branch is an isolated local-web configuration for the disposable `AZ-Staging` Supabase project.

## Safety boundary

- The staging mode uses only project ref `tskdpubkxkirtmrwujrs`.
- The normal `npm run dev` and `npm run build` commands are unchanged.
- No production or primary AZ project settings are changed.
- Never put a `service_role` key in a Vite environment variable. Browser code must use only the Staging publishable key.
- Do not commit `.env.staging.local`; it is ignored by Git.

## Local setup (Windows PowerShell)

1. Check out branch `test/az-staging-web-config-20261111`.
2. Install dependencies with `npm ci`.
3. Copy the template:

   ```powershell
   Copy-Item .env.staging.example .env.staging.local
   ```

4. Open `.env.staging.local` and replace `YOUR_SUPABASE_STAGING_PUBLISHABLE_KEY` with the publishable key from the **AZ-Staging** project only.
5. Start the local staging-configured web app:

   ```powershell
   npm run dev:staging
   ```

6. Sign in with the two Auth test users created in AZ-Staging. Use their own test credentials; never share passwords or access tokens in chat.

## Verification

- `npm run build:staging` checks the TypeScript/Vite production build using staging mode.
- The app's existing Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; Vite's `staging` mode loads `.env.staging.local`.
- This setup does not itself prove Storage isolation. That requires uploading a harmless test document as User A, marking its database row ready through the normal trusted processing path, then invoking the signed-URL endpoint as A and B.
- Do not fabricate a `documents` row or storage object with SQL to simulate a real upload.

No deployment, merge, migration, or live-data operation is part of this setup.
