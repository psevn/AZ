import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_ANON_KEY: "test-anon-key",
          COLLAB_TICKET_SECRET: "test-only-secret-that-is-long-enough-for-local-tests",
          COLLAB_REVOKE_SECRET: "test-only-revoke-secret-that-is-long-enough",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
