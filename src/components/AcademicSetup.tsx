import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "./AcademicSetup.css";

type Language = "ar" | "en";
type Step = "identity" | "term" | "courses" | "schedule" | "preferences" | "review";
type EducationLevel = "school" | "university" | "college" | "postgraduate";
type ExistingSubject = { id: string; name: string; term_id?: string | null; course_code?: string | null; instructor?: string | null };
type SessionDraft = { id: string; subject_id: string; weekday: number; starts_at_local: string; ends_at_local: string; meeting_type: "lecture" | "lab" | "tutorial" | "other"; location: string };
type AcademicProfile = {
  education_level: EducationLevel;
  institution: string;
  grade_or_year: string;
  specialization: string;
  study_time: string;
  study_hours_per_day: string;
  primary_goal: string;
};

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
    intro: "تجربة واحدة لكل طالب. نحتاج بعض التفاصيل حتى يجهّز AZ مساحتك بالطريقة المناسبة لدراستك.",
    identity: "هويتك الأكاديمية",
    identityHint: "اختر مرحلتك التعليمية. ستبقى تجربة AZ واحدة، وتتغير البيانات والمصطلحات فقط.",
    level: "المرحلة التعليمية",
    school: "المدرسة",
    university: "الجامعة",
    college: "الكلية / الدبلوم",
    postgraduate: "الدراسات العليا",
    institution: "اسم المؤسسة التعليمية",
    institutionPlaceholder: "اسم المدرسة أو الجامعة أو الكلية",
    grade: "الصف / السنة / المستوى",
    gradePlaceholder: "اختر مستواك",
    specialization: "التخصص أو المسار (اختياري)",
    specializationPlaceholder: "مثلاً: علوم الحاسب أو المسار العلمي",
    term: "الفترة الدراسية",
    termHint: "استخدم الاسم الذي تتبعه مؤسستك: فصل، ترم، سنة دراسية أو غير ذلك.",
    termName: "اسم الفترة الدراسية",
    termPlaceholder: "مثلاً: الفصل الأول 2026–2027",
    start: "تاريخ البداية (اختياري)",
    end: "تاريخ النهاية (اختياري)",
    courses: "موادك الدراسية",
    coursesHint: "أضف المواد يدوياً، أو ارفع جدولك، أو جهّز مستنداً للاستيراد الذكي.",
    methods: "اختر طريقة الإضافة",
    manual: "إضافة يدوية",
    manualHint: "أدخل اسم المادة ورمزها بنفسك.",
    upload: "رفع جدول",
    uploadHint: "اختر صورة أو PDF لجدولك.",
    smart: "استيراد ذكي",
    smartHint: "مستند تسجيل أو توصيف أكاديمي.",
    file: "اختر ملفاً",
    selectedFile: "الملف المحدد",
    fileNotice: "تم اختيار الملف للمعاينة في هذه النسخة. استخراج البيانات آلياً يحتاج ربط خدمة قراءة الملفات، لذلك لن نخمن المواد أو المواعيد. يمكنك إدخال البيانات المستخرجة يدوياً الآن.",
    fileTypes: "PDF أو PNG أو JPG، بحد أقصى 10 MB.",
    subjectName: "اسم المادة",
    subjectPlaceholder: "مثلاً: الرياضيات أو هياكل البيانات",
    code: "رمز المادة (اختياري)",
    instructor: "المعلم / الدكتور (اختياري)",
    add: "إضافة المادة",
    added: "المواد المضافة",
    duplicate: "توجد مادة بالاسم نفسه. تأكد أنها ليست مكررة.",
    noSubjects: "لم تضف مواد بعد. يمكنك المتابعة وإضافتها لاحقاً.",
    schedule: "جدولك الأسبوعي",
    scheduleHint: "أضف الحصص أو المحاضرات. يمكنك تخطي هذه الخطوة وإكمال الجدول لاحقاً.",
    chooseCourse: "المادة",
    chooseCoursePlaceholder: "اختر مادة",
    weekday: "اليوم",
    starts: "وقت البداية",
    ends: "وقت النهاية",
    sessionType: "نوع الجلسة",
    lecture: "حصة / محاضرة",
    lab: "مختبر",
    tutorial: "تمرين",
    other: "أخرى",
    location: "المكان (اختياري)",
    locationPlaceholder: "القاعة أو رابط الحصة",
    addSession: "إضافة إلى الجدول",
    sessions: "الجلسات المضافة",
    noSessions: "لا توجد حصص مضافة بعد.",
    preferences: "تفضيلات الدراسة",
    preferencesHint: "هذه التفضيلات تساعد AZ على اقتراح خطة واقعية. يمكنك تغييرها في أي وقت.",
    studyTime: "متى تفضل الدراسة؟",
    morning: "الصباح",
    afternoon: "بعد الظهر",
    evening: "المساء",
    flexible: "مرن",
    studyHours: "كم ساعة تستطيع تخصيصها يومياً؟",
    goal: "هدفك الأساسي",
    organize: "تنظيم الدراسة وتحسين الأداء",
    exams: "الاستعداد للاختبارات",
    understanding: "تحسين الفهم والدرجات",
    habit: "بناء عادة دراسة مستمرة",
    review: "راجع إعدادك",
    reviewHint: "تحقق من معلوماتك قبل تجهيز مساحتك الأكاديمية.",
    institutionLabel: "المؤسسة",
    levelLabel: "المرحلة",
    termLabel: "الفترة",
    subjectLabel: "المواد",
    sessionLabel: "الحصص والمحاضرات",
    profileLabel: "تفضيلات الدراسة",
    noInstitution: "لم تحدد المؤسسة",
    noTerm: "لم تحدد فترة دراسية",
    noSpecialization: "غير محدد",
    back: "رجوع",
    next: "متابعة",
    finish: "تجهيز مساحتي",
    skip: "سأتجاوز الإعداد الآن",
    saving: "جارٍ الحفظ...",
    step: "الخطوة",
    of: "من",
    error: "تعذر حفظ الإعداد. حاول مرة أخرى.",
    remove: "حذف",
    days: ["الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد"],
    dateError: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية.",
    timeError: "وقت النهاية يجب أن يكون بعد وقت البداية.",
    courseError: "اختر مادة أولاً.",
    fileError: "اختر ملف PDF أو صورة بحجم لا يتجاوز 10 MB.",
    launchTitle: "مساحتك الأكاديمية جاهزة للانطلاق",
    launchText: "أصبحت بياناتك الأساسية جاهزة. يمكنك تعديلها وإضافة المزيد من المواد والجلسات لاحقاً.",
  },
  en: {
    eyebrow: "AZ / ACADEMIC SETUP",
    title: "Let's set up your academic space.",
    intro: "One experience for every learner. A few details help AZ prepare a workspace that fits your studies.",
    identity: "Your academic identity",
    identityHint: "Choose your education level. The AZ experience stays the same; only the data and terminology change.",
    level: "Education level",
    school: "School",
    university: "University",
    college: "College / Diploma",
    postgraduate: "Postgraduate",
    institution: "Institution name",
    institutionPlaceholder: "School, university, or college name",
    grade: "Grade / Year / Level",
    gradePlaceholder: "Choose your level",
    specialization: "Specialization or track (optional)",
    specializationPlaceholder: "e.g. Computer Science or Science track",
    term: "Academic period",
    termHint: "Use the period system your institution follows: term, semester, school year, or another format.",
    termName: "Academic period name",
    termPlaceholder: "e.g. Fall 2026 or Academic Year 2026–2027",
    start: "Start date (optional)",
    end: "End date (optional)",
    courses: "Your courses",
    coursesHint: "Add courses manually, upload your timetable, or prepare an academic document for smart import.",
    methods: "Choose how to add your courses",
    manual: "Add manually",
    manualHint: "Enter course names and codes yourself.",
    upload: "Upload timetable",
    uploadHint: "Choose an image or PDF of your schedule.",
    smart: "Smart import",
    smartHint: "Registration or course-description document.",
    file: "Choose a file",
    selectedFile: "Selected file",
    fileNotice: "The file is selected for preview in this version. Automatic extraction needs a connected document-reading service, so AZ will not guess courses or times. You can enter the details manually for now.",
    fileTypes: "PDF, PNG, or JPG, up to 10 MB.",
    subjectName: "Course / subject name",
    subjectPlaceholder: "e.g. Mathematics or Data Structures",
    code: "Course code (optional)",
    instructor: "Teacher / Instructor (optional)",
    add: "Add course",
    added: "Added courses",
    duplicate: "A course with the same name exists. Check that it isn't a duplicate.",
    noSubjects: "No courses added yet. You can continue and add them later.",
    schedule: "Your weekly schedule",
    scheduleHint: "Add classes or lectures. You can skip this and complete your timetable later.",
    chooseCourse: "Course / subject",
    chooseCoursePlaceholder: "Choose a course",
    weekday: "Day",
    starts: "Start time",
    ends: "End time",
    sessionType: "Session type",
    lecture: "Class / Lecture",
    lab: "Lab",
    tutorial: "Tutorial",
    other: "Other",
    location: "Location (optional)",
    locationPlaceholder: "Room or class link",
    addSession: "Add to schedule",
    sessions: "Added sessions",
    noSessions: "No sessions added yet.",
    preferences: "Study preferences",
    preferencesHint: "These preferences help AZ suggest a realistic plan. You can change them at any time.",
    studyTime: "When do you prefer to study?",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    flexible: "Flexible",
    studyHours: "How many hours can you study per day?",
    goal: "Your main goal",
    organize: "Organize my studies and improve performance",
    exams: "Prepare for exams",
    understanding: "Improve understanding and grades",
    habit: "Build a consistent study habit",
    review: "Review your setup",
    reviewHint: "Check your information before AZ prepares your academic space.",
    institutionLabel: "Institution",
    levelLabel: "Education level",
    termLabel: "Academic period",
    subjectLabel: "Courses",
    sessionLabel: "Classes and lectures",
    profileLabel: "Study preferences",
    noInstitution: "No institution added",
    noTerm: "No academic period selected",
    noSpecialization: "Not specified",
    back: "Back",
    next: "Continue",
    finish: "Prepare my space",
    skip: "I'll do this later",
    saving: "Saving...",
    step: "Step",
    of: "of",
    error: "We couldn't save your setup. Please try again.",
    remove: "Remove",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    dateError: "The end date must be after the start date.",
    timeError: "The end time must be after the start time.",
    courseError: "Choose a course first.",
    fileError: "Choose a PDF or image no larger than 10 MB.",
    launchTitle: "Your academic space is ready",
    launchText: "Your core details are saved. You can edit them and add more courses or sessions at any time.",
  },
};

