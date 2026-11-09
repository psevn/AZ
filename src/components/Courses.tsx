import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./Courses.css";

type Language = "ar" | "en";
type Subject = { id: string; name: string; color: string | null; created_at: string; course_code?: string | null };
type Task = { id: string; title: string; status: "todo" | "doing" | "done"; due_at: string | null };
type Document = { id: string; title: string; status: string; kind: string; created_at: string };

type CatalogItem = { name: string; code?: string; level: "school" | "higher"; group: string; aliases: string[] };

const catalog: CatalogItem[] = [
  ...[
    ["اللغة العربية","Arabic Language","العربي","Arabic"],["اللغة الإنجليزية","English Language","إنجليزي","English"],
    ["الرياضيات","Mathematics","رياضيات","Math"],["العلوم","Science","علوم","Science"],
    ["الفيزياء","Physics","فيزياء","Physics"],["الكيمياء","Chemistry","كيمياء","Chemistry"],
    ["الأحياء","Biology","احياء","Biology"],["التاريخ","History","تاريخ","History"],
    ["الجغرافيا","Geography","جغرافيا","Geography"],["التربية الإسلامية","Islamic Studies","اسلامية","Islamic"],
    ["تاريخ قطر","Qatar History","تاريخ قطر","Qatar history"],["تقنية المعلومات","Information Technology","الحاسوب","IT"],
    ["التربية البدنية","Physical Education","رياضة","PE"],["الفنون","Art","فنون","Art"]
  ].map(([ar,en,a,b])=>({name:ar,code:undefined,group:"school",level:"school" as const,aliases:[en,a,b]})),
  ...[
    ["مقدمة في البرمجة","Introduction to Programming","CS 101","programming"],
    ["هياكل البيانات","Data Structures","CS 201","data structures"],
    ["الخوارزميات","Algorithms","CS 301","algorithms"],
    ["قواعد البيانات","Database Systems","CS 2XX","database"],
    ["الرياضيات المتقطعة","Discrete Mathematics","MATH 2XX","discrete math"],
    ["التفاضل والتكامل","Calculus","MATH 101","calculus"],
    ["الجبر الخطي","Linear Algebra","MATH 2XX","linear algebra"],
    ["الإحصاء والاحتمالات","Probability and Statistics","STAT 2XX","statistics"],
    ["الفيزياء العامة","General Physics","PHYS 1XX","physics"],
    ["الكيمياء العامة","General Chemistry","CHEM 1XX","chemistry"],
    ["مبادئ الاقتصاد","Principles of Economics","ECON 101","economics"],
    ["مبادئ المحاسبة","Principles of Accounting","ACCT 101","accounting"],
    ["التسويق","Marketing","MKT 101","marketing"],
    ["مبادئ الإدارة","Principles of Management","MGT 101","management"],
    ["علم النفس","Psychology","PSYC 101","psychology"],
    ["علم الاجتماع","Sociology","SOC 101","sociology"],
    ["التصميم الجرافيكي","Graphic Design","ART 1XX","graphic design"],
    ["مهارات الكتابة الأكاديمية","Academic Writing","ENG 1XX","academic writing"]
  ].map(([ar,en,code,alias])=>({name:ar,group:"higher",level:"higher" as const,code,aliases:[en,alias]}))
];

const institutions = [
  "Qatar University","University of Doha for Science and Technology","Hamad Bin Khalifa University",
  "Lusail University","Doha Institute for Graduate Studies","Georgetown University in Qatar",
  "Carnegie Mellon University in Qatar","Northwestern University in Qatar","Weill Cornell Medicine–Qatar",
  "Virginia Commonwealth University School of the Arts in Qatar","HEC Paris in Qatar"
];

const text = {
  ar: {
    eyebrow:"AZ / COURSES", title:"موادك، في مكان واحد.", intro:"كل مادة لها مساحة عمل خاصة تجمع ملفاتها ومهامها وتقدّمك الدراسي.",
    search:"ابحث عن مادة أو رمز مقرر", institution:"المؤسسة التعليمية (اختياري)", institutionHint:"الاقتراحات الحالية عامة؛ سنربطها بمقررات كل مؤسسة بعد اعتماد بياناتها",
    all:"الكل", school:"المدرسة", higher:"الجامعة والكلية", suggestions:"اقتراحات المواد", add:"إضافة إلى موادي",
    empty:"ما لقينا مادة بهذا الاسم. تقدر تضيفها بنفسك.", custom:"إضافة مادة مخصصة", customPlaceholder:"اكتب اسم المادة",
    mine:"موادي", noCourses:"ما أضفت مواد بعد. ابحث عن مادة وأضفها بضغطة واحدة.",
    workspace:"مساحة المادة", tasks:"المهام", files:"الملفات", noTasks:"لا توجد مهام مرتبطة بهذه المادة بعد.",
    noFiles:"لا توجد ملفات مضافة لهذه المادة بعد.", done:"مكتملة", open:"مفتوحة", back:"العودة للمواد",
    sourceNote:"هذه اقتراحات أولية لمواد شائعة، وليست قائمة رسمية بمقررات مؤسسة بعينها. نربطها بكتالوجات المؤسسات المعتمدة تدريجياً.",
    added:"تمت إضافة المادة.", duplicate:"هذه المادة موجودة عندك بالفعل.", loading:"جارٍ تحميل مساحة المادة..."
  },
  en: {
    eyebrow:"AZ / COURSES", title:"Your courses. One universe.", intro:"Every course gets its own workspace for files, tasks, and learning progress.",
    search:"Search a subject or course code", institution:"Institution (optional)", institutionHint:"Current suggestions are general; institution-specific catalogs will follow verified data.",
    all:"All", school:"School", higher:"University & college", suggestions:"Course suggestions", add:"Add to my courses",
    empty:"No match found. You can add this course yourself.", custom:"Add a custom course", customPlaceholder:"Course name",
    mine:"My courses", noCourses:"No courses yet. Search for a subject and add it in one click.",
    workspace:"Course workspace", tasks:"Tasks", files:"Files", noTasks:"No tasks linked to this course yet.",
    noFiles:"No files added to this course yet.", done:"Completed", open:"Open", back:"Back to courses",
    sourceNote:"These are starter suggestions for common subjects, not an official course list for a specific institution. Verified institution catalogs will be added progressively.",
    added:"Course added.", duplicate:"This course is already in your list.", loading:"Loading course workspace..."
  }
};

