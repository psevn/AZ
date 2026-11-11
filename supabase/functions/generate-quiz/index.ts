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

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function readBearerToken(request: Request) {
  const value = request.headers.get("Authorization") ?? "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
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
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-6-astra";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("generate-quiz is missing Supabase server configuration.");
    return json(503, { error: "The study service is not configured." });
  }
  if (!openAIKey) return json(503, { error: "AI quiz generation is not configured yet." });

  let body: { documentId?: unknown; language?: unknown; questionCount?: unknown; topic?: unknown };
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 8192) {
      return json(413, { error: "Quiz request is too large." });
    }
    body = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const language = body.language === "ar" || body.language === "en" ? body.language : null;
  const questionCount = Number.isInteger(body.questionCount) ? Number(body.questionCount) : 8;
  const topic = typeof body.topic === "string" ? body.topic.trim() : "";

  if (!documentId || !language || questionCount < QUIZ_LIMITS.minQuestions || questionCount > QUIZ_LIMITS.maxQuestions || topic.length > 120) {
    return json(400, { error: "Invalid quiz settings." });
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

  let generated;
  let responseId: string | undefined;
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

    const payload = await openAIResponse.json();
    responseId = typeof payload.id === "string" ? payload.id : undefined;
    if (!openAIResponse.ok) {
      console.error("OpenAI Responses API failed:", openAIResponse.status, responseId ?? "no-request-id");
      return json(openAIResponse.status === 429 ? 429 : 502, { error: "AI could not prepare this quiz. Please try again." });
    }
    generated = validateGeneratedQuestions(
      extractResponsesOutput(payload),
      boundedPages.map((page) => page.page_no),
      questionCount,
    );
  } catch (error) {
    console.error("generate-quiz model/validation failure:", error instanceof Error ? error.message : "unknown");
    return json(502, { error: "AI returned an invalid quiz. No quiz was saved; please try again." });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: saved, error: saveError } = await adminClient.rpc("create_generated_quiz", {
    p_user_id: userId,
    p_document_id: documentId,
    p_questions: generated,
  });

  if (saveError || !Array.isArray(saved) || !saved[0]?.quiz_id || !Array.isArray(saved[0]?.questions)) {
    console.error("generate-quiz save failed:", saveError?.code ?? "invalid-rpc-result");
    return json(503, { error: "Quiz storage is not ready. No quiz was returned." });
  }

  // The RPC response is deliberately safe: no correct indexes or explanations are sent to the browser.
  return json(200, {
    quizId: saved[0].quiz_id,
    document: { id: document.id, title: document.title },
    questions: saved[0].questions,
    questionCount: saved[0].questions.length,
    provider: "openai",
    model,
  });
});
