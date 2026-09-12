import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { fmtDate } from "@/lib/seoul";
import { ClickTracker } from "@/components/ClickTracker";
import { Notice } from "@/components/Notice";
import { IconCheck } from "@/components/icons";

export default async function PostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ published?: string }> }) {
  const [{ id }, { published }] = await Promise.all([params, searchParams]);
  const [{ t, locale }, user] = await Promise.all([getT(), currentUser()]);
  const row = db
    .select({ p: schema.posts, author: schema.users, verification: schema.specialistProfiles.verification, headline: schema.specialistProfiles.headline })
    .from(schema.posts)
    .innerJoin(schema.users, eq(schema.users.id, schema.posts.authorId))
    .leftJoin(schema.specialistProfiles, eq(schema.specialistProfiles.userId, schema.posts.authorId))
    .where(eq(schema.posts.id, id))
    .get();
  if (!row) notFound();
  const { p, author, verification, headline } = row;
  return (
    <article className="mx-auto max-w-2xl">
      {published && <Notice>{t("posts.published")}</Notice>}
      <h1 className="text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-balance sm:text-[34px]">{p.title}</h1>
      <div className="mt-4 flex items-center gap-3 border-b border-line pb-5">
        <Link href={`/specialists/${author.id}`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[15px] font-bold text-brand">
          {author.name.slice(0, 1)}
        </Link>
        <div className="min-w-0 text-[14px]">
          <Link href={`/specialists/${author.id}`} className="flex items-center gap-1 font-bold hover:text-brand-deep">
            {author.name}
            {verification === "verified" && <IconCheck size={14} strokeWidth={2.5} className="text-brand" />}
          </Link>
          <div className="muted truncate">
            {headline} · <span className="tnum">{fmtDate(p.createdAt, locale)}</span> · <span className="tnum">{t("posts.clicks", { n: p.clickCount })}</span>
          </div>
        </div>
      </div>
      <div className="mt-6 max-w-[68ch] text-[16.5px] leading-[1.8] whitespace-pre-line text-ink">{p.body}</div>
      {user && user.id !== author.id && <ClickTracker postId={p.id} />}
    </article>
  );
}
