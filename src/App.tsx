import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { flushSync } from "react-dom";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigReady } from "./lib/supabase";
import UniverseEffects from "./components/UniverseEffects";

const AcademicSetup = lazy(() => import("./components/AcademicSetup"));
const ProjectPlanningFeed = lazy(() => import("./components/ProjectPlanningFeed"));
const ProjectsHome = lazy(() => import("./components/ProjectsHome"));
const ProjectWorkspace = lazy(() => import("./components/ProjectWorkspace"));

function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return <div className="page-skeleton" role="status" aria-label={label}>
    <span className="skeleton-line skeleton-line-wide" />
    <span className="skeleton-line" />
    <span className="skeleton-line skeleton-line-short" />
  </div>;
}

type Language = "ar" | "en";
type Page = "workspace" | "notebook" | "focus" | "arena";
type Section = "home" | "planning" | "az" | "projects" | "community" | "me";
type Subject = { id: string; name: string; color: string | null; created_at: string };
type Task = { id: string; user_id: string; subject_id: string | null; title: string; due_at: string | null; priority: number; est_minutes: number | null; status: "todo" | "doing" | "done"; created_at: string };

const labels = {
  ar: { eyebrow:"مساحتك الأكاديمية", headline:"خطّط بوضوح. ادرس بتركيز.", intro:"مكان واحد يجمع خطتك ومذاكرتك وتقدّمك.", email:"البريد الإلكتروني", password:"كلمة المرور", signIn:"تسجيل الدخول", signUp:"إنشاء حساب", create:"ابدأ حسابك", have:"عندك حساب؟", none:"ما عندك حساب؟", signOut:"تسجيل الخروج", language:"English", loading:"لحظة...", config:"نحتاج إعداد الاتصال بـ Supabase", configText:"انسخ .env.example إلى .env.local وأضف رابط المشروع ومفتاح Publishable. لا تستخدم service_role في المتصفح.", checkEmail:"أرسلنا لك رسالة تأكيد. افتح بريدك ثم ارجع لتسجيل الدخول.", welcome:"تم تسجيل الدخول بنجاح.", workspace:"مساحة العمل", notebook:"دفتر الملاحظات", arena:"ARENA", az:"AZ", projects:"AZ Projects", community:"المجتمع", me:"أنا", projectsTitle:"مشاريع AZ", projectsText:"أنشئ مساحة خاصة لفريقك، واجمعوا المستندات والمهام والتحديثات في مكان واحد.", communityTitle:"مجتمع AZ", communityText:"مساحة تجمع الطلاب لتبادل المعرفة والتجارب. ستتوفر في مرحلة لاحقة.", meTitle:"ملفي الشخصي", meText:"إدارة حسابك وتفضيلاتك الشخصية.", account:"الحساب", appearance:"المظهر", home:"الرئيسية", planning:"التخطيط", focus:"التركيز", study:"المذاكرة", today:"مساحة اليوم", todayText:"خطوة صغيرة ومنتظمة تصنع تقدماً كبيراً.", tasks:"المهام", completed:"مكتملة", subjects:"المواد الدراسية", subjectName:"اسم المادة", addSubject:"إضافة مادة", addTask:"إضافة مهمة", taskTitle:"عنوان المهمة", chooseSubject:"المادة", noSubject:"بدون مادة", due:"تاريخ الإنجاز", minutes:"المدة بالدقائق", priority:"الأولوية", high:"عالية", medium:"متوسطة", low:"منخفضة", todo:"لم تبدأ", doing:"قيد التنفيذ", done:"مكتملة", all:"الكل", todayFilter:"اليوم", upcoming:"القادمة", overdue:"المتأخرة", start:"ابدأ التركيز", stop:"إنهاء الجلسة", focusTitle:"وقت تركيزك", focusText:"اختر مهمة وابدأ جلسة تركيز.", studyTitle:"مساحة العمل الأكاديمية", studyText:"غرفة عملياتك لتنظيم الدراسة والعمل على أدواتك الأكاديمية.", notebookTitle:"دفتر الملاحظات", notebookText:"مساحة تدوين أفكارك وملاحظاتك الأكاديمية. ستتوفر أدواتها في مرحلة لاحقة.", arenaTitle:"ARENA", arenaText:"مساحة التحديات والتنافس الأكاديمي بين الطلاب.", studyNext:"الخطوة التالية: رفع ملفات PDF واستخراج محتواها وبناء أدوات الدراسة.", empty:"لا توجد مهام هنا بعد.", emptySubjects:"لا توجد مواد بعد.", remove:"حذف", startTask:"ابدأ", finishTask:"أنجزت", reopen:"إعادة فتح", saved:"تم حفظ جلسة التركيز.", noDue:"بدون موعد", footer:"AZ — خطّط، ادرس، تطوّر." },
  en: { eyebrow:"Your academic space", headline:"Plan clearly. Study with focus.", intro:"One place for your plan, study sessions, and progress.", email:"Email address", password:"Password", signIn:"Sign in", signUp:"Create account", create:"Create your account", have:"Already have an account?", none:"New to AZ?", signOut:"Sign out", language:"العربية", loading:"Loading...", config:"Connect AZ to Supabase", configText:"Copy .env.example to .env.local and add your project URL and Publishable key. Never use a service_role key in the browser.", checkEmail:"We sent a confirmation email. Confirm it, then return to sign in.", welcome:"You're signed in.", workspace:"Workspace", notebook:"Notebook", arena:"ARENA", az:"AZ", projects:"AZ Projects", community:"Community", me:"Me", projectsTitle:"AZ Projects", projectsText:"Create a private team workspace and bring documents, tasks, and updates together.", communityTitle:"AZ Community", communityText:"A space for students to exchange knowledge and experiences. Coming in a later phase.", meTitle:"My profile", meText:"Manage your account and personal preferences.", account:"Account", appearance:"Appearance", home:"Home", planning:"Planning", focus:"Focus", study:"Study", today:"Your day", todayText:"Small, consistent steps create meaningful progress.", tasks:"Tasks", completed:"Completed", subjects:"Subjects", subjectName:"Subject name", addSubject:"Add subject", addTask:"Add task", taskTitle:"Task title", chooseSubject:"Subject", noSubject:"No subject", due:"Due date", minutes:"Duration in minutes", priority:"Priority", high:"High", medium:"Medium", low:"Low", todo:"To do", doing:"In progress", done:"Done", all:"All", todayFilter:"Today", upcoming:"Upcoming", overdue:"Overdue", start:"Start focus", stop:"End session", focusTitle:"Focus time", focusText:"Choose a task and start a focus session.", studyTitle:"Academic workspace", studyText:"Your command center for study and academic tools.", notebookTitle:"Notebook", notebookText:"A dedicated space for your academic notes and ideas. Tools are coming in a later phase.", arenaTitle:"ARENA", arenaText:"A space for academic challenges and student competition.", studyNext:"Next: PDF uploads, text extraction, and AI-powered study tools.", empty:"Nothing here yet. Add your first task.", emptySubjects:"No subjects yet.", remove:"Delete", startTask:"Start", finishTask:"Complete", reopen:"Reopen", saved:"Focus session saved.", noDue:"No due date", footer:"AZ — Plan, study, evolve." }
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
    <div className="orbit-caption caption-plan"><i/> PLAN</div><div className="orbit-caption caption-study"><i/> STUDY</div><div className="orbit-caption caption-grow"><i/> GROW</div>
  </div>;
}

