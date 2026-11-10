import UniverseEffects from "./components/UniverseEffects";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigReady } from "./lib/supabase";
import AcademicSetup from "./components/AcademicSetup";
import PlanningPage from "./components/PlanningPage";
import { qatarDateKey } from "./lib/qatarTime.mjs";
import { formatArabicCount } from "./lib/arabicPlural.mjs";

type Language = "ar" | "en";
type Page = "workspace" | "notebook" | "focus" | "arena";
type Section = "home" | "planning" | "az" | "community" | "me";
type Subject = { id: string; name: string; color: string | null; exam_date: string | null; created_at: string };
type Task = { id: string; user_id: string; subject_id: string | null; title: string; due_at: string | null; priority: number; est_minutes: number | null; status: "todo" | "doing" | "done"; note: string | null; completed_at?: string | null; document_id?: string | null; created_at: string };

const labels = {
  ar: { eyebrow:"مساحتك الأكاديمية", headline:"خطّط بوضوح. ادرس بتركيز.", intro:"مكان واحد يجمع خطتك ومذاكرتك وتقدّمك.", email:"البريد الإلكتروني", password:"كلمة المرور", signIn:"تسجيل الدخول", signUp:"إنشاء حساب", create:"ابدأ حسابك", have:"عندك حساب؟", none:"ما عندك حساب؟", signOut:"تسجيل الخروج", language:"English", loading:"لحظة...", config:"نحتاج إعداد الاتصال بـ Supabase", configText:"انسخ .env.example إلى .env.local وأضف رابط المشروع ومفتاح Publishable. لا تستخدم service_role في المتصفح.", checkEmail:"أرسلنا لك رسالة تأكيد. افتح بريدك ثم ارجع لتسجيل الدخول.", welcome:"تم تسجيل الدخول بنجاح.", workspace:"مساحة العمل", notebook:"دفتر الملاحظات", arena:"ARENA", az:"AZ", community:"المجتمع", me:"أنا", communityTitle:"مجتمع AZ", communityText:"مساحة تجمع الطلاب لتبادل المعرفة والتجارب. ستتوفر في مرحلة لاحقة.", meTitle:"ملفي الشخصي", meText:"إدارة حسابك وتفضيلاتك الشخصية.", account:"الحساب", appearance:"المظهر", home:"الرئيسية", planning:"التخطيط", focus:"التركيز", study:"المذاكرة", today:"مساحة اليوم", todayText:"خطوة صغيرة ومنتظمة تصنع تقدماً كبيراً.", tasks:"المهام", completed:"مكتملة", subjects:"المواد الدراسية", subjectName:"اسم المادة", addSubject:"إضافة مادة", addTask:"إضافة مهمة", taskTitle:"عنوان المهمة", chooseSubject:"المادة", noSubject:"بدون مادة", due:"تاريخ الإنجاز", minutes:"المدة بالدقائق", priority:"الأولوية", high:"عالية", medium:"متوسطة", low:"منخفضة", todo:"لم تبدأ", doing:"قيد التنفيذ", done:"مكتملة", all:"الكل", todayFilter:"اليوم", upcoming:"القادمة", overdue:"المتأخرة", start:"ابدأ التركيز", stop:"إنهاء الجلسة", focusTitle:"وقت تركيزك", focusText:"اختر مهمة وابدأ جلسة تركيز.", studyTitle:"مساحة العمل الأكاديمية", studyText:"غرفة عملياتك لتنظيم الدراسة والعمل على أدواتك الأكاديمية.", notebookTitle:"دفتر الملاحظات", notebookText:"مساحة تدوين أفكارك وملاحظاتك الأكاديمية. ستتوفر أدواتها في مرحلة لاحقة.", arenaTitle:"ARENA", arenaText:"مساحة التحديات والتنافس الأكاديمي بين الطلاب.", studyNext:"الخطوة التالية: رفع ملفات PDF واستخراج محتواها وبناء أدوات الدراسة.", empty:"لا توجد مهام هنا بعد.", emptySubjects:"لا توجد مواد بعد.", remove:"حذف", startTask:"ابدأ", finishTask:"أنجزت", reopen:"إعادة فتح", saved:"تم حفظ جلسة التركيز.", noDue:"بدون موعد", footer:"AZ — خطّط، ادرس، تطوّر." },
  en: { eyebrow:"Your academic space", headline:"Plan clearly. Study with focus.", intro:"One place for your plan, study sessions, and progress.", email:"Email address", password:"Password", signIn:"Sign in", signUp:"Create account", create:"Create your account", have:"Already have an account?", none:"New to AZ?", signOut:"Sign out", language:"العربية", loading:"Loading...", config:"Connect AZ to Supabase", configText:"Copy .env.example to .env.local and add your project URL and Publishable key. Never use a service_role key in the browser.", checkEmail:"We sent a confirmation email. Confirm it, then return to sign in.", welcome:"You're signed in.", workspace:"Workspace", notebook:"Notebook", arena:"ARENA", az:"AZ", community:"Community", me:"Me", communityTitle:"AZ Community", communityText:"A space for students to exchange knowledge and experiences. Coming in a later phase.", meTitle:"My profile", meText:"Manage your account and personal preferences.", account:"Account", appearance:"Appearance", home:"Home", planning:"Planning", focus:"Focus", study:"Study", today:"Your day", todayText:"Small, consistent steps create meaningful progress.", tasks:"Tasks", completed:"Completed", subjects:"Subjects", subjectName:"Subject name", addSubject:"Add subject", addTask:"Add task", taskTitle:"Task title", chooseSubject:"Subject", noSubject:"No subject", due:"Due date", minutes:"Duration in minutes", priority:"Priority", high:"High", medium:"Medium", low:"Low", todo:"To do", doing:"In progress", done:"Done", all:"All", todayFilter:"Today", upcoming:"Upcoming", overdue:"Overdue", start:"Start focus", stop:"End session", focusTitle:"Focus time", focusText:"Choose a task and start a focus session.", studyTitle:"Academic workspace", studyText:"Your command center for study and academic tools.", notebookTitle:"Notebook", notebookText:"A dedicated space for your academic notes and ideas. Tools are coming in a later phase.", arenaTitle:"ARENA", arenaText:"A space for academic challenges and student competition.", studyNext:"Next: PDF uploads, text extraction, and AI-powered study tools.", empty:"Nothing here yet. Add your first task.", emptySubjects:"No subjects yet.", remove:"Delete", startTask:"Start", finishTask:"Complete", reopen:"Reopen", saved:"Focus session saved.", noDue:"No due date", footer:"AZ — Plan, study, evolve." }
};

