import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { lang: "ar" | "en"; onUploaded: () => void };
type UploadStage = "uploading" | "extracting" | "saving" | "finalizing";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const STAGE_COPY = {
  ar: {
    uploading: "جارٍ رفع ملف PDF…",
    extracting: "جارٍ استخراج النص من الصفحات…",
    saving: "جارٍ حفظ النص المستخرج…",
    finalizing: "جارٍ تجهيز المستند للدراسة…",
  },
  en: {
    uploading: "Uploading PDF…",
    extracting: "Extracting text from pages…",
    saving: "Saving extracted text…",
    finalizing: "Preparing the document for study…",
  },
};

async function invokeProcessing(
  client: NonNullable<typeof supabase>,
  body: Record<string, unknown>,
) {
  const { data, error } = await client.functions.invoke("process-document-pages", { body });
  if (error) throw error;
  if (!data || data.ok !== true) throw new Error("Document processing did not complete.");
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

export default function DocumentUpload({ lang, onUploaded }: Props) {
  const ar = lang === "ar";
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function upload() {
    const client = supabase;
    if (!client || !file || busy) return;
    setError("");
    setMessage("");
    setProgress(null);
    if (!file.name.toLowerCase().endsWith(".pdf") || (file.type !== "" && file.type !== "application/pdf")) {
      setError(ar ? "اختر ملف PDF فقط." : "Choose a PDF file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setError(ar ? "حجم الملف يجب ألا يتجاوز 20 ميجابايت." : "The file must be no larger than 20 MB.");
      return;
    }

    setBusy(true);
    setStage("uploading");
    const documentId = crypto.randomUUID();
    let uploadRecordMayExist = false;
    let uploadCompleted = false;
    let processingStarted = false;
    try {
      uploadRecordMayExist = true;
      const { data: signed, error: signedError } = await client.functions.invoke(
        "create-document-upload-url",
        {
          body: {
            documentId,
            title: file.name.replace(/\.pdf$/i, "").slice(0, 255) || "Study document",
          },
        },
      );
      if (signedError) throw signedError;
      if (!signed || signed.documentId !== documentId || typeof signed.path !== "string" || typeof signed.token !== "string") {
        throw new Error("The upload service returned an invalid response.");
      }

      const { error: uploadError } = await client.storage
        .from("documents")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      uploadCompleted = true;

      await invokeProcessing(client, { action: "start", documentId });
      processingStarted = true;

      setStage("extracting");
      const { extractPdfPages } = await import("../lib/extractPdfText");
      const { pages, pageCount } = await extractPdfPages(file, (current, total) => {
        setProgress({ current, total });
      });

      const { makePageBatches } = await import("../lib/pdfTextPipeline.mjs");
      const batches = makePageBatches(documentId, pages);
      setStage("saving");
      setProgress({ current: 0, total: batches.length });
      for (let index = 0; index < batches.length; index += 1) {
        await invokeProcessing(client, {
          action: "save_pages",
          documentId,
          pages: batches[index],
        });
        setProgress({ current: index + 1, total: batches.length });
      }

      setStage("finalizing");
      await invokeProcessing(client, { action: "complete", documentId, pageCount });
      processingStarted = false;
      setMessage(ar
        ? "تم استخراج نص المستند وتجهيزه. أصبح جاهزاً للفتح والتدريب."
        : "Document text was extracted and saved. It is ready to open and practise.");
      setFile(null);
      onUploaded();
    } catch (cause) {
      if (processingStarted) {
        const { error: statusError } = await client.functions.invoke(
          "process-document-pages",
          { body: { action: "fail", documentId, reasonCode: failureReason(cause) } },
        );
        if (statusError) console.error("Could not record document processing failure:", statusError.message);
      } else if (uploadRecordMayExist && !uploadCompleted) {
        const { error: statusError } = await client.functions.invoke(
          "create-document-upload-url",
          { body: { documentId, action: "mark_failed" } },
        );
        if (statusError) console.error("Could not mark failed document upload:", statusError.message);
      }
      setError(cause instanceof Error
        ? cause.message
        : (ar ? "تعذر تجهيز المستند." : "Could not prepare the document."));
      if (uploadRecordMayExist) onUploaded();
    } finally {
      setBusy(false);
      setStage(null);
      setProgress(null);
    }
  }

  return <section className="document-upload-panel" aria-labelledby="document-upload-title">
    <div className="document-upload-copy">
      <span className="eyebrow">{ar ? "مكتبة المواد" : "YOUR MATERIALS"}</span>
      <h3 id="document-upload-title">{ar ? "أضف مستنداً دراسياً" : "Add a study document"}</h3>
      <p>{ar ? "ارفع محاضراتك وملخصاتك بصيغة PDF لتجميع موادك في مكان واحد. الحد الأقصى 20 ميجابايت." : "Add lecture slides and notes to keep your study materials in one place. Maximum size: 20 MB."}</p>
    </div>
    <label className="document-upload-picker">
      <span>{file ? file.name : (ar ? "اختر ملف PDF" : "Choose a PDF")}</span>
      <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => {
        setError("");
        setMessage("");
        setFile(event.target.files?.[0] ?? null);
      }} />
    </label>
    <button type="button" className="az-btn az-btn--primary" disabled={!file || busy} onClick={() => void upload()}>
      {busy ? (ar ? "جارٍ التجهيز..." : "Preparing...") : (ar ? "رفع وتجهيز المستند" : "Upload and prepare")} ↗
    </button>
    {busy && stage && <p className="document-upload-progress" role="status" aria-live="polite">
      {STAGE_COPY[lang][stage]}
      {progress && progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
    </p>}
    {error && <p className="document-upload-error" role="alert">{error}</p>}
    {message && <p className="document-upload-success" role="status">{message}</p>}
  </section>;
}
