import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseConfigReady } from "./lib/supabase";

type Language = "ar" | "en";
type Subject = {
  id: string;
  name: string;
  color: string | null;
  created_at: string;
};

const copy = {
  ar: {
    eyebrow: "مساحتك الأكاديمية",
    headline: "خطّط بوضوح. ادرس بتركيز.",
    intro: "مكان واحد يجمع خطتك ومذاكرتك وتقدّمك.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء حساب",
    createAccount: "ابدأ حسابك",
    haveAccount: "عندك حساب؟",
    noAccount: "ما عندك حساب؟",
    signOut: "تسجيل الخروج",
    subjects: "المواد الدراسية",
    subjectsHint: "ابدأ بإضافة مادة واحدة، ثم نبني عليها خطتك.",
    subjectName: "اسم المادة",
    addSubject: "إضافة مادة",
    empty: "ما أضفت أي مادة حتى الآن.",
    loading: "لحظة...",
    configTitle: "نحتاج إعداد الاتصال بـ Supabase",
    configBody: "انسخ .env.example إلى .env.local وأضف رابط المشروع ومفتاح Publishable من لوحة Supabase. لا تستخدم service_role في المتصفح.",
    checkEmail: "أرسلنا لك رسالة تأكيد. افتح بريدك ثم ارجع لتسجيل الدخول.",
    welcome: "تم تسجيل الدخول بنجاح.",
    genericError: "صار خطأ. حاول مرة ثانية.",
    footer: "نسخة تأسيسية — نضيف الميزات على مراحل.",
    language: "English",
  },
  en: {
    eyebrow: "Your academic space",
    headline: "Plan clearly. Study with focus.",
    intro: "One place for your plan, study sessions, and progress.",
    email: "Email address",
    password: "Password",
    signIn: "Sign in",
    signUp: "Create account",
    createAccount: "Create your account",
    haveAccount: "Already have an account?",
    noAccount: "New to AZ?",
    signOut: "Sign out",
    subjects: "Your subjects",
    subjectsHint: "Add one subject to get started. Your plan will grow from here.",
    subjectName: "Subject name",
    addSubject: "Add subject",
    empty: "No subjects yet.",
    loading: "Loading...",
    configTitle: "Connect AZ to Supabase",
    configBody: "Copy .env.example to .env.local and add your project URL and Publishable key from Supabase. Never use a service_role key in the browser.",
    checkEmail: "We sent a confirmation email. Confirm it, then return to sign in.",
    welcome: "You're signed in.",
    genericError: "Something went wrong. Please try again.",
    footer: "Foundation build — features arrive in stages.",
    language: "العربية",
  },
} as const;

