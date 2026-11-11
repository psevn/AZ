import { supabase } from "./supabase";

type RecoverableStatus = "uploaded" | "processing";

async function invokeProcessing(
  client: NonNullable<typeof supabase>,
  body: Record<string, unknown>,
) {
  const { data, error } = await client.functions.invoke("process-document-pages", { body });
  if (error) throw error;
  if (!data || data.ok !== true) {
    throw new Error(typeof data?.error === "string" ? data.error : "Document processing did not complete.");
  }
  return data as Record<string, unknown>;
}

function failureReason(cause: unknown): string {
  if (cause && typeof cause === "object" && "name" in cause && cause.name === "PasswordException") {
    return "password_protected";
  }
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (message.includes("invalid pdf") || message.includes("pdf header") || message.includes("format")) {
    return "invalid_pdf";
  }
  return "processing_failed";
}

export async function recoverDocumentProcessing(
  documentId: string,
  title: string,
  status: RecoverableStatus,
  onProgress?: (stage: "downloading" | "extracting" | "saving" | "finalizing", current?: number, total?: number) => void,
): Promise<void> {
  const client = supabase;
  if (!client) throw new Error("Document storage is not configured.");

  let processingStarted = false;
  let processingToken: string | null = null;
  try {
    onProgress?.("downloading");
    const { data: signed, error: signedError } = await client.functions.invoke(
      "create-document-signed-url",
      { body: { documentId } },
    );
    if (signedError) throw signedError;
    if (!signed || typeof signed.signedUrl !== "string") {
      throw new Error("The document link service returned an invalid response.");
    }

    const response = await fetch(signed.signedUrl);
    if (!response.ok) throw new Error("Could not download the original PDF. Please try again.");
    const blob = await response.blob();
    if (blob.size <= 0 || blob.size > 20 * 1024 * 1024) {
      throw new Error("The original PDF is empty or exceeds the 20 MB limit.");
    }
    const file = new File([blob], (title || "Study document") + ".pdf", { type: "application/pdf" });

    const started = await invokeProcessing(client, {
      action: status === "uploaded" ? "start" : "resume",
      documentId,
    });
    if (typeof started.processingToken !== "string") {
      throw new Error("The processing service returned an invalid attempt token.");
    }
    processingToken = started.processingToken;
    processingStarted = true;

    onProgress?.("extracting", 0, 0);
    const { extractPdfPages } = await import("./extractPdfText");
    const { pages, pageCount } = await extractPdfPages(file, (current, total) => {
      onProgress?.("extracting", current, total);
    });

    const { makePageBatches } = await import("./pdfTextPipeline.mjs");
    const batches = makePageBatches(documentId, pages);
    onProgress?.("saving", 0, batches.length);
    for (let index = 0; index < batches.length; index += 1) {
      await invokeProcessing(client, {
        action: "save_pages",
        documentId,
        processingToken,
        pages: batches[index],
      });
      onProgress?.("saving", index + 1, batches.length);
    }

    onProgress?.("finalizing");
    await invokeProcessing(client, { action: "complete", documentId, pageCount, processingToken });
    processingStarted = false;
  } catch (cause) {
    if (processingStarted) {
      const { error } = await client.functions.invoke("process-document-pages", {
        body: { action: "fail", documentId, processingToken, reasonCode: failureReason(cause) },
      });
      if (error) console.error("Could not record recovered document failure:", error.message);
    }
    throw cause;
  }
}
