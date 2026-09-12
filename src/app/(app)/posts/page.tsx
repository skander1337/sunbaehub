import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate } from "@/lib/seoul";
import { IconCheck } from "@/components/icons";

export default async function PostsPage() {
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const rows = db
    .select({ p: schema.posts, author: schema.users.name, verification: schema.specialistProfiles.verification })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .leftJoin(schema.specialistProfiles, eq(schema.specialistProfiles.userId, schema.posts.authorId))
    .orderBy(desc(schema.posts.createdAt))
    .all();
  const canPost = !!user && user.isSpecialist;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{t("posts.title")}</h1>
          <p className="muted mt-2 max-w-[60ch] text-[15px]">{t("posts.sub")}</p>
        </div>
        {canPost && (
          <Link href="/specialist/posts/new" className="btn btn-sm btn-primary">
            {t("posts.new")}
          </Link>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="panel mt-8 p-10 text-center text-[15px] text-ink-2">{t("posts.empty")}</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {rows.map(({ p, author, verification }) => (
            <li key={p.id}>
              <Link href={`/posts/${p.id}`} className="group block py-5">
                <div className="text-[19px] font-bold tracking-[-0.01em] group-hover:text-brand-deep">{p.title}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-2">
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    {t("posts.by", { name: author })}
                    {verification === "verified" && <IconCheck size={14} strokeWidth={2.5} className="text-brand" />}
                  </span>
                  <span className="text-ink-3">·</span>
                  <span className="tnum">{fmtDate(p.createdAt, locale)}</span>
                  <span className="text-ink-3">·</span>
                  <span className="tnum">{t("posts.clicks", { n: p.clickCount })}</span>
                </div>
                <p className="muted mt-2 line-clamp-2 max-w-[70ch] text-[14.5px] leading-relaxed">{p.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
