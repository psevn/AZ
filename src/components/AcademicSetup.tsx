import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./AcademicSetup.css";

type Language = "ar" | "en";
type Step = "term" | "subjects" | "review";
type ExistingSubject = { id: string; name: string; term_id?: string | null };

type Props = {
  userId: string;
  lang: Language;
  existingSubjects: ExistingSubject[];
  onComplete: () => void;
};

const copy = {
  ar: {
    eyebrow: "AZ / إعداد مساحتك الأكاديمية",
    title: "لنجهّز عالمك الأكاديمي.",
    intro: "خطوات بسيطة تساعد AZ على تنظيم تجربتك الدراسية. تقدر تتجاوز أي شيء وتكمل لاحقاً.",
    term: "الفصل الدراسي",
    termHint: "أضف فصلك الحالي إذا رغبت. لا نفترض تقويماً جامعياً معيناً.",
    termName: "اسم الفصل",
    termPlaceholder: "مثلاً: خريف 2026",
    start: "تاريخ البداية (اختياري)",
    end: "تاريخ النهاية (اختياري)",
    subjects: "موادك الدراسية",
    subjectsHint: "أضف المواد التي تدرسها حالياً. تقدر تضيف المزيد أو تعدّلها لاحقاً.",
    subjectName: "اسم المادة",
    subjectPlaceholder: "مثلاً: هياكل البيانات",
    code: "رمز المادة (اختياري)",
    instructor: "اسم الدكتور (اختياري)",
    add: "إضافة المادة",
    added: "المواد المضافة",
    duplicate: "لديك مادة باسم مشابه. تقدر تضيفها إذا كانت مادة مختلفة.",
    review: "مساحتك جاهزة للانطلاق",
    reviewHint: "تقدر تعدّل بياناتك وتضيف جدول المحاضرات لاحقاً من Planning.",
    termLabel: "الفصل",
    subjectLabel: "المواد",
    noTerm: "لم تحدد فصلاً دراسياً",
    noSubjects: "لم تضف مواد بعد",
    back: "رجوع",
    next: "متابعة",
    finish: "إنهاء الإعداد",
    skip: "سأتجاوز الإعداد الآن",
    saving: "جارٍ الحفظ...",
    step: "الخطوة",
    of: "من",
    error: "تعذر حفظ الإعداد. حاول مرة أخرى.",
  },
  en: {
    eyebrow: "AZ / ACADEMIC SETUP",
    title: "Let's set up your academic space.",
    intro: "A few simple steps help AZ shape your study experience. You can skip this and return later.",
    term: "Academic term",
    termHint: "Add your current term if you like. AZ won't assume a university calendar.",
    termName: "Term name",
    termPlaceholder: "e.g. Fall 2026",
    start: "Start date (optional)",
    end: "End date (optional)",
    subjects: "Your subjects",
    subjectsHint: "Add the subjects you're studying now. You can add or edit them later.",
    subjectName: "Subject name",
    subjectPlaceholder: "e.g. Data Structures",
    code: "Course code (optional)",
    instructor: "Instructor (optional)",
    add: "Add subject",
    added: "Added subjects",
    duplicate: "A subject with a similar name already exists. You can still add it if it's a different course.",
    review: "Your space is ready to begin",
    reviewHint: "You can edit your details and add your class timetable later from Planning.",
    termLabel: "Term",
    subjectLabel: "Subjects",
    noTerm: "No term selected",
    noSubjects: "No subjects added yet",
    back: "Back",
    next: "Continue",
    finish: "Finish setup",
    skip: "I'll do this later",
    saving: "Saving...",
    step: "Step",
    of: "of",
    error: "We couldn't save your setup. Please try again.",
  },
};

