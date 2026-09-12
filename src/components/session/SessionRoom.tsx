"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { IconPaperclip, IconPhone, IconSend } from "@/components/icons";
import type { WireMessage } from "@/lib/services/chat";

export type ChatMessage = WireMessage;

type Props = {
  bookingId: string;
  meId: string;
  otherName: string;
  otherInitial: string;
  initialMessages: ChatMessage[];
  canSend: boolean;
  uploadAllowed: boolean;
  phase: "early" | "open" | "closed";
  startAt: string;
  endAt: string;
};

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function SessionRoom(p: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(p.initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState(false);
  const [typingName, setTypingName] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTypingSent = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const phaseRef = useRef(p.phase);
  const lastIdRef = useRef<string | null>(p.initialMessages.at(-1)?.id ?? null);

  const append = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh];
      lastIdRef.current = next[next.length - 1].id;
      return next;
    });
  }, []);

  // wall clock + phase transitions
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const start = new Date(p.startAt).getTime() - 5 * 60_000;
    const end = new Date(p.endAt).getTime() + 5 * 60_000;
    const phase = now < start ? "early" : now > end ? "closed" : "open";
    if (phase !== phaseRef.current) {
      phaseRef.current = phase;
      router.refresh();
    }
  }, [now, p.startAt, p.endAt, router]);

  // live stream (SSE) with polling fallback
  useEffect(() => {
    if (p.phase === "closed") return;
    const es = new EventSource(`/api/bookings/${p.bookingId}/stream`);
    es.addEventListener("hello", () => setLive(true));
    es.addEventListener("message", (e) => append([JSON.parse((e as MessageEvent).data) as ChatMessage]));
    es.addEventListener("typing", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { userId: string; name: string };
      if (d.userId === p.meId) return;
      setTypingName(d.name);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(null), 3000);
    });
    es.addEventListener("status", () => router.refresh());
    es.onerror = () => setLive(false);
    return () => {
      es.close();
      clearTimeout(typingTimer.current);
    };
  }, [p.bookingId, p.meId, p.phase, append, router]);

  const poll = useCallback(async () => {
    try {
      const after = lastIdRef.current;
      const res = await fetch(`/api/bookings/${p.bookingId}/messages${after ? `?after=${after}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[]; status: string };
      append(data.messages);
      if (data.status === "completed" || data.status === "cancelled") router.refresh();
    } catch {
      /* transient */
    }
  }, [p.bookingId, append, router]);
  useEffect(() => {
    if (p.phase === "closed") return;
    const iv = setInterval(poll, live ? 15_000 : 2_500);
    return () => clearInterval(iv);
  }, [poll, p.phase, live]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, typingName]);

  function onType(v: string) {
    setText(v);
    const t0 = Date.now();
    if (p.canSend && v.trim() && t0 - lastTypingSent.current > 2500) {
      lastTypingSent.current = t0;
      fetch(`/api/bookings/${p.bookingId}/typing`, { method: "POST" }).catch(() => {});
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings/${p.bookingId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: body }) });
      const data = (await res.json()) as { message?: ChatMessage; error?: string };
      if (!res.ok || !data.message) {
        const key = `session.blocked.${data.error ?? "status"}` as Parameters<typeof t>[0];
        setErr(t(key) === key ? t("error.generic") : t(key));
        if (res.status === 403) router.refresh();
        return;
      }
      append([data.message]);
      setText("");
    } catch {
      setErr(t("error.generic"));
    } finally {
      setSending(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/bookings/${p.bookingId}/files`, { method: "POST", body: fd });
      const data = (await res.json()) as { message?: ChatMessage; error?: string };
      if (!res.ok || !data.message) {
        const key = (data.error === "file_type" || data.error === "file_size" ? `error.${data.error}` : "error.generic") as Parameters<typeof t>[0];
        setErr(t(key));
        return;
      }
      append([data.message]);
    } catch {
      setErr(t("error.generic"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const startMs = new Date(p.startAt).getTime();
  const endMs = new Date(p.endAt).getTime();
  const clock = p.phase === "early" ? { label: t("session.startsIn"), value: fmtClock(startMs - now) } : { label: t("session.endsIn"), value: fmtClock(endMs - now) };
  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });

  return (
    <div className="card flex h-[min(72vh,760px)] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-bold text-brand">{p.otherInitial}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[15px] font-bold">
              {p.otherName}
              {p.phase !== "closed" && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${live ? "text-success" : "text-ink-3"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success" : "bg-ink-3"}`} />
                  {live ? t("chat.live") : t("chat.reconnecting")}
                </span>
              )}
            </div>
            <div className="truncate text-[12px] text-ink-3">{t("session.translationHint")}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {p.phase !== "closed" && (
            <div className="tnum rounded-[10px] bg-mist px-2.5 py-1.5 text-right sm:px-3">
              <div className="text-[10px] font-semibold text-ink-3 uppercase">{clock.label}</div>
              <div className="text-[15px] leading-tight font-extrabold">{clock.value}</div>
            </div>
          )}
          {p.phase === "open" && (
            <button
              type="button"
              onClick={() => {
                setInCall((v) => !v);
                setCallStart((v) => (v ? null : Date.now()));
              }}
              className={`btn btn-sm ${inCall ? "btn-danger" : "btn-outline"}`}
            >
              <IconPhone size={16} />
              <span className="hidden sm:inline">{inCall ? t("session.hangup") : t("session.call")}</span>
            </button>
          )}
        </div>
      </div>

      {p.phase === "open" && inCall && (
        <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-[14px] font-semibold">
              {t("session.inCall")} · <span className="tnum">{fmtClock(now - (callStart ?? now))}</span>
            </span>
            <span className="hidden text-[12.5px] text-white/60 sm:inline">{t("session.callDemo")}</span>
          </div>
          <button type="button" onClick={() => setMuted((m) => !m)} className="btn btn-sm btn-outline-on-brand">
            {muted ? t("session.unmute") : t("session.mute")}
          </button>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper px-3 py-4 sm:px-4">
        {messages.length === 0 && <p className="py-10 text-center text-[14px] text-ink-3">{p.phase === "early" ? t("session.early") : t("session.noMessages")}</p>}
        {messages.map((m) => {
          const mine = m.senderId === p.meId;
          if (m.kind === "system") return <p key={m.id} className="text-center text-[12.5px] text-ink-3">{m.body}</p>;
          if (m.kind === "file" && m.attachment) {
            const a = m.attachment;
            const href = `/api/files/attachments/${a.id}`;
            const isImage = a.mime.startsWith("image/");
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                  <a href={href} target="_blank" rel="noreferrer" className={`block overflow-hidden rounded-[16px] border ${mine ? "rounded-br-[6px] border-brand/30 bg-brand-tint" : "rounded-bl-[6px] border-line bg-mist"}`}>
                    {isImage && <img src={href} alt={a.fileName} className="max-h-64 w-full object-cover" />}
                    <div className="flex items-center gap-3 px-3.5 py-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-paper text-[10px] font-bold text-ink-2 uppercase">{a.mime === "application/pdf" ? "PDF" : a.mime.split("/")[1]}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink">{a.fileName}</span>
                        <span className="tnum block text-[12px] text-ink-3">
                          {fmtSize(a.size)} · {t("chat.open")}
                        </span>
                      </span>
                    </div>
                  </a>
                  <div className="tnum mt-1 text-[11.5px] text-ink-3">{fmtTime(m.createdAt)}</div>
                </div>
              </div>
            );
          }
          const foreign = m.lang !== locale;
          const original = showOriginal.has(m.id);
          const showTranslated = foreign && m.translatedBody && !original;
          const body = showTranslated ? m.translatedBody! : m.body;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`rounded-[16px] px-4 py-2.5 text-[15px] leading-relaxed ${mine ? "rounded-br-[6px] bg-brand text-white" : "rounded-bl-[6px] bg-mist text-ink"}`}>{body}</div>
                <div className={`tnum mt-1 flex items-center gap-2 text-[11.5px] text-ink-3 ${mine ? "flex-row-reverse" : ""}`}>
                  <span>{fmtTime(m.createdAt)}</span>
                  {foreign && m.translatedBody && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowOriginal((s) => {
                          const n = new Set(s);
                          if (n.has(m.id)) n.delete(m.id);
                          else n.add(m.id);
                          return n;
                        })
                      }
                      className="font-semibold text-brand hover:underline"
                    >
                      {original ? t("common.showTranslation") : `${t("common.autoTranslated")} · ${t("common.showOriginal")}`}
                    </button>
                  )}
                  {foreign && !m.translatedBody && <span className="tag tag-neutral py-0 text-[10.5px]">{t("common.untranslated")}</span>}
                </div>
              </div>
            </div>
          );
        })}
        {typingName && (
          <div className="flex justify-start">
            <div className="rounded-[16px] rounded-bl-[6px] bg-mist px-4 py-2 text-[13px] text-ink-2">{t("chat.typing", { name: typingName })}</div>
          </div>
        )}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-2.5 sm:p-3">
        <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!p.uploadAllowed || uploading}
          className="btn btn-outline h-11 w-11 shrink-0 px-0"
          aria-label={t("chat.attach")}
          title={`${t("chat.attach")} · ${t("chat.attachHint")}`}
        >
          <IconPaperclip size={18} />
        </button>
        <input
          value={text}
          onChange={(e) => onType(e.target.value)}
          disabled={!p.canSend || sending}
          placeholder={uploading ? t("chat.uploading") : p.phase === "early" ? t("session.early") : p.phase === "closed" ? t("session.closed") : t("session.placeholder")}
          className="field h-11 min-w-0 flex-1"
          maxLength={2000}
          aria-label={t("session.placeholder")}
        />
        <button type="submit" disabled={!p.canSend || sending || !text.trim()} className="btn btn-primary h-11 shrink-0 px-4" aria-label={t("session.send")}>
          <IconSend size={18} />
        </button>
      </form>
      {err && (
        <p role="alert" className="border-t border-line bg-[#fdecec] px-4 py-2 text-[13px] font-medium text-danger">
          {err}
        </p>
      )}
    </div>
  );
}
