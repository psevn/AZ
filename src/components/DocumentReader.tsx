import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  documentId: string;
  title: string;
  signedUrl: string;
  status: "uploaded" | "processing" | "ready";
  pageCount: number | null;
  lang: "ar" | "en";
  onClose: () => void;
};

const COPY = {
  ar: {
    close: "إغلاق",
    source: "الملف الأصلي",
    extracted: "النص المستخرج",
    previewPending: "معاينة فقط",
    pending: "يظهر النص المستخرج هنا بعد اكتمال معالجة المستند.",
    loading: "جارٍ تحميل نص الصفحة…",
    loadError: "تعذّر تحميل نص هذه الصفحة.",
    retry: "إعادة المحاولة",
    page: "صفحة",
    pageReferenceNote: "ترقيم الصفحات هنا ناتج عن استخراج النص داخل المتصفح ولم يتم التحقق منه مقابل ملف PDF الأصلي.",
    of: "من",
    previous: "السابقة",
    next: "التالية",
    search: "ابحث في الصفحة الحالية",
    noMatches: "لا توجد نتائج في هذه الصفحة.",
    matches: "نتيجة",
    empty: "لا يوجد نص محفوظ لهذه الصفحة.",
  },
  en: {
    close: "Close",
    source: "Original PDF",
    extracted: "Extracted text",
    previewPending: "Preview only",
    pending: "Extracted text will appear here when document processing is complete.",
    loading: "Loading page text…",
    loadError: "Could not load this page’s text.",
    retry: "Try again",
    page: "Page",
    pageReferenceNote: "Page numbering here comes from browser-side PDF extraction and has not been verified against the original PDF.",
    of: "of",
    previous: "Previous",
    next: "Next",
    search: "Search this page",
    noMatches: "No matches on this page.",
    matches: "matches",
    empty: "No saved text was found for this page.",
  },
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function DocumentReader({
  documentId,
  title,
  signedUrl,
  status,
  pageCount,
  lang,
  onClose,
}: Props) {
  const ar = lang === "ar";
  const t = COPY[lang];
  const totalPages = Math.max(0, pageCount ?? 0);
  const [pageNo, setPageNo] = useState(1);
  const [pageText, setPageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    setPageNo(1);
    setSearch("");
  }, [documentId]);

  useEffect(() => {
    if (status !== "ready" || totalPages < 1) {
      setPageText("");
      setLoading(false);
      setError("");
      return;
    }
    if (!supabase) {
      setError(t.loadError);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    void supabase
      .from("document_pages")
      .select("page_no,text")
      .eq("document_id", documentId)
      .eq("page_no", pageNo)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(t.loadError);
          setPageText("");
        } else {
          setPageText(data?.text ?? "");
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [documentId, pageNo, status, totalPages, t.loadError, retryKey]);

  const matches = useMemo(() => {
    const query = search.trim();
    if (!query || !pageText) return 0;
    return pageText.match(new RegExp(escapeRegExp(query), "gi"))?.length ?? 0;
  }, [pageText, search]);

  const highlightedText = useMemo(() => {
    const query = search.trim();
    if (!query) return pageText;
    const parts = pageText.split(new RegExp("(" + escapeRegExp(query) + ")", "gi"));
    return parts.map((part, index) =>
      part.toLocaleLowerCase() === query.toLocaleLowerCase()
        ? <mark key={index}>{part}</mark>
        : part,
    );
  }, [pageText, search]);

  function changePage(nextPage: number) {
    setPageNo(Math.min(totalPages, Math.max(1, nextPage)));
    setSearch("");
  }

  return (
    <section className="document-reader content-panel" aria-label={title}>
      <header className="document-reader-header">
        <div className="document-reader-title">
          <span className="eyebrow">{ar ? "مساحة الدراسة / المستند" : "STUDY SPACE / DOCUMENT"}</span>
          <strong title={title}>{title}</strong>
        </div>
        <button type="button" className="az-btn az-btn--ghost" onClick={onClose}>{t.close}</button>
      </header>

      <div className="document-reader-grid">
        <section className="document-reader-source" aria-label={t.source}>
          <div className="document-reader-pane-head">
            <strong>{t.source}</strong>
            {status !== "ready" && <span>{t.previewPending}</span>}
          </div>
          <iframe title={title} src={signedUrl} />
        </section>

        <section className="document-reader-text-pane" aria-label={t.extracted}>
          <div className="document-reader-pane-head">
            <strong>{t.extracted}</strong>
            {status === "ready" && totalPages > 0 && <span>{totalPages} {ar ? "صفحة" : "pages"}</span>}
          </div>

          {status !== "ready" ? (
            <p className="document-reader-pending">{t.pending}</p>
          ) : (
            <>
              <div className="document-reader-controls">
                <small className="document-reader-page-reference-note">{t.pageReferenceNote}</small>
                <div className="document-reader-pagination">
                  <button type="button" className="az-btn az-btn--ghost" disabled={pageNo <= 1} onClick={() => changePage(pageNo - 1)}>{t.previous}</button>
                  <label>
                    <span>{t.page}</span>
                    <input type="number" min={1} max={totalPages} value={pageNo} onChange={event => {
                      const next = Number(event.target.value);
                      if (Number.isInteger(next) && next >= 1 && next <= totalPages) changePage(next);
                    }} />
                    <span>{t.of} {totalPages}</span>
                  </label>
                  <button type="button" className="az-btn az-btn--ghost" disabled={pageNo >= totalPages} onClick={() => changePage(pageNo + 1)}>{t.next}</button>
                </div>
                <input className="document-reader-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={t.search} aria-label={t.search} />
                {search.trim() && <small className="document-reader-match-count">{matches ? `${matches} ${t.matches}` : t.noMatches}</small>}
              </div>

              <div className="document-reader-page">
                {loading ? (
                  <p className="document-reader-state" role="status">{t.loading}</p>
                ) : error ? (
                  <div className="document-reader-state" role="alert">
                    <p>{error}</p>
                    <button type="button" className="az-btn az-btn--ghost" onClick={() => setRetryKey(value => value + 1)}>{t.retry}</button>
                  </div>
                ) : pageText ? (
                  <pre dir={ar ? "rtl" : "ltr"}>{highlightedText}</pre>
                ) : (
                  <p className="document-reader-state">{t.empty}</p>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