export default function AcademicSetup({ userId, lang, existingSubjects, onComplete }: Props) {
  const t = copy[lang];
  const [step, setStep] = useState<Step>("term");
  const [termId, setTermId] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [added, setAdded] = useState<ExistingSubject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const allSubjects = useMemo(() => [...existingSubjects, ...added], [existingSubjects, added]);
  const stepNumber = step === "term" ? 1 : step === "subjects" ? 2 : 3;

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!supabase) return;
      const [setupResult, termResult] = await Promise.all([
        supabase.from("academic_setup").select("current_step").eq("user_id", userId).maybeSingle(),
        supabase.from("academic_terms").select("id,name,start_date,end_date").eq("user_id", userId).eq("is_active", true).maybeSingle(),
      ]);
      if (!active) return;
      if (setupResult.data?.current_step === "subjects" || setupResult.data?.current_step === "timetable") setStep("subjects");
      if (setupResult.data?.current_step === "review") setStep("review");
      if (termResult.data) {
        setTermId(termResult.data.id);
        setTermName(termResult.data.name);
        setStartDate(termResult.data.start_date || "");
        setEndDate(termResult.data.end_date || "");
      }
    }
    void restore();
    return () => { active = false; };
  }, [userId]);

  async function saveProgress(currentStep: "term" | "subjects" | "review", status = "in_progress") {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error: saveError } = await supabase.from("academic_setup").upsert({
      user_id: userId,
      status,
      current_step: currentStep,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      updated_at: new Date().toISOString(),
      ...(status === "completed" ? { completed_at: new Date().toISOString(), skipped_at: null } : {}),
      ...(status === "skipped" ? { skipped_at: new Date().toISOString() } : {}),
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;
  }

  async function continueFromTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      if (termName.trim()) {
        if (endDate && startDate && endDate < startDate) {
          setError(lang === "ar" ? "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." : "The end date must be after the start date.");
          setBusy(false);
          return;
        }
        if (termId) {
          const { error: updateError } = await supabase.from("academic_terms").update({
            name: termName.trim(), start_date: startDate || null, end_date: endDate || null,
          }).eq("id", termId).eq("user_id", userId);
          if (updateError) throw updateError;
        } else {
          const { error: deactivateError } = await supabase.from("academic_terms").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
          if (deactivateError) throw deactivateError;
          const { data, error: insertError } = await supabase.from("academic_terms").insert({
            user_id: userId, name: termName.trim(), start_date: startDate || null, end_date: endDate || null, is_active: true,
          }).select("id").single();
          if (insertError) throw insertError;
          setTermId(data.id);
        }
      }
      await saveProgress("subjects");
      setStep("subjects");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !name.trim()) return;
    setBusy(true); setError("");
    try {
      const { data, error: insertError } = await supabase.from("subjects").insert({
        user_id: userId,
        term_id: termId,
        name: name.trim(),
        course_code: courseCode.trim() || null,
        instructor: instructor.trim() || null,
      }).select("id,name,term_id").single();
      if (insertError) throw insertError;
      setAdded(current => [...current, data as ExistingSubject]);
      setName(""); setCourseCode(""); setInstructor(""); setDuplicateWarning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function continueFromSubjects() {
    setBusy(true); setError("");
    try {
      await saveProgress("review");
      setStep("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true); setError("");
    try {
      await saveProgress("review", "completed");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true); setError("");
    try {
      await saveProgress(step === "term" ? "term" : step === "subjects" ? "subjects" : "review", "skipped");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="academic-setup-backdrop" role="dialog" aria-modal="true" aria-labelledby="academic-setup-title" dir={lang === "ar" ? "rtl" : "ltr"}>
      <section className="academic-setup-panel">
        <div className="academic-setup-topline"><span>{t.eyebrow}</span><span>{t.step} {stepNumber} {t.of} 3</span></div>
        <div className="academic-setup-progress"><i style={{ width: (stepNumber / 3 * 100) + "%" }} /></div>
        <div className="academic-setup-heading">
          <span className="academic-setup-mark">AZ</span>
          <h2 id="academic-setup-title">{step === "review" ? t.review : t.title}</h2>
          <p>{step === "review" ? t.reviewHint : step === "term" ? t.intro : t.subjectsHint}</p>
        </div>

        {step === "term" && <form className="academic-setup-form" onSubmit={continueFromTerm}>
          <div className="academic-setup-section-title"><span>01</span><div><h3>{t.term}</h3><p>{t.termHint}</p></div></div>
          <label><span>{t.termName}</span><input value={termName} onChange={e => setTermName(e.target.value)} maxLength={120} placeholder={t.termPlaceholder} /></label>
          <div className="academic-setup-fields">
            <label><span>{t.start}</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
            <label><span>{t.end}</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          </div>
          <div className="academic-setup-actions"><button type="submit" className="primary-button" disabled={busy}>{busy ? t.saving : t.next} <span>↗</span></button><button type="button" className="academic-setup-skip" onClick={() => void skip()} disabled={busy}>{t.skip}</button></div>
        </form>}

        {step === "subjects" && <div className="academic-setup-form">
          <div className="academic-setup-section-title"><span>02</span><div><h3>{t.subjects}</h3><p>{t.subjectsHint}</p></div></div>
          <form className="academic-setup-subject-form" onSubmit={addSubject}>
            <label><span>{t.subjectName}</span><input value={name} onChange={e => { setName(e.target.value); setDuplicateWarning(allSubjects.some(s => s.name.trim().toLocaleLowerCase() === e.target.value.trim().toLocaleLowerCase())); }} maxLength={120} placeholder={t.subjectPlaceholder} required /></label>
            <div className="academic-setup-fields">
              <label><span>{t.code}</span><input value={courseCode} onChange={e => setCourseCode(e.target.value)} maxLength={40} /></label>
              <label><span>{t.instructor}</span><input value={instructor} onChange={e => setInstructor(e.target.value)} maxLength={120} /></label>
            </div>
            {duplicateWarning && <p className="academic-setup-warning">{t.duplicate}</p>}
            <button type="submit" className="academic-setup-add" disabled={busy || !name.trim()}>＋ {t.add}</button>
          </form>
          <div className="academic-setup-added"><div className="academic-setup-added-heading"><span>{t.added}</span><strong>{allSubjects.length.toString().padStart(2, "0")}</strong></div>
            {allSubjects.length ? allSubjects.map((subject, index) => <div className="academic-setup-subject" key={subject.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{subject.name}</strong></div>) : <p>{t.noSubjects}</p>}
          </div>
          <div className="academic-setup-actions"><button type="button" className="primary-button" onClick={() => void continueFromSubjects()} disabled={busy}>{busy ? t.saving : t.next} <span>↗</span></button><button type="button" className="academic-setup-back" onClick={() => setStep("term")} disabled={busy}>{t.back}</button><button type="button" className="academic-setup-skip" onClick={() => void skip()} disabled={busy}>{t.skip}</button></div>
        </div>}

        {step === "review" && <div className="academic-setup-review">
          <div><span>{t.termLabel}</span><strong>{termName || t.noTerm}</strong></div>
          <div><span>{t.subjectLabel}</span><strong>{allSubjects.length}</strong></div>
          <div className="academic-setup-review-subjects">{allSubjects.map(subject => <span key={subject.id}>{subject.name}</span>)}</div>
          <div className="academic-setup-actions"><button type="button" className="primary-button" onClick={() => void finish()} disabled={busy}>{busy ? t.saving : t.finish} <span>↗</span></button><button type="button" className="academic-setup-back" onClick={() => setStep("subjects")} disabled={busy}>{t.back}</button><button type="button" className="academic-setup-skip" onClick={() => void skip()} disabled={busy}>{t.skip}</button></div>
        </div>}

        {error && <p className="academic-setup-error" role="alert">{error}</p>}
        <div className="academic-setup-footer"><span>THE ACADEMIC UNIVERSE</span><span>FROM A TO Z</span></div>
      </section>
    </div>
  );
}
