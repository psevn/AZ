import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { recoverDocumentProcessing } from "../lib/recoverDocumentProcessing";
import { isTerminalDocumentProcessingError } from "../lib/documentProcessingResponse.mjs";

type DocumentRow = {
  id: string;
  title: string;
  status: "uploaded" | "processing" | "ready" | "failed" | "deleting";
  created_at: string;
  page_count: number | null;
  failed_reason: string | null;
  locked_at: string | null;
};

type Props = {
  userId: string;
  lang: "ar" | "en";
  refreshKey: number;
  onOpenDocument: (documentId: string) => void;
  onStartQuiz: (documentId: string) => void;
};

const COPY = {
  ar: {
    title: "مستنداتك",
    loading: "جارٍ تحميل المستندات…",
    empty: "ستظهر مستنداتك هنا بعد رفع أول ملف PDF.",
    retry: "إعادة المحاولة",
    ready: "جاهز للدراسة",
    uploaded: "تم الرفع · بانتظار المعالجة",
    processing: "قيد المعالجة",
    failed: "تعذّرت المعالجة",
    uploadFailed: "فشل الرفع",
    scanned: "ملف مصوّر · يحتاج OCR",
    password: "ملف محمي بكلمة مرور",
    open: "فتح المستند",
    preview: "معاينة PDF",
    practice: "ابدأ التدريب",
    count: "مستند",
    error: "تعذّر تحميل قائمة المستندات.",
    resume: "استئناف المعالجة",
    resuming: "جارٍ استعادة المعالجة…",
    resumeError: "تعذّر استئناف معالجة المستند.",
    deleting: "بانتظار اكتمال الحذف",
    delete: "حذف المستند",
    retryDelete: "متابعة الحذف",
    deletePrompt: "سيُحذف ملف PDF والنص والملاحظات والملخصات والأسئلة المرتبطة به. لا يمكن التراجع عن هذه الخطوة.",
    confirmDelete: "تأكيد الحذف",
    cancel: "إلغاء",
    deletingNow: "جارٍ تنفيذ الحذف الآمن…",
    deletePending: "بدأ الحذف بأمان. قد نحتاج إلى الانتظار حتى تنتهي صلاحية رابط رفع سابق؛ يمكنك متابعة الحذف من هنا.",
    deleteSuccess: "تم حذف المستند وبياناته المرتبطة.",
    deleteError: "تعذّر إكمال الحذف. بقيت بيانات المستند محمية؛ حاول مرة أخرى.",
  },
  en: {
    title: "Your documents",
    loading: "Loading documents…",
    empty: "Your documents will appear here after your first PDF upload.",
    retry: "Try again",
    ready: "Ready to study",
    uploaded: "Uploaded · awaiting processing",
    processing: "Processing",
    failed: "Processing failed",
    uploadFailed: "Upload failed",
    scanned: "Scanned PDF · OCR needed",
    password: "Password-protected PDF",
    open: "Open document",
    preview: "Preview PDF",
    practice: "Practice",
    count: "documents",
    error: "Could not load your documents.",
    resume: "Resume processing",
    resuming: "Recovering processing…",
    resumeError: "Could not resume document processing.",
    deleting: "Deletion pending",
    delete: "Delete document",
    retryDelete: "Continue deletion",
    deletePrompt: "This permanently removes the PDF, extracted text, notes, summaries, and related questions. This cannot be undone.",
    confirmDelete: "Confirm deletion",
    cancel: "Cancel",
    deletingNow: "Completing secure deletion…",
    deletePending: "Deletion has started safely. We may need to wait for an earlier upload link to expire; you can continue the deletion here.",
    deleteSuccess: "The document and its related data were deleted.",
    deleteError: "Deletion could not be completed. Your document data remains protected; please try again.",
  },
};