function clock(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2,"0");
  const m = Math.floor(seconds % 3600 / 60).toString().padStart(2,"0");
  const s = (seconds % 60).toString().padStart(2,"0");
  return h + ":" + m + ":" + s;
}

function Universe() {
  return <div className="universe-stage" aria-hidden="true">
    <div className="universe-halo halo-a"/><div className="universe-halo halo-b"/><div className="universe-grid"/>
    <div className="universe-orbit orbit-a"/><div className="universe-orbit orbit-b"/><div className="universe-orbit orbit-c"/>
    <span className="universe-node node-a"/><span className="universe-node node-b"/><span className="universe-node node-c"/>
    <div className="universe-monogram"><img src="/az-mark.svg" alt=""/></div>
    <div className="orbit-caption caption-plan"><i/> Plan</div><div className="orbit-caption caption-study"><i/> Study</div><div className="orbit-caption caption-grow"><i/> Grow</div>
  </div>;
}

export default function App() {
  const [universe,setUniverse] = useState<boolean>(() => {
    try { return window.localStorage.getItem("az-background") === "universe"; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem("az-background", universe ? "universe" : "plain"); } catch { /* storage unavailable */ }
  }, [universe]);
  const [lang,setLang] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("az-language");
      return saved === "en" || saved === "ar" ? saved : "ar";
    } catch {
      return "ar";
    }
  });
  const [dark,setDark] = useState<boolean>(() => { try { return window.localStorage.getItem("az-theme") !== "light"; } catch { return true; } });
  const [user,setUser] = useState<User|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [mode,setMode] = useState<"signin"|"signup">("signin");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [section,setSection] = useState<Section>("home");
  const [page,setPage] = useState<Page>("workspace");
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [taskDocumentLinkAvailable,setTaskDocumentLinkAvailable] = useState(false);
  const [activeDocument,setActiveDocument] = useState<{id:string;title:string;url:string}|null>(null);
  const [focusTask,setFocusTask] = useState("");
  const [finishedFocus,setFinishedFocus] = useState<{taskId:string|null;taskTitle:string;minutes:number}|null>(null);
  const [started,setStarted] = useState<number|null>(null);
  const [elapsed,setElapsed] = useState(0);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [setupChecked,setSetupChecked] = useState(false);
  const [showAcademicSetup,setShowAcademicSetup] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed] = useState(false);
  const [mobileNavOpen,setMobileNavOpen] = useState(false);
  const [offline,setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [homePrompt,setHomePrompt] = useState("");
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const t = labels[lang];
  const ar = lang === "ar";
  const qaHomeState = import.meta.env.VITE_DEMO === "1" ? new URLSearchParams(window.location.search).get("qa-home-state") : null;
  const showHomeLoading = loading || qaHomeState === "loading";
  const showHomeError = Boolean(error) || qaHomeState === "error";

  useEffect(() => {
    try {
      window.localStorage.setItem("az-theme",dark ? "dark" : "light");
    } catch { /* storage unavailable */ }
  },[dark]);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online",update);
    window.addEventListener("offline",update);
    return () => { window.removeEventListener("online",update); window.removeEventListener("offline",update); };
  },[]);

  useEffect(() => {
    try {
      window.localStorage.setItem("az-language",lang);
    } catch {
      // Keep the selected language for the current session if storage is unavailable.
    }
  },[lang]);

  async function refreshUser() {
    if (!supabase) return;
    const {data,error:e} = await supabase.auth.getUser();
    if (e) setError(e.message);
    setUser(data.user);
  }

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    let active = true;
    const client = supabase;
    async function initial() {
      const {data,error:e} = await client.auth.getUser();
      if (!active) return;
      if (e && e.name !== "AuthSessionMissingError") setError(e.message);
      setUser(data.user); setAuthLoading(false);
    }
    void initial();
    const {data} = client.auth.onAuthStateChange((_event,session) => {
      if (!active) return;
      if (!session) setUser(null);
      else window.setTimeout(() => { if (active) void refreshUser(); },0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  },[]);

  async function loadData() {
    if (!supabase || !user) return;
    setError("");
    setLoading(true);
    const [s,initialTasks] = await Promise.all([
      supabase.from("subjects").select("id,name,color,exam_date,created_at").order("created_at"),
      supabase.from("tasks").select("id,user_id,subject_id,title,due_at,priority,est_minutes,status,note,completed_at,document_id,created_at").order("created_at",{ascending:false})
    ]);
    let taskError = initialTasks.error;
    let taskData = (initialTasks.data || []) as Task[];
    let hasDocumentLink = true;
    if (taskError && (taskError.message.toLowerCase().includes("document_id") || taskError.message.toLowerCase().includes("completed_at"))) {
      hasDocumentLink = false;
      const fallbackTasks = await supabase
        .from("tasks")
        .select("id,user_id,subject_id,title,due_at,priority,est_minutes,status,note,completed_at,created_at")
        .order("created_at", { ascending: false });
      taskError = fallbackTasks.error;
      taskData = (fallbackTasks.data || []) as Task[];
      if (taskError && taskError.message.toLowerCase().includes("completed_at")) {
        const legacyTasks = await supabase.from("tasks")
          .select("id,user_id,subject_id,title,due_at,priority,est_minutes,status,note,created_at")
          .order("created_at", { ascending: false });
        taskError = legacyTasks.error;
        taskData = (legacyTasks.data || []) as Task[];
      }
    }
    setTaskDocumentLinkAvailable(hasDocumentLink);
    if (s.error) setError(s.error.message); else setSubjects((s.data||[]) as Subject[]);
    if (taskError) setError(taskError.message); else setTasks(taskData);
    setLoading(false);
  }
  useEffect(() => { if (user) void loadData(); else { setSubjects([]); setTasks([]); } },[user]);

  useEffect(() => {
    if (!user || !supabase) {
      setSetupChecked(false);
      setShowAcademicSetup(false);
      return;
    }
    let active = true;
    setSetupChecked(false);
    async function checkAcademicSetup() {
      const { data, error: setupError } = await supabase!.from("academic_setup")
        .select("status").eq("user_id", user!.id).maybeSingle();
      if (!active) return;
      if (setupError) {
        setError(setupError.message);
        setShowAcademicSetup(false);
      } else {
        setShowAcademicSetup(!data || data.status === "not_started" || data.status === "in_progress");
      }
      setSetupChecked(true);
    }
    void checkAcademicSetup();
    return () => { active = false; };
  },[user]);

  useEffect(() => {
    if (started === null) return;
    const tick = () => setElapsed(Math.floor((Date.now()-started)/1000));
    tick();
    const id = window.setInterval(tick,1000);
    return () => window.clearInterval(id);
  },[started]);

  const today = qatarDateKey();
  const nearestExam = subjects
    .filter(subject => subject.exam_date && subject.exam_date >= today)
    .sort((a, b) => (a.exam_date ?? "").localeCompare(b.exam_date ?? ""))[0] ?? null;
  const nearestExamDays = nearestExam?.exam_date
    ? Math.round((Date.parse(nearestExam.exam_date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000)
    : null;
  const nearestExamLabel = nearestExamDays === null
    ? (ar ? "لا توجد اختبارات قادمة" : "No upcoming exams")
    : nearestExamDays === 0
      ? (ar ? "الاختبار اليوم" : "Exam today")
      : ar
        ? `الاختبار بعد ${nearestExamDays === 1 ? "يوم واحد" : nearestExamDays === 2 ? "يومين" : nearestExamDays <= 10 ? `${nearestExamDays} أيام` : `${nearestExamDays} يومًا`}`
        : `Exam in ${nearestExamDays} days`;
  const subjectFor = (id:string|null) => subjects.find(s=>s.id===id)?.name || t.noSubject;
  const completedCount = tasks.filter(task=>task.status==="done").length;
  const completionRate = tasks.length ? Math.round(completedCount/tasks.length*100) : 0;
  const openTasks = tasks.filter(task=>task.status!=="done");
  const todayTaskCount = openTasks.filter(task=>task.due_at && new Date(task.due_at).toLocaleDateString("en-CA")===today).length;
  const todayLabel = new Date().toLocaleDateString(ar?"ar-QA":"en-US",{weekday:"long",month:"long",day:"numeric"});

  async function auth(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); setError(""); setMessage("");
    const result = mode === "signup"
      ? await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:window.location.origin}})
      : await supabase.auth.signInWithPassword({email:email.trim(),password});
    if (result.error) setError(result.error.message);
    else if (mode === "signup" && !result.data.session) { setMessage(t.checkEmail); setMode("signin"); }
    else { setMessage(t.welcome); await refreshUser(); }
    setBusy(false);
  }
  async function signOut() {
    if (!supabase) return;
    setBusy(true); const {error:e} = await supabase.auth.signOut();
    if (e) setError(e.message); else { setUser(null); setTasks([]); setSubjects([]); }
    setBusy(false);
  }
  async function changeTask(task:Task,status:Task["status"]) {
    if (!supabase) return;
    const {error:e} = await supabase.from("tasks").update({status}).eq("id",task.id);
    if (e) setError(e.message); else await loadData();
  }
  async function openDocument(documentId:string) {
    if (!supabase || !user) return;
    const {data,error:e}=await supabase.from("documents").select("id,title,storage_path").eq("id",documentId).eq("user_id",user.id).eq("status","ready").single();
    if(e||!data){setError(e?.message??(ar?"تعذر فتح المستند":"Could not open document"));return;}
    const {data:signed,error:signError}=await supabase.storage.from("documents").createSignedUrl(data.storage_path,3600);
    if(signError||!signed){setError(signError?.message??"Could not create document link");return;}
    setActiveDocument({id:data.id,title:data.title,url:signed.signedUrl});setSection("az");setPage("workspace");
  }
  async function stopFocus() {
    if (!supabase || !user || started===null) return;
    setBusy(true);
    const endedAt=Date.now();
    const task=tasks.find(x=>x.id===focusTask);
    const duration=Math.max(0,Math.round((endedAt-started)/60000));
    const {error:e} = await supabase.from("focus_sessions").insert({
      user_id:user.id,task_id:focusTask||null,
      started_at:new Date(started).toISOString(),ended_at:new Date(endedAt).toISOString()
    });
    if (e) setError(e.message); else { setMessage(t.saved); setFinishedFocus({taskId:focusTask||null,taskTitle:task?.title??(ar?"جلسة تركيز":"Focus session"),minutes:duration}); }
    setStarted(null); setElapsed(0); setBusy(false);
  }

  const workspaceNav:Page[] = ["workspace","notebook","focus","arena"];
  const sectionNav:Section[] = ["home","planning","az","me"];
  const navGlyphs:Record<Section,string> = {home:"⌂",planning:"◷",az:"✧",community:"◎",me:"◌"};
  const moduleGlyphs:Record<Page,string> = {workspace:"▦",notebook:"▤",focus:"◉",arena:"◇"};
  return <main className={"app-shell "+(dark?"theme-dark":"theme-light")+(universe?" bg-universe":" bg-plain")} dir={ar?"rtl":"ltr"} lang={lang}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/>{universe && <UniverseEffects />}
    <section className="main-content">
      {!supabaseConfigReady ? <div className="auth-layout">
        <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-pulse"/>{t.eyebrow}</span><h1>{t.headline}</h1><p>{t.intro}</p><Universe/></div>
        <section className="setup-card"><h2>{t.config}</h2><p>{t.configText}</p><code>.env.local</code></section>
      </div> : authLoading ? <div className="loading-state">{t.loading}</div> : !user ? <div className="auth-layout">
        <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-pulse"/>{t.eyebrow}</span><h1>{t.headline}</h1><p>{t.intro}</p><Universe/></div>
        <section className="auth-card">
          <div className="auth-tabs"><button className={mode==="signin"?"active":""} onClick={()=>setMode("signin")} type="button">{t.signIn}</button><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")} type="button">{t.signUp}</button></div>
          <h2>{mode==="signup"?t.create:t.signIn}</h2>
          <form onSubmit={auth}>
            <label><span>{t.email}</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
            <label><span>{t.password}</span><input type="password" autoComplete={mode==="signup"?"new-password":"current-password"} minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required/></label>
            <button className="primary-button full-button" disabled={busy}>{busy?t.loading:mode==="signup"?t.create:t.signIn}<span>↗</span></button>
          </form>
          <p className="switch-mode">{mode==="signin"?t.none:t.have}<button type="button" onClick={()=>setMode(mode==="signin"?"signup":"signin")}>{mode==="signin"?t.signUp:t.signIn}</button></p>
        </section>
      </div> : <div className="az-workspace">
        <button className="mobile-nav-toggle workspace-menu-toggle" type="button" onClick={()=>setMobileNavOpen(v=>!v)} aria-label={mobileNavOpen?(ar?"إغلاق القائمة":"Close navigation"):(ar?"فتح القائمة":"Open navigation")} aria-expanded={mobileNavOpen}>{mobileNavOpen?"×":"☰"}</button>
        {mobileNavOpen && <button className="mobile-nav-backdrop" type="button" aria-label={ar?"إغلاق القائمة":"Close navigation"} onClick={()=>setMobileNavOpen(false)}/>}
        <aside className={"workspace-rail"+(sidebarCollapsed?" is-collapsed":"")+(mobileNavOpen?" is-mobile-open":"")}>
          <div className="rail-topline"><div className="rail-label"><img className="rail-logo" src="/az-mark.svg" alt="AZ"/></div><button className="rail-collapse" type="button" onClick={()=>setSidebarCollapsed(v=>!v)} aria-label={sidebarCollapsed?(ar?"توسيع القائمة":"Expand sidebar"):(ar?"طي القائمة":"Collapse sidebar")}>{sidebarCollapsed?"⇤":"⇥"}</button></div><button className="rail-new-session" type="button" onClick={()=>{setSection("az");setPage("focus");setMessage("");setMobileNavOpen(false);}}><span aria-hidden="true">＋</span><span>{ar?"جلسة جديدة":"New session"}</span></button>
          <nav className="primary-nav" aria-label={ar?"الأقسام الرئيسية":"Main sections"}>{sectionNav.map((item,i)=><div className="primary-nav-item" key={item}><button className={section===item?"active":""} aria-expanded={item==="az"?section==="az":undefined} title={sidebarCollapsed?t[item]:undefined} onClick={()=>{setSection(item);setMessage("");setMobileNavOpen(false);}}><span className="nav-glyph" aria-hidden="true">{navGlyphs[item]}</span><span className="nav-index">0{i+1}</span><span className="nav-text">{t[item]}</span><i/></button>{item==="az" && section==="az" && <div className="workspace-subnav"><span className="subnav-label">{ar?"داخل AZ":"AZ modules"}</span><nav className="workspace-nav" aria-label={ar?"أدوات AZ":"AZ modules"}>{workspaceNav.map((subItem,j)=><button key={subItem} className={page===subItem?"active":""} title={sidebarCollapsed?t[subItem]:undefined} onClick={()=>{setPage(subItem);setMessage("");setMobileNavOpen(false);}}><span className="module-glyph" aria-hidden="true">{moduleGlyphs[subItem]}</span><span className="nav-index">0{j+1}</span><span className="nav-text">{t[subItem]}</span><i/></button>)}</nav></div>}</div>)}</nav>
          <div className="rail-bottom"><button className="rail-account" type="button" onClick={()=>{setSection("me");setMessage("");setMobileNavOpen(false);}}><span className="rail-account-avatar">{(user.email||"A").slice(0,1).toUpperCase()}</span><span className="rail-account-copy"><small>{ar?"الحساب":"Account"}</small><strong>{user.email}</strong></span></button></div>
        </aside>
        <div className="workspace-main">
          {section!=="home" && section!=="planning" && <div className="workspace-heading"><div><span className="eyebrow"><span className="eyebrow-pulse"/>{section==="az"?t.az:section==="community"?t.community:t.me}</span><h1>{section==="az"?(page==="workspace"?t.workspace:page==="notebook"?t.notebook:page==="focus"?t.focus:t.arenaTitle):section==="community"?t.communityTitle:t.meTitle}</h1><p>{section==="az"?(page==="workspace"?t.studyText:page==="notebook"?t.notebookText:page==="focus"?t.focusText:t.arenaText):section==="community"?t.communityText:t.meText}</p></div></div>}
          {section==="home" && <div className="home-view">{offline&&<div className="home-offline" role="status">{ar?"أنت غير متصل بالإنترنت. قد لا تتم مزامنة التغييرات.":"You’re offline. Changes may not sync until you reconnect."}</div>}
            <section className="home-hero">
              <div className="home-hero-copy">
                
                <p className="home-date">{todayLabel}</p>
                <p className="home-greeting">{ar?"أهلاً بعودتك.":"Welcome back."}</p>
                <h2 className="home-hero-title">{ar?"ماذا تريد أن تدرس اليوم؟":"What would you like to study today?"}</h2>
                <form className="home-study-input az-card" onSubmit={event=>{event.preventDefault();if(!homePrompt.trim())return;setSection("planning");}}>
                  <input className="az-input" value={homePrompt} onChange={event=>setHomePrompt(event.target.value)} placeholder={ar?"اكتب ما تريد إنجازه أو مراجعته...":"Add a topic or task to work on..."} aria-label={ar?"ماذا تريد أن تدرس اليوم؟":"What would you like to study today?"} />
                  <button className="az-btn az-btn--primary home-continue-button" type="submit" disabled={!homePrompt.trim()}>{ar?"تابع إلى خطتك":"Continue to plan"} <span>↗</span></button>
                </form>
                <div className="home-hero-actions">
                  <button className="az-btn home-secondary-action" onClick={()=>setSection("planning")}>{ar?"افتح خطتك":"Open your plan"} <span>↗</span></button>
                  <button className="az-btn home-secondary-action" onClick={()=>{setSection("az");setPage("focus");}}><span className="play-mark">▶</span>{ar?"ابدأ جلسة تركيز":"Start a focus session"}</button>
                </div>
              </div>
              <div className="home-universe-visual" aria-hidden="true">
                <div className="universe-nebula nebula-cyan"/><div className="universe-nebula nebula-violet"/>
                <div className="universe-grid-plane"/>
                <div className="home-orbit one"/><div className="home-orbit two"/><div className="home-orbit three"/>
                <div className="home-planet"><img src="/az-mark.svg" alt=""/></div>
                <span className="home-star star-one"/><span className="home-star star-two"/><span className="home-star star-three"/>
                <span className="universe-label label-plan">{ar?"خطّط":"Plan"}</span><span className="universe-label label-study">{ar?"تعلّم":"Study"}</span><span className="universe-label label-grow">{ar?"تطوّر":"Grow"}</span>
                <span className="universe-coordinate coordinate-top">AZ · 01</span><span className="universe-coordinate coordinate-bottom">From A to Z</span>
              </div>
            </section>
            {showHomeError&&<div className="home-state" role="alert"><p>{ar?"تعذّر تحميل بياناتك. حاول مرة أخرى.":"Could not load your data. Please try again."}</p><button type="button" className="az-btn az-btn--primary" onClick={()=>void loadData()}>{ar?"إعادة المحاولة":"Retry"}</button></div>}
            {showHomeLoading?<section className="home-skeleton" aria-label={t.loading}><span/><span/><span/></section>:<>
            <section className="home-dashboard-cards"><article className="az-card home-dashboard-card"><span>{ar?"مهام اليوم":"Today"}</span><strong>{todayTaskCount}</strong><small>{ar?formatArabicCount(todayTaskCount,{zero:"لا مهام بموعد اليوم",one:"مهمة واحدة بموعد اليوم",two:"مهمتان بموعد اليوم",few:"مهام بموعد اليوم",many:"مهمة بموعد اليوم"}):"Tasks due today"}</small></article><article className="az-card home-dashboard-card"><span>{ar?"التركيز":"Focus"}</span><strong>{started===null?(ar?"جاهز":"Ready"):clock(elapsed)}</strong><small>{ar?"ابدأ جلسة تركيز":"Start a focus session"}</small><button type="button" className="az-btn az-btn--ghost" onClick={()=>{setSection("az");setPage("focus");}}>{ar?"ابدأ":"Start"} ↗</button></article><article className="az-card home-dashboard-card"><span>{ar?"الاختبار القادم":"Upcoming exam"}</span><strong>{nearestExamLabel}</strong><small>{nearestExam?.name ?? (ar?"لا توجد اختبارات قادمة":"No upcoming exams")}</small></article></section>
            <section className="home-overview">
              <div className="az-card home-progress-panel">
                <div className="home-section-heading"><div><span className="eyebrow">{ar?"إشارتك اليومية":"Daily progress"}</span><h2>{ar?"تقدّمك":"Your progress"}</h2></div><span className="progress-orbit-icon">✧</span></div>
                <div className="progress-summary"><div className="progress-number"><strong>{completionRate}<small>%</small></strong><span>{ar?"من إجمالي المهام مكتمل":"of all tasks completed"}</span></div><div className="progress-track home-progress-track"><i style={{width:completionRate+"%"}}/></div></div>
                <div className="home-metrics">
                  <div><strong>{String(tasks.length).padStart(2,"0")}</strong><span>{ar?"إجمالي المهام":"Total tasks"}</span></div>
                  <div><strong>{String(todayTaskCount).padStart(2,"0")}</strong><span>{ar?"المهام المستحقة":"Due today"}</span></div>
                  <div><strong>{String(subjects.length).padStart(2,"0")}</strong><span>{ar?"المواد":"Subjects"}</span></div>
                </div>
              </div>
              <section className="az-card home-next-panel">
                <div className="home-section-heading"><div><span className="eyebrow">{ar?"الخطوة التالية":"Next step"}</span><h2>{ar?"تابع من هنا":"Pick up where you left off"}</h2></div><button className="az-btn az-btn--ghost text-action" onClick={()=>setSection("planning")}>{t.planning} ↗</button></div>
                {(qaHomeState==="empty"||openTasks.length===0)?<div className="empty-state"><span className="empty-symbol">✧</span><p>{t.empty}</p><button className="az-btn az-btn--primary home-empty-action" onClick={()=>setSection("planning")}>{t.addTask} ↗</button></div>:<div className="task-list">{openTasks.slice(0,4).map(task=><article className="task-row" key={task.id}><span className={"task-priority priority-"+task.priority}/><div className="task-info"><strong>{task.title}</strong><small>{subjectFor(task.subject_id)} · {task.est_minutes||45} {ar?"دقيقة":"min"}</small></div><span className={"task-status status-"+task.status}>{t[task.status]}</span><button className="az-btn az-btn--ghost small-action" onClick={()=>void changeTask(task,task.status==="todo"?"doing":"done")}>{task.status==="todo"?t.startTask:t.finishTask}</button></article>)}</div>}
              </section>
            </section>
            </>}
          </div>}
          {section==="planning" && <PlanningPage userId={user.id} lang={lang} tasks={tasks} subjects={subjects} loading={loading} hasError={Boolean(error)} onRetry={loadData} documentLinkAvailable={taskDocumentLinkAvailable} onOpenDocument={openDocument} initialText={homePrompt} onInitialTextConsumed={()=>setHomePrompt("")} onRefresh={loadData} onStartFocus={(taskId)=>{setFocusTask(taskId);setElapsed(0);setStarted(Date.now());setSection("az");setPage("focus");setMessage("");}}/>}
          {section==="az" && page==="focus" && <section className="focus-view content-panel">{finishedFocus&&<div className="focus-finish-card"><strong>{ar?"أحسنت!":"Nice work."} {finishedFocus.minutes} {ar?"دقيقة على":"min on"} {finishedFocus.taskTitle}.</strong><div><button type="button" onClick={async()=>{if(finishedFocus.taskId){const finishedTask=tasks.find(x=>x.id===finishedFocus.taskId);if(finishedTask)await changeTask(finishedTask,"done");}setFinishedFocus(null);}}>{ar?"وضع علامة مكتملة":"Mark done"}</button><button type="button" onClick={()=>setFinishedFocus(null)}>{ar?"ليس الآن":"Not yet"}</button></div></div>}<span className="eyebrow">Deep work session</span><h2>{t.focusTitle}</h2><p>{t.focusText}</p><div className="focus-clock"><div className="clock-ring"><span>{clock(elapsed)}</span><small>Focus elapsed</small></div></div><label className="focus-select"><span>{t.chooseSubject}</span><select value={focusTask} onChange={e=>setFocusTask(e.target.value)} disabled={started!==null}><option value="">{t.noSubject}</option>{tasks.filter(x=>x.status!=="done").map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>{started===null?<button className="primary-button focus-button" onClick={()=>{setElapsed(0);setStarted(Date.now());}}>{t.start} ↗</button>:<button className="primary-button focus-button" onClick={()=>void stopFocus()} disabled={busy}>{busy?t.loading:t.stop}</button>}</section>}
          {section==="az" && page==="workspace" && (activeDocument?<section className="document-viewer content-panel"><div className="document-viewer-head"><strong>{activeDocument.title}</strong><button type="button" onClick={()=>setActiveDocument(null)}>{ar?"إغلاق المستند":"Close document"}</button></div><iframe title={activeDocument.title} src={activeDocument.url}/></section>:<section className="study-placeholder content-panel"><div className="study-orbit"><div className="study-core"><img src="/az-mark.svg" alt="AZ"/></div><span className="study-ring ring-a"/><span className="study-ring ring-b"/></div><span className="eyebrow">Knowledge system / 01</span><h2>{t.studyTitle}</h2><p>{t.studyText}</p><div className="study-next">{t.studyNext}</div></section>)}
          {section==="az" && page==="notebook" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">Notebook</span><h2>{t.notebookTitle}</h2><p>{t.notebookText}</p></section>}
          {section==="az" && page==="arena" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">Arena</span><h2>{t.arenaTitle}</h2><p>{t.arenaText}</p><span className="coming-soon-label">Coming soon</span></section>}
          {section==="community" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">Community</span><h2>{t.communityTitle}</h2><p>{t.communityText}</p><span className="coming-soon-label">{ar?"قريبًا":"Coming in a later phase"}</span></section>}
          {section==="me" && <section className="profile-view az-card"><div className="profile-avatar">{(user.email||"A").slice(0,1).toUpperCase()}</div><span className="eyebrow">{ar?"إعدادات الحساب":"Account settings"}</span><p>{t.meText}</p><div className="profile-details"><div><span>{t.account}</span><strong>{user.email}</strong></div><div><span>{t.appearance}</span><strong>{dark?(ar?"داكن":"Dark"):(ar?"فاتح":"Light")}</strong></div><div><span>{ar?"الخلفية":"Background"}</span><strong>{universe?(ar?"الكون":"Universe"):(ar?"سادة":"Plain")}</strong></div><div><span>{ar?"اللغة":"Language"}</span><strong>{ar?"العربية":"English"}</strong></div></div><div className="profile-actions"><button className="az-btn" onClick={()=>setDark(v=>!v)}>{ar?"تبديل الإضاءة":"Toggle light / dark"}</button><button className="az-btn" onClick={()=>setUniverse(v=>!v)}>{ar?"تبديل الخلفية":"Toggle Plain / Universe"}</button><button className="az-btn" onClick={()=>setLang(ar?"en":"ar")}>{ar?"English":"العربية"}</button><button className="az-btn" onClick={()=>setShowAcademicSetup(true)}>{ar?"إعداد المساحة الأكاديمية":"Academic setup"}</button><button className="az-btn az-btn--primary" onClick={signOut} disabled={busy}>{t.signOut}</button></div></section>}
        </div>
      </div>}
      {showAcademicSetup && setupChecked && !loading && user && <AcademicSetup userId={user.id} lang={lang} existingSubjects={subjects} onComplete={()=>{setShowAcademicSetup(false); void loadData();}} />}
      {message && <p className="feedback success-feedback" role="status">{message}</p>}
      {error && <p className="feedback error-feedback" role="alert">{ar?"حدث خطأ. حاول مرة أخرى.":"Something went wrong. Please try again."}</p>}
    </section>
    <footer className="footer"><span>© 2026 AZ</span><span>{t.footer}</span></footer>
  </main>;
}
