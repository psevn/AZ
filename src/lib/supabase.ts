import { createClient } from "@supabase/supabase-js";
import { demoClient } from "./demoSupabase";

// Build-time switch used only by the visual-QA pipeline (see docs/design/AZ-WEB-DESIGN-WORLD-CLASS-PLAN.md).
const demoMode = import.meta.env.VITE_DEMO === "1";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigReady = demoMode || Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !supabaseUrl.includes("YOUR_PROJECT_REF") &&
    !supabasePublishableKey.includes("YOUR_SUPABASE"),
);

export const supabase = demoMode
  ? demoClient
  : supabaseConfigReady
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