export default function DocumentLibrary({ userId, lang, refreshKey, onOpenDocument, onStartQuiz }: Props) {
  const ar = lang === "ar";
  const t = COPY[lang];
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recoveringId, setRecoveringId] = useState<string | null>(null);
  const [recoveryProgress, setRecoveryProgress] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletionMessage, setDeletionMessage] = useState("");
  const [deletionError, setDeletionError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError(t.error);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("documents")
      .select("id,title,status,created_at,page_count,failed_reason,locked_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (queryError) {
      setError(t.error);
      setLoading(false);
      return;
    }
    setDocuments((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, [userId, t.error]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  function canResume(document: DocumentRow) {
    if (document.status === "uploaded") return true;
    if (document.status !== "processing") return false;
    if (!document.locked_at) return true;
    const lockTime = Date.parse(document.locked_at);
    return Number.isFinite(lockTime) && Date.now() - lockTime >= 30 * 60 * 1000;
  }

  async function resume(document: DocumentRow) {
    if (recoveringId || deletingId || !canResume(document)) return;
    setRecoveringId(document.id);
    setRecoveryError("");
    setRecoveryProgress(t.resuming);
    try {
      await recoverDocumentProcessing(document.id, document.title, document.status as "uploaded" | "processing", (stage, current, total) => {
        const labels = ar
          ? { downloading: "جارٍ استرجاع ملف PDF…", extracting: "جارٍ استخراج النص…", saving: "جارٍ حفظ الصفحات…", finalizing: "جارٍ إنهاء المعالجة…" }
          : { downloading: "Retrieving the PDF…", extracting: "Extracting text…", saving: "Saving pages…", finalizing: "Finishing processing…" };
        setRecoveryProgress(current !== undefined && total
          ? labels[stage] + " " + current + " / " + total
          : labels[stage]);
      });
      setRecoveryProgress("");
      await load();
    } catch (cause) {
      setRecoveryError(isTerminalDocumentProcessingError(cause)
        ? (ar
          ? "لم يُعثر على نص قابل للاستخراج. يبدو أن ملف PDF مصوّر ويحتاج إلى OCR، وهي ميزة غير متاحة بعد."
          : "No selectable text was found. This appears to be a scanned PDF; OCR is not available yet.")
        : cause instanceof Error ? cause.message : t.resumeError);
      await load();
    } finally {
      setRecoveringId(null);
    }
  }

  async function deleteDocument(document: DocumentRow) {
    if (!supabase || deletingId || recoveringId) return;
    setDeletingId(document.id);
    setDeletionError("");
    setDeletionMessage(t.deletingNow);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("delete-document", {
        body: { documentId: document.id },
      });
      if (invokeError) throw new Error(t.deleteError);

      if (data?.status === "deleted") {
        setDocuments(current => current.filter(item => item.id !== document.id));
        setConfirmDeleteId(null);
        setDeletionMessage(t.deleteSuccess);
      } else if (data?.status === "deleting") {
        setDocuments(current => current.map(item => item.id === document.id ? { ...item, status: "deleting" } : item));
        setConfirmDeleteId(null);
        setDeletionMessage(t.deletePending);
      } else {
        throw new Error(t.deleteError);
      }
    } catch (cause) {
      // The server may have persisted the deleting tombstone before Storage
      // cleanup or finalization failed. Refresh from the database so the UI
      // exposes the retry action instead of stale open/practice controls.
      await load();
      setDeletionError(cause instanceof Error ? cause.message : t.deleteError);
      setDeletionMessage("");
    } finally {
      setDeletingId(null);
    }
  }

  function statusLabel(document: DocumentRow) {
    if (document.status === "deleting") return t.deleting;
    if (document.status === "ready") return t.ready;
    if (document.status === "processing") return t.processing;
    if (document.status !== "failed") return t.uploaded;
    if (document.failed_reason === "Upload did not complete." || document.failed_reason === "Could not prepare the upload.") return t.uploadFailed;
    if (document.failed_reason?.includes("No selectable text")) return t.scanned;
    if (document.failed_reason?.includes("password-protected")) return t.password;
    return t.failed;
  }

  return (
    <section className="document-library" aria-labelledby="document-library-title">
      <div className="document-library-heading">
        <h3 id="document-library-title">{t.title}</h3>
        {!loading && !error && documents.length > 0 && (
          <span className="document-library-count">{documents.length} {t.count}</span>
        )}
      </div>

      {loading ? (
        <p className="document-library-state" role="status">{t.loading}</p>
      ) : error ? (
        <div className="document-library-state" role="alert">
          <p>{error}</p>
          <button type="button" className="az-btn az-btn--ghost" onClick={() => void load()}>{t.retry}</button>
        </div>
      ) : documents.length === 0 ? (
        <p className="document-library-state is-empty">{t.empty}</p>
      ) : (
        <ul className="document-library-list">
          {documents.map((document) => (
            <li className="document-library-item" key={document.id}>
              <span className="document-library-icon" aria-hidden="true">PDF</span>
              <span className="document-library-meta">
                <strong title={document.title}>{document.title}</strong>
                <small>{new Date(document.created_at).toLocaleDateString(ar ? "ar-QA" : "en-QA", { day: "numeric", month: "short", year: "numeric" })}{document.status === "ready" && document.page_count ? ` · ${document.page_count} ${ar ? "صفحة" : "pages"}` : ""}</small>
              </span>
              <span className={"document-library-status is-" + document.status}>{statusLabel(document)}</span>
              <div className="document-library-actions">
                {document.status !== "failed" && document.status !== "deleting" && (
                  <button type="button" className="az-btn az-btn--ghost document-library-open" onClick={() => onOpenDocument(document.id)}>{document.status === "ready" ? t.open : t.preview} ↗</button>
                )}
                {document.status === "ready" && <button type="button" className="az-btn az-btn--primary document-library-practice" onClick={() => onStartQuiz(document.id)}>{t.practice}</button>}
                {canResume(document) && <button type="button" className="az-btn az-btn--ghost document-library-resume" disabled={recoveringId !== null || deletingId !== null} onClick={() => void resume(document)}>{recoveringId === document.id ? t.resuming : t.resume}</button>}
                {document.status === "deleting" ? (
                  <button type="button" className="az-btn az-btn--ghost document-library-delete" disabled={deletingId !== null || recoveringId !== null} onClick={() => void deleteDocument(document)}>{deletingId === document.id ? t.deletingNow : t.retryDelete}</button>
                ) : (
                  <button type="button" className="az-btn az-btn--ghost document-library-delete" disabled={deletingId !== null || recoveringId !== null} onClick={() => { setDeletionError(""); setConfirmDeleteId(current => current === document.id ? null : document.id); }}>{t.delete}</button>
                )}
              </div>
              {confirmDeleteId === document.id && (
                <div className="document-library-delete-confirm" role="group" aria-label={t.confirmDelete}>
                  <p>{t.deletePrompt}</p>
                  <div>
                    <button type="button" className="az-btn az-btn--ghost" disabled={deletingId !== null} onClick={() => setConfirmDeleteId(null)}>{t.cancel}</button>
                    <button type="button" className="az-btn az-btn--danger" disabled={deletingId !== null} onClick={() => void deleteDocument(document)}>{deletingId === document.id ? t.deletingNow : t.confirmDelete}</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {recoveryProgress && <p className="document-library-state" role="status" aria-live="polite">{recoveryProgress}</p>}
      {recoveryError && <p className="document-upload-error" role="alert">{recoveryError}</p>}
      {deletionMessage && <p className="document-library-delete-message" role="status" aria-live="polite">{deletionMessage}</p>}
      {deletionError && <p className="document-upload-error" role="alert">{deletionError}</p>}
    </section>
  );
}
