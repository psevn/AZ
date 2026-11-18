import { useEffect, useRef, useState } from "react";

type FocusTask = { id: string; title: string };
type Props = {
  lang: "ar" | "en";
  elapsed: number;
  subjectName: string;
  tasks: FocusTask[];
  selectedTaskId: string;
  onSelectTask: (id: string) => void;
  active: boolean;
  running: boolean;
  paused: boolean;
  busy: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
};

function formatElapsed(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const remainder = (total % 60).toString().padStart(2, "0");
  const hours = Math.floor(total / 3600);
  return hours > 0 ? hours.toString().padStart(2, "0") + ":" + minutes + ":" + remainder : minutes + ":" + remainder;
}

export default function FocusUniverse(props: Props) {
  const {
    lang, elapsed, subjectName, tasks, selectedTaskId, onSelectTask,
    active, running, paused, busy, onStart, onPause, onResume, onEnd,
  } = props;
  const ar = lang === "ar";
  const stageRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (stage.requestFullscreen) await stage.requestFullscreen();
    } catch {
      // Fullscreen can be unavailable or blocked; the focus session remains usable.
    }
  }

  return (
    <section className={"focus-universe" + (active ? " is-active" : "")} ref={stageRef} aria-label={ar ? "مساحة التركيز" : "Focus space"}>
      <div className="focus-cosmos" aria-hidden="true">
        <div className="focus-nebula focus-nebula-cyan" />
        <div className="focus-nebula focus-nebula-violet" />
        <div className="focus-starfield focus-starfield-a" />
        <div className="focus-starfield focus-starfield-b" />
        <div className="focus-dust focus-dust-a" />
        <div className="focus-dust focus-dust-b" />
        <div className="focus-black-hole">
          <div className="black-hole-aura" />
          <div className="black-hole-disk black-hole-disk-back" />
          <div className="black-hole-core" />
          <div className="black-hole-disk black-hole-disk-front" />
          <div className="black-hole-photon-ring" />
        </div>
      </div>
      <div className="focus-universe-content">
        <header className="focus-universe-header">
          <span className="focus-brand-mark">AZ <i /> FOCUS</span>
          {!active && (
            <label className="focus-task-picker">
              <span>{ar ? "ماذا ستنجز؟" : "What are you working on?"}</span>
              <select value={selectedTaskId} onChange={event => onSelectTask(event.target.value)}>
                <option value="">{ar ? "جلسة حرة" : "Free session"}</option>
                {tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
          )}
        </header>
        <div className="focus-timer-stage">
          <div className="focus-timer-display" role="timer" aria-live="off">{formatElapsed(elapsed)}</div>
          <div className="focus-subject-name">{subjectName}</div>
          {active && paused && <div className="focus-paused-label">{ar ? "الجلسة متوقفة مؤقتاً" : "Session paused"}</div>}
        </div>
        <footer className="focus-universe-controls">
          {!active ? (
            <button type="button" className="focus-control focus-control-primary" onClick={onStart}>
              {ar ? "ابدأ التركيز" : "Start focus"}
            </button>
          ) : (
            <>
              {running ? (
                <button type="button" className="focus-control" onClick={onPause} disabled={busy}>
                  {ar ? "إيقاف مؤقت" : "Pause"}
                </button>
              ) : (
                <button type="button" className="focus-control focus-control-primary" onClick={onResume} disabled={busy}>
                  {ar ? "استئناف" : "Resume"}
                </button>
              )}
              <button type="button" className="focus-control focus-control-end" onClick={onEnd} disabled={busy}>
                {busy ? (ar ? "جارٍ الحفظ..." : "Saving...") : (ar ? "إنهاء الجلسة" : "End session")}
              </button>
            </>
          )}
          <button type="button" className="focus-control focus-control-fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? (ar ? "الخروج من ملء الشاشة" : "Exit fullscreen") : (ar ? "ملء الشاشة" : "Fullscreen")}>
            <span aria-hidden="true">{fullscreen ? "⛶" : "⛶"}</span>
            {ar ? (fullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة") : (fullscreen ? "Exit fullscreen" : "Fullscreen")}
          </button>
        </footer>
      </div>
    </section>
  );
}
