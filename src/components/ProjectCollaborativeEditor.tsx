import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";

type Language = "ar" | "en";
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";
type PresenceUser = { clientId: number; name: string; color: string };

type Props = {
  client: SupabaseClient | null;
  documentId: string;
  documentTitle: string;
  lang: Language;
  userId: string;
};

const collaborationEndpoint = import.meta.env.VITE_AZ_COLLABORATION_URL as string | undefined;

function colorForUser(userId: string): string {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) | 0;
  }
  const palette = ["#42d9ef", "#8b7cff", "#54d6a7", "#f2a65a", "#e879b8", "#7aa8ff"];
  return palette[Math.abs(hash) % palette.length];
}

function friendlyError(message: string, lang: Language): string {
  const ar = lang === "ar";
  const errors: Record<string, string> = {
    AUTH_REQUIRED: ar ? "سجّل الدخول للمتابعة." : "Sign in to continue.",
    AUTH_INVALID: ar ? "انتهت جلسة الدخول. سجّل الدخول مجدداً." : "Your session is no longer valid. Sign in again.",
    PROJECT_ACCESS_DENIED: ar ? "لم تعد تملك صلاحية الوصول إلى هذا المشروع." : "You no longer have access to this project.",
    DOCUMENT_NOT_FOUND: ar ? "المستند غير موجود أو لم تعد تملك صلاحية الوصول إليه." : "The document was not found or you no longer have access.",
    ORIGIN_DENIED: ar ? "هذا النطاق غير مسموح له بالاتصال بخدمة التعاون." : "This site is not allowed to connect to the collaboration service.",
    COLLABORATION_SECRET_NOT_CONFIGURED: ar ? "خدمة التعاون غير مكتملة الإعداد على الخادم." : "The collaboration service is not fully configured on the server.",
  };
  return errors[message] || message || (ar ? "تعذر الاتصال بالمستند المشترك." : "Could not connect to the shared document.");
}