const levelOptions: Record<Language, { value: EducationLevel; label: string }[]> = {
  ar: [
    { value: "school", label: "المدرسة" },
    { value: "university", label: "الجامعة" },
    { value: "college", label: "الكلية / الدبلوم" },
    { value: "postgraduate", label: "الدراسات العليا" },
  ],
  en: [
    { value: "school", label: "School" },
    { value: "university", label: "University" },
    { value: "college", label: "College / Diploma" },
    { value: "postgraduate", label: "Postgraduate" },
  ],
};

const gradeOptions: Record<Language, Record<EducationLevel, string[]>> = {
  ar: {
    school: ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس", "الصف السابع", "الصف الثامن", "الصف التاسع", "الصف العاشر", "الصف الحادي عشر", "الصف الثاني عشر"],
    university: ["السنة الأولى", "السنة الثانية", "السنة الثالثة", "السنة الرابعة", "السنة الخامسة أو أكثر"],
    college: ["المستوى الأول", "المستوى الثاني", "المستوى الثالث", "المستوى الرابع", "مستوى آخر"],
    postgraduate: ["ماجستير", "دكتوراه", "دبلوم دراسات عليا", "مستوى آخر"],
  },
  en: {
    school: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
    university: ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5 or above"],
    college: ["Level 1", "Level 2", "Level 3", "Level 4", "Other level"],
    postgraduate: ["Master's", "Doctorate", "Postgraduate Diploma", "Other level"],
  },
};

