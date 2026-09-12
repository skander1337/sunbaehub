import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDateTime } from "@/lib/seoul";
import type { DictKey } from "@/lib/i18n/dictionary";

export default async function NotificationsPage() {
  const [user, { t, locale }] = await Promise.all([requireUser("/me/notifications"), getT()]);
  const rows = db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(50).all();
  const unreadIds = new Set(rows.filter((n) => !n.readAt).map((n) => n.id));
  if (unreadIds.size) {
    db.update(schema.notifications).set({ readAt: new Date() }).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))).run();
  }
  const text = (n: typeof rows[number]) => {
    const params = (n.params ?? {}) as Record<string, string | number>;
    const status = params.status ? `.${params.status}` : "";
    const key = `notif.${n.kind}${status}` as DictKey;
    const out = t(key, params);
    return out === key ? t(`notif.${n.kind}` as DictKey, params) : out;
  };
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="h1">{t("notif.title")}</h1>
      {rows.length === 0 ? (
        <p className="panel mt-6 p-8 text-center text-[14.5px] text-ink-2">{t("notif.empty")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((n) => {
            const inner = (
              <>
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${unreadIds.has(n.id) ? "bg-brand" : "bg-transparent"}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[15px] ${unreadIds.has(n.id) ? "font-semibold" : "font-medium text-ink-2"}`}>{text(n)}</span>
                  <span className="tnum block text-[12.5px] text-ink-3">{fmtDateTime(n.createdAt, locale)}</span>
                </span>
              </>
            );
            return (
              <li key={n.id}>
                {n.href ? (
                  <Link href={n.href} className="flex gap-3 py-3.5 hover:bg-mist/60">{inner}</Link>
                ) : (
                  <div className="flex gap-3 py-3.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
