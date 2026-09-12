import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireSpecialist } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { BRAND } from "@/lib/brand";
import { fmtDateTime } from "@/lib/seoul";
import { getSpecialistCard } from "@/lib/queries/specialists";
import { requestWithdrawal } from "@/app/actions/specialist";
import { FormError } from "@/components/FormError";
import { Notice } from "@/components/Notice";

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ requested?: string; error?: string }> }) {
  const sp = await searchParams;
  const [{ user }, { t, locale }] = await Promise.all([requireSpecialist(), getT()]);
  const sum = (types: string[]) =>
    Number(
      db
        .select({ s: sql<number>`coalesce(sum(${schema.creditTransactions.amount}), 0)` })
        .from(schema.creditTransactions)
        .where(and(eq(schema.creditTransactions.userId, user.id), inArray(schema.creditTransactions.type, types)))
        .get()?.s ?? 0,
    );
  const fromSessions = sum(["booking_release"]);
  const fromClicks = sum(["post_click"]);
  const withdrawals = db.select().from(schema.withdrawalRequests).where(eq(schema.withdrawalRequests.userId, user.id)).orderBy(desc(schema.withdrawalRequests.createdAt)).all();
  const pending = withdrawals.filter((w) => w.status === "pending");
  const card = getSpecialistCard(user.id)!;
  const stat = (label: string, value: number) => (
    <div className="card p-5">
      <div className="text-[12.5px] font-semibold text-ink-3">{label}</div>
      <div className="tnum mt-1 text-[24px] font-extrabold tracking-[-0.02em]">{value.toLocaleString()}</div>
      <div className="tnum text-[12px] text-ink-3">≈ ₩{(value * BRAND.creditsToWon).toLocaleString()}</div>
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">{t("sp.earn.title")}</h1>
      <div className="mt-6">
        {sp.requested && <Notice>{t("sp.earn.requested")}</Notice>}
        <FormError code={sp.error} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stat(t("sp.earn.sessions"), fromSessions)}
        {stat(t("sp.earn.clicks"), fromClicks)}
        {stat(t("sp.earn.total"), fromSessions + fromClicks)}
      </div>
      <p className="mt-3 text-[13px] text-ink-3">{t("sp.earn.ratioHint", { n: Math.round(card.pricing.price * 0.95) })}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <div className="rounded-[16px] bg-brand p-6 text-white">
          <div className="text-[13px] font-semibold text-white/75">{t("dash.balance")}</div>
          <div className="tnum mt-2 text-[36px] leading-none font-extrabold tracking-[-0.03em]">{user.creditBalance.toLocaleString()}</div>
          <div className="tnum mt-2 text-[13px] text-white/75">≈ ₩{(user.creditBalance * BRAND.creditsToWon).toLocaleString()}</div>
          {pending.length > 0 && (
            <div className="tnum mt-4 border-t border-white/20 pt-3 text-[13px] text-white/85">
              {t("sp.earn.pending")}: {pending.reduce((a, w) => a + w.amount, 0).toLocaleString()}
            </div>
          )}
        </div>
        <form action={requestWithdrawal} className="card p-6">
          <div className="text-[15px] font-bold">{t("sp.earn.withdraw")}</div>
          <p className="muted mt-1 text-[13px]">{t("sp.earn.withdrawSub")}</p>
          <label htmlFor="amount" className="mt-4 block text-[13px] font-semibold text-ink-3">{t("sp.earn.amount")}</label>
          <input id="amount" name="amount" type="number" min={100} max={user.creditBalance} step={10} defaultValue={Math.min(500, user.creditBalance)} required className="field tnum mt-1.5" />
          <label htmlFor="bankInfo" className="mt-3 block text-[13px] font-semibold text-ink-3">{t("sp.earn.bank")}</label>
          <input id="bankInfo" name="bankInfo" required minLength={4} placeholder={t("sp.earn.bankPh")} className="field mt-1.5" />
          <button type="submit" disabled={user.creditBalance < 100} className="btn btn-primary mt-5 w-full">{t("sp.earn.submit")}</button>
        </form>
      </div>

      {withdrawals.length > 0 && (
        <section className="mt-10">
          <h2 className="h3">{t("sp.earn.history")}</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {withdrawals.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-3 text-[14px]">
                <div>
                  <span className={`tag ${w.status === "paid" ? "tag-success" : w.status === "pending" ? "tag-warn" : "tag-neutral"}`}>{w.status}</span>
                  <span className="ml-2 text-ink-2">{w.bankInfo}</span>
                  <span className="tnum ml-2 text-ink-3">{fmtDateTime(w.createdAt, locale)}</span>
                </div>
                <span className="tnum font-bold">{t("common.creditsN", { n: w.amount.toLocaleString() })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
