import { createClient } from "npm:@supabase/supabase-js@2";
import {
  extractResponsesOutput,
  makeOpenAIRequest,
  QUIZ_LIMITS,
  validateGeneratedQuestions,
} from "../_shared/quizGeneration.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const FEATURE = "generate_quiz";
const MODEL_PRICING_CONFIG = "openai_model_pricing";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function readBearerToken(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeTokenCount(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function calculateCost(tokens: { input: number; output: number }, pricing: Record<string, unknown>) {
  const inputRate = Number(pricing.input_per_million_usd);
  const outputRate = Number(pricing.output_per_million_usd);
  if (!Number.isFinite(inputRate) || inputRate < 0 || !Number.isFinite(outputRate) || outputRate < 0) {
    throw new Error("invalid_model_pricing");
  }
  return (tokens.input * inputRate + tokens.output * outputRate) / 1_000_000;
}

function estimatedTokens(sourceCharacters: number, questionCount: number) {
  // Conservative reservation estimate; provider-reported usage replaces it at settlement.
  return { input: Math.ceil(sourceCharacters / 3) + 1_000, output: questionCount * 500 };
}

async function refund(adminClient: ReturnType<typeof createClient>, userId: string, requestKey: string, reason: string) {
  const { error } = await adminClient.rpc("refund_credits", {
    p_user_id: userId,
    p_feature: FEATURE,
    p_request_key: requestKey,
    p_error: reason.slice(0, 240),
  });
  if (error) console.error("generate-quiz refund failed:", error.code);
}

async function loadReplay(adminClient: ReturnType<typeof createClient>, userId: string, quizId: string) {
  const { data: quiz, error: quizError } = await adminClient
    .from("quizzes").select("id,document_id").eq("id", quizId).eq("user_id", userId).maybeSingle();
  if (quizError || !quiz) return null;

  const [{ data: document }, { data: rows, error: questionsError }] = await Promise.all([
    adminClient.from("documents").select("id,title").eq("id", quiz.document_id).eq("user_id", userId).maybeSingle(),
    adminClient.from("quiz_questions")
      .select("id,prompt,choices,source_page,topic,difficulty")
      .eq("quiz_id", quizId).eq("user_id", userId).order("position_no", { ascending: true }),
  ]);
  if (questionsError || !document || !Array.isArray(rows) || rows.length < QUIZ_LIMITS.minQuestions) return null;
  return {
    quizId,
    document: { id: document.id, title: document.title },
    questions: rows,
    questionCount: rows.length,
    provider: "openai",
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
  if (!model?.trim()) return json(503, { error: "Quiz generation is not configured: OPENAI_MODEL must name a model enabled for this OpenAI account." });
  if (!openAIKey) return json(503, { error: "AI quiz generation is not configured yet." });

  let body: { documentId?: unknown; language?: unknown; questionCount?: unknown; topic?: unknown; requestKey?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8192) {
      return json(413, { error: "Quiz request is too large." });
    }
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) return json(400, { error: "Invalid JSON request body." });
    body = parsed;
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const language = body.language === "ar" || body.language === "en" ? body.language : null;
  const questionCount = Number.isInteger(body.questionCount) ? Number(body.questionCount) : 8;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const requestKey = typeof body.requestKey === "string" ? body.requestKey.trim() : "";
  if (!documentId || !language || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey) ||
      questionCount < QUIZ_LIMITS.minQuestions || questionCount > QUIZ_LIMITS.maxQuestions || topic.length > 120) {
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
    .from("documents").select("id,title,subject_id,status")
    .eq("id", documentId).eq("user_id", userId).eq("status", "ready").maybeSingle();
  if (documentError) {
    console.error("generate-quiz document lookup failed:", documentError.code);
    return json(500, { error: "Could not read the selected document." });
  }
  if (!document) return json(404, { error: "Ready document not found." });

  const { data: pageRows, error: pagesError } = await userClient
    .from("document_pages").select("page_no,text")
    .eq("document_id", documentId).eq("user_id", userId)
    .order("page_no", { ascending: true }).limit(QUIZ_LIMITS.maxPages);
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
  const { data: pricingRow, error: pricingError } = await adminClient
    .from("app_config").select("value").eq("key", MODEL_PRICING_CONFIG).maybeSingle();
  const allPricing = isRecord(pricingRow?.value) ? pricingRow.value : null;
  const modelPricing = allPricing && isRecord(allPricing[model]) ? allPricing[model] : null;
  if (pricingError || !modelPricing) {
    console.error("generate-quiz model pricing is not configured:", pricingError?.code ?? "missing-model-price");
    return json(503, { error: "Quiz generation pricing is not configured for this model." });
  }

  let estimatedCost: number;
  try {
    estimatedCost = calculateCost(estimatedTokens(boundedPages.reduce((sum, page) => sum + page.text.length, 0), questionCount), modelPricing) * 1.25;
  } catch {
    return json(503, { error: "Quiz generation pricing configuration is invalid." });
  }

  const { data: reservationRows, error: reservationError } = await adminClient.rpc("reserve_quiz_credits", {
    p_user_id: userId,
    p_request_key: requestKey,
    p_question_count: questionCount,
    p_page_count: boundedPages.length,
    p_est_cost: estimatedCost,
  });
  const reservation = Array.isArray(reservationRows) ? reservationRows[0] : null;
  if (reservationError || !reservation) {
    console.error("generate-quiz reservation failed:", reservationError?.code ?? "invalid-reservation-result");
    return json(503, { error: "Could not reserve quiz usage. Please try again." });
  }
  if (reservation.r_replay) {
    if (reservation.r_status === "succeeded" && typeof reservation.r_result_ref === "string") {
      const replay = await loadReplay(adminClient, userId, reservation.r_result_ref);
      return replay ? json(200, replay) : json(503, { error: "The saved quiz result could not be recovered safely." });
    }
    if (reservation.r_status === "reserved") return json(409, { error: "This quiz request is already being processed. Retry with the same request key shortly." });
    if (reservation.r_status === "denied" || String(reservation.r_reason ?? "").startsWith("daily_limit") ||
        String(reservation.r_reason ?? "").startsWith("monthly_limit") || String(reservation.r_reason ?? "").startsWith("global_cap")) {
      return json(429, { error: "Your daily, monthly, or service-wide AI usage limit has been reached." });
    }
    return json(409, { error: "This request key has already been used. Start a new quiz request." });
  }
  if (reservation.r_status === "denied") {
    return json(429, { error: "Your daily, monthly, or service-wide AI usage limit has been reached." });
  }
  if (reservation.r_status !== "reserved") return json(503, { error: "Could not reserve quiz usage." });

  let generated: ReturnType<typeof validateGeneratedQuestions>;
  let responseId: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let latencyMs = 0;
  const startedAt = Date.now();
  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(makeOpenAIRequest({ model, language, questionCount, topic, pages: boundedPages })),
      signal: AbortSignal.timeout(45000),
    });
    const payload: unknown = await openAIResponse.json();
    latencyMs = Date.now() - startedAt;
    if (isRecord(payload) && typeof payload.id === "string") responseId = payload.id;
    if (!openAIResponse.ok) {
      await refund(adminClient, userId, requestKey, `openai_http_${openAIResponse.status}`);
      console.error("OpenAI Responses API failed:", openAIResponse.status, responseId ?? "no-request-id");
      return json(openAIResponse.status === 429 ? 429 : 502, { error: "AI could not prepare this quiz. Please try again." });
    }
    const usage = isRecord(payload) && isRecord(payload.usage) ? payload.usage : {};
    inputTokens = safeTokenCount(usage.input_tokens);
    outputTokens = safeTokenCount(usage.output_tokens);
    generated = validateGeneratedQuestions(extractResponsesOutput(payload), boundedPages.map((page) => page.page_no), questionCount);
  } catch (error) {
    await refund(adminClient, userId, requestKey, error instanceof Error ? error.message : "generation_or_validation_failed");
    console.error("generate-quiz model/validation failure:", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "AI returned an invalid quiz. No quiz was saved; please try again." });
  }

  const { data: saved, error: saveError } = await adminClient.rpc("create_generated_quiz", {
    p_user_id: userId, p_document_id: documentId, p_questions: generated,
  });
  if (saveError || !Array.isArray(saved) || !saved[0]?.quiz_id || !Array.isArray(saved[0]?.questions)) {
    await refund(adminClient, userId, requestKey, "quiz_persistence_failed");
    console.error("generate-quiz save failed:", saveError?.code ?? "invalid-rpc-result");
    return json(503, { error: "Quiz storage is not ready. No quiz was returned." });
  }

  if (inputTokens <= 0 || outputTokens <= 0) {
    await refund(adminClient, userId, requestKey, "provider_usage_missing");
    return json(502, { error: "AI usage details were unavailable; the reservation was refunded." });
  }
  const actualCost = calculateCost({ input: inputTokens, output: outputTokens }, modelPricing);
  const { error: usageLogError } = await adminClient.from("ai_usage_log").update({
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: actualCost,
  }).eq("user_id", userId).eq("feature", FEATURE).eq("request_key", requestKey);
  if (usageLogError) {
    await refund(adminClient, userId, requestKey, "usage_logging_failed");
    console.error("generate-quiz token usage logging failed:", usageLogError.code);
    return json(503, { error: "Could not record AI usage safely; the reservation was refunded." });
  }

  const { error: settleError } = await adminClient.rpc("settle_credits", {
    p_user_id: userId,
    p_feature: FEATURE,
    p_request_key: requestKey,
    p_actual_cost: actualCost,
    p_provider: "openai",
    p_model: model,
    p_latency_ms: latencyMs,
    p_result_ref: saved[0].quiz_id,
  });
  if (settleError) {
    console.error("generate-quiz settlement failed:", settleError.code, responseId ?? "no-request-id");
    return json(503, { error: "The quiz was saved but usage settlement is pending. Retry this request shortly." });
  }

  return json(200, {
    quizId: saved[0].quiz_id,
    document: { id: document.id, title: document.title },
    questions: saved[0].questions,
    questionCount: saved[0].questions.length,
    provider: "openai",
    model,
  });
});
