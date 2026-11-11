import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import { getStudyInsights } from "../lib/studyInsights";
import "./QuizPage.css";

type Subject = { id: string; name: string; color: string | null; exam_date: string | null };
type Document = { id: string; title: string; subject_id: string | null };
type Question = {
  id: string;
  subject_id: string | null;
  prompt: string;
  choices: string[];
  topic: string;
  source_page: number | null;
  difficulty: number | null;
};
type AttemptResult = { score: number; correct_count: number; total_questions: number; finished_at: string };
type DailyChallengeContext = { id: string; date: string; documentId: string; documentTitle: string; quizId: string; questionCount: number };
type DailyChallengeCompletion = { challengeId: string; quizId: string; attemptId: string; finishedAt: string; score: number };
type AnswerResult = { questionId: string; topic: string; correct: boolean };
type Feedback = { correct: boolean; explanation: string; demo: boolean };
type Screen = "setup" | "question" | "feedback" | "result" | "loading" | "empty" | "error";

const DEMO_QUESTIONS: Question[] = [
  {
    id: "demo-econ-1",
    subject_id: "00000000-0000-4000-8000-0000000000a1",
    prompt: "What happens to the equilibrium price when demand increases and supply stays the same?",
    choices: ["It increases", "It decreases", "It stays the same", "The market disappears"],
    topic: "Supply and demand",
    source_page: 12,
    difficulty: 1,
  },
  {
    id: "demo-econ-2",
    subject_id: "00000000-0000-4000-8000-0000000000a1",
    prompt: "Which change would shift the supply curve to the right?",
    choices: ["Higher production costs", "Improved production technology", "A new sales tax", "Fewer suppliers"],
    topic: "Market supply",
    source_page: 18,
    difficulty: 2,
  },
  {
    id: "demo-accounting-1",
    subject_id: "00000000-0000-4000-8000-0000000000a2",
    prompt: "Which statement describes the accounting equation?",
    choices: ["Assets = Liabilities + Equity", "Revenue = Assets − Expenses", "Cash = Profit + Debt", "Equity = Expenses + Revenue"],
    topic: "Accounting equation",
    source_page: 4,
    difficulty: 1,
  },
  {
    id: "demo-stats-1",
    subject_id: "00000000-0000-4000-8000-0000000000a3",
    prompt: "What does the median represent in an ordered data set?",
    choices: ["The most frequent value", "The middle value", "The total of all values", "The difference between extremes"],
    topic: "Descriptive statistics",
    source_page: 7,
    difficulty: 1,
  },
];