export default function ProjectCollaborativeEditor({
  client,
  documentId,
  documentTitle,
  lang,
  userId,
}: Props) {
  const ar = lang === "ar";
  const documentState = useMemo(() => new Y.Doc(), [documentId]);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState((ar ? "عضو" : "Member") + " " + userId.slice(0, 4));
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const userColor = colorForUser(userId);

  useEffect(() => {
    let active = true;
    if (!client) return () => { active = false; };
    void client.from("profiles").select("display_name").eq("id", userId).maybeSingle()
      .then(({ data }) => {
        if (active && data?.display_name?.trim()) setUserName(data.display_name.trim());
      });
    return () => { active = false; };
  }, [client, userId]);

  useEffect(() => {
    let disposed = false;
    let activeProvider: HocuspocusProvider | null = null;
    let renewalTimer: number | undefined;
    let lastError = "";

    const endpoint = collaborationEndpoint?.trim();
    if (!client) {
      setConnectionStatus("error");
      setError(ar ? "تعذر الوصول إلى جلسة المستخدم." : "The signed-in user session is unavailable.");
      return;
    }
    if (!endpoint) {
      setConnectionStatus("error");
      setError(ar
        ? "لم يتم إعداد رابط خدمة التعاون. أضف VITE_AZ_COLLABORATION_URL إلى إعدادات البيئة."
        : "The collaboration service URL is not configured. Set VITE_AZ_COLLABORATION_URL in the environment.");
      return;
    }

    const endpointUrl = endpoint.replace(/\/$/, "");
    const socketUrl = new URL("/collab/" + documentId, endpointUrl);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";

    const scheduleRenewal = (expiresAt: number) => {
      if (renewalTimer !== undefined) window.clearTimeout(renewalTimer);
      const renewIn = Math.max(10_000, expiresAt * 1000 - Date.now() - 60_000);
      renewalTimer = window.setTimeout(() => {
        if (disposed || !activeProvider) return;
        // Re-authenticate before the short-lived ticket expires. The provider's
        // async token resolver obtains a fresh ticket on the next handshake.
        activeProvider.configuration.websocketProvider.disconnect();
        activeProvider.configuration.websocketProvider.connect();
      }, renewIn);
    };

    const resolveTicket = async (): Promise<string> => {
      lastError = "";
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError || !data.session?.access_token) throw new Error("AUTH_REQUIRED");
        const response = await fetch(new URL("/ticket", endpointUrl), {
          method: "POST",
          headers: {
            authorization: "Bearer " + data.session.access_token,
            "content-type": "application/json",
          },
          body: JSON.stringify({ documentId }),
        });
        const result = await response.json().catch(() => ({})) as { token?: string; expiresAt?: number; error?: string };
        if (!response.ok || !result.token || !result.expiresAt) {
          throw new Error(result.error || "TICKET_REQUEST_FAILED");
        }
        if (!disposed) scheduleRenewal(result.expiresAt);
        return result.token;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "TICKET_REQUEST_FAILED";
        lastError = message;
        if (!disposed) {
          setSynced(false);
          setConnectionStatus("error");
          setError(friendlyError(message, lang));
        }
        throw caught;
      }
    };

    setProvider(null);
    setSynced(false);
    setConnectionStatus("connecting");
    setError("");

    activeProvider = new HocuspocusProvider({
      url: socketUrl.toString(),
      name: documentId,
      document: documentState,
      token: resolveTicket,
      onStatus: ({ status }) => {
        if (disposed) return;
        setConnectionStatus(status);
        if (status !== "connected") setSynced(false);
      },
      onSynced: ({ state }) => {
        if (disposed) return;
        setSynced(state);
        if (state) setError("");
      },
      onAuthenticationFailed: ({ reason }) => {
        if (disposed) return;
        setSynced(false);
        setConnectionStatus("error");
        setError(friendlyError(lastError || reason, lang));
      },
      onClose: ({ event }) => {
        if (disposed || event.code === 1000) return;
        setSynced(false);
      },
    });
    activeProvider.setAwarenessField("user", { name: userName, color: userColor });
    setProvider(activeProvider);

    return () => {
      disposed = true;
      if (renewalTimer !== undefined) window.clearTimeout(renewalTimer);
      activeProvider?.destroy();
    };
  }, [client, documentId, documentState, lang, userColor, userName, ar]);

  useEffect(() => () => documentState.destroy(), [documentState]);

  useEffect(() => {
    if (!provider?.awareness) {
      setPresence([]);
      return;
    }
    const updatePresence = () => {
      const states = provider.awareness?.getStates();
      if (!states) return;
      const users: PresenceUser[] = [];
      for (const [clientId, state] of states.entries()) {
        const user = state.user as { name?: string; color?: string } | undefined;
        if (!user?.name) continue;
        users.push({ clientId, name: user.name, color: user.color || "#42d9ef" });
      }
      setPresence(users);
    };
    provider.awareness.on("change", updatePresence);
    updatePresence();
    return () => provider.awareness?.off("change", updatePresence);
  }, [provider]);

  useEffect(() => {
    provider?.setAwarenessField("user", { name: userName, color: userColor });
  }, [provider, userName, userColor]);

  const editor = useEditor({
    extensions: provider
      ? [
          StarterKit.configure({ undoRedo: false }),
          Collaboration.configure({ document: documentState }),
          CollaborationCaret.configure({
            provider,
            user: { name: userName, color: userColor },
          }),
        ]
      : [StarterKit.configure({ undoRedo: false })],
    editable: Boolean(provider && synced && connectionStatus === "connected"),
    editorProps: {
      attributes: {
        class: "project-editor-content",
        dir: "auto",
        lang,
        "aria-label": ar ? "مستند المشروع المشترك" : "Shared project document",
        "data-placeholder": ar ? "ابدأ الكتابة هنا..." : "Start writing here...",
      },
    },
  }, [provider, documentState, userName, userColor, lang]);

  useEffect(() => {
    editor?.setEditable(Boolean(provider && synced && connectionStatus === "connected"));
  }, [editor, provider, synced, connectionStatus]);

  const disabled = !editor || !synced || connectionStatus !== "connected";
  const statusLabel = connectionStatus === "error"
    ? (ar ? "تعذر الاتصال" : "Connection error")
    : connectionStatus === "connected" && synced
      ? (ar ? "متصل · تمت المزامنة" : "Connected · Synced")
      : connectionStatus === "connected"
        ? (ar ? "جارٍ مزامنة المستند" : "Syncing document")
        : connectionStatus === "disconnected"
          ? (ar ? "الاتصال منقطع" : "Disconnected")
          : (ar ? "جارٍ الاتصال" : "Connecting");

  const toolButton = (
    label: string,
    active: boolean,
    action: () => void,
    ariaLabel: string,
  ) => (
    <button
      type="button"
      className={"project-editor-tool" + (active ? " is-active" : "")}
      onClick={action}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      title={ariaLabel}
    >
      {label}
    </button>
  );

  return (
    <section className="content-panel project-collab-editor">
      <div className="project-collab-editor-heading">
        <div>
          <span className="eyebrow">{ar ? "مستند الفريق المشترك" : "SHARED TEAM DOCUMENT"}</span>
          <h3>{documentTitle}</h3>
        </div>
        <span className={"project-collab-status status-" + connectionStatus} role="status">
          <i />{statusLabel}
        </span>
      </div>

      <div className="project-collab-presence" aria-label={ar ? "الأعضاء المتصلون" : "Connected members"}>
        {presence.map((person) => (
          <span
            className="project-collab-presence-chip"
            key={person.clientId}
            title={person.name}
            style={{ "--presence-color": person.color } as CSSProperties}
          >
            <i />{person.name}
          </span>
        ))}
        {presence.length === 0 && <span className="muted">{ar ? "بانتظار أعضاء الفريق..." : "Waiting for teammates..."}</span>}
      </div>

      <div className="project-editor-toolbar" role="toolbar" aria-label={ar ? "أدوات تنسيق المستند" : "Document formatting"}>
        {toolButton("B", Boolean(editor?.isActive("bold")), () => editor?.chain().focus().toggleBold().run(), ar ? "عريض" : "Bold")}
        {toolButton("I", Boolean(editor?.isActive("italic")), () => editor?.chain().focus().toggleItalic().run(), ar ? "مائل" : "Italic")}
        {toolButton("H1", Boolean(editor?.isActive("heading", { level: 1 })), () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), ar ? "عنوان رئيسي" : "Heading 1")}
        {toolButton("H2", Boolean(editor?.isActive("heading", { level: 2 })), () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), ar ? "عنوان فرعي" : "Heading 2")}
        {toolButton("•", Boolean(editor?.isActive("bulletList")), () => editor?.chain().focus().toggleBulletList().run(), ar ? "قائمة نقطية" : "Bullet list")}
        {toolButton("1.", Boolean(editor?.isActive("orderedList")), () => editor?.chain().focus().toggleOrderedList().run(), ar ? "قائمة مرقمة" : "Numbered list")}
        {toolButton("❞", Boolean(editor?.isActive("blockquote")), () => editor?.chain().focus().toggleBlockquote().run(), ar ? "اقتباس" : "Quote")}
      </div>

      {error && <p className="feedback error-feedback project-editor-error">{error}</p>}
      {!provider && connectionStatus === "connecting" && <div className="project-editor-loading"><span className="skeleton-line skeleton-line-wide" /><span className="skeleton-line" /></div>}
      <div className={"project-editor-canvas" + (disabled ? " is-disabled" : "")}>
        {editor && provider && <EditorContent editor={editor} />}
        {!provider && connectionStatus === "error" && (
          <p className="project-editor-placeholder">{ar ? "لا يمكن فتح المستند حتى يتم إعداد خدمة التعاون." : "The document cannot open until the collaboration service is configured."}</p>
        )}
      </div>
      <p className="project-editor-footnote">
        {ar
          ? "تُحفظ التعديلات تلقائياً وتظهر لأعضاء المشروع المتصلين."
          : "Changes are saved automatically and shared with connected project members."}
      </p>
    </section>
  );
}
