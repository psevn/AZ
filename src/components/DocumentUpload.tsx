import { useState } from "react";
import { supabase } from "../lib/supabase";

type Props = { userId: string; lang: "ar" | "en"; onUploaded: () => void };

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export default function DocumentUpload({ userId, lang, onUploaded }: Props) {
  const ar = lang === "ar";
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function upload() {
    if (!supabase || !file || busy) return;
    setError("");
    setMessage("");
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(ar ? "اختر ملف PDF فقط." : "Choose a PDF file.");
      return;
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setError(ar ? "حجم الملف يجب ألا يتجاوز 20 ميجابايت." : "The file must be no larger than 20 MB.");
      return;
    }

    setBusy(true);
    const documentId = crypto.randomUUID();
    let uploadRecordCreated = false;
    try {
      const { data: signed, error: signedError } = await supabase.functions.invoke(
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
      uploadRecordCreated = true;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      setMessage(ar
        ? "تم رفع الملف بأمان. استخراج النص سيُفعّل في خطوة المعالجة التالية."
        : "PDF uploaded securely. Text extraction will be added in the processing step.");
      setFile(null);
      onUploaded();
    } catch (cause) {
      if (uploadRecordCreated && supabase) {
        const { error: statusError } = await supabase.functions.invoke(
          "create-document-upload-url",
          { body: { documentId, action: "mark_failed" } },
        );
        if (statusError) {
          console.error("Could not mark failed document upload:", statusError.message);
        }
      }
      setError(cause instanceof Error ? cause.message : (ar ? "تعذر رفع الملف." : "Could not upload the file."));
    } finally {
      setBusy(false);
    }
  }

  return <section className="document-upload-panel" aria-labelledby="document-upload-title">
    <div className="document-upload-copy">
      <span className="eyebrow">{ar ? "مكتبة المواد" : "YOUR MATERIALS"}</span>
      <h3 id="document-upload-title">{ar ? "أضف أول مستند دراسي" : "Add your first study document"}</h3>
      <p>{ar ? "ارفع ملفات محاضراتك وملخصاتك بصيغة PDF. الحد الأقصى 20 ميجابايت." : "Upload lecture slides and notes as PDF files. Maximum size: 20 MB."}</p>
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
      {busy ? (ar ? "جارٍ الرفع..." : "Uploading...") : (ar ? "رفع المستند" : "Upload document")} ↗
    </button>
    {error && <p className="document-upload-error" role="alert">{error}</p>}
    {message && <p className="document-upload-success" role="status">{message}</p>}
  </section>;
}