const COPY = {
  en: {
    eyebrow: "Study / Practice",
    title: "Short quiz",
    intro: "A few focused questions to help you check your understanding.",
    subject: "Subject",
    chooseSubject: "Choose a subject",
    document: "Study document",
    chooseDocument: "Choose a ready document",
    noReadyDocument: "No ready documents are available for this subject.",
    topic: "Topic (optional)",
    topicPlaceholder: "e.g. Supply and demand",
    start: "Start quiz",
    question: "Question",
    of: "of",
    confirm: "Confirm answer",
    next: "Continue",
    correct: "Correct",
    incorrect: "Not quite",
    demoNote: "Demo feedback is illustrative only. Live grading is not connected yet.",
    explanation: "Explanation",
    source: "Source",
    page: "page",
    result: "Quiz complete",
    score: "Your score",
    missed: "Topics to revisit",
    noneMissed: "No missed topics this time.",
    repeat: "Quiz me on what I missed",
    repeatNote: "For now, this repeats the same short quiz. Topic-only retry will come with the next server slice.",
    back: "Back to Planning",
    addDocument: "Add a document first",
    addDocumentText: "Upload a study document in your AZ workspace, then return here to practise from it.",
    openWorkspace: "Open workspace",
    noQuestions: "No questions are available for this subject yet.",
    generationUnavailable: "The AI study service is not configured yet. Your document is safe; try again when quiz generation is enabled.",
    retry: "Retry",
    loading: "Preparing your quiz…",
    errorTitle: "We couldn’t prepare this quiz",
    offline: "You’re offline. Your quiz progress may not sync.",
    selected: "Selected",
    insights: "Study insights",
    difficulty: ["", "Foundational", "Intermediate", "Advanced"],
  },
  ar: {
    eyebrow: "المذاكرة / التدريب",
    title: "اختبار قصير",
    intro: "أسئلة قصيرة تساعدك على التحقق من فهمك بهدوء.",
    subject: "المادة",
    chooseSubject: "اختر المادة",
    document: "المستند الدراسي",
    chooseDocument: "اختر مستنداً جاهزاً",
    noReadyDocument: "لا توجد مستندات جاهزة لهذه المادة.",
    topic: "الموضوع (اختياري)",
    topicPlaceholder: "مثال: العرض والطلب",
    start: "ابدأ الاختبار",
    question: "السؤال",
    of: "من",
    confirm: "تأكيد الإجابة",
    next: "متابعة",
    correct: "إجابة صحيحة",
    incorrect: "ليست الإجابة الصحيحة",
    demoNote: "التصحيح هنا توضيحي لوضع العرض فقط. لم يتم ربط التصحيح الفعلي بعد.",
    explanation: "التوضيح",
    source: "المصدر",
    page: "صفحة",
    result: "اكتمل الاختبار",
    score: "نتيجتك",
    missed: "موضوعات للمراجعة",
    noneMissed: "لم تفُتك أي موضوع هذه المرة.",
    repeat: "اختبرني فيما أخطأت فيه",
    repeatNote: "حالياً يعيد هذا الزر الاختبار نفسه. إعادة الأسئلة حسب الأخطاء ستتوفر في خطوة خادم لاحقة.",
    back: "العودة إلى التخطيط",
    addDocument: "أضف مستنداً أولاً",
    addDocumentText: "ارفع مستنداً دراسياً في مساحة عمل AZ، ثم عُد إلى هنا للتدرب عليه.",
    openWorkspace: "افتح مساحة العمل",
    noQuestions: "لا توجد أسئلة متاحة لهذه المادة بعد.",
    generationUnavailable: "خدمة إنشاء الاختبارات بالذكاء الاصطناعي غير مهيأة بعد. مستندك آمن؛ حاول مجدداً عند تفعيل خدمة الدراسة.",
    retry: "إعادة المحاولة",
    loading: "جارٍ تجهيز الاختبار…",
    errorTitle: "تعذّر تجهيز هذا الاختبار",
    offline: "أنت غير متصل بالإنترنت. قد لا تتم مزامنة تقدم الاختبار.",
    selected: "محدد",
    insights: "رؤى الدراسة",
    difficulty: ["", "أساسي", "متوسط", "متقدم"],
  },
};

function EmptyInsights({ lang }: { lang: "ar" | "en" }) {
  const insights = getStudyInsights();
  if (!insights.length) return <div className="quiz-insights-slot" data-insights-slot aria-label={lang === "ar" ? "موضع رؤى الدراسة" : "Study insights slot"} />;
  return <section className="quiz-insights-slot" data-insights-slot aria-label={lang === "ar" ? "رؤى الدراسة" : "Study insights"}>
    {insights.map((insight) => <p key={insight.id}>{insight.message}</p>)}
  </section>;
}

