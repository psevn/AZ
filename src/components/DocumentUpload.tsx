import { useState } from "react";
import { supabase } from "../lib/supabase";
import { createDocumentProcessingError, isTerminalDocumentProcessingError, normalizeDocumentProcessingError } from "../lib/documentProcessingResponse.mjs";

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
  if (error) throw await normalizeDocumentProcessingError(error);
  if (!data || data.ok !== true) throw createDocumentProcessingError(data);
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
  const [dragActive, setDragActive] = useState(false);
  const [stage, setStage] = useState<UploadStage | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function selectFile(nextFile: File | null) {
    setError("");
    setMessage("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!nextFile.name.toLowerCase().endsWith(".pdf") ||
      (nextFile.type !== "" && nextFile.type !== "application/pdf")) {
      setFile(null);
      setError(ar ? "اختر ملف PDF فقط." : "Choose a PDF file only.");
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(ar ? "حجم الملف يجب أن يكون أكبر من صفر وألا يتجاوز 20 ميجابايت." : "The file must be larger than zero and no larger than 20 MB.");
      return;
    }
    setFile(nextFile);
  }

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
    let processingToken: string | null = null;
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

      const started = await invokeProcessing(client, { action: "start", documentId });
      if (typeof started.processingToken !== "string") throw new Error("The processing service returned an invalid attempt token.");
      processingToken = started.processingToken;
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
          processingToken,
          pages: batches[index],
        });
        setProgress({ current: index + 1, total: batches.length });
      }

      setStage("finalizing");
      await invokeProcessing(client, { action: "complete", documentId, pageCount, processingToken });
      processingStarted = false;
      setMessage(ar
        ? "تم استخراج نص المستند وتجهيزه. أصبح جاهزاً للفتح والتدريب."
        : "Document text was extracted and saved. It is ready to open and practise.");
      setFile(null);
      onUploaded();
    } catch (cause) {
      const terminalNoTextFailure = isTerminalDocumentProcessingError(cause);
      if (processingStarted && !terminalNoTextFailure) {
        const { error: statusError } = await client.functions.invoke(
          "process-document-pages",
          { body: { action: "fail", documentId, processingToken, reasonCode: failureReason(cause) } },
        );
        if (statusError) console.error("Could not record document processing failure:", statusError.message);
      } else if (!processingStarted && uploadRecordMayExist && !uploadCompleted) {
        const { error: statusError } = await client.functions.invoke(
          "create-document-upload-url",
          { body: { documentId, action: "mark_failed" } },
        );
        if (statusError) console.error("Could not mark failed document upload:", statusError.message);
      }
      setError(terminalNoTextFailure
        ? (ar
          ? "لم يُعثر على نص قابل للاستخراج. يبدو أن ملف PDF مصوّر ويحتاج إلى OCR، وهي ميزة غير متاحة بعد."
          : "No selectable text was found. This appears to be a scanned PDF; OCR is not available yet.")
        : cause instanceof Error
          ? cause.message
          : (ar ? "تعذر تجهيز المستند." : "Could not prepare the document."));
      if (uploadRecordMayExist) onUploaded();
    } finally {
      setBusy(false);
      setStage(null);
      setProgress(null);
    }
  }

  return (
    <section className="document-upload-panel" aria-label={ar ? "رفع مستند دراسي" : "Upload a study document"}>
      <label
        className={"document-upload-dropzone" + (dragActive ? " is-dragging" : "") + (file ? " has-file" : "")}
        onDragOver={event => {
          event.preventDefault();
          if (!busy) {
            event.dataTransfer.dropEffect = "copy";
            setDragActive(true);
          }
        }}
        onDragLeave={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
        }}
        onDrop={event => {
          event.preventDefault();
          setDragActive(false);
          if (!busy) selectFile(event.dataTransfer.files.item(0));
        }}
      >
        <span className="document-upload-file-icon" aria-hidden="true">PDF</span>
        <strong>{dragActive
          ? (ar ? "أفلت الملف هنا" : "Drop your file here")
          : file ? file.name : (ar ? "اسحب ملف PDF إلى هنا" : "Drop your PDF here")}</strong>
        <span className="document-upload-drop-hint">
          {file
            ? (ar ? "تم اختيار الملف" : "File selected")
            : (ar ? "أو اضغط لاختيار ملف من جهازك" : "or browse files from your device")}
        </span>
        <span className="document-upload-limit">{file
          ? (file.size / (1024 * 1024)).toFixed(1) + " MB"
          : (ar ? "PDF · حتى 20 ميجابايت" : "PDF · Up to 20 MB")}</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label={ar ? "اختر ملف PDF" : "Choose a PDF file"}
          disabled={busy}
          onChange={event => {
            selectFile(event.currentTarget.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />
      </label>

      <ol className="document-upload-steps" aria-label={ar ? "خطوات الدراسة" : "Study steps"}>
        <li>
          <span className="document-upload-step-number">01</span>
          <span><strong>{ar ? "ارفع ملفك" : "Upload your file"}</strong><small>{ar ? "محاضراتك وملخصاتك بصيغة PDF" : "Lecture slides and notes in PDF"}</small></span>
        </li>
        <li>
          <span className="document-upload-step-number">02</span>
          <span><strong>{ar ? "جهّز محتواه" : "Prepare its content"}</strong><small>{ar ? "استخراج النص من صفحات المستند" : "Text is extracted from document pages"}</small></span>
        </li>
        <li>
          <span className="document-upload-step-number">03</span>
          <span><strong>{ar ? "ابدأ التدريب" : "Start practising"}</strong><small>{ar ? "افتح المستند وأنشئ تدريباً منه" : "Open the document and practise from it"}</small></span>
        </li>
      </ol>

      <button
        type="button"
        className="az-btn az-btn--primary document-upload-submit"
        disabled={!file || busy}
        onClick={() => void upload()}
      >
        {busy
          ? (ar ? "جارٍ تجهيز المستند..." : "Preparing document...")
          : (ar ? "رفع وتجهيز المستند" : "Upload and prepare")}
      </button>

      {busy && stage && <p className="document-upload-progress" role="status" aria-live="polite">
        {STAGE_COPY[lang][stage]}
        {progress && progress.total > 0 && <span>{progress.current} / {progress.total}</span>}
      </p>}
      {error && <p className="document-upload-error" role="alert">{error}</p>}
      {message && <p className="document-upload-success" role="status">{message}</p>}
    </section>
  );
}
