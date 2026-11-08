import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Language = "ar" | "en";
type SubjectOption = { id: string; name: string };
type Project = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  client: SupabaseClient | null;
  lang: Language;
  subjects: SubjectOption[];
  onOpenProject: (projectId: string) => void;
};

export default function ProjectsHome({ client, lang, subjects, onOpenProject }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const ar = lang === "ar";

  const copy = {
    eyebrow: ar ? "مساحة العمل الجماعي" : "COLLABORATIVE WORKSPACE",
    heading: ar ? "مشاريعك، في مكان واحد." : "Bring the whole project together.",
    intro: ar
      ? "اجمع فريقك، اكتبوا في مستند واحد، وتابعوا العمل من مساحة مشتركة."
      : "Bring your team together, work from one shared document, and keep every part of the project connected.",
    create: ar ? "إنشاء مشروع" : "Create a project",
    title: ar ? "اسم المشروع" : "Project name",
    description: ar ? "وصف مختصر (اختياري)" : "Short description (optional)",
    subject: ar ? "المادة المرتبطة" : "Related subject",
    noSubject: ar ? "بدون مادة" : "No subject",
    due: ar ? "موعد التسليم" : "Project deadline",
    createAction: ar ? "أنشئ مساحة المشروع" : "Create project workspace",
    creating: ar ? "جارٍ إنشاء المشروع..." : "Creating project...",
    yourProjects: ar ? "مساحاتك" : "YOUR WORKSPACES",
    emptyTitle: ar ? "مشروعك الأول يبدأ هنا" : "Your first project starts here",
    emptyText: ar
      ? "أنشئ مساحة خاصة، ثم أضف فريقك وابدأوا العمل على المستند الرئيسي."
      : "Create a private workspace, then invite your teammates and start with the primary shared document.",
    open: ar ? "افتح المشروع" : "Open project",
    active: ar ? "نشط" : "Active",
    dueLabel: ar ? "التسليم" : "DUE",
    noDue: ar ? "لم يحدد موعد" : "No deadline set",
    loading: ar ? "جارٍ تحميل مشاريعك..." : "Loading your projects...",
    loadError: ar ? "تعذر تحميل المشاريع. حاول مرة أخرى." : "Projects could not be loaded. Try again.",
    createError: ar ? "تعذر إنشاء المشروع. حاول مرة أخرى." : "Project creation failed. Please try again.",
    subjectFallback: ar ? "مشروع أكاديمي" : "Academic project",
  };

  const refresh = useCallback(async () => {
    if (!client) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await client
      .from("projects")
      .select("id,title,description,subject_id,due_at,status,created_at,updated_at")
      .order("updated_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
    } else {
      setError("");
      setProjects((data || []) as Project[]);
    }
    setLoading(false);
  }, [client]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await refresh();
      if (!active) return;
    };
    void load();
    if (!client) return () => { active = false; };
    const channel = client
      .channel("az-projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, () => {
        if (active) void refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, () => {
        if (active) void refresh();
      })
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, refresh]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !title.trim() || creating) return;
    setCreating(true);
    setError("");
    const dueAt = dueDate ? new Date(dueDate + "T23:59:00").toISOString() : null;
    const { data, error: createError } = await client.rpc("create_project", {
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_subject_id: subjectId || null,
      p_due_at: dueAt,
    });
    if (createError || !data) {
      setError(createError?.message || copy.createError);
      setCreating(false);
      return;
    }
    const projectId = data as string;
    setTitle("");
    setDescription("");
    setSubjectId("");
    setDueDate("");
    await refresh();
    setCreating(false);
    onOpenProject(projectId);
  }

  const dateLabel = (value: string | null) => value
    ? new Date(value).toLocaleDateString(ar ? "ar-QA" : "en-US", { day: "numeric", month: "short", year: "numeric" })
    : copy.noDue;

  return (
    <section className="projects-page">
      <div className="projects-hero">
        <div className="projects-hero-copy">
          <span className="eyebrow"><span className="eyebrow-pulse" />{copy.eyebrow}</span>
          <h2>{copy.heading}</h2>
          <p>{copy.intro}</p>
          <div className="projects-hero-proof">
            <span className="projects-proof-orbit">✧</span>
            <span>{ar ? "فريق واحد · مستند واحد · إنجاز مشترك" : "One team · One document · One shared outcome"}</span>
          </div>
        </div>
        <div className="projects-hero-visual" aria-hidden="true">
          <div className="projects-visual-orbit orbit-one" />
          <div className="projects-visual-orbit orbit-two" />
          <div className="projects-visual-core"><span>AZ</span></div>
          <i className="projects-visual-node node-one" />
          <i className="projects-visual-node node-two" />
          <i className="projects-visual-node node-three" />
        </div>
      </div>

      <div className="projects-content-grid">
        <section className="content-panel projects-create-panel">
          <div className="panel-heading">
            <div><span className="eyebrow">{ar ? "ابدأ مساحة جديدة" : "START SOMETHING TOGETHER"}</span><h2>{copy.create}</h2></div>
            <span className="panel-symbol">＋</span>
          </div>
          <form className="projects-create-form" onSubmit={createProject}>
            <label><span>{copy.title}</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} required /></label>
            <label><span>{copy.description}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1200} rows={3} /></label>
            <label><span>{copy.subject}</span><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{copy.noSubject}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label><span>{copy.due}</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <button className="primary-button full-button" type="submit" disabled={!title.trim() || creating || !client}>
              {creating ? copy.creating : copy.createAction}<span>↗</span>
            </button>
          </form>
        </section>

        <section className="projects-list-panel">
          <div className="panel-heading projects-list-heading">
            <div><span className="eyebrow">{copy.yourProjects}</span><h2>{ar ? "مساحات العمل" : "Project spaces"}</h2></div>
            <span className="count-pill">{projects.length.toString().padStart(2, "0")}</span>
          </div>
          {loading ? <p className="muted">{copy.loading}</p> : error && projects.length === 0 ? (
            <div className="project-feed-empty"><span>!</span><p>{copy.loadError}</p></div>
          ) : projects.length === 0 ? (
            <div className="projects-empty-state">
              <div className="projects-empty-orbit"><span>✧</span></div>
              <h3>{copy.emptyTitle}</h3>
              <p>{copy.emptyText}</p>
            </div>
          ) : (
            <div className="projects-card-list">
              {projects.map((project, index) => (
                <button className="project-card" key={project.id} type="button" onClick={() => onOpenProject(project.id)}>
                  <span className="project-card-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="project-card-main">
                    <strong>{project.title || copy.subjectFallback}</strong>
                    <small>{project.description || (ar ? "مساحة عمل أكاديمية مشتركة" : "Shared academic workspace")}</small>
                    <span className="project-card-meta">
                      <span className="project-status-dot" />{project.status === "active" ? copy.active : project.status}
                      <span className="project-meta-separator">·</span>
                      {copy.dueLabel}: {dateLabel(project.due_at)}
                    </span>
                  </span>
                  <span className="project-card-arrow">↗</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
      {error && projects.length > 0 && <p className="feedback error-feedback">{copy.loadError}</p>}
    </section>
  );
}
