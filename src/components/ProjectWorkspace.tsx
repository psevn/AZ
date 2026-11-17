import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const ProjectCollaborativeEditor = lazy(() => import("./ProjectCollaborativeEditor"));

type Language = "ar" | "en";
type Project = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_at: string | null;
  status: string;
  created_at: string;
};
type ProjectDocument = { id: string; title: string; document_type: string; is_primary: boolean; updated_at: string };
type Member = { user_id: string; role: "lead" | "member"; joined_at: string; revoked_at: string | null };
type ProjectTask = {
  id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  due_at: string | null;
  priority: number;
  status: "todo" | "doing" | "done";
  created_at: string;
};
type Activity = { id: string; actor_id: string | null; event_type: string; payload: Record<string, unknown>; created_at: string };

type Props = {
  client: SupabaseClient | null;
  lang: Language;
  projectId: string;
  userId: string;
  onBack: () => void;
};

type Tab = "overview" | "document" | "tasks" | "activity";

export default function ProjectWorkspace({ client, lang, projectId, userId, onBack }: Props) {
  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<ProjectDocument | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState(false);
  const [error, setError] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [priority, setPriority] = useState("2");
  const [currentUserRole, setCurrentUserRole] = useState<"lead" | "member">("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const ar = lang === "ar";

  const copy = {
    back: ar ? "كل المشاريع" : "All projects",
    overview: ar ? "نظرة عامة" : "Overview",
    document: ar ? "المستند الرئيسي" : "Main document",
    tasks: ar ? "المهام" : "Tasks",
    activity: ar ? "النشاط" : "Activity",
    team: ar ? "الفريق" : "TEAM",
    inviteEmail: ar ? "بريد العضو (اختياري)" : "Teammate email (optional)",
    inviteAction: ar ? "إنشاء رابط دعوة" : "Create invite link",
    creatingInvite: ar ? "جارٍ إنشاء الدعوة..." : "Creating invitation...",
    inviteReady: ar ? "انسخ الرابط وأرسله لعضو الفريق." : "Copy this link and send it to your teammate.",
    copyInvite: ar ? "نسخ الرابط" : "Copy link",
    removeMember: ar ? "إزالة العضو" : "Remove member",
    removingMember: ar ? "جارٍ الإزالة..." : "Removing...",
    confirmRemoveMember: ar ? "هل تريد بدء إزالة هذا العضو؟ سنمنع وصوله ونطلب إغلاق جلسات التحرير المفتوحة." : "Start removing this member? Their access will be fenced and active editing sessions will be asked to close.",
    memberNumber: ar ? "عضو" : "Member",
    revocationPending: ar ? "بانتظار إغلاق الجلسات" : "Revocation pending",
    retryRemoval: ar ? "إكمال الإزالة" : "Retry removal",
    memberInvited: ar ? "تم إرسال دعوة لعضو" : "Invited a teammate",
    memberJoined: ar ? "انضم عضو إلى المشروع" : "A teammate joined the project",
    progress: ar ? "الإنجاز" : "PROGRESS",
    due: ar ? "موعد التسليم" : "DEADLINE",
    noDue: ar ? "لم يحدد موعد" : "No deadline",
    primary: ar ? "المستند الرئيسي المشترك" : "PRIMARY SHARED DOCUMENT",
    docTitle: ar ? "مستند المشروع" : "Project document",
    docDescription: ar
      ? "مستند واحد يعمل عليه الفريق معاً. تظهر التعديلات المشتركة مباشرة وتُحفظ تلقائياً."
      : "One shared document for the team. Edits sync live between members and save automatically.",
    editorStatus: ar ? "مستند تعاوني للفريق" : "SHARED TEAM DOCUMENT",
    taskTitle: ar ? "عنوان المهمة" : "Task title",
    taskDescription: ar ? "تفاصيل المهمة (اختياري)" : "Task details (optional)",
    assign: ar ? "إسناد إلى" : "Assign to",
    unassigned: ar ? "غير مسندة" : "Unassigned",
    dueDate: ar ? "الموعد" : "Due date",
    priority: ar ? "الأولوية" : "Priority",
    high: ar ? "عالية" : "High",
    medium: ar ? "متوسطة" : "Medium",
    low: ar ? "منخفضة" : "Low",
    addTask: ar ? "إضافة مهمة للفريق" : "Add team task",
    adding: ar ? "جارٍ الإضافة..." : "Adding...",
    emptyTasks: ar ? "لا توجد مهام بعد. أضف أول مهمة للفريق." : "No tasks yet. Add the first team task.",
    emptyActivity: ar ? "سيظهر هنا سجل العمل الفعلي للفريق." : "Real project activity will appear here.",
    emptyMembers: ar ? "لم ينضم أعضاء آخرون بعد." : "No teammates have joined yet.",
    loading: ar ? "جارٍ تحميل مساحة المشروع..." : "Loading project workspace...",
    failed: ar ? "تعذر تحميل مساحة المشروع." : "Could not load this project workspace.",
    notFound: ar ? "المشروع غير موجود أو لا تملك صلاحية الوصول إليه." : "Project not found or you don't have access.",
    todo: ar ? "لم تبدأ" : "To do",
    doing: ar ? "قيد التنفيذ" : "In progress",
    done: ar ? "مكتملة" : "Done",
    lead: ar ? "قائد" : "Lead",
    member: ar ? "عضو" : "Member",
    you: ar ? "أنت" : "You",
    teammate: ar ? "عضو الفريق" : "Teammate",
    status: ar ? "حالة المشروع" : "PROJECT STATUS",
    active: ar ? "نشط" : "Active",
    completed: ar ? "مكتمل" : "Completed",
    archived: ar ? "مؤرشف" : "Archived",
    created: ar ? "تم إنشاء المهمة" : "Created a task",
    assigned: ar ? "تم إسناد مهمة" : "Assigned a task",
    reassigned: ar ? "تم تغيير المسؤول" : "Reassigned a task",
    statusChanged: ar ? "تم تحديث حالة مهمة" : "Updated task status",
    taskCompleted: ar ? "أكمل مهمة" : "Completed a task",
    docCreated: ar ? "تم إنشاء المستند الرئيسي" : "Created the primary document",
    unknownEvent: ar ? "تحديث في المشروع" : "Project update",
  };

  const refresh = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setError(copy.failed);
      return;
    }
    const [projectResult, documentResult, membersResult, tasksResult, activityResult] = await Promise.all([
      client.from("projects").select("id,title,description,subject_id,due_at,status,created_at").eq("id", projectId).maybeSingle(),
      client.from("project_documents").select("id,title,document_type,is_primary,updated_at").eq("project_id", projectId).eq("is_primary", true).maybeSingle(),
      client.from("project_members").select("user_id,role,joined_at,revoked_at").eq("project_id", projectId).order("joined_at", { ascending: true }),
      client.from("project_tasks").select("id,title,description,assignee_id,due_at,priority,status,created_at").eq("project_id", projectId).order("created_at", { ascending: false }),
      client.from("project_activity").select("id,actor_id,event_type,payload,created_at").eq("project_id", projectId).order("created_at", { ascending: false }).limit(30),
    ]);

    if (projectResult.error || !projectResult.data) {
      setError(copy.notFound);
      setProject(null);
      setLoading(false);
      return;
    }
    if (documentResult.error || membersResult.error || tasksResult.error || activityResult.error) {
      setError(copy.failed);
    } else {
      setError("");
    }
    setProject(projectResult.data as Project);
    setDocument((documentResult.data || null) as ProjectDocument | null);
    const loadedMembers = (membersResult.data || []) as Member[];
    setMembers(loadedMembers);
    setCurrentUserRole(loadedMembers.find((member) => member.user_id === userId && !member.revoked_at)?.role || "member");
    setTasks((tasksResult.data || []) as ProjectTask[]);
    setActivity((activityResult.data || []) as Activity[]);
    setLoading(false);
  }, [client, projectId, userId, copy.failed, copy.notFound]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      await refresh();
      if (!active) return;
    };
    void load();
    if (!client) return () => { active = false; };
    const channel = client
      .channel("az-project-workspace-" + projectId)
      .on("postgres_changes", { event: "*", schema: "public", table: "projects", filter: "id=eq." + projectId }, () => { if (active) void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: "project_id=eq." + projectId }, () => { if (active) void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_documents", filter: "project_id=eq." + projectId }, () => { if (active) void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks", filter: "project_id=eq." + projectId }, () => { if (active) void refresh(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_activity", filter: "project_id=eq." + projectId }, () => { if (active) void refresh(); })
      .subscribe();
    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, projectId, refresh]);

  const completedCount = useMemo(() => tasks.filter((task) => task.status === "done").length, [tasks]);
  const completion = tasks.length ? Math.round(completedCount / tasks.length * 100) : 0;
  const dateLabel = (value: string | null) => value
    ? new Date(value).toLocaleDateString(ar ? "ar-QA" : "en-US", { day: "numeric", month: "short", year: "numeric" })
    : copy.noDue;

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !project || !taskTitle.trim() || savingTask) return;
    setSavingTask(true);
    setError("");
    const dueAt = taskDue ? new Date(taskDue + "T23:59:00").toISOString() : null;
    const { error: insertError } = await client.from("project_tasks").insert({
      project_id: project.id,
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      assignee_id: assigneeId || null,
      created_by: userId,
      due_at: dueAt,
      priority: Number(priority),
      status: "todo",
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setTaskTitle("");
      setTaskDescription("");
      setAssigneeId("");
      setTaskDue("");
      setPriority("2");
      await refresh();
    }
    setSavingTask(false);
  }

  async function changeTaskStatus(task: ProjectTask) {
    if (!client) return;
    const nextStatus: ProjectTask["status"] = task.status === "todo" ? "doing" : task.status === "doing" ? "done" : "todo";
    const { error: updateError } = await client.from("project_tasks")
      .update({ status: nextStatus, updated_at: new Date().toISOString(), completed_at: nextStatus === "done" ? new Date().toISOString() : null })
      .eq("id", task.id);
    if (updateError) setError(updateError.message);
    else await refresh();
  }

  async function createInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || currentUserRole !== "lead" || creatingInvite) return;
    setCreatingInvite(true);
    setError("");
    setInviteLink("");
    const { data, error: inviteError } = await client.functions.invoke("project-invitations", {
      body: { action: "create", projectId, invitedEmail: inviteEmail.trim() || null },
    });
    if (inviteError || !data?.token) {
      setError(inviteError?.message || (ar ? "تعذر إنشاء رابط الدعوة." : "Could not create the invitation link."));
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set("projectInvite", data.token);
      setInviteLink(url.toString());
      setInviteEmail("");
    }
    setCreatingInvite(false);
  }

  async function removeMember(memberUserId: string) {
    if (!client || currentUserRole !== "lead" || removingMemberId) return;
    if (!window.confirm(copy.confirmRemoveMember)) return;
    setRemovingMemberId(memberUserId);
    setError("");
    let removalMessage = "";
    try {
      const { error: removalError } = await client.functions.invoke("project-members", {
        body: { action: "remove", projectId, memberUserId },
      });
      if (removalError) removalMessage = removalError.message || copy.failed;
    } catch {
      removalMessage = copy.failed;
    } finally {
      // A failed request may still have completed phase one (the database
      // revocation fence). Refresh so the pending state and retry action are
      // visible instead of leaving stale membership data on screen.
      try {
        await refresh();
      } catch {
        if (!removalMessage) removalMessage = copy.failed;
      }
      if (removalMessage) setError(removalMessage);
      setRemovingMemberId(null);
    }
  }

  async function copyInvitation() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setError("");
    } catch {
      setError(ar ? "تعذر النسخ تلقائياً؛ انسخ الرابط من الحقل." : "Automatic copy failed; copy the link from the field.");
    }
  }

  function eventLabel(event: Activity) {
    const title = typeof event.payload?.title === "string" ? event.payload.title : "";
    const labels: Record<string, string> = {
      task_created: copy.created,
      task_assigned: copy.assigned,
      task_reassigned: copy.reassigned,
      task_status_changed: copy.statusChanged,
      task_completed: copy.taskCompleted,
      document_created: copy.docCreated,
      member_invited: copy.memberInvited,
      member_joined: copy.memberJoined,
    };
    return (labels[event.event_type] || copy.unknownEvent) + (title ? ": " + title : "");
  }

  if (loading) return <section className="project-workspace-loading page-skeleton" role="status" aria-label={copy.loading}><span className="skeleton-line skeleton-line-wide" /><span className="skeleton-line" /><span className="skeleton-line skeleton-line-short" /></section>;
  if (!project) return <section className="content-panel"><button className="quiet-button" type="button" onClick={onBack}>← {copy.back}</button><p className="muted">{error || copy.notFound}</p></section>;

  return (
    <section className="project-workspace">
      <div className="project-workspace-top">
        <button className="project-back-button" type="button" onClick={onBack}>← {copy.back}</button>
        <span className="project-workspace-status"><i />{project.status === "active" ? copy.active : project.status === "completed" ? copy.completed : copy.archived}</span>
      </div>
      <div className="project-title-block">
        <span className="eyebrow">{ar ? "AZ PROJECT / مساحة خاصة" : "AZ PROJECT / PRIVATE WORKSPACE"}</span>
        <h2>{project.title}</h2>
        {project.description && <p>{project.description}</p>}
        <div className="project-title-meta"><span>{copy.due}: {dateLabel(project.due_at)}</span><span>{members.length} {copy.team}</span></div>
      </div>

      <nav className="project-tabs" aria-label={ar ? "أقسام المشروع" : "Project sections"}>
        {(["overview", "document", "tasks", "activity"] as Tab[]).map((item) => (
          <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>
            {item === "overview" ? copy.overview : item === "document" ? copy.document : item === "tasks" ? copy.tasks : copy.activity}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="project-overview-grid">
          <section className="content-panel project-primary-document">
            <div className="project-section-kicker"><span className="eyebrow">{copy.primary}</span><span className="project-doc-symbol">▤</span></div>
            <h3>{document?.title || copy.docTitle}</h3>
            <p>{copy.docDescription}</p>
            <div className="project-document-state"><span className="status-dot" />{copy.editorStatus}</div>
            <button className="project-open-document" type="button" onClick={() => setTab("document")}>{ar ? "عرض تفاصيل المستند" : "View document details"} <span>↗</span></button>
          </section>
          <div className="project-overview-side">
            <section className="content-panel project-stat-panel">
              <span className="eyebrow">{copy.progress}</span>
              <strong>{completion}<small>%</small></strong>
              <div className="progress-track"><i style={{ width: completion + "%" }} /></div>
              <p>{completedCount} / {tasks.length} {copy.tasks}</p>
            </section>
            <section className="content-panel project-stat-panel">
              <span className="eyebrow">{copy.team}</span>
              <strong>{members.filter((member) => !member.revoked_at).length.toString().padStart(2, "0")}</strong>
              <p>{members.length <= 1 ? copy.emptyMembers : ar ? "فريق المشروع" : "Project team"}</p>
            </section>
            <section className="content-panel project-members-panel">
              <div className="panel-heading"><div><span className="eyebrow">{copy.team}</span><h3>{ar ? "أعضاء المشروع" : "Project members"}</h3></div></div>
              <div className="project-task-list">
                {members.map((member, index) => (
                  <article className="project-task-item" key={member.user_id}>
                    <div className="project-task-copy">
                      <strong>{member.user_id === userId ? copy.you : copy.memberNumber + " " + (index + 1)}</strong>
                      <small>{member.revoked_at ? copy.revocationPending : member.role === "lead" ? copy.lead : copy.member}</small>
                    </div>
                    {currentUserRole === "lead" && member.role === "member" && (
                      <button
                        className="small-action"
                        type="button"
                        disabled={removingMemberId !== null}
                        onClick={() => void removeMember(member.user_id)}
                      >
                        {removingMemberId === member.user_id ? copy.removingMember : member.revoked_at ? copy.retryRemoval : copy.removeMember}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
            {currentUserRole === "lead" && <section className="content-panel project-invite-panel">
              <span className="eyebrow">{ar ? "أضف فريقك" : "GROW YOUR TEAM"}</span>
              <h3>{ar ? "دعوة عضو جديد" : "Invite a teammate"}</h3>
              <form className="projects-create-form" onSubmit={createInvitation}>
                <label><span>{copy.inviteEmail}</span><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} maxLength={320} placeholder="name@example.com" /></label>
                <button className="primary-button full-button" type="submit" disabled={creatingInvite}>{creatingInvite ? copy.creatingInvite : copy.inviteAction}<span>↗</span></button>
              </form>
              {inviteLink && <div className="project-invite-link"><p>{copy.inviteReady}</p><input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /><button className="small-action" type="button" onClick={() => void copyInvitation()}>{copy.copyInvite}</button></div>}
            </section>}
          </div>
          <section className="content-panel project-recent-panel">
            <div className="panel-heading"><div><span className="eyebrow">{copy.activity}</span><h3>{ar ? "آخر المستجدات" : "Latest updates"}</h3></div><button className="text-action" type="button" onClick={() => setTab("activity")}>{ar ? "عرض الكل" : "View all"} ↗</button></div>
            {activity.length === 0 ? <p className="muted">{copy.emptyActivity}</p> : <div className="project-activity-list">{activity.slice(0, 4).map((event) => <article className="project-activity-item" key={event.id}><span className="project-activity-dot" /><div><strong>{eventLabel(event)}</strong><small>{new Date(event.created_at).toLocaleString(ar ? "ar-QA" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</small></div></article>)}</div>}
          </section>
        </div>
      )}

      {tab === "document" && (
        document ? (
          <Suspense fallback={<section className="content-panel project-editor-loading"><span className="skeleton-line skeleton-line-wide" /><span className="skeleton-line" /></section>}>
            <ProjectCollaborativeEditor
              client={client}
              documentId={document.id}
              documentTitle={document.title || copy.docTitle}
              lang={lang}
              userId={userId}
            />
          </Suspense>
        ) : (
          <section className="content-panel project-document-detail">
            <div className="project-document-detail-icon">▤</div>
            <span className="eyebrow">{copy.primary}</span>
            <h3>{copy.docTitle}</h3>
            <p>{error || copy.docDescription}</p>
            <div className="project-document-state"><span className="status-dot" />{copy.editorStatus}</div>
          </section>
        )
      )}

      {tab === "tasks" && (
        <div className="project-tasks-layout">
          <section className="content-panel project-task-create">
            <div className="panel-heading"><div><span className="eyebrow">{ar ? "وزّع العمل" : "COORDINATE THE WORK"}</span><h3>{copy.addTask}</h3></div><span className="panel-symbol">＋</span></div>
            <form className="projects-create-form" onSubmit={addTask}>
              <label><span>{copy.taskTitle}</span><input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} maxLength={300} required /></label>
              <label><span>{copy.taskDescription}</span><textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} rows={3} maxLength={3000} /></label>
              <label><span>{copy.assign}</span><select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">{copy.unassigned}</option>{members.filter((member) => !member.revoked_at && (currentUserRole === "lead" || member.user_id === userId)).map((member) => <option key={member.user_id} value={member.user_id}>{member.user_id === userId ? copy.you : copy.teammate} · {member.role === "lead" ? copy.lead : copy.member}</option>)}</select></label>
              <label><span>{copy.dueDate}</span><input type="date" value={taskDue} onChange={(event) => setTaskDue(event.target.value)} /></label>
              <label><span>{copy.priority}</span><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="3">{copy.high}</option><option value="2">{copy.medium}</option><option value="1">{copy.low}</option></select></label>
              <button className="primary-button full-button" type="submit" disabled={!taskTitle.trim() || savingTask}>{savingTask ? copy.adding : copy.addTask}<span>↗</span></button>
            </form>
          </section>
          <section className="content-panel project-task-list-panel">
            <div className="panel-heading"><div><span className="eyebrow">{ar ? "تقدّم الفريق" : "TEAM PROGRESS"}</span><h3>{copy.tasks}</h3></div><span className="count-pill">{tasks.length.toString().padStart(2, "0")}</span></div>
            {tasks.length === 0 ? <div className="projects-empty-state compact"><h3>{copy.emptyTasks}</h3></div> : <div className="project-task-list">{tasks.map((task) => {
              const canUpdate = currentUserRole === "lead" || task.assignee_id === userId;
              return <article className="project-task-item" key={task.id}>
                <div className="project-task-copy"><strong>{task.title}</strong>{task.description && <p>{task.description}</p>}<small>{task.assignee_id === userId ? copy.you : task.assignee_id ? copy.teammate : copy.unassigned} · {dateLabel(task.due_at)}</small></div>
                <div className="project-task-actions"><span className={"project-task-status status-" + task.status}>{task.status === "todo" ? copy.todo : task.status === "doing" ? copy.doing : copy.done}</span>{canUpdate && <button className="small-action" type="button" onClick={() => void changeTaskStatus(task)}>{task.status === "todo" ? (ar ? "ابدأ" : "Start") : task.status === "doing" ? (ar ? "أنجز" : "Complete") : (ar ? "إعادة فتح" : "Reopen")}</button>}</div>
              </article>;
            })}</div>}
          </section>
        </div>
      )}

      {tab === "activity" && (
        <section className="content-panel project-activity-panel">
          <div className="panel-heading"><div><span className="eyebrow">{ar ? "سجل موثوق" : "VERIFIED PROJECT HISTORY"}</span><h3>{copy.activity}</h3></div><span className="count-pill">{activity.length.toString().padStart(2, "0")}</span></div>
          {activity.length === 0 ? <p className="muted">{copy.emptyActivity}</p> : <div className="project-activity-list">{activity.map((event) => <article className="project-activity-item" key={event.id}><span className="project-activity-dot" /><div><strong>{eventLabel(event)}</strong><small>{new Date(event.created_at).toLocaleString(ar ? "ar-QA" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</small></div></article>)}</div>}
        </section>
      )}
      {error && <p className="feedback error-feedback">{error}</p>}
    </section>
  );
}
