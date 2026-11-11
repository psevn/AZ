import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type DocumentRow = {
  id: string;
  title: string;
  status: "uploaded" | "processing" | "ready" | "failed";
  created_at: string;
};

type Props = {
  userId: string;
  lang: "ar" | "en";
  refreshKey: number;
  onOpenDocument: (documentId: string) => void;
  onStartQuiz: () => void;
};

const COPY = {
  ar: {
    title: "مستنداتك",
    intro: "ملفاتك الدراسية محفوظة هنا، وستظهر أدوات الدراسة عند اكتمال تجهيز المستند.",
    loading: "جارٍ تحميل المستندات…",
    empty: "لم ترفع أي مستند بعد.",
    retry: "إعادة المحاولة",
    ready: "جاهز للفتح",
    uploaded: "تم الرفع · بانتظار المعالجة",
    processing: "قيد المعالجة",
    failed: "تعذّر إكمال الرفع",
    open: "فتح المستند",
    preview: "معاينة PDF",
    practice: "ابدأ التدريب",
    count: "مستند",
    error: "تعذّر تحميل قائمة المستندات.",
  },
  en: {
    title: "Your documents",
    intro: "Your study files are kept here. Study tools will appear when a document is processed.",
    loading: "Loading documents…",
    empty: "You haven’t uploaded a document yet.",
    retry: "Try again",
    ready: "Ready to open",
    uploaded: "Uploaded · awaiting processing",
    processing: "Processing",
    failed: "Upload did not complete",
    open: "Open document",
    preview: "Preview PDF",
    practice: "Practice",
    count: "documents",
    error: "Could not load your documents.",
  },
};

export default function DocumentLibrary({ userId, lang, refreshKey, onOpenDocument, onStartQuiz }: Props) {
  const ar = lang === "ar";
  const t = COPY[lang];
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
      .select("id,title,status,created_at")
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

  function statusLabel(status: DocumentRow["status"]) {
    if (status === "ready") return t.ready;
    if (status === "processing") return t.processing;
    if (status === "failed") return t.failed;
    return t.uploaded;
  }

  return (
    <section className="document-library" aria-labelledby="document-library-title">
      <div className="document-library-heading">
        <div>
          <span className="eyebrow">{ar ? "مكتبة المواد" : "STUDY LIBRARY"}</span>
          <h3 id="document-library-title">{t.title}</h3>
          <p>{t.intro}</p>
        </div>
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
        <p className="document-library-state">{t.empty}</p>
      ) : (
        <ul className="document-library-list">
          {documents.map((document) => (
            <li className="document-library-item" key={document.id}>
              <span className="document-library-icon" aria-hidden="true">PDF</span>
              <span className="document-library-meta">
                <strong title={document.title}>{document.title}</strong>
                <small>{new Date(document.created_at).toLocaleDateString(ar ? "ar-QA" : "en-QA", { day: "numeric", month: "short", year: "numeric" })}</small>
              </span>
              <span className={"document-library-status is-" + document.status}>{statusLabel(document.status)}</span>
              {document.status !== "failed" ? (
                <div className="document-library-actions">
                  <button type="button" className="az-btn az-btn--ghost document-library-open" onClick={() => onOpenDocument(document.id)}>{document.status === "ready" ? t.open : t.preview} ↗</button>
                  {document.status === "ready" && <button type="button" className="az-btn az-btn--primary document-library-practice" onClick={onStartQuiz}>{t.practice}</button>}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