export default function App() {
  const [lang,setLang] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("az-language");
      return saved === "en" || saved === "ar" ? saved : "ar";
    } catch {
      return "ar";
    }
  });
  const [dark,setDark] = useState(true);
  const [user,setUser] = useState<User|null>(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [mode,setMode] = useState<"signin"|"signup">("signin");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [section,setSection] = useState<Section>("home");
  const [page,setPage] = useState<Page>("workspace");
  const [selectedProjectId,setSelectedProjectId] = useState<string|null>(null);
  const [subjects,setSubjects] = useState<Subject[]>([]);
  const [tasks,setTasks] = useState<Task[]>([]);
  const [subjectName,setSubjectName] = useState("");
  const [title,setTitle] = useState("");
  const [subjectId,setSubjectId] = useState("");
  const [due,setDue] = useState("");
  const [minutes,setMinutes] = useState("45");
  const [priority,setPriority] = useState("2");
  const [filter,setFilter] = useState<"all"|"todo"|"doing"|"done">("all");
  const [scope,setScope] = useState<"today"|"upcoming"|"overdue">("today");
  const [focusTask,setFocusTask] = useState("");
  const [started,setStarted] = useState<number|null>(null);
  const [elapsed,setElapsed] = useState(0);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(false);
  const [setupChecked,setSetupChecked] = useState(false);
  const [showAcademicSetup,setShowAcademicSetup] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed] = useState(() => window.innerWidth <= 1100);
  const [moreMenuOpen,setMoreMenuOpen] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const t = labels[lang];
  const ar = lang === "ar";
  const navigateSection = (next: Section) => {
    if (next === section) return;
    const viewDocument = document as Document & {
      startViewTransition?: (callback: () => void) => { finished: Promise<void> };
    };
    if (viewDocument.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewDocument.startViewTransition(() => flushSync(() => setSection(next)));
    } else {
      setSection(next);
    }
  };

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
    setLoading(true);
    const [s,q] = await Promise.all([
      supabase.from("subjects").select("id,name,color,created_at").order("created_at"),
      supabase.from("tasks").select("id,user_id,subject_id,title,due_at,priority,est_minutes,status,created_at").order("created_at",{ascending:false})
    ]);
    if (s.error) setError(s.error.message); else setSubjects((s.data||[]) as Subject[]);
    if (q.error) setError(q.error.message); else setTasks((q.data||[]) as Task[]);
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

  const today = new Date().toLocaleDateString("en-CA");
  const visible = useMemo(() => tasks.filter(task => {
    if (filter !== "all" && task.status !== filter) return false;
    if (!task.due_at) return scope === "today";
    const date = new Date(task.due_at).toLocaleDateString("en-CA");
    if (scope === "today") return date === today;
    if (scope === "upcoming") return date > today && task.status !== "done";
    return date < today && task.status !== "done";
  }),[tasks,filter,scope,today]);
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
    if (e) setError(e.message); else { setUser(null); setTasks([]); setSubjects([]); setSelectedProjectId(null); }
    setBusy(false);
  }
  async function addSubject(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !user || !subjectName.trim()) return;
    setBusy(true);
    const {error:e} = await supabase.from("subjects").insert({name:subjectName.trim(),user_id:user.id});
    if (e) setError(e.message); else { setSubjectName(""); await loadData(); }
    setBusy(false);
  }
  async function addTask(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !user || !title.trim()) return;
    setBusy(true); setError("");
    const {error:e} = await supabase.from("tasks").insert({
      user_id:user.id, subject_id:subjectId||null, title:title.trim(),
      due_at:due ? new Date(due+"T23:59:00").toISOString() : null,
      priority:Number(priority), est_minutes:Math.max(5,Number(minutes)||45), status:"todo"
    });
    if (e) setError(e.message);
    else { setTitle(""); setDue(""); setMinutes("45"); setPriority("2"); await loadData(); }
    setBusy(false);
  }
  async function changeTask(task:Task,status:Task["status"]) {
    if (!supabase) return;
    const {error:e} = await supabase.from("tasks").update({status}).eq("id",task.id);
    if (e) setError(e.message); else await loadData();
  }
  async function removeTask(task:Task) {
    if (!supabase) return;
    const {error:e} = await supabase.from("tasks").delete().eq("id",task.id);
    if (e) setError(e.message); else await loadData();
  }
  async function stopFocus() {
    if (!supabase || !user || started===null) return;
    setBusy(true);
    const {error:e} = await supabase.from("focus_sessions").insert({
      user_id:user.id,task_id:focusTask||null,
      started_at:new Date(started).toISOString(),ended_at:new Date().toISOString()
    });
    if (e) setError(e.message); else setMessage(t.saved);
    setStarted(null); setElapsed(0); setBusy(false);
  }

  const workspaceNav:Page[] = ["workspace","notebook","focus","arena"];
  const sectionNav:Section[] = ["home","planning","az","projects","community","me"];
  const mobileSectionNav:Section[] = ["home","planning","az","projects"];
  const navGlyphs:Record<Section,string> = {home:"⌂",planning:"◷",az:"✧",projects:"▣",community:"◎",me:"◌"};
  const moduleGlyphs:Record<Page,string> = {workspace:"▦",notebook:"▤",focus:"◉",arena:"◇"};
  return <main className={"app-shell "+(dark?"theme-dark":"theme-light")} dir={ar?"rtl":"ltr"} lang={lang}>
    <div className="ambient ambient-one"/><div className="ambient ambient-two"/><UniverseEffects />
    {(!user || section !== "home") && <header className="topbar">
      <a className="brand" href="/" aria-label="AZ"><img className="brand-logo" src="/az-mark.svg" alt="AZ"/></a>
      <div className="top-actions">
        <button className="quiet-button" onClick={()=>setLang(ar?"en":"ar")}>{t.language}</button>
        <button className="icon-button" onClick={()=>setDark(v=>!v)} aria-label="Toggle theme">{dark?"☼":"☾"}</button>
        {user && <button className="quiet-button signout-button" onClick={signOut} disabled={busy}>{t.signOut}</button>}
      </div>
    </header>}
    <section className="main-content">
      {!supabaseConfigReady ? <div className="auth-layout">
        <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-pulse"/>{t.eyebrow}</span><h1>{t.headline}</h1><p>{t.intro}</p><Universe/></div>
        <section className="setup-card"><h2>{t.config}</h2><p>{t.configText}</p><code>.env.local</code></section>
      </div> : authLoading ? <PageSkeleton label={t.loading} /> : !user ? <div className="auth-layout">
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
        <aside className={"workspace-rail"+(sidebarCollapsed?" is-collapsed":"")}>
          <div className="rail-topline"><div className="rail-label">AZ / THE ACADEMIC UNIVERSE</div><button className="rail-collapse" type="button" onClick={()=>setSidebarCollapsed(v=>!v)} aria-label={sidebarCollapsed?(ar?"توسيع القائمة":"Expand sidebar"):(ar?"طي القائمة":"Collapse sidebar")}>{sidebarCollapsed?"⇤":"⇥"}</button></div>
          <nav className="primary-nav" aria-label={ar?"الأقسام الرئيسية":"Main sections"}>{sectionNav.map((item,i)=><div className="primary-nav-item" key={item}><button data-section={item} className={section===item?"active":""} aria-expanded={item==="az"?section==="az":undefined} title={sidebarCollapsed?t[item]:undefined} onClick={()=>{navigateSection(item);setMessage("");setMoreMenuOpen(false);}}><span className="nav-glyph" aria-hidden="true">{navGlyphs[item]}</span><span className="nav-index">0{i+1}</span><span className="nav-text">{t[item]}</span><i/></button>{item==="az" && section==="az" && <div className="workspace-subnav"><span className="subnav-label">{ar?"داخل AZ":"AZ MODULES"}</span><nav className="workspace-nav" aria-label={ar?"أدوات AZ":"AZ modules"}>{workspaceNav.map((subItem,j)=><button key={subItem} className={page===subItem?"active":""} title={sidebarCollapsed?t[subItem]:undefined} onClick={()=>{navigatePage(subItem);setMessage("");setMoreMenuOpen(false);}}><span className="module-glyph" aria-hidden="true">{moduleGlyphs[subItem]}</span><span className="nav-index">0{j+1}</span><span className="nav-text">{t[subItem]}</span><i/></button>)}</nav></div>}</div>)}</nav>
          <div className="rail-bottom"><span className="rail-orbit"/> <span className="rail-motto">PLAN · STUDY · GROW</span></div>
        </aside>
        <div className="mobile-more-menu" data-open={moreMenuOpen}>
          <button type="button" className={section==="community"?"active":""} onClick={()=>{navigateSection("community");setMoreMenuOpen(false);setMessage("");}}><span className="nav-glyph" aria-hidden="true">◎</span>{t.community}{ar?" · قريباً":" · Coming soon"}</button>
          <button type="button" className={section==="me"?"active":""} onClick={()=>{navigateSection("me");setMoreMenuOpen(false);setMessage("");}}><span className="nav-glyph" aria-hidden="true">◌</span>{t.me}</button>
        </div>
        <nav className="mobile-bottom-nav" aria-label={ar?"التنقل الرئيسي":"Primary navigation"}>
          {mobileSectionNav.map(item=><button key={item} type="button" data-section={item} className={section===item?"active":""} onClick={()=>{navigateSection(item);setMessage("");setMoreMenuOpen(false);}}><span className="nav-glyph" aria-hidden="true">{navGlyphs[item]}</span><span>{item==="az"?t.study:t[item]}</span></button>)}
          <button type="button" className={(section==="community"||section==="me"||moreMenuOpen)?"active":""} aria-expanded={moreMenuOpen} onClick={()=>setMoreMenuOpen(v=>!v)}><span className="nav-glyph" aria-hidden="true">•••</span><span>{ar?"المزيد":"More"}</span></button>
        </nav>
        <div className="workspace-main">
          <div className="workspace-heading"><div><span className="eyebrow"><span className="eyebrow-pulse"/>{section==="home"?t.home:section==="planning"?t.planning:section==="az"?t.az:section==="projects"?t.projects:section==="community"?t.community:t.me}</span><h1>{section==="home"?t.today:section==="planning"?t.planning:section==="az"?(page==="workspace"?t.workspace:page==="notebook"?t.notebook:page==="focus"?t.focus:t.arenaTitle):section==="projects"?t.projectsTitle:section==="community"?t.communityTitle:t.meTitle}</h1><p>{section==="home"?t.todayText:section==="planning"?(ar?"رتّب مهامك ومواعيدك الدراسية.":"Organize your tasks and academic deadlines."):section==="az"?(page==="workspace"?t.studyText:page==="notebook"?t.notebookText:page==="focus"?t.focusText:t.arenaText):section==="projects"?t.projectsText:section==="community"?t.communityText:t.meText}</p></div>{section !== "home" && <div className="workspace-meta"><span className="status-dot"/>{user.email}</div>}</div>
          {section==="home" && <div className="home-view">
            <section className="home-hero">
              <div className="home-hero-copy">
                <span className="home-kicker"><span className="eyebrow-pulse"/>{ar?"AZ — عالمك الأكاديمي":"AZ — THE ACADEMIC UNIVERSE"}</span>
                <p className="home-date">{todayLabel}</p>
                <h2>{ar?"مسارك يبدأ من هنا.":"Your next chapter starts here."}</h2>
                <p className="home-hero-description">{ar?"حوّل أهدافك إلى خطوات واضحة، وتقدّم في دراستك بإيقاعك الخاص.":"Turn your goals into clear steps, and move your learning forward at your own pace."}</p>
                <div className="home-hero-actions">
                  <button className="primary-button" onClick={()=>navigateSection("planning")}>{ar?"افتح خطتك":"Open your plan"} <span>↗</span></button>
                  <button className="home-secondary-action" onClick={()=>{navigateSection("az");setPage("focus");}}><span className="play-mark">▶</span>{ar?"ابدأ جلسة تركيز":"Start a focus session"}</button>
                </div>
              </div>
              <div className="home-universe-visual" aria-hidden="true">
                <div className="universe-nebula nebula-cyan"/><div className="universe-nebula nebula-violet"/>
                <div className="universe-grid-plane"/>
                <div className="home-orbit one"/><div className="home-orbit two"/><div className="home-orbit three"/>
                <div className="home-planet"><img src="/az-mark.svg" alt=""/></div>
                <span className="home-star star-one"/><span className="home-star star-two"/><span className="home-star star-three"/>
                <span className="universe-label label-plan">{ar?"خطّط":"PLAN"}</span><span className="universe-label label-study">{ar?"تعلّم":"STUDY"}</span><span className="universe-label label-grow">{ar?"تطوّر":"GROW"}</span>
                <span className="universe-coordinate coordinate-top">AZ / 01</span><span className="universe-coordinate coordinate-bottom">FROM A TO Z</span>
              </div>
            </section>
            <section className="home-overview">
              <div className="home-progress-panel">
                <div className="home-section-heading"><div><span className="eyebrow">{ar?"إشارتك اليومية":"YOUR DAILY SIGNAL"}</span><h2>{ar?"تقدّمك":"Your progress"}</h2></div><span className="progress-orbit-icon">✧</span></div>
                <div className="progress-summary"><div className="progress-number"><strong>{completionRate}<small>%</small></strong><span>{ar?"من إجمالي المهام مكتمل":"of all tasks completed"}</span></div><div className="progress-track home-progress-track"><i style={{width:completionRate+"%"}}/></div></div>
                <div className="home-metrics">
                  <div><strong>{String(tasks.length).padStart(2,"0")}</strong><span>{ar?"إجمالي المهام":"TOTAL TASKS"}</span></div>
                  <div><strong>{String(todayTaskCount).padStart(2,"0")}</strong><span>{ar?"مهام اليوم":"DUE TODAY"}</span></div>
                  <div><strong>{String(subjects.length).padStart(2,"0")}</strong><span>{ar?"المواد":"SUBJECTS"}</span></div>
                </div>
              </div>
              <section className="home-next-panel">
                <div className="home-section-heading"><div><span className="eyebrow">{ar?"الخطوة التالية":"NEXT IN YOUR ORBIT"}</span><h2>{ar?"تابع من هنا":"Pick up where you left off"}</h2></div><button className="text-action" onClick={()=>navigateSection("planning")}>{t.planning} ↗</button></div>
                {loading?<div className="home-task-skeleton" role="status" aria-label={ar?"جارٍ تحميل المهام":"Loading tasks"}><i/><i/><i/></div>:openTasks.length===0?<div className="empty-state"><span className="empty-symbol">✧</span><p>{t.empty}</p><button className="home-empty-action" onClick={()=>navigateSection("planning")}>{t.addTask} ↗</button></div>:<div className="task-list">{openTasks.slice(0,4).map(task=><article className="task-row" key={task.id}><span className={"task-priority priority-"+task.priority}/><div className="task-info"><strong>{task.title}</strong><small>{subjectFor(task.subject_id)} · {task.est_minutes||45} {ar?"دقيقة":"min"}</small></div><span className={"task-status status-"+task.status}>{t[task.status]}</span><button className="small-action" onClick={()=>void changeTask(task,task.status==="todo"?"doing":"done")}>{task.status==="todo"?t.startTask:t.finishTask}</button></article>)}</div>}
              </section>
            </section>
          </div>}
          {section==="home" && <Suspense fallback={<PageSkeleton label={t.loading} />}><ProjectPlanningFeed client={supabase} lang={lang} compact onOpenProject={setSelectedProjectId} /></Suspense>}
          {section==="planning" && <div className="planning-view">
            <div className="planning-grid">
              <section className="content-panel"><div className="panel-heading"><div><span className="eyebrow">BUILD YOUR ROUTE</span><h2>{t.addTask}</h2></div><span className="panel-symbol">＋</span></div>
                <form className="task-form" onSubmit={addTask}>
                  <label><span>{t.taskTitle}</span><input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} required/></label>
                  <label><span>{t.chooseSubject}</span><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}><option value="">{t.noSubject}</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                  <div className="form-two"><label><span>{t.due}</span><input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><label><span>{t.minutes}</span><input type="number" min="5" max="600" step="5" value={minutes} onChange={e=>setMinutes(e.target.value)}/></label></div>
                  <label><span>{t.priority}</span><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="3">{t.high}</option><option value="2">{t.medium}</option><option value="1">{t.low}</option></select></label>
                  <button className="primary-button full-button" disabled={busy||!title.trim()}>{busy?t.loading:t.addTask}<span>↗</span></button>
                </form>
              </section>
              <section className="content-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR LEARNING AREAS</span><h2>{t.subjects}</h2></div><span className="count-pill">{subjects.length.toString().padStart(2,"0")}</span></div>
                <form className="subject-form" onSubmit={addSubject}><input value={subjectName} onChange={e=>setSubjectName(e.target.value)} placeholder={t.subjectName} maxLength={120} required/><button className="primary-button" disabled={busy||!subjectName.trim()}>＋</button></form>
                {subjects.length===0?<p className="muted">{t.emptySubjects}</p>:<div className="subject-list">{subjects.map((s,i)=><article className="subject-row" key={s.id}><span className="subject-index">{String(i+1).padStart(2,"0")}</span><span className="subject-color"/><strong>{s.name}</strong></article>)}</div>}
              </section>
            </div>
            <section className="content-panel task-board"><div className="panel-heading"><div><span className="eyebrow">MISSION CONTROL</span><h2>{t.planning}</h2></div><span className="count-pill">{tasks.length.toString().padStart(2,"0")}</span></div>
              <div className="filter-bar">{(["today","upcoming","overdue"] as const).map(x=><button key={x} className={scope===x?"active":""} onClick={()=>setScope(x)}>{t[x==="today"?"todayFilter":x]}</button>)}<span className="filter-spacer"/>{(["all","todo","doing","done"] as const).map(x=><button key={x} className={filter===x?"active subtle":"subtle"} onClick={()=>setFilter(x)}>{t[x]}</button>)}</div>
              {loading?<PageSkeleton label={t.loading} />:visible.length===0?<div className="empty-state"><span className="empty-symbol">✧</span><p>{t.empty}</p></div>:<div className="task-list">{visible.map(task=><article className="task-row" key={task.id}><span className={"task-priority priority-"+task.priority}/><div className="task-info"><strong>{task.title}</strong><small>{subjectFor(task.subject_id)} · {task.due_at?new Date(task.due_at).toLocaleDateString(ar?"ar-QA":"en-US"):t.noDue}</small></div><span className={"task-status status-"+task.status}>{t[task.status]}</span><button className="small-action" onClick={()=>void changeTask(task,task.status==="todo"?"doing":task.status==="doing"?"done":"todo")}>{task.status==="todo"?t.startTask:task.status==="doing"?t.finishTask:t.reopen}</button><button className="delete-action" onClick={()=>void removeTask(task)} aria-label={t.remove}>×</button></article>)}</div>}
            </section>
          </div>}
          {section==="planning" && <Suspense fallback={<PageSkeleton label={t.loading} />}><ProjectPlanningFeed client={supabase} lang={lang} onOpenProject={setSelectedProjectId} /></Suspense>}
          {section==="projects" && <Suspense fallback={<PageSkeleton label={t.loading} />}>{selectedProjectId ? <ProjectWorkspace client={supabase} lang={lang} projectId={selectedProjectId} userId={user.id} onBack={()=>setSelectedProjectId(null)} /> : <ProjectsHome client={supabase} lang={lang} subjects={subjects} onOpenProject={setSelectedProjectId} />}</Suspense>}
          {section==="az" && page==="focus" && <section className="focus-view content-panel"><span className="eyebrow">DEEP WORK SESSION</span><h2>{t.focusTitle}</h2><p>{t.focusText}</p><div className="focus-clock"><div className="clock-ring"><span>{clock(elapsed)}</span><small>FOCUS ELAPSED</small></div></div><label className="focus-select"><span>{t.chooseSubject}</span><select value={focusTask} onChange={e=>setFocusTask(e.target.value)} disabled={started!==null}><option value="">{t.noSubject}</option>{tasks.filter(x=>x.status!=="done").map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>{started===null?<button className="primary-button focus-button" onClick={()=>{setElapsed(0);setStarted(Date.now());}}>{t.start} ↗</button>:<button className="primary-button focus-button" onClick={()=>void stopFocus()} disabled={busy}>{busy?t.loading:t.stop}</button>}</section>}
          {section==="az" && page==="workspace" && <section className="study-placeholder content-panel"><div className="study-orbit"><div className="study-core"><img src="/az-mark.svg" alt="AZ"/></div><span className="study-ring ring-a"/><span className="study-ring ring-b"/></div><span className="eyebrow">KNOWLEDGE SYSTEM / 01</span><h2>{t.studyTitle}</h2><p>{t.studyText}</p><div className="study-next">{t.studyNext}</div></section>}
          {section==="az" && page==="notebook" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">AZ / NOTEBOOK</span><h2>{t.notebookTitle}</h2><p>{t.notebookText}</p></section>}\n          {section==="az" && page==="arena" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">AZ / ARENA</span><h2>{t.arenaTitle}</h2><p>{t.arenaText}</p><span className="coming-soon-label">COMING SOON</span></section>}\n          {section==="community" && <section className="section-placeholder content-panel"><div className="section-placeholder-orbit"><span className="community-symbol">✧</span></div><span className="eyebrow">AZ / COMMUNITY</span><h2>{t.communityTitle}</h2><p>{t.communityText}</p><span className="coming-soon-label">{ar?"قريبًا":"COMING IN A LATER PHASE"}</span></section>}
          {section==="me" && <section className="profile-view content-panel"><div className="profile-avatar">{(user.email||"A").slice(0,1).toUpperCase()}</div><span className="eyebrow">AZ / PERSONAL SPACE</span><h2>{t.meTitle}</h2><p>{t.meText}</p><div className="profile-details"><div><span>{t.account}</span><strong>{user.email}</strong></div><div><span>{t.appearance}</span><strong>{dark?(ar?"داكن":"Dark"):(ar?"فاتح":"Light")}</strong></div></div><div className="profile-actions"><button className="quiet-button" onClick={()=>setDark(v=>!v)}>{ar?"تغيير المظهر":"Change appearance"}</button><button className="quiet-button" onClick={()=>setLang(ar?"en":"ar")}>{t.language}</button><button className="quiet-button" onClick={()=>setShowAcademicSetup(true)}>{ar?"إعداد المساحة الأكاديمية":"Academic setup"}</button><button className="primary-button" onClick={signOut} disabled={busy}>{t.signOut}</button></div></section>}
        </div>
      </div>}
      {showAcademicSetup && setupChecked && !loading && user && <Suspense fallback={<PageSkeleton label={t.loading} />}><AcademicSetup userId={user.id} lang={lang} existingSubjects={subjects} onComplete={()=>{setShowAcademicSetup(false); void loadData();}} /></Suspense>}
      {message && <p className="feedback success-feedback" role="status">{message}</p>}
      {error && <p className="feedback error-feedback" role="alert">{error}</p>}
    </section>
    <footer className="footer"><span>© 2026 AZ</span><span>{t.footer}</span></footer>
  </main>;
}
