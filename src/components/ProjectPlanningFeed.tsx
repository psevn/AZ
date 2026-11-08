import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Language = "ar" | "en";
type PlanningItem = {
  id: string;
  item_type: "personal_task" | "project_task" | "project_deadline";
  title: string;
  due_at: string | null;
  status: "todo" | "doing" | "done";
  priority: number;
  est_minutes: number | null;
  project_id: string | null;
  project_title: string | null;
};

type Props = {
  client: SupabaseClient | null;
  lang: Language;
  compact?: boolean;
  onOpenProject: (projectId: string) => void;
};

export default function ProjectPlanningFeed({ client, lang, compact = false, onOpenProject }: Props) {
  const [items, setItems] = useState<PlanningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const ar = lang === "ar";

  const refresh = useCallback(async () => {
    if (!client) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await client
      .from("planning_items")
      .select("id,item_type,title,due_at,status,priority,est_minutes,project_id,project_title")
      .order("due_at", { ascending: true, nullsFirst: false });
    if (queryError) {
      setError(queryError.message);
    } else {
      setError("");
      setItems(((data || []) as PlanningItem[]).filter((item) => item.item_type !== "personal_task"));
    }
    setLoading(false);
  }, [client]);

  useEffect(() => {
    let active = true;
    const runRefresh = async () => {
      if (!active) return;
      await refresh();
    };
    void runRefresh();
    if (!client) return () => { active = false; };

    const channel = client
      .channel("az-unified-planning")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, runRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_tasks" }, runRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, runRefresh)
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [client, refresh]);

  const visible = compact
    ? items.filter((item) => item.status !== "done").slice(0, 3)
    : items;

  const dateLabel = (value: string | null) => value
    ? new Date(value).toLocaleString(ar ? "ar-QA" : "en-US", { month: "short", day: "numeric" })
    : (ar ? "بدون موعد" : "No date");

  if (loading) {
    return <section className="project-planning-feed"><div className="page-skeleton" role="status" aria-label={ar ? "جارٍ تحميل عناصر المشاريع" : "Loading project items"}><span className="skeleton-line skeleton-line-wide" /><span className="skeleton-line" /><span className="skeleton-line skeleton-line-short" /></div></section>;
  }

  return (
    <section className={"project-planning-feed" + (compact ? " is-compact" : "")}>
      <div className="project-feed-heading">
        <div>
          <span className="eyebrow">{ar ? "مترابط مع فريقك" : "CONNECTED WORKSPACE"}</span>
          <h2>{ar ? "مشاريعك ضمن خطتك" : "Projects in your plan"}</h2>
        </div>
        <span className="count-pill">{items.length.toString().padStart(2, "0")}</span>
      </div>
      {error ? (
        <p className="muted">{ar ? "تعذر تحميل عناصر المشاريع." : "Project items could not be loaded."}</p>
      ) : visible.length === 0 ? (
        <div className="project-feed-empty">
          <span>✧</span>
          <p>{ar ? "ستظهر هنا مواعيد مشاريع فريقك والمهام المسندة إليك تلقائياً." : "Your team project deadlines and assigned tasks will appear here automatically."}</p>
        </div>
      ) : (
        <div className="project-feed-list">
          {visible.map((item) => {
            const deadline = item.item_type === "project_deadline";
            return (
              <button className="project-feed-item" type="button" key={item.item_type + ":" + item.id} onClick={() => { if (item.project_id) onOpenProject(item.project_id); }}>
                <span className={"project-feed-marker " + (deadline ? "is-deadline" : "is-task")} />
                <div className="project-feed-copy">
                  <strong>{item.title}</strong>
                  <small>{item.project_title || (ar ? "مهمة شخصية" : "Personal task")} · {dateLabel(item.due_at)}</small>
                </div>
                <span className={"project-feed-kind " + (deadline ? "is-deadline" : "is-task")}>
                  {deadline ? (ar ? "موعد المشروع" : "Project deadline") : (ar ? "مهمة فريق" : "Team task")}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
