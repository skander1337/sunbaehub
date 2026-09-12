"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { IconPhone, IconSend } from "@/components/icons";

export type ChatMessage = { id: string; senderId: string; kind: string; body: string; lang: string; translatedBody: string | null; createdAt: string };

type Props = {
  bookingId: string;
  meId: string;
  otherName: string;
  otherInitial: string;
  initialMessages: ChatMessage[];
  canSend: boolean;
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

export function SessionRoom(p: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(p.initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [inCall, setInCall] = useState(false);
  const [callStart, setCallStart] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : null;
  const phaseRef = useRef(p.phase);

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

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${p.bookingId}/messages${lastId ? `?after=${lastId}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: ChatMessage[]; status: string };
      if (data.messages.length) setMessages((prev) => [...prev, ...data.messages.filter((m) => !prev.some((x) => x.id === m.id))]);
      if (data.status === "completed" || data.status === "cancelled") router.refresh();
    } catch {
      /* transient */
    }
  }, [p.bookingId, lastId, router]);
  useEffect(() => {
    if (p.phase === "closed") return;
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, [poll, p.phase]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

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
      setMessages((prev) => [...prev, data.message!]);
      setText("");
    } catch {
      setErr(t("error.generic"));
    } finally {
      setSending(false);
    }
  }

  const startMs = new Date(p.startAt).getTime();
  const endMs = new Date(p.endAt).getTime();
  const clock = p.phase === "early" ? { label: t("session.startsIn"), value: fmtClock(startMs - now) } : { label: t("session.endsIn"), value: fmtClock(endMs - now) };

  return (
    <div className="card flex h-[min(72vh,760px)] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-bold text-brand">{p.otherInitial}</span>
          <div className="min-w-0">
            <div className="text-[15px] font-bold">{p.otherName}</div>
            <div className="truncate text-[12px] text-ink-3">{t("session.translationHint")}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {p.phase !== "closed" && (
            <div className="tnum rounded-[10px] bg-mist px-3 py-1.5 text-right">
              <div className="text-[10.5px] font-semibold text-ink-3 uppercase">{clock.label}</div>
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
              {inCall ? t("session.hangup") : t("session.call")}
            </button>
          )}
        </div>
      </div>

      {inCall && (
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

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-[14px] text-ink-3">{p.phase === "early" ? t("session.early") : t("session.noMessages")}</p>}
        {messages.map((m) => {
          const mine = m.senderId === p.meId;
          const foreign = m.lang !== locale;
          const original = showOriginal.has(m.id);
          const showTranslated = foreign && m.translatedBody && !original;
          const body = showTranslated ? m.translatedBody! : m.body;
          const time = new Date(m.createdAt).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" });
          if (m.kind === "system") return <p key={m.id} className="text-center text-[12.5px] text-ink-3">{m.body}</p>;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
                <div className={`rounded-[16px] px-4 py-2.5 text-[15px] leading-relaxed ${mine ? "rounded-br-[6px] bg-brand text-white" : "rounded-bl-[6px] bg-mist text-ink"}`}>{body}</div>
                <div className={`tnum mt-1 flex items-center gap-2 text-[11.5px] text-ink-3 ${mine ? "flex-row-reverse" : ""}`}>
                  <span>{time}</span>
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
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!p.canSend || sending}
          placeholder={p.phase === "early" ? t("session.early") : p.phase === "closed" ? t("session.closed") : t("session.placeholder")}
          className="field h-11 flex-1"
          maxLength={2000}
          aria-label={t("session.placeholder")}
        />
        <button type="submit" disabled={!p.canSend || sending || !text.trim()} className="btn btn-primary h-11 px-4" aria-label={t("session.send")}>
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