export default function QuizPage({
  userId,
  lang,
  subjects,
  offline,
  onBackPlanning,
  onOpenWorkspace,
  challenge = null,
  onChallengeCompleted,
}: {
  userId: string;
  lang: "ar" | "en";
  subjects: Subject[];
  offline: boolean;
  onBackPlanning: () => void;
  onOpenWorkspace: () => void;
  challenge?: DailyChallengeContext | null;
  onChallengeCompleted?: (completion: DailyChallengeCompletion) => void;
}) {
  const ar = lang === "ar";
  const t = COPY[lang];
  const demoMode = import.meta.env.VITE_DEMO === "1";
  const qaState = demoMode ? new URLSearchParams(window.location.search).get("qa-quiz-state") : null;
  const [screen, setScreen] = useState<Screen>(() => {
    if (qaState === "question" || qaState === "feedback" || qaState === "result" || qaState === "loading" || qaState === "empty" || qaState === "error") return qaState;
    return demoMode ? "setup" : "loading";
  });
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentCount, setDocumentCount] = useState<number | null>(demoMode ? 2 : null);
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]?.id ?? "");
  const [selectedDocument, setSelectedDocument] = useState("");
  const [quizId, setQuizId] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState<Question[]>(DEMO_QUESTIONS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(qaState === "feedback" ? 1 : null);
  const [feedback, setFeedback] = useState<Feedback | null>(() => qaState === "feedback" ? {
    correct: false,
    explanation: "This is sample feedback for the visual demo. The secure grading service will provide the real explanation after submission.",
    demo: true,
  } : null);
  const [answers, setAnswers] = useState<AnswerResult[]>(() => qaState === "result" ? [
    { questionId: DEMO_QUESTIONS[0].id, topic: DEMO_QUESTIONS[0].topic, correct: true },
    { questionId: DEMO_QUESTIONS[1].id, topic: DEMO_QUESTIONS[1].topic, correct: false },
    { questionId: DEMO_QUESTIONS[2].id, topic: DEMO_QUESTIONS[2].topic, correct: true },
  ] : []);
  const [loadError, setLoadError] = useState("");

  const filteredDemoQuestions = useMemo(() => DEMO_QUESTIONS.filter((question) =>
    (!selectedSubject || question.subject_id === selectedSubject) &&
    (!topic.trim() || question.topic.toLocaleLowerCase().includes(topic.trim().toLocaleLowerCase())),
  ), [selectedSubject, topic]);
  const current = questions[questionIndex] ?? DEMO_QUESTIONS[0];
  const correctCount = answers.filter((answer) => answer.correct).length;
  const score = answers.length ? Math.round((correctCount / answers.length) * 100) : 0;
  const missedTopics = [...new Set(answers.filter((answer) => !answer.correct).map((answer) => answer.topic))];
  const availableDocuments = documents.filter((document) =>
    !selectedSubject || document.subject_id === selectedSubject,
  );
  const displayedScore = attemptResult?.score ?? score;

  async function loadDocuments() {
    if (demoMode) {
      setDocumentCount(2);
      setLoadError("");
      setScreen("setup");
      return;
    }
    if (!supabase) {
      setLoadError(t.generationUnavailable);
      setScreen("error");
      return;
    }
    setScreen("loading");
    setLoadError("");
    const { data, error } = await supabase
      .from("documents")
      .select("id,title,subject_id")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(t.errorTitle);
      setScreen("error");
      return;
    }
    const readyDocuments = (data ?? []) as Document[];
    setDocuments(readyDocuments);
    setDocumentCount(readyDocuments.length);
    if (readyDocuments.length) {
      const preferred = readyDocuments.find((document) => document.subject_id === selectedSubject)
        ?? readyDocuments[0];
      setSelectedSubject(preferred.subject_id ?? "");
      setSelectedDocument(preferred.id);
    }
    setScreen(readyDocuments.length === 0 ? "empty" : "setup");
  }

  useEffect(() => {
    if (demoMode || qaState || challenge) return;
    void loadDocuments();
  }, [userId, challenge?.id]);

  useEffect(() => {
    if (qaState === "empty" || qaState === "error" || qaState === "loading") return;
    if (qaState === "question") {
      setQuestions(DEMO_QUESTIONS.slice(0, 3));
      setQuestionIndex(0);
    }
    if (qaState === "result") {
      setQuestions(DEMO_QUESTIONS.slice(0, 3));
      setQuestionIndex(2);
    }
  }, [qaState]);

  useEffect(() => {
    if (screen !== "question" && screen !== "feedback") return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
      if (screen === "question" && !feedback && /^[1-4]$/.test(event.key)) {
        const next = Number(event.key) - 1;
        if (next < (current?.choices.length ?? 0)) {
          event.preventDefault();
          setSelectedIndex(next);
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        document.querySelector<HTMLButtonElement>(feedback ? ".quiz-next" : ".quiz-confirm")?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, feedback, current?.choices.length]);

  async function beginAttempt(nextQuizId: string, requestedQuestionCount: number) {
    if (!supabase) {
      setLoadError(t.generationUnavailable);
      setScreen("error");
      return;
    }
    setScreen("loading");
    const { data: attemptData, error: attemptError } = await supabase.rpc("start_attempt", {
      p_quiz_id: nextQuizId,
      p_mode: "practice",
      p_question_count: requestedQuestionCount,
      p_time_limit_seconds: null,
    });
    const attempt = Array.isArray(attemptData) ? attemptData[0] : attemptData;
    if (attemptError || !attempt?.attempt_id ||
        Number(attempt.question_count) !== requestedQuestionCount) {
      setLoadError(attemptError?.message || t.generationUnavailable);
      setScreen("error");
      return;
    }

    const { data: rows, error: questionsError } = await supabase
      .from("attempt_questions")
      .select("question_id,position_no,quiz_questions(id,prompt,choices,source_page,topic,difficulty)")
      .eq("attempt_id", attempt.attempt_id)
      .eq("user_id", userId)
      .order("position_no", { ascending: true });
    if (questionsError || !rows?.length ||
        rows.length !== Number(attempt.question_count)) {
      setLoadError(questionsError?.message || t.noQuestions);
      setScreen("error");
      return;
    }

    const attemptQuestions: Question[] = rows.flatMap((row: any) => {
      const nested = Array.isArray(row.quiz_questions) ? row.quiz_questions[0] : row.quiz_questions;
      if (!nested || typeof nested.id !== "string" || typeof nested.prompt !== "string") return [];
      return [{
        id: nested.id,
        subject_id: selectedSubject || null,
        prompt: nested.prompt,
        choices: Array.isArray(nested.choices) ? nested.choices : [],
        topic: nested.topic || (ar ? "موضوع عام" : "General"),
        source_page: nested.source_page ?? null,
        difficulty: nested.difficulty ?? null,
      }];
    });
    if (attemptQuestions.some((question) => !question.id || !question.prompt || question.choices.length !== 4)) {
      setLoadError(t.errorTitle);
      setScreen("error");
      return;
    }

    setQuizId(nextQuizId);
    setAttemptId(attempt.attempt_id);
    setAttemptResult(null);
    setQuestions(attemptQuestions);
    setQuestionIndex(0);
    setSelectedIndex(null);
    setFeedback(null);
    setAnswers([]);
    setScreen("question");
  }

  useEffect(() => {
    if (!challenge || demoMode || qaState) return;
    void beginAttempt(challenge.quizId, challenge.questionCount);
  }, [challenge?.id, userId]);

  async function startQuiz() {
    if (demoMode) {
      if (!filteredDemoQuestions.length) {
        setQuestions([]);
        setScreen("empty");
        return;
      }
      setQuestions(filteredDemoQuestions);
      setQuestionIndex(0);
      setSelectedIndex(null);
      setFeedback(null);
      setAnswers([]);
      setScreen("question");
      return;
    }
    if (!supabase || !selectedDocument) {
      setLoadError(t.generationUnavailable);
      setScreen("error");
      return;
    }
    setScreen("loading");
    setLoadError("");
    const { data, error } = await supabase.functions.invoke("generate-quiz", {
      body: { documentId: selectedDocument, language: lang, questionCount: 8, topic: topic.trim() },
    });
    if (error || !data?.quizId || !Array.isArray(data.questions) || data.questions.length < 5) {
      setLoadError(data?.error || error?.message || t.generationUnavailable);
      setScreen("error");
      return;
    }
    await beginAttempt(data.quizId, data.questions.length);
  }

  async function submitAnswer() {
    if (selectedIndex === null || !current || isSubmitting) return;
    if (demoMode) {
      // Visual-QA fixtures deliberately contain no answer keys; this is synthetic presentation data.
      const correct = questionIndex % 2 === 0;
      setFeedback({
        correct,
        explanation: ar
          ? "هذا توضيح تجريبي لعرض حالة التصحيح. سيأتي التفسير الفعلي من خدمة التصحيح الآمنة بعد الإرسال."
          : "This is illustrative demo feedback. The secure grading service will return the real explanation after submission.",
        demo: true,
      });
      setAnswers((existing) => [...existing.filter((answer) => answer.questionId !== current.id), {
        questionId: current.id,
        topic: current.topic,
        correct,
      }]);
      setScreen("feedback");
      return;
    }
    if (!supabase || !attemptId) {
      setLoadError(t.generationUnavailable);
      setScreen("error");
      return;
    }
    setIsSubmitting(true);
    const { data, error } = await supabase.rpc("submit_answer", {
      p_attempt_id: attemptId,
      p_question_id: current.id,
      p_chosen_index: selectedIndex,
    });
    setIsSubmitting(false);
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result || typeof result.is_correct !== "boolean") {
      setLoadError(error?.message || t.errorTitle);
      setScreen("error");
      return;
    }
    const correct = result.is_correct;
    setFeedback({
      correct,
      explanation: result.explanation || (ar ? "تم تسجيل الإجابة." : "Your answer was recorded."),
      demo: false,
    });
    setAnswers((existing) => [...existing.filter((answer) => answer.questionId !== current.id), {
      questionId: current.id,
      topic: current.topic,
      correct,
    }]);
    setScreen("feedback");
  }

  async function continueQuiz() {
    if (questionIndex + 1 >= questions.length) {
      if (demoMode) {
        setScreen("result");
        return;
      }
      if (!supabase || !attemptId) {
        setLoadError(t.generationUnavailable);
        setScreen("error");
        return;
      }
      setScreen("loading");
      const { data, error } = await supabase.rpc("finish_attempt", { p_attempt_id: attemptId });
      const result = Array.isArray(data) ? data[0] : data;
      const finalScore = Number(result?.score);
      if (error || !result || !Number.isFinite(finalScore) ||
          typeof result.correct_count !== "number" || typeof result.total_questions !== "number" ||
          !Number.isInteger(result.total_questions) || result.total_questions !== questions.length ||
          typeof result.finished_at !== "string" || Number.isNaN(Date.parse(result.finished_at))) {
        setLoadError(error?.message || t.errorTitle);
        setScreen("error");
        return;
      }
      setAttemptResult({
        score: finalScore,
        correct_count: result.correct_count,
        total_questions: result.total_questions,
        finished_at: result.finished_at,
      });
      if (challenge && quizId === challenge.quizId && attemptId &&
          typeof result.finished_at === "string" && result.finished_at.length > 0) {
        onChallengeCompleted?.({
          challengeId: challenge.id,
          quizId,
          attemptId,
          finishedAt: result.finished_at,
          score: finalScore,
        });
      }
      setScreen("result");
      return;
    }
    setQuestionIndex((index) => index + 1);
    setSelectedIndex(null);
    setFeedback(null);
    setScreen("question");
  }

  async function repeatQuiz() {
    if (demoMode) {
      setQuestionIndex(0);
      setSelectedIndex(null);
      setFeedback(null);
      setAnswers([]);
      setScreen("question");
      return;
    }
    if (quizId) await beginAttempt(quizId, questions.length);
  }

  const questionProgress = questions.length ? ((questionIndex + 1) / questions.length) * 100 : 0;

  return <main className="quiz-page" dir={ar ? "rtl" : "ltr"} lang={lang}>
    {offline && <div className="quiz-offline" role="status">{t.offline}</div>}
    <header className="quiz-heading">
      <div>
        <span className="eyebrow">{t.eyebrow}</span>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>
      <button type="button" className="az-btn az-btn--ghost" onClick={onBackPlanning}>{t.back}</button>
    </header>

    {screen === "loading" && <section className="quiz-card az-card quiz-loading" aria-label={t.loading}>
      <span /><span /><span /><span />
      <p>{t.loading}</p>
    </section>}

    {screen === "empty" && <section className="quiz-card az-card quiz-state" role="status">
      <span className="quiz-state-mark" aria-hidden="true">▤</span>
      <h2>{t.addDocument}</h2>
      <p>{t.addDocumentText}</p>
      <button type="button" className="az-btn az-btn--primary" onClick={onOpenWorkspace}>{t.openWorkspace}</button>
      <button type="button" className="az-btn az-btn--ghost" onClick={onBackPlanning}>{t.back}</button>
    </section>}

    {screen === "error" && <section className="quiz-card az-card quiz-state" role="alert">
      <span className="quiz-state-mark" aria-hidden="true">!</span>
      <h2>{t.errorTitle}</h2>
      <p>{loadError || t.generationUnavailable}</p>
      <button type="button" className="az-btn az-btn--primary" onClick={() => void loadDocuments()}>{t.retry}</button>
    </section>}

    {screen === "setup" && <section className="quiz-card az-card quiz-setup">
      {documentCount !== null && <p className="quiz-document-count">{ar ? `${documentCount} مستندات جاهزة` : `${documentCount} ready documents`}</p>}
      <label className="quiz-field">
        <span>{t.subject}</span>
        <select className="az-input" value={selectedSubject} onChange={(event) => {
          setSelectedSubject(event.target.value);
          const nextDocument = documents.find((document) => !event.target.value || document.subject_id === event.target.value);
          setSelectedDocument(nextDocument?.id ?? "");
        }}>
          <option value="">{t.chooseSubject}</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
      </label>
      {!demoMode && <label className="quiz-field">
        <span>{t.document}</span>
        <select className="az-input" value={selectedDocument} onChange={(event) => setSelectedDocument(event.target.value)}>
          <option value="">{t.chooseDocument}</option>
          {availableDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
        </select>
        {!availableDocuments.length && <small>{t.noReadyDocument}</small>}
      </label>}
      <label className="quiz-field">
        <span>{t.topic}</span>
        <input className="az-input" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t.topicPlaceholder} />
      </label>
      <div className="quiz-setup-footer">
        <p>{demoMode ? (ar ? "وضع العرض: أسئلة تجريبية بلا مفاتيح إجابة." : "Demo mode: sample questions with no answer keys.") : t.generationUnavailable}</p>
        <button type="button" className="az-btn az-btn--primary quiz-start" onClick={() => void startQuiz()} disabled={demoMode ? !selectedSubject : !selectedDocument}>{t.start}</button>
      </div>
    </section>}

    {(screen === "question" || screen === "feedback") && current && <section className="quiz-card az-card quiz-question-card">
      <div className="quiz-question-meta">
        <span>{t.question} {questionIndex + 1} {t.of} {questions.length}</span>
        <span>{current.topic}</span>
      </div>
      <div className="quiz-progress-track" role="progressbar" aria-label={ar ? "تقدم الاختبار" : "Quiz progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(questionProgress)}>
        <span style={{ width: `${questionProgress}%` } as CSSProperties} />
      </div>
      <p className="quiz-topic-label">{current.topic}</p>
      <h2 className="quiz-prompt" dir="auto">{current.prompt}</h2>
      <div className="quiz-choice-group" role="radiogroup" aria-label={ar ? "خيارات الإجابة" : "Answer choices"}>
        {current.choices.map((choice, index) => <button
          key={`${current.id}-${index}`}
          type="button"
          className={"az-btn quiz-choice" + (selectedIndex === index ? " is-selected" : "")}
          role="radio"
          aria-checked={selectedIndex === index}
          aria-label={`${String.fromCharCode(65 + index)}. ${choice}`}
          onClick={() => screen === "question" && setSelectedIndex(index)}
          disabled={screen === "feedback"}
        >
          <span className="quiz-choice-key" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
          <span>{choice}</span>
        </button>)}
      </div>
      {screen === "question" && <div className="quiz-question-footer">
        <span className="quiz-key-hint">{ar ? "اختر 1–4 ثم اضغط Enter" : "Press 1–4 to choose, then Enter"}</span>
        <button type="button" className="az-btn az-btn--primary quiz-confirm" onClick={() => void submitAnswer()} disabled={selectedIndex === null || isSubmitting}>{isSubmitting ? t.loading : t.confirm}</button>
      </div>}
      {screen === "feedback" && feedback && <section className={"quiz-feedback " + (feedback.correct ? "is-correct" : "is-incorrect")} role="status" aria-live="polite">
        <div className="quiz-feedback-heading"><span aria-hidden="true">{feedback.correct ? "✓" : "○"}</span><strong>{feedback.correct ? t.correct : t.incorrect}</strong></div>
        <p><strong>{t.explanation}:</strong> {feedback.explanation}</p>
        {feedback.demo && <p className="quiz-demo-note">{t.demoNote}</p>}
        <div className="quiz-question-footer"><span className="quiz-key-hint">{current.source_page ? t.source + ": " + current.source_page + " " + t.page : ""}</span><button type="button" className="az-btn az-btn--primary quiz-next" onClick={() => void continueQuiz()}>{t.next}</button></div>
      </section>}
    </section>}

    {screen === "result" && <section className="quiz-card az-card quiz-result" aria-live="polite">
      <span className="quiz-result-orbit" aria-hidden="true">✧</span>
      <span className="eyebrow">{t.result}</span>
      <div className="quiz-score"><strong>{displayedScore}<small>%</small></strong><span>{t.score}</span></div>
      <div className="quiz-missed-topics">
        <h2>{t.missed}</h2>
        {missedTopics.length ? <ul>{missedTopics.map((missedTopic) => <li key={missedTopic}>{missedTopic}</li>)}</ul> : <p>{t.noneMissed}</p>}
      </div>
      <EmptyInsights lang={lang} />
      <div className="quiz-result-actions">
        <button type="button" className="az-btn az-btn--primary" onClick={repeatQuiz}>{t.repeat}</button>
        <p>{t.repeatNote}</p>
        <button type="button" className="az-btn az-btn--ghost" onClick={onBackPlanning}>{t.back}</button>
      </div>
    </section>}
  </main>;
}