export default function App() {
  const [language, setLanguage] = useState<Language>("ar");
  const [isDark, setIsDark] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const t = copy[language];
  const isArabic = language === "ar";

  const refreshVerifiedUser = useCallback(async () => {
    if (!supabase) return;
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setError(userError.message);
      setUser(null);
      return;
    }
    setUser(data.user);
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAuthLoading(false);
      return;
    }

    let active = true;
    const loadInitialUser = async () => {
      const { data, error: userError } = await client.auth.getUser();
      if (!active) return;
      if (userError && userError.name !== "AuthSessionMissingError") {
        setError(userError.message);
      }
      setUser(data.user);
      setAuthLoading(false);
    };

    void loadInitialUser();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        return;
      }
      window.setTimeout(() => {
        if (active) void refreshVerifiedUser();
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [refreshVerifiedUser]);

  const loadSubjects = useCallback(async () => {
    if (!supabase || !user) return;
    setSubjectsLoading(true);
    const { data, error: queryError } = await supabase
      .from("subjects")
      .select("id, name, color, created_at")
      .order("created_at", { ascending: true });
    if (queryError) {
      setError(queryError.message);
    } else {
      setSubjects((data ?? []) as Subject[]);
    }
    setSubjectsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) void loadSubjects();
    else setSubjects([]);
  }, [user, loadSubjects]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setMessage("");

    const result =
      mode === "signup"
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup" && !result.data.session) {
      setMessage(t.checkEmail);
      setMode("signin");
    } else {
      setMessage(t.welcome);
      await refreshVerifiedUser();
    }
    setBusy(false);
  }

  async function handleSignOut() {
    if (!supabase) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else {
      setUser(null);
      setSubjects([]);
      setMessage("");
    }
    setBusy(false);
  }

  async function handleAddSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user || !subjectName.trim()) return;
    setBusy(true);
    setError("");
    const { error: insertError } = await supabase.from("subjects").insert({
      name: subjectName.trim(),
      user_id: user.id,
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setSubjectName("");
      await loadSubjects();
    }
    setBusy(false);
  }

  return (
    <main
      className={`app-shell ${isDark ? "theme-dark" : "theme-light"}`}
      dir={isArabic ? "rtl" : "ltr"}
      lang={language}
    >
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="/" aria-label="AZ home">
          <img className="brand-logo" src="/az-mark.svg" alt="" />
        </a>
        <div className="top-actions">
          <button className="quiet-button" onClick={() => setLanguage(isArabic ? "en" : "ar")}>
            {t.language}
          </button>
          <button className="icon-button" onClick={() => setIsDark((value) => !value)} aria-label="Toggle theme">
            {isDark ? "☼" : "☾"}
          </button>
          {user && (
            <button className="quiet-button signout-button" onClick={handleSignOut} disabled={busy}>
              {t.signOut}
            </button>
          )}
        </div>
      </header>

      <section className="main-content">
        {!supabaseConfigReady ? (
          <div className="auth-layout">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-pulse" />{t.eyebrow}</span>
              <h1>{t.headline}</h1>
              <p>{t.intro}</p>
              <div className="hero-promise">
                <span className="promise-line" />
                <span>{isArabic ? "عالم واحد — من أول خطة إلى آخر إنجاز" : "One universe — from your first plan to every achievement"}</span>
              </div>
              <div className="universe-stage" aria-hidden="true">
                <div className="universe-halo halo-a" />
                <div className="universe-halo halo-b" />
                <div className="universe-grid" />
                <div className="universe-orbit orbit-a" />
                <div className="universe-orbit orbit-b" />
                <div className="universe-orbit orbit-c" />
                <span className="universe-node node-a" />
                <span className="universe-node node-b" />
                <span className="universe-node node-c" />
                <div className="universe-monogram"><img src="/az-mark.svg" alt="" /></div>
                <div className="orbit-caption caption-plan"><i /> PLAN</div>
                <div className="orbit-caption caption-study"><i /> STUDY</div>
                <div className="orbit-caption caption-grow"><i /> GROW</div>
                <div className="float-panel panel-progress"><span className="float-kicker">YOUR JOURNEY</span><strong>01 <small> / 04</small></strong><span className="progress-track"><i /></span><span className="float-foot">PLAN · STUDY · PRACTICE</span></div>
                <div className="float-panel panel-spark"><span className="spark-icon">✳</span><span>Keep moving<br/><b>forward.</b></span></div>
                <span className="stage-coordinate coordinate-a">25° 17′ N</span>
                <span className="stage-coordinate coordinate-b">AZ / 001</span>
              </div>
            </div>
            <section className="setup-card">
              <span className="eyebrow">{t.eyebrow}</span>
              <h2>{t.configTitle}</h2>
              <p>{t.configBody}</p>
              <code>.env.local</code>
            </section>
          </div>
        ) : authLoading ? (
          <div className="loading-state">{t.loading}</div>
        ) : user ? (
          <div className="workspace">
            <div className="welcome-panel">
              <div>
                <span className="eyebrow">{t.eyebrow}</span>
                <h1>{t.headline}</h1>
                <p>{t.intro}</p>
              </div>
              <div className="user-chip">
                <span className="status-dot" />
                <span>{user.email}</span>
              </div>
            </div>
            <section className="subjects-panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">01 / FOUNDATION</span>
                  <h2>{t.subjects}</h2>
                  <p>{t.subjectsHint}</p>
                </div>
                <span className="count-pill">{subjects.length.toString().padStart(2, "0")}</span>
              </div>
              <form className="subject-form" onSubmit={handleAddSubject}>
                <input
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  placeholder={t.subjectName}
                  maxLength={120}
                  required
                />
                <button className="primary-button" disabled={busy || !subjectName.trim()}>
                  {busy ? t.loading : t.addSubject}
                </button>
              </form>
              {subjectsLoading ? (
                <p className="muted">{t.loading}</p>
              ) : subjects.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-symbol">＋</span>
                  <p>{t.empty}</p>
                </div>
              ) : (
                <div className="subject-list">
                  {subjects.map((subject, index) => (
                    <article className="subject-row" key={subject.id}>
                      <span className="subject-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="subject-color" />
                      <strong>{subject.name}</strong>
                      <span className="subject-arrow">↗</span>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="auth-layout">
            <div className="hero-copy">
              <span className="eyebrow"><span className="eyebrow-pulse" />{t.eyebrow}</span>
              <h1>{t.headline}</h1>
              <p>{t.intro}</p>
              <div className="hero-promise">
                <span className="promise-line" />
                <span>{isArabic ? "عالم واحد — من أول خطة إلى آخر إنجاز" : "One universe — from your first plan to every achievement"}</span>
              </div>
              <div className="universe-stage" aria-hidden="true">
                <div className="universe-halo halo-a" />
                <div className="universe-halo halo-b" />
                <div className="universe-grid" />
                <div className="universe-orbit orbit-a" />
                <div className="universe-orbit orbit-b" />
                <div className="universe-orbit orbit-c" />
                <span className="universe-node node-a" />
                <span className="universe-node node-b" />
                <span className="universe-node node-c" />
                <div className="universe-monogram"><img src="/az-mark.svg" alt="" /></div>
                <div className="orbit-caption caption-plan"><i /> PLAN</div>
                <div className="orbit-caption caption-study"><i /> STUDY</div>
                <div className="orbit-caption caption-grow"><i /> GROW</div>
                <div className="float-panel panel-progress"><span className="float-kicker">YOUR JOURNEY</span><strong>01 <small> / 04</small></strong><span className="progress-track"><i /></span><span className="float-foot">PLAN · STUDY · PRACTICE</span></div>
                <div className="float-panel panel-spark"><span className="spark-icon">✳</span><span>Keep moving<br/><b>forward.</b></span></div>
                <span className="stage-coordinate coordinate-a">25° 17′ N</span>
                <span className="stage-coordinate coordinate-b">AZ / 001</span>
              </div>
            </div>
            <section className="auth-card">
              <div className="auth-tabs">
                <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">
                  {t.signIn}
                </button>
                <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">
                  {t.signUp}
                </button>
              </div>
              <h2>{mode === "signup" ? t.createAccount : t.signIn}</h2>
              <form onSubmit={handleAuth}>
                <label>
                  <span>{t.email}</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>{t.password}</span>
                  <input
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                <button className="primary-button full-button" disabled={busy}>
                  {busy ? t.loading : mode === "signup" ? t.createAccount : t.signIn}
                  <span aria-hidden="true">↗</span>
                </button>
              </form>
              <p className="switch-mode">
                {mode === "signin" ? t.noAccount : t.haveAccount}
                <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} type="button">
                  {mode === "signin" ? t.signUp : t.signIn}
                </button>
              </p>
            </section>
          </div>
        )}

        {message && <p className="feedback success-feedback" role="status">{message}</p>}
        {error && <p className="feedback error-feedback" role="alert">{error || t.genericError}</p>}
      </section>

      <footer className="footer">
        <span>© 2026 AZ</span>
        <span>{t.footer}</span>
      </footer>
    </main>
  );
}
