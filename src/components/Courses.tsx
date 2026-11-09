import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./Courses.css";

type Language = "ar" | "en";
type Subject = { id: string; name: string; color: string | null; created_at: string; course_code?: string | null; catalog_course_id?: string | null };
type Task = { id: string; title: string; status: "todo" | "doing" | "done"; due_at: string | null };
type Document = { id: string; title: string; status: string; kind: string; created_at: string };
type CatalogInstitution = { name_ar: string; name_en: string };
type CatalogItem = {
  course_id: string;
  name_ar: string;
  name_en: string;
  course_code: string | null;
  education_level: string;
  grade_level: string | null;
  institution_name_ar: string;
  institution_name_en: string;
  curriculum_name_ar: string | null;
  curriculum_name_en: string | null;
  aliases: string[];
  source_url: string;
  source_name: string;
  source_checked_at: string;
};

const text = {
  ar: {
    eyebrow:"AZ / COURSES", title:"موادك، في مكان واحد.", intro:"كل مادة لها مساحة عمل خاصة تجمع ملفاتها ومهامها وتقدّمك الدراسي.",
    search:"ابحث عن مادة أو رمز مقرر", institution:"المؤسسة التعليمية (اختياري)", institutionHint:"ابحث في كتالوج قطر الموثق؛ اختر المؤسسة لتضييق النتائج.",
    all:"الكل", school:"المدرسة", higher:"الجامعة والكلية", suggestions:"نتائج الكتالوج", add:"إضافة إلى موادي",
    empty:"ما لقينا مادة موثقة بهذا البحث. تقدر تضيفها بنفسك.", custom:"إضافة مادة مخصصة", customPlaceholder:"اكتب اسم المادة",
    mine:"موادي", noCourses:"ما أضفت مواد بعد. ابحث عن مادة وأضفها بضغطة واحدة.",
    workspace:"مساحة المادة", tasks:"المهام", files:"الملفات", noTasks:"لا توجد مهام مرتبطة بهذه المادة بعد.",
    noFiles:"لا توجد ملفات مضافة لهذه المادة بعد.", done:"مكتملة", open:"مفتوحة", back:"العودة للمواد",
    sourceNote:"النتائج مرتبطة بمصادر رسمية وتاريخ آخر تحقق. قد لا يتوفر لكل مؤسسة كتالوج مقررات كامل بعد.",
    added:"تمت إضافة المادة.", duplicate:"هذه المادة موجودة عندك بالفعل.", loading:"جارٍ تحميل مساحة المادة...",
    searching:"نبحث في الكتالوج الرسمي...", source:"المصدر", verified:"موثق"
  },
  en: {
    eyebrow:"AZ / COURSES", title:"Your courses. One universe.", intro:"Every course gets its own workspace for files, tasks, and learning progress.",
    search:"Search a subject or course code", institution:"Institution (optional)", institutionHint:"Search the verified Qatar catalog; add an institution to narrow results.",
    all:"All", school:"School", higher:"University & college", suggestions:"Catalog results", add:"Add to my courses",
    empty:"No verified match found. You can add this course yourself.", custom:"Add a custom course", customPlaceholder:"Course name",
    mine:"My courses", noCourses:"No courses yet. Search for a subject and add it in one click.",
    workspace:"Course workspace", tasks:"Tasks", files:"Files", noTasks:"No tasks linked to this course yet.",
    noFiles:"No files added to this course yet.", done:"Completed", open:"Open", back:"Back to courses",
    sourceNote:"Results are linked to official sources and a last-checked date. A complete course catalog may not yet be available for every institution.",
    added:"Course added.", duplicate:"This course is already in your list.", loading:"Loading course workspace...",
    searching:"Searching the official catalog...", source:"Source", verified:"Verified"
  }
};

type Props = { userId: string; lang: Language; subjects: Subject[]; onRefresh: () => Promise<void> };