const weekdayNumbers = [1, 2, 3, 4, 5, 6, 7];

export default function AcademicSetup({ userId, lang, existingSubjects, onComplete }: Props) {
  const t = copy[lang];
  const [step, setStep] = useState<Step>("identity");
  const [educationLevel, setEducationLevel] = useState<EducationLevel>("university");
  const [institution, setInstitution] = useState("");
  const [gradeOrYear, setGradeOrYear] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [termId, setTermId] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [name, setName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [instructor, setInstructor] = useState("");
  const [added, setAdded] = useState<ExistingSubject[]>([]);
  const [method, setMethod] = useState<"manual" | "upload" | "smart">("manual");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [sessionSubject, setSessionSubject] = useState("");
  const [startsAt, setStartsAt] = useState("09:00");
  const [endsAt, setEndsAt] = useState("10:00");
  const [meetingType, setMeetingType] = useState<SessionDraft["meeting_type"]>("lecture");
  const [location, setLocation] = useState("");
  const [sessions, setSessions] = useState<SessionDraft[]>([]);
  const [savedSessionCount, setSavedSessionCount] = useState(0);
  const [studyTime, setStudyTime] = useState("evening");
  const [studyHours, setStudyHours] = useState("2");
  const [primaryGoal, setPrimaryGoal] = useState("organize");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const allSubjects = useMemo(() => [...existingSubjects, ...added], [existingSubjects, added]);
  const steps: Step[] = ["identity", "term", "courses", "schedule", "preferences", "review"];
  const stepNumber = steps.indexOf(step) + 1;
  const profile = useMemo<AcademicProfile>(() => ({
    education_level: educationLevel,
    institution: institution.trim(),
    grade_or_year: gradeOrYear,
    specialization: specialization.trim(),
    study_time: studyTime,
    study_hours_per_day: studyHours,
    primary_goal: primaryGoal,
  }), [educationLevel, institution, gradeOrYear, specialization, studyTime, studyHours, primaryGoal]);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!supabase) return;
      const [{ data: authData }, { data: setupData }, { data: termData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("academic_setup").select("current_step").eq("user_id", userId).maybeSingle(),
        supabase.from("academic_terms").select("id,name,start_date,end_date").eq("user_id", userId).eq("is_active", true).maybeSingle(),
      ]);
      if (!active) return;
      const savedProfile = authData.user?.user_metadata?.az_academic_profile as Partial<AcademicProfile> | undefined;
      if (savedProfile) {
        if (savedProfile.education_level && ["school", "university", "college", "postgraduate"].includes(savedProfile.education_level)) setEducationLevel(savedProfile.education_level);
        setInstitution(savedProfile.institution || "");
        setGradeOrYear(savedProfile.grade_or_year || "");
        setSpecialization(savedProfile.specialization || "");
        setStudyTime(savedProfile.study_time || "evening");
        setStudyHours(savedProfile.study_hours_per_day || "2");
        setPrimaryGoal(savedProfile.primary_goal || "organize");
      }
      if (setupData?.current_step === "term") setStep("term");
      if (setupData?.current_step === "subjects") setStep("courses");
      if (setupData?.current_step === "timetable") setStep("schedule");
      if (setupData?.current_step === "review") setStep("review");
      if (termData) {
        setTermId(termData.id);
        setTermName(termData.name);
        setStartDate(termData.start_date || "");
        setEndDate(termData.end_date || "");
      }
    }
    void restore();
    return () => { active = false; };
  }, [userId]);

  async function saveProgress(currentStep: "term" | "subjects" | "timetable" | "review", status = "in_progress") {
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

  async function saveProfile() {
    if (!supabase) throw new Error("Supabase is not configured");
    const { error: updateError } = await supabase.auth.updateUser({
      data: { az_academic_profile: profile },
    });
    if (updateError) throw updateError;
  }

  async function saveTerm() {
    if (!supabase) throw new Error("Supabase is not configured");
    if (endDate && startDate && endDate < startDate) throw new Error(t.dateError);
    if (!termName.trim()) return;
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
      }).select("id,name,term_id,course_code,instructor").single();
      if (insertError) throw insertError;
      setAdded(current => [...current, data as ExistingSubject]);
      setName(""); setCourseCode(""); setInstructor(""); setDuplicateWarning(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  async function removeSubject(subject: ExistingSubject) {
    if (!supabase || !added.some(item => item.id === subject.id)) return;
    setBusy(true); setError("");
    try {
      const { error: deleteError } = await supabase.from("subjects").delete().eq("id", subject.id).eq("user_id", userId);
      if (deleteError) throw deleteError;
      setAdded(current => current.filter(item => item.id !== subject.id));
      setSessions(current => current.filter(item => item.subject_id !== subject.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    if (!file) { setSelectedFile(null); return; }
    const validType = file.type === "application/pdf" || ["image/png", "image/jpeg"].includes(file.type);
    if (!validType || file.size > 10 * 1024 * 1024) {
      setError(t.fileError);
      event.target.value = "";
      setSelectedFile(null);
      return;
    }
    setError("");
    setSelectedFile(file);
  }

  function addSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionSubject) { setError(t.courseError); return; }
    if (endsAt <= startsAt) { setError(t.timeError); return; }
    setError("");
    setSessions(current => [...current, {
      id: crypto.randomUUID(),
      subject_id: sessionSubject,
      weekday,
      starts_at_local: startsAt,
      ends_at_local: endsAt,
      meeting_type: meetingType,
      location: location.trim(),
    }]);
    setLocation("");
  }

  async function saveSessions() {
    if (!supabase || sessions.length === 0) return;
    const payload = sessions.map(session => ({
      user_id: userId,
      subject_id: session.subject_id,
      weekday: session.weekday,
      starts_at_local: session.starts_at_local,
      ends_at_local: session.ends_at_local,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      location: session.location || null,
      meeting_type: session.meeting_type,
      valid_from: startDate || null,
      valid_until: endDate || null,
    }));
    const { error: insertError } = await supabase.from("class_meetings").insert(payload);
    if (insertError) throw insertError;
    setSavedSessionCount(current => current + sessions.length);
    setSessions([]);
  }

  async function continueStep() {
    if (!supabase) return;
    setBusy(true); setError("");
    try {
      if (step === "identity") {
        await saveProfile();
        await saveProgress("term");
        setStep("term");
      } else if (step === "term") {
        await saveTerm();
        await saveProgress("subjects");
        setStep("courses");
      } else if (step === "courses") {
        await saveProgress("timetable");
        setStep("schedule");
      } else if (step === "schedule") {
        await saveSessions();
        await saveProgress("review");
        setStep("preferences");
      } else if (step === "preferences") {
        await saveProfile();
        await saveProgress("review");
        setStep("review");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  function goBack() {
    const index = steps.indexOf(step);
    if (index > 0) setStep(steps[index - 1]);
  }

  async function finish() {
    setBusy(true); setError("");
    try {
      await saveProfile();
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
      await saveProgress(step === "identity" || step === "term" ? "term" : step === "courses" ? "subjects" : step === "schedule" ? "timetable" : "review", "skipped");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const levelLabel = levelOptions[lang].find(option => option.value === educationLevel)?.label || t.university;
  const subjectName = (id: string) => allSubjects.find(subject => subject.id === id)?.name || "";
  const weekdayLabel = (day: number) => t.days[day - 1] || "";

  return (
    <div className="academic-setup-backdrop" role="dialog" aria-modal="true" aria-labelledby="academic-setup-title" dir={lang === "ar" ? "rtl" : "ltr"}>
      <section className="academic-setup-panel">
        <div className="academic-setup-topline"><span>{t.eyebrow}</span><span>{t.step} {stepNumber} {t.of} 6</span></div>
        <div className="academic-setup-progress"><i style={{ width: (stepNumber / 6 * 100) + "%" }} /></div>
        <div className="academic-setup-heading">
          <span className="academic-setup-mark"><img src="/az-mark.svg" alt="AZ" /></span>
          <h2 id="academic-setup-title">{step === "review" ? t.review : step === "identity" ? t.title : step === "term" ? t.term : step === "courses" ? t.courses : step === "schedule" ? t.schedule : t.preferences}</h2>
          <p>{step === "review" ? t.reviewHint : step === "identity" ? t.intro : step === "term" ? t.termHint : step === "courses" ? t.coursesHint : step === "schedule" ? t.scheduleHint : t.preferencesHint}</p>
        </div>

        {step === "identity" && <div className="academic-setup-form">
          <div className="academic-setup-section-title"><span>01</span><div><h3>{t.identity}</h3><p>{t.identityHint}</p></div></div>
          <div className="academic-setup-level-grid">
            {levelOptions[lang].map(option => <button type="button" key={option.value} className={"academic-setup-level" + (educationLevel === option.value ? " active" : "")} onClick={() => { setEducationLevel(option.value); setGradeOrYear(""); }}>
              <span className="academic-setup-level-icon">{option.value === "school" ? "⌂" : option.value === "university" ? "⌘" : option.value === "college" ? "◇" : "✧"}</span>
              <strong>{option.label}</strong><i>{educationLevel === option.value ? "✓" : "+"}</i>
            </button>)}
          </div>
          <label><span>{t.institution}</span><input value={institution} onChange={event => setInstitution(event.target.value)} maxLength={160} placeholder={t.institutionPlaceholder} /></label>
          <div className="academic-setup-fields">
            <label><span>{t.grade}</span><select value={gradeOrYear} onChange={event => setGradeOrYear(event.target.value)}><option value="">{t.gradePlaceholder}</option>{gradeOptions[lang][educationLevel].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>{t.specialization}</span><input value={specialization} onChange={event => setSpecialization(event.target.value)} maxLength={160} placeholder={t.specializationPlaceholder} /></label>
          </div>
          <div className="academic-setup-note">{t.identityHint}</div>
        </div>}

        {step === "term" && <form className="academic-setup-form" onSubmit={event => { event.preventDefault(); void continueStep(); }}>
          <div className="academic-setup-section-title"><span>02</span><div><h3>{t.term}</h3><p>{t.termHint}</p></div></div>
          <label><span>{t.termName}</span><input value={termName} onChange={event => setTermName(event.target.value)} maxLength={120} placeholder={t.termPlaceholder} /></label>
          <div className="academic-setup-fields">
            <label><span>{t.start}</span><input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
            <label><span>{t.end}</span><input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
          </div>
        </form>}

        {step === "courses" && <div className="academic-setup-form">
          <div className="academic-setup-section-title"><span>03</span><div><h3>{t.courses}</h3><p>{t.coursesHint}</p></div></div>
          <div className="academic-setup-methods">
            {(["manual", "upload", "smart"] as const).map(value => <button type="button" key={value} className={"academic-setup-method" + (method === value ? " active" : "")} onClick={() => { setMethod(value); setError(""); }}>
              <span className="academic-setup-method-icon">{value === "manual" ? "＋" : value === "upload" ? "▤" : "✧"}</span>
              <strong>{t[value]}</strong><small>{t[value + "Hint" as "manualHint" | "uploadHint" | "smartHint"]}</small>
              <i>{method === value ? "✓" : "↗"}</i>
            </button>)}
          </div>
          {method !== "manual" && <div className="academic-setup-import">
            <label className="academic-setup-file"><span>＋ {t.file}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={onFileChange} /></label>
            <small>{t.fileTypes}</small>
            {selectedFile && <div className="academic-setup-file-selected"><strong>{t.selectedFile}</strong><span>{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span></div>}
            <p>{t.fileNotice}</p>
          </div>}
          <form className="academic-setup-subject-form" onSubmit={addSubject}>
            <label><span>{t.subjectName}</span><input value={name} onChange={event => { setName(event.target.value); setDuplicateWarning(allSubjects.some(subject => subject.name.trim().toLocaleLowerCase() === event.target.value.trim().toLocaleLowerCase())); }} maxLength={120} placeholder={t.subjectPlaceholder} required /></label>
            <div className="academic-setup-fields">
              <label><span>{t.code}</span><input value={courseCode} onChange={event => setCourseCode(event.target.value)} maxLength={40} /></label>
              <label><span>{t.instructor}</span><input value={instructor} onChange={event => setInstructor(event.target.value)} maxLength={120} /></label>
            </div>
            {duplicateWarning && <p className="academic-setup-warning">{t.duplicate}</p>}
            <button type="submit" className="academic-setup-add" disabled={busy || !name.trim()}>＋ {t.add}</button>
          </form>
          <div className="academic-setup-added"><div className="academic-setup-added-heading"><span>{t.added}</span><strong>{allSubjects.length.toString().padStart(2, "0")}</strong></div>
            {allSubjects.length ? allSubjects.map((subject, index) => <div className="academic-setup-subject" key={subject.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{subject.name}</strong>{subject.course_code && <small>{subject.course_code}</small>}{added.some(item => item.id === subject.id) && <button type="button" onClick={() => void removeSubject(subject)} aria-label={t.remove}>×</button>}</div>) : <p>{t.noSubjects}</p>}
          </div>
        </div>}

        {step === "schedule" && <div className="academic-setup-form">
          <div className="academic-setup-section-title"><span>04</span><div><h3>{t.schedule}</h3><p>{t.scheduleHint}</p></div></div>
          <form className="academic-setup-session-form" onSubmit={addSession}>
            <label><span>{t.chooseCourse}</span><select value={sessionSubject} onChange={event => setSessionSubject(event.target.value)}><option value="">{t.chooseCoursePlaceholder}</option>{allSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <div className="academic-setup-fields">
              <label><span>{t.weekday}</span><select value={weekday} onChange={event => setWeekday(Number(event.target.value))}>{weekdayNumbers.map(day => <option key={day} value={day}>{weekdayLabel(day)}</option>)}</select></label>
              <label><span>{t.sessionType}</span><select value={meetingType} onChange={event => setMeetingType(event.target.value as SessionDraft["meeting_type"])}><option value="lecture">{t.lecture}</option><option value="lab">{t.lab}</option><option value="tutorial">{t.tutorial}</option><option value="other">{t.other}</option></select></label>
            </div>
            <div className="academic-setup-fields">
              <label><span>{t.starts}</span><input type="time" value={startsAt} onChange={event => setStartsAt(event.target.value)} required /></label>
              <label><span>{t.ends}</span><input type="time" value={endsAt} onChange={event => setEndsAt(event.target.value)} required /></label>
            </div>
            <label><span>{t.location}</span><input value={location} onChange={event => setLocation(event.target.value)} maxLength={160} placeholder={t.locationPlaceholder} /></label>
            <button type="submit" className="academic-setup-add" disabled={busy || !allSubjects.length}>＋ {t.addSession}</button>
          </form>
          <div className="academic-setup-added"><div className="academic-setup-added-heading"><span>{t.sessions}</span><strong>{sessions.length.toString().padStart(2, "0")}</strong></div>
            {sessions.length ? sessions.map(session => <div className="academic-setup-session" key={session.id}><div><strong>{subjectName(session.subject_id)}</strong><small>{weekdayLabel(session.weekday)} · {session.starts_at_local}–{session.ends_at_local}</small></div><button type="button" onClick={() => setSessions(current => current.filter(item => item.id !== session.id))} aria-label={t.remove}>×</button></div>) : <p>{t.noSessions}</p>}
          </div>
        </div>}

        {step === "preferences" && <div className="academic-setup-form">
          <div className="academic-setup-section-title"><span>05</span><div><h3>{t.preferences}</h3><p>{t.preferencesHint}</p></div></div>
          <fieldset className="academic-setup-choice-group"><legend>{t.studyTime}</legend><div className="academic-setup-choice-grid">{(["morning", "afternoon", "evening", "flexible"] as const).map(value => <button type="button" key={value} className={studyTime === value ? "active" : ""} onClick={() => setStudyTime(value)}>{t[value]}</button>)}</div></fieldset>
          <fieldset className="academic-setup-choice-group"><legend>{t.studyHours}</legend><div className="academic-setup-choice-grid compact">{["1", "2", "3", "4+"].map(value => <button type="button" key={value} className={studyHours === value ? "active" : ""} onClick={() => setStudyHours(value)}>{value}</button>)}</div></fieldset>
          <label><span>{t.goal}</span><select value={primaryGoal} onChange={event => setPrimaryGoal(event.target.value)}><option value="organize">{t.organize}</option><option value="exams">{t.exams}</option><option value="understanding">{t.understanding}</option><option value="habit">{t.habit}</option></select></label>
        </div>}

        {step === "review" && <div className="academic-setup-review">
          <div className="academic-setup-review-hero"><span className="academic-setup-success-mark">✧</span><h3>{t.launchTitle}</h3><p>{t.launchText}</p></div>
          <div><span>{t.institutionLabel}</span><strong>{institution || t.noInstitution}</strong></div>
          <div><span>{t.levelLabel}</span><strong>{levelLabel} · {gradeOrYear || t.noSpecialization}</strong></div>
          <div><span>{t.termLabel}</span><strong>{termName || t.noTerm}</strong></div>
          <div><span>{t.subjectLabel}</span><strong>{allSubjects.length}</strong></div>
          <div><span>{t.sessionLabel}</span><strong>{(savedSessionCount + sessions.length).toString().padStart(2, "0")}</strong></div>
          <div><span>{t.profileLabel}</span><strong>{t[studyTime as "morning" | "afternoon" | "evening" | "flexible"]} · {studyHours}h/day</strong></div>
          <div className="academic-setup-review-subjects">{allSubjects.map(subject => <span key={subject.id}>{subject.name}</span>)}</div>
        </div>}

        {error && <p className="academic-setup-error" role="alert">{error}</p>}
        <div className="academic-setup-actions">
          {step !== "identity" && <button type="button" className="academic-setup-back" onClick={goBack} disabled={busy}>{t.back}</button>}
          {step === "review"
            ? <button type="button" className="primary-button" onClick={() => void finish()} disabled={busy}>{busy ? t.saving : t.finish} <span>↗</span></button>
            : <button type="button" className="primary-button" onClick={() => void continueStep()} disabled={busy}>{busy ? t.saving : t.next} <span>↗</span></button>}
          <button type="button" className="academic-setup-skip" onClick={() => void skip()} disabled={busy}>{t.skip}</button>
        </div>
        <div className="academic-setup-footer"><span>THE ACADEMIC UNIVERSE</span><span>FROM A TO Z</span></div>
      </section>
    </div>
  );
}
