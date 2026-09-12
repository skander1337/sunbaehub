import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { BRAND } from "@/lib/brand";
import { fmtDateTime } from "@/lib/seoul";
import { topUp } from "@/app/actions/credits";
import { FormError } from "@/components/FormError";
import { Notice } from "@/components/Notice";
import type { DictKey } from "@/lib/i18n/dictionary";

export default async function CreditsPage({ searchParams }: { searchParams: Promise<{ topped?: string; error?: string }> }) {
  const sp = await searchParams;
  const [user, { t, locale }] = await Promise.all([requireUser("/me/credits"), getT()]);
  const txs = db.select().from(schema.creditTransactions).where(eq(schema.creditTransactions.userId, user.id)).orderBy(desc(schema.creditTransactions.createdAt)).limit(100).all();
  const packs = [100, 300, 1000];
  const methods = [
    { id: "kakao", label: t("credits.method.kakao") },
    { id: "toss", label: t("credits.method.toss") },
    { id: "card", label: t("credits.method.card") },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="h1">{t("credits.title")}</h1>
      <div className="mt-6">
        {sp.topped && <Notice>{t("credits.toppedUp", { n: Number(sp.topped).toLocaleString() })}</Notice>}
        <FormError code={sp.error} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <div className="rounded-[16px] bg-brand p-6 text-white">
          <div className="text-[13px] font-semibold text-white/75">{t("credits.balance")}</div>
          <div className="tnum mt-2 text-[40px] leading-none font-extrabold tracking-[-0.03em]">{user.creditBalance.toLocaleString()}</div>
          <div className="tnum mt-2 text-[13px] text-white/75">
            {t("common.credits")} · ≈ ₩{(user.creditBalance * BRAND.creditsToWon).toLocaleString()}
          </div>
        </div>
        <form action={topUp} className="card p-6">
          <div className="text-[15px] font-bold">{t("credits.topup")}</div>
          <p className="muted mt-1 text-[13px]">{t("credits.topupSub")}</p>
          <fieldset className="mt-4">
            <legend className="sr-only">{t("credits.topup")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {packs.map((n, i) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="amount" value={n} defaultChecked={i === 1} className="peer sr-only" />
                  <span className="tnum block rounded-[12px] border border-line px-3 py-3 text-center text-[15px] font-bold transition-colors duration-150 peer-checked:border-brand peer-checked:bg-brand-tint peer-checked:text-brand-deep peer-focus-visible:outline-2 peer-focus-visible:outline-brand hover:border-brand">
                    {t("credits.pack", { n: n.toLocaleString() })}
                    <span className="block text-[12px] font-medium text-ink-3">≈ ₩{(n * BRAND.creditsToWon).toLocaleString()}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-[13px] font-semibold text-ink-3">{t("credits.method")}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {methods.map((m, i) => (
                <label key={m.id} className="cursor-pointer">
                  <input type="radio" name="method" value={m.id} defaultChecked={i === 0} className="peer sr-only" />
                  <span className="block rounded-[10px] bg-mist px-3.5 py-2 text-[14px] font-semibold transition-colors duration-150 peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-brand">
                    {m.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn btn-primary mt-5 w-full">
            {t("credits.topupBtn")}
          </button>
        </form>
      </div>

      <section className="mt-10">
        <h2 className="h3">{t("credits.history")}</h2>
        {txs.length === 0 ? (
          <p className="panel mt-3 p-8 text-center text-[14.5px] text-ink-2">{t("credits.emptyHistory")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {txs.map((x) => {
              const key = `tx.${x.type}` as DictKey;
              return (
                <li key={x.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[14.5px] font-semibold">{t(key)}</div>
                    <div className="muted truncate text-[13px]">
                      {x.note} · <span className="tnum">{fmtDateTime(x.createdAt, locale)}</span>
                    </div>
                  </div>
                  <div className={`tnum shrink-0 text-[15px] font-bold ${x.amount < 0 ? "text-ink" : "text-success"}`}>
                    {x.amount > 0 ? "+" : ""}
                    {x.amount.toLocaleString()}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
