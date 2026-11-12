import { createClient } from "npm:@supabase/supabase-js@2";
import { corsForRequest } from "../_shared/cors.ts";
import { checkUserRateLimit } from "../_shared/rateLimit.ts";
import {
  extractResponsesOutput,
  makeOpenAIRequest,
  QUIZ_LIMITS,
  validateGeneratedQuestions,
} from "../_shared/quizGeneration.mjs";

const FEATURE = "generate_quiz";
const PROMPT_VERSION = "quiz-v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OUTPUT_TOKENS = 6000;


function readBearerToken(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  const match = value.match(/^Bearer\\s+(.+)$/i);
  return match?.[1] ?? null;
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function quizCostUsd(inputTokens: number, outputTokens: number, pricing: { input_usd_per_1m: number; output_usd_per_1m: number }) {
  return (inputTokens * pricing.input_usd_per_1m + outputTokens * pricing.output_usd_per_1m) / 1_000_000;
}

function responsePayload(saved: any, document: { id: string; title: string }, model: string) {
  return {
    quizId: saved.quiz_id,
    document,
    questions: saved.questions,
    questionCount: saved.questions.length,
    provider: "openai",
    model,
  };
}

async function refund(adminClient: any, userId: string, requestKey: string, reason: string) {
  const { error } = await adminClient.rpc("refund_credits", {
    p_user_id: userId,
    p_feature: FEATURE,
    p_request_key: requestKey,
    p_error: reason,
  });
  if (error) console.error("generate-quiz reservation refund failed:", error.code);
}

Deno.serve(async (request: Request) => {
  const cors = corsForRequest(request);
  const json = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), { status, headers: cors.headers });
  if (!cors.allowed) return json(cors.status, {
    error: cors.code === "CORS_NOT_CONFIGURED"
      ? "This Edge Function has no configured browser origin allowlist."
      : "This request origin is not allowed.",
    code: cors.code ?? "CORS_REJECTED",
  });
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors.headers });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const token = readBearerToken(request);
  if (!token) return json(401, { error: "Authentication required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openAIKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL");

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("generate-quiz is missing Supabase server configuration.");
    return json(503, { error: "The study service is not configured." });
  }
  if (!openAIKey) return json(503, { error: "AI quiz generation is not configured yet." });
  if (!model?.trim()) return json(503, { error: "Quiz generation model is not configured. Set OPENAI_MODEL to a model enabled for this account." });

  let body: { documentId?: unknown; language?: unknown; questionCount?: unknown; topic?: unknown; requestKey?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8192) {
      return json(413, { error: "Quiz request is too large." });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { error: "Invalid JSON request body." });
    body = parsed as typeof body;
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const language = body.language === "ar" || body.language === "en" ? body.language : null;
  const questionCount = Number.isInteger(body.questionCount) ? Number(body.questionCount) : 8;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";

  if (!UUID_RE.test(documentId) || !language ||
      questionCount < QUIZ_LIMITS.minQuestions || questionCount > QUIZ_LIMITS.maxQuestions ||
      topic.length > 120 || !UUID_RE.test(requestKey)) {
    return json(400, { error: "Invalid quiz settings or request key." });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "Your session is invalid or expired." });
  const userId = authData.user.id;

  const { data: document, error: documentError } = await userClient
    .from("documents")
    .select("id,title,subject_id,status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("status", "ready")
    .maybeSingle();

  if (documentError) {
    console.error("generate-quiz document lookup failed:", documentError.code);
    return json(500, { error: "Could not read the selected document." });
  }
  if (!document) return json(404, { error: "Ready document not found." });

  const { data: pageRows, error: pagesError } = await userClient
    .from("document_pages")
    .select("page_no,text")
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .order("page_no", { ascending: true })
    .limit(QUIZ_LIMITS.maxPages);

  if (pagesError) {
    console.error("generate-quiz page lookup failed:", pagesError.code);
    return json(500, { error: "Could not read document pages." });
  }

  const pages = (pageRows ?? [])
    .filter((page) => Number.isInteger(page.page_no) && typeof page.text === "string" && page.text.trim())
    .map((page) => ({ page_no: page.page_no, text: page.text.trim() }));
  if (!pages.length) return json(422, { error: "This document has no extracted text pages yet." });

  let remaining = QUIZ_LIMITS.maxCharacters;
  const boundedPages = pages.map((page) => {
    const text = page.text.slice(0, Math.min(QUIZ_LIMITS.maxPageCharacters, remaining));
    remaining -= text.length;
    return { page_no: page.page_no, text };
  }).filter((page) => page.text.length > 0);
  if (!boundedPages.length) return json(422, { error: "The selected document contains no usable text." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Prices are owner-configured in app_config; no model price is embedded in source.
  const { data: pricingConfig, error: pricingError } = await adminClient
    .from("app_config").select("value").eq("key", "openai_model_pricing").maybeSingle();
  const modelPricing = pricingConfig?.value && typeof pricingConfig.value === "object"
    ? pricingConfig.value[model]
    : null;
  if (pricingError || !modelPricing ||
      !finiteNonNegative(modelPricing.input_usd_per_1m) ||
      !finiteNonNegative(modelPricing.output_usd_per_1m)) {
    console.error("generate-quiz model pricing is not configured for the selected model.");
    return json(503, { error: "Pricing is not configured for this model. Ask the AZ owner to configure openai_model_pricing." });
  }

  const inputCharacters = boundedPages.reduce((sum, page) => sum + page.text.length, 0) + topic.length + 2500;
  // Reserve against a conservative character-based input bound and the full output-token ceiling.
  const estimatedInputTokens = inputCharacters * 4;
  const estimatedCost = quizCostUsd(estimatedInputTokens, MAX_OUTPUT_TOKENS, modelPricing);
  const creditMultiplier = questionCount / 8 + boundedPages.length / 40;

  const { data: reservationRows, error: reservationError } = await adminClient.rpc("reserve_credits", {
    p_user_id: userId,
    p_feature: FEATURE,
    p_request_key: requestKey,
    p_est_cost: estimatedCost,
    p_credit_multiplier: creditMultiplier,
  });
  if (reservationError) {
    console.error("generate-quiz credit reservation failed:", reservationError.code);
    return json(503, { error: "Could not reserve quiz-generation credits. Please try again." });
  }
  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows;
  if (!reservation) return json(503, { error: "Could not verify quiz-generation credits." });

  if (reservation.r_replay === true) {
    if (reservation.r_status === "succeeded") {
      const { data: prior } = await adminClient.from("ai_usage_log")
        .select("result_payload").eq("user_id", userId).eq("feature", FEATURE)
        .eq("request_key", requestKey).eq("status", "succeeded").maybeSingle();
      if (prior?.result_payload && typeof prior.result_payload === "object") return json(200, prior.result_payload);
      return json(503, { error: "The saved quiz result is unavailable. The request was not charged again." });
    }
    if (reservation.r_status === "denied" || String(reservation.r_reason ?? "").startsWith("denied:")) {
      return json(429, { error: "Quiz-generation usage limit reached. Please try again after your allowance resets.", code: "USAGE_LIMIT_EXCEEDED" });
    }
    return json(409, { error: "This quiz request is already being processed or has finished unsuccessfully. Start a new request to try again.", code: "REQUEST_ALREADY_USED" });
  }

  if (reservation.r_status === "denied") {
    const reason = String(reservation.r_reason ?? "usage_limit");
    return json(429, {
      error: reason === "global_cap"
        ? "AZ has reached its monthly AI usage budget. Please try again later."
        : "Your quiz-generation daily or monthly allowance has been reached.",
      code: reason === "global_cap" ? "GLOBAL_SPEND_CAP_EXCEEDED" : "USAGE_LIMIT_EXCEEDED",
    });
  }
  if (reservation.r_status !== "reserved") return json(503, { error: "Could not reserve quiz-generation credits." });

  // Successful replays returned above; only new provider work consumes this rate-limit slot.
  const rateLimit = await checkUserRateLimit(adminClient, userId, "generate_quiz");
  if (!rateLimit.allowed) {
    await refund(adminClient, userId, requestKey, "rate_limit_exceeded");
    return json(rateLimit.status, {
      error: rateLimit.message,
      code: rateLimit.code,
      ...(rateLimit.retryAfterSeconds ? { retryAfterSeconds: rateLimit.retryAfterSeconds } : {}),
    });
  }

  const startedAt = Date.now();
  let payload: any;
  let generated: ReturnType<typeof validateGeneratedQuestions>;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(makeOpenAIRequest({
        model,
        language,
        questionCount,
        topic,
        pages: boundedPages,
      })),
      signal: AbortSignal.timeout(45000),
    });

    payload = await openAIResponse.json();
    if (!openAIResponse.ok) {
      await refund(adminClient, userId, requestKey, `provider_http_${openAIResponse.status}`);
      console.error("OpenAI Responses API failed:", openAIResponse.status);
      return json(openAIResponse.status === 429 ? 429 : 502, { error: "AI could not prepare this quiz. No credits were charged." });
    }
    inputTokens = Number(payload?.usage?.input_tokens);
    outputTokens = Number(payload?.usage?.output_tokens);
    if (!Number.isInteger(inputTokens) || inputTokens < 0 ||
        !Number.isInteger(outputTokens) || outputTokens < 0) {
      throw new Error("Missing or invalid provider token usage.");
    }
    generated = validateGeneratedQuestions(
      extractResponsesOutput(payload),
      boundedPages.map((page) => page.page_no),
      questionCount,
    );
  } catch (error) {
    await refund(adminClient, userId, requestKey, error instanceof Error ? error.message.slice(0, 160) : "generation_failed");
    console.error("generate-quiz generation/validation failed:", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "AI returned an invalid or incomplete quiz. No credits were charged." });
  }

  const actualCost = quizCostUsd(inputTokens, outputTokens, modelPricing);
  const { data: finalized, error: finalizeError } = await adminClient.rpc("complete_generated_quiz", {
    p_user_id: userId,
    p_document_id: documentId,
    p_document_title: document.title,
    p_request_key: requestKey,
    p_questions: generated,
    p_actual_cost: actualCost,
    p_provider: "openai",
    p_model: model,
    p_prompt_version: PROMPT_VERSION,
    p_latency_ms: Date.now() - startedAt,
    p_input_tokens: inputTokens,
    p_output_tokens: outputTokens,
  });
  const completed = Array.isArray(finalized) ? finalized[0] : finalized;

  if (finalizeError || !completed?.result_payload) {
    // The RPC is transactional; this lookup handles a response lost after a committed finalization.
    const { data: reservationState } = await adminClient.from("ai_usage_log")
      .select("status,result_payload").eq("user_id", userId).eq("feature", FEATURE)
      .eq("request_key", requestKey).maybeSingle();
    if (reservationState?.status === "succeeded" && reservationState.result_payload) {
      return json(200, reservationState.result_payload);
    }
    await refund(adminClient, userId, requestKey, "quiz_finalization_failed");
    console.error("generate-quiz finalization failed:", finalizeError?.code ?? "invalid-rpc-result");
    return json(503, { error: "Quiz storage or billing is not ready. No credits were charged." });
  }

  // No correct indexes or explanations are sent to the browser.
  return json(200, completed.result_payload);
});
