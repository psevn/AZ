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
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
