import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { postClicks, posts, specialistProfiles } from "@/db/schema";
import { seoulDayKey } from "@/lib/seoul";
import { postTx } from "./ledger";

export function clickReward(authorId: string, viewerId: string, authorVerified: boolean): 0 | 1 {
  return viewerId !== authorId && authorVerified ? 1 : 0;
}

/** Records a unique (post, viewer, Seoul-day) click and pays the author 1 credit when eligible. */
export function recordClick(tx: Tx | Db, postId: string, viewerId: string, now: Date): { counted: boolean; rewarded: boolean } {
  const post = tx.select().from(posts).where(eq(posts.id, postId)).get();
  if (!post) return { counted: false, rewarded: false };
  const author = tx.select({ verification: specialistProfiles.verification }).from(specialistProfiles).where(eq(specialistProfiles.userId, post.authorId)).get();
  const dayKey = seoulDayKey(now);
  const res = tx.insert(postClicks).values({ postId, viewerId, dayKey, createdAt: now }).onConflictDoNothing().run();
  if (!res.changes) return { counted: false, rewarded: false };
  tx.update(posts).set({ clickCount: sql`${posts.clickCount} + 1` }).where(eq(posts.id, postId)).run();
  const reward = clickReward(post.authorId, viewerId, author?.verification === "verified");
  if (reward) postTx(tx, { userId: post.authorId, type: "post_click", amount: reward, postId, note: "글 클릭 적립", createdAt: now });
  return { counted: true, rewarded: reward === 1 };
}