export default function Courses({ userId, lang, subjects, onRefresh }: Props) {
  const t = text[lang];
  const ar = lang === "ar";
  const [query,setQuery] = useState("");
  const [institution,setInstitution] = useState("");
  const [level,setLevel] = useState<"all"|"school"|"higher">("all");
  const [results,setResults] = useState<CatalogItem[]>([]);
  const [institutions,setInstitutions] = useState<CatalogInstitution[]>([]);
  const [searchLoading,setSearchLoading] = useState(false);
  const [selected,setSelected] = useState<Subject|null>(null);
  const [customName,setCustomName] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [tasks,setTasks] = useState<Task[]>([]);
  const [documents,setDocuments] = useState<Document[]>([]);
  const [detailLoading,setDetailLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("academic_catalog_institutions")
      .select("name_ar,name_en")
      .eq("country_code","QA")
      .eq("is_active",true)
      .order("name_en")
      .then(({data,error}) => {
        if (!active) return;
        if (!error) setInstitutions((data || []) as CatalogInstitution[]);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q || !supabase) {
      setResults([]);
      setSearchLoading(false);
      return;
    }
    let active = true;
    const client = supabase;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      const {data,error} = await client.rpc("search_academic_catalog", {
        p_query:q,
        p_country_code:"QA",
        p_education_level:level,
        p_institution_query:institution.trim() || null,
        p_limit:12
      });
      if (!active) return;
      if (error) {
        setResults([]);
        setNotice(error.message);
      } else {
        setResults((data || []) as CatalogItem[]);
        setNotice("");
      }
      setSearchLoading(false);
    },250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  },[query,level,institution]);

  async function addCourse(name: string, code?: string | null, catalogCourseId?: string) {
    if (!supabase) return;
    const duplicate = subjects.some(s =>
      s.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() ||
      Boolean(catalogCourseId && s.catalog_course_id === catalogCourseId)
    );
    if (duplicate) { setNotice(t.duplicate); return; }
    setBusy(true); setNotice("");
    const {data,error} = await supabase.from("subjects").insert({
      user_id:userId,
      name:name.trim(),
      course_code:code || null,
      catalog_course_id:catalogCourseId || null
    }).select("id,name,color,created_at,course_code,catalog_course_id").single();
    if (error) {
      setNotice(error.code === "23505" ? t.duplicate : error.message);
    } else {
      setNotice(t.added);
      setQuery("");
      setCustomName("");
      await onRefresh();
      if (data) await openCourse(data as Subject);
    }
    setBusy(false);
  }

  async function openCourse(subject: Subject) {
    setSelected(subject); setDetailLoading(true); setNotice("");
    if (!supabase) { setDetailLoading(false); return; }
    const [taskResult,documentResult] = await Promise.all([
      supabase.from("tasks").select("id,title,status,due_at").eq("subject_id",subject.id).order("due_at",{ascending:true}),
      supabase.from("documents").select("id,title,status,kind,created_at").eq("subject_id",subject.id).order("created_at",{ascending:false})
    ]);
    if (taskResult.error) setNotice(taskResult.error.message); else setTasks((taskResult.data || []) as Task[]);
    if (documentResult.error) setNotice(documentResult.error.message); else setDocuments((documentResult.data || []) as Document[]);
    setDetailLoading(false);
  }

  async function customSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (customName.trim()) await addCourse(customName);
  }

  if (selected) {
    const courseTasks = tasks;
    const completed = courseTasks.filter(task=>task.status==="done").length;
    return <section className="courses-view">
      <div className="courses-heading"><button className="courses-back" onClick={()=>setSelected(null)}>← {t.back}</button><span className="eyebrow">{t.eyebrow}</span><h1>{selected.name}</h1><p>{t.workspace}</p></div>
      {detailLoading ? <div className="courses-empty">{t.loading}</div> : <>
        <div className="course-stats">
          <article><strong>{courseTasks.length}</strong><span>{t.tasks}</span></article>
          <article><strong>{completed}</strong><span>{t.done}</span></article>
          <article><strong>{documents.length}</strong><span>{t.files}</span></article>
        </div>
        <div className="course-workspace-grid">
          <section className="course-panel"><div className="course-panel-heading"><h2>{t.tasks}</h2><span>{courseTasks.length.toString().padStart(2,"0")}</span></div>
            {courseTasks.length ? courseTasks.map(task=><div className="course-row" key={task.id}><span className={task.status==="done"?"course-check done":"course-check"}/><strong>{task.title}</strong><small>{task.due_at ? new Date(task.due_at).toLocaleDateString(ar?"ar-QA":"en-US") : t.open}</small></div>) : <p className="courses-muted">{t.noTasks}</p>}
          </section>
          <section className="course-panel"><div className="course-panel-heading"><h2>{t.files}</h2><span>{documents.length.toString().padStart(2,"0")}</span></div>
            {documents.length ? documents.map(doc=><div className="course-row" key={doc.id}><span className="course-file-mark">▤</span><strong>{doc.title}</strong><small>{doc.status}</small></div>) : <p className="courses-muted">{t.noFiles}</p>}
          </section>
        </div>
      </>}
    </section>;
  }

  return <section className="courses-view">
    <div className="courses-heading"><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.intro}</p></div>
    <div className="courses-catalog">
      <div className="catalog-search-wrap"><span className="catalog-search-icon">⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t.search} aria-label={t.search}/><kbd>⌘ K</kbd></div>
      <label className="catalog-institution"><span>{t.institution}</span><input list="catalog-institution-options" value={institution} onChange={e=>setInstitution(e.target.value)} placeholder={ar?"مثلاً: جامعة قطر أو جامعة حمد بن خليفة":"e.g. Qatar University or HBKU"}/><datalist id="catalog-institution-options">{institutions.map(item=><option key={item.name_en} value={ar?item.name_ar:item.name_en}/>)}</datalist><small>{t.institutionHint}</small></label>
      <div className="catalog-level-tabs">{(["all","school","higher"] as const).map(value=><button key={value} className={level===value?"active":""} onClick={()=>setLevel(value)}>{t[value]}</button>)}</div>
      {query.trim() && <div className="catalog-results">
        <div className="catalog-section-title"><span>{t.suggestions}</span><small>{searchLoading ? "…" : results.length.toString().padStart(2,"0")}</small></div>
        {searchLoading ? <p className="courses-muted">{t.searching}</p> : results.length ? results.map(item=><article className="catalog-result" key={item.course_id}>
          <div className="catalog-result-icon">{item.education_level==="school"?"⌂":"◇"}</div>
          <div className="catalog-result-copy">
            <strong>{ar ? item.name_ar : item.name_en}</strong>
            <small>{item.institution_name_ar && ar ? item.institution_name_ar : item.institution_name_en}{item.course_code ? " · "+item.course_code : ""}</small>
            <small>{item.curriculum_name_ar && ar ? item.curriculum_name_ar : item.curriculum_name_en || t.verified} · {t.source}: {item.source_name} · {item.source_checked_at}</small>
          </div>
          <button disabled={busy} onClick={()=>void addCourse(ar ? item.name_ar : item.name_en,item.course_code,item.course_id)}>{t.add} <span>＋</span></button>
        </article>) : <p className="courses-muted">{t.empty}</p>}
        <p className="catalog-source-note">{t.sourceNote}</p>
      </div>}
    </div>
    <div className="courses-lower-grid">
      <section className="courses-panel"><div className="courses-panel-heading"><div><span className="eyebrow">{t.mine}</span><h2>{t.mine}</h2></div><strong>{subjects.length.toString().padStart(2,"0")}</strong></div>
        {subjects.length ? <div className="my-course-grid">{subjects.map((subject,index)=><button className="my-course-card" key={subject.id} onClick={()=>void openCourse(subject)}><span className="my-course-index">{String(index+1).padStart(2,"0")}</span><span className="my-course-orbit">✧</span><strong>{subject.name}</strong><small>{subject.course_code || (ar?"مساحة دراسية":"Study workspace")}</small><i>↗</i></button>)}</div> : <div className="courses-empty"><span>✧</span><p>{t.noCourses}</p></div>}
      </section>
      <section className="courses-panel custom-course-panel"><div className="courses-panel-heading"><div><span className="eyebrow">{ar?"إضافة سريعة":"QUICK ADD"}</span><h2>{t.custom}</h2></div><span>＋</span></div><form onSubmit={customSubmit}><input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder={t.customPlaceholder} maxLength={120}/><button className="primary-button" disabled={busy||!customName.trim()}>{t.add} ↗</button></form>{notice && <p className="courses-notice" role="status">{notice}</p>}
      </section>
    </div>
  </section>;
}