type Props = { userId: string; lang: Language; subjects: Subject[]; onRefresh: () => Promise<void> };

export default function Courses({ userId, lang, subjects, onRefresh }: Props) {
  const t = text[lang];
  const ar = lang === "ar";
  const [query,setQuery] = useState("");
  const [institution,setInstitution] = useState("");
  const [level,setLevel] = useState<"all"|"school"|"higher">("all");
  const [selected,setSelected] = useState<Subject|null>(null);
  const [customName,setCustomName] = useState("");
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");
  const [tasks,setTasks] = useState<Task[]>([]);
  const [documents,setDocuments] = useState<Document[]>([]);
  const [detailLoading,setDetailLoading] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return catalog.filter(item => (level === "all" || item.level === level) &&
      [item.name,...item.aliases,item.code || ""].some(value => value.toLocaleLowerCase().includes(q)))
      .slice(0,12);
  },[query,level]);

  async function addCourse(name: string, code?: string) {
    if (!supabase) return;
    const duplicate = subjects.some(s => s.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase());
    if (duplicate) { setNotice(t.duplicate); return; }
    setBusy(true); setNotice("");
    const {data,error} = await supabase.from("subjects").insert({
      user_id:userId, name:name.trim(), course_code:code || null
    }).select("id,name,color,created_at,course_code").single();
    if (error) setNotice(error.message);
    else { setNotice(t.added); setQuery(""); setCustomName(""); await onRefresh(); if (data) await openCourse(data as Subject); }
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
      <label className="catalog-institution"><span>{t.institution}</span><input value={institution} onChange={e=>setInstitution(e.target.value)} placeholder={ar?"مثلاً: جامعة قطر أو اسم المدرسة":"e.g. Qatar University or your school"}/><small>{t.institutionHint}</small></label>
      <div className="catalog-level-tabs">{(["all","school","higher"] as const).map(value=><button key={value} className={level===value?"active":""} onClick={()=>setLevel(value)}>{t[value]}</button>)}</div>
      {query.trim() && <div className="catalog-results"><div className="catalog-section-title"><span>{t.suggestions}</span><small>{results.length.toString().padStart(2,"0")}</small></div>
        {results.length ? results.map(item=><article className="catalog-result" key={item.name}><div className="catalog-result-icon">{item.level==="school"?"⌂":"◇"}</div><div className="catalog-result-copy"><strong>{item.name}</strong><small>{item.aliases[0]}{item.code ? " · "+item.code : ""}</small></div><button disabled={busy} onClick={()=>void addCourse(item.name,item.code)}>{t.add} <span>＋</span></button></article>) : <p className="courses-muted">{t.empty}</p>}
        <p className="catalog-source-note">{t.sourceNote}</p>
      </div>}
    </div>
    <div className="courses-lower-grid">
      <section className="courses-panel"><div className="courses-panel-heading"><div><span className="eyebrow">{t.mine}</span><h2>{t.mine}</h2></div><strong>{subjects.length.toString().padStart(2,"0")}</strong></div>
        {subjects.length ? <div className="my-course-grid">{subjects.map((subject,index)=><button className="my-course-card" key={subject.id} onClick={()=>void openCourse(subject)}><span className="my-course-index">{String(index+1).padStart(2,"0")}</span><span className="my-course-orbit">✧</span><strong>{subject.name}</strong><small>{subject.course_code || (ar?"مساحة دراسية":"Study workspace")}</small><i>↗</i></button>)}</div> : <div className="courses-empty"><span>✧</span><p>{t.noCourses}</p></div>}
      </section>
      <section className="courses-panel custom-course-panel"><div className="courses-panel-heading"><div><span className="eyebrow">{ar?"إضافة سريعة":"QUICK ADD"}</span><h2>{t.custom}</h2></div><span>＋</span></div><form onSubmit={customSubmit}><input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder={t.customPlaceholder} maxLength={120}/><button className="primary-button" disabled={busy||!customName.trim()}>{t.add} ↗</button></form>{notice && <p className="courses-notice" role="status">{notice}</p>}
        <div className="institution-suggestions"><small>{ar?"مؤسسات تعليم عالٍ في قطر":"Higher education in Qatar"}</small>{institutions.slice(0,5).map(name=><span key={name}>{name}</span>)}</div>
      </section>
    </div>
  </section>;
}
