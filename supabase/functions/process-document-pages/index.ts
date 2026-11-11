import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 400 * 1024;
const MAX_PAGES_PER_BATCH = 20;
const MAX_PAGE_CHARS = 18_000;
const MAX_DOCUMENT_PAGES = 1_000;
const STALE_PROCESSING_MS = 30 * 60 * 1000;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function readBearerToken(request: Request) {
  const match = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function readLimitedBody(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error("too_large");
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function detectLanguage(text: string): "ar" | "en" | "mixed" {
  const arabicCount = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latinCount = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabicCount > 0 && latinCount > 0) return "mixed";
  if (arabicCount > 0) return "ar";
  if (latinCount > 0) return "en";
  return "mixed";
}

const FAILURE_REASONS: Record<string, string> = {
  no_text: "No selectable text was found. OCR is not available yet.",
  password_protected: "This PDF is password-protected and could not be processed.",
  invalid_pdf: "This file could not be read as a valid PDF.",
  processing_failed: "PDF text extraction did not complete. Please try again.",
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });

  const token = readBearerToken(request);
  if (!token) return json(401, { error: "Authentication required." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    console.error("process-document-pages is missing server configuration.");
    return json(503, { error: "Document processing is not configured." });
  }

  let body: Record<string, unknown>;
  try {
    const rawBody = await readLimitedBody(request);
    const parsed: unknown = JSON.parse(rawBody);
    if (!isRecord(parsed)) return json(400, { error: "Invalid JSON request body." });
    body = parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") {
      return json(413, { error: "Processing batch is too large." });
    }
    return json(400, { error: "Invalid JSON request body." });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!UUID_RE.test(documentId)) return json(400, { error: "A valid document ID is required." });

  const action = body.action;
  if (action !== "start" && action !== "save_pages" && action !== "complete" && action !== "fail" && action !== "resume") {
    return json(400, { error: "Unsupported processing action." });
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
    .select("id,user_id,status,attempts,locked_at")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (documentError) {
    console.error("process-document-pages document lookup failed:", documentError.code);
    return json(500, { error: "Could not verify document access." });
  }
  if (!document) return json(404, { error: "Document not found." });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "start") {
    if (document.status !== "uploaded" && document.status !== "failed") {
      return json(409, { error: "This document cannot start processing in its current state." });
    }

    const processingToken = new Date().toISOString();
    const { data: started, error: startError } = await adminClient
      .from("documents")
      .update({
        status: "processing",
        attempts: Number(document.attempts ?? 0) + 1,
        locked_at: processingToken,
        processed_at: null,
        page_count: null,
        language: null,
        failed_reason: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .in("status", ["uploaded", "failed"])
      .select("id")
      .maybeSingle();

    if (startError) {
      console.error("process-document-pages start failed:", startError.code);
      return json(500, { error: "Could not start document processing." });
    }
    if (!started) return json(409, { error: "Document processing has already started." });

    const { error: deleteError } = await adminClient
      .from("document_pages")
      .delete()
      .eq("document_id", documentId)
      .eq("user_id", userId);
    if (deleteError) {
      await adminClient.from("documents")
        .update({ status: "failed", locked_at: null, failed_reason: "Could not reset extracted pages." })
        .eq("id", documentId).eq("user_id", userId).eq("status", "processing");
      console.error("process-document-pages page reset failed:", deleteError.code);
      return json(500, { error: "Could not prepare document pages." });
    }
    return json(200, { ok: true, status: "processing", processingToken });
  }

  if (action === "resume") {
    if (document.status !== "processing") {
      return json(409, { error: "Only an interrupted processing document can be resumed." });
    }
    const lockedAt = typeof document.locked_at === "string" ? document.locked_at : null;
    const lockTime = lockedAt ? Date.parse(lockedAt) : Number.NaN;
    const isStale = lockedAt === null || (Number.isFinite(lockTime) && Date.now() - lockTime >= STALE_PROCESSING_MS);
    if (!isStale) {
      return json(409, { error: "Document processing is still active. Try again later." });
    }

    const processingToken = new Date().toISOString();
    let reclaimQuery = adminClient.from("documents")
      .update({
        attempts: Number(document.attempts ?? 0) + 1,
        locked_at: processingToken,
        processed_at: null,
        page_count: null,
        language: null,
        failed_reason: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .eq("status", "processing");
    reclaimQuery = lockedAt ? reclaimQuery.eq("locked_at", lockedAt) : reclaimQuery.is("locked_at", null);
    const { data: reclaimed, error: reclaimError } = await reclaimQuery.select("id").maybeSingle();
    if (reclaimError) {
      console.error("process-document-pages resume failed:", reclaimError.code);
      return json(500, { error: "Could not resume document processing." });
    }
    if (!reclaimed) return json(409, { error: "Document processing state changed. Refresh and try again." });

    const { error: deleteError } = await adminClient.from("document_pages")
      .delete().eq("document_id", documentId).eq("user_id", userId);
    if (deleteError) {
      await adminClient.from("documents")
        .update({ status: "failed", locked_at: null, failed_reason: "Could not reset extracted pages." })
        .eq("id", documentId).eq("user_id", userId).eq("status", "processing");
      console.error("process-document-pages resume page reset failed:", deleteError.code);
      return json(500, { error: "Could not prepare document pages for recovery." });
    }
    return json(200, { ok: true, status: "processing", resumed: true, processingToken });
  }

  if (document.status !== "processing") {
    return json(409, { error: "The document is not currently processing." });
  }
  if (typeof body.processingToken !== "string" || body.processingToken !== document.locked_at) {
    return json(409, { error: "This processing attempt is no longer active. Refresh and resume the document." });
  }

  if (action === "save_pages") {
    if (!Array.isArray(body.pages) || body.pages.length < 1 || body.pages.length > MAX_PAGES_PER_BATCH) {
      return json(400, { error: "A batch must contain between 1 and 20 pages." });
    }

    const seen = new Set<number>();
    let totalChars = 0;
    const rows: Array<{ document_id: string; user_id: string; page_no: number; text: string }> = [];
    for (const page of body.pages) {
      if (!isRecord(page) || typeof page.pageNo !== "number" || !Number.isInteger(page.pageNo) ||
          Number(page.pageNo) < 1 || Number(page.pageNo) > MAX_DOCUMENT_PAGES ||
          typeof page.text !== "string" || page.text.length > MAX_PAGE_CHARS ||
          page.text.includes("\u0000")) {
        return json(400, { error: "A page contains invalid text or page metadata." });
      }
      const pageNo = page.pageNo;
      if (seen.has(pageNo)) return json(400, { error: "A batch cannot contain duplicate page numbers." });
      seen.add(pageNo);
      totalChars += page.text.length;
      if (totalChars > 300_000) return json(413, { error: "Page text batch is too large." });
      rows.push({ document_id: documentId, user_id: userId, page_no: pageNo, text: page.text });
    }

    const { error: saveError } = await adminClient
      .from("document_pages")
      .upsert(rows, { onConflict: "document_id,page_no" });
    if (saveError) {
      console.error("process-document-pages page save failed:", saveError.code);
      return json(500, { error: "Could not save extracted page text." });
    }
    return json(200, { ok: true, savedPages: rows.length });
  }

  if (action === "complete") {
    const pageCount = body.pageCount;
    if (typeof pageCount !== "number" || !Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_DOCUMENT_PAGES) {
      return json(400, { error: "A valid page count is required." });
    }

    const { data: pages, error: pagesError } = await adminClient
      .from("document_pages")
      .select("page_no,text")
      .eq("document_id", documentId)
      .eq("user_id", userId)
      .order("page_no", { ascending: true });
    if (pagesError) {
      console.error("process-document-pages completion lookup failed:", pagesError.code);
      return json(500, { error: "Could not verify extracted pages." });
    }

    if (!pages || pages.length !== pageCount ||
        pages.some((page, index) => Number(page.page_no) !== index + 1)) {
      return json(409, { error: "Some document pages are missing. Processing is not complete." });
    }

    const combinedText = pages.map((page) => page.text).join("\n");
    if (combinedText.trim().length === 0) {
      const { data: failed, error: failError } = await adminClient.from("documents")
        .update({
          status: "failed",
          failed_reason: FAILURE_REASONS.no_text,
          locked_at: null,
          page_count: pageCount,
          processed_at: new Date().toISOString(),
        })
        .eq("id", documentId).eq("user_id", userId).eq("status", "processing")
        .select("id").maybeSingle();
      if (failError) {
        console.error("process-document-pages no-text update failed:", failError.code);
        return json(500, { error: "Could not update document processing status." });
      }
      if (!failed) return json(409, { error: "Document processing state changed before completion." });
      return json(422, { error: FAILURE_REASONS.no_text, code: "no_text" });
    }

    const { data: completed, error: completeError } = await adminClient
      .from("documents")
      .update({
        status: "ready",
        page_count: pageCount,
        language: detectLanguage(combinedText),
        processed_at: new Date().toISOString(),
        locked_at: null,
        failed_reason: null,
      })
      .eq("id", documentId)
      .eq("user_id", userId)
      .eq("status", "processing")
      .select("id")
      .maybeSingle();
    if (completeError) {
      console.error("process-document-pages completion update failed:", completeError.code);
      return json(500, { error: "Could not finish document processing." });
    }
    if (!completed) return json(409, { error: "Document processing state changed before completion." });
    return json(200, { ok: true, status: "ready", pageCount });
  }

  const reasonCode = typeof body.reasonCode === "string" ? body.reasonCode : "processing_failed";
  const reason = FAILURE_REASONS[reasonCode] ?? FAILURE_REASONS.processing_failed;
  const { data: failed, error: failError } = await adminClient
    .from("documents")
    .update({ status: "failed", failed_reason: reason, locked_at: null })
    .eq("id", documentId)
    .eq("user_id", userId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  if (failError) {
    console.error("process-document-pages failure update failed:", failError.code);
    return json(500, { error: "Could not update document processing status." });
  }
  if (!failed) return json(409, { error: "Document processing state changed before failure was recorded." });
  return json(200, { ok: true, status: "failed", reasonCode });
});
