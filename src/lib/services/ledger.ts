import { eq, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { creditTransactions, users } from "@/db/schema";

export type TxType =
  | "signup_grant"
  | "topup"
  | "booking_hold"
  | "booking_release"
  | "booking_refund"
  | "platform_fee"
  | "post_click"
  | "withdrawal";

export type LedgerEntry = {
  userId: string;
  type: TxType;
  amount: number; // signed; negative = debit
  bookingId?: string | null;
  postId?: string | null;
  note?: string | null;
  createdAt?: Date;
};

/** The only way credits move: insert the ledger row and bump the cached balance in the same transaction. */
export function postTx(tx: Tx | Db, entry: LedgerEntry): void {
  tx.insert(creditTransactions)
    .values({
      userId: entry.userId,
      type: entry.type,
      amount: entry.amount,
      bookingId: entry.bookingId ?? null,
      postId: entry.postId ?? null,
      note: entry.note ?? null,
      ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
    })
    .run();
  tx.update(users)
    .set({ creditBalance: sql`${users.creditBalance} + ${entry.amount}` })
    .where(eq(users.id, entry.userId))
    .run();
}

let platformUserId: string | null = null;

export function getPlatformUserId(tx: Tx | Db): string {
  if (platformUserId) return platformUserId;
  const row = tx.select({ id: users.id }).from(users).where(eq(users.isPlatform, true)).get();
  if (!row) throw new Error("platform user missing; run npm run db:seed");
  platformUserId = row.id;
  return platformUserId;
}

export class InsufficientCredits extends Error {
  constructor(public needed: number, public balance: number) {
    super(`insufficient credits: need ${needed}, have ${balance}`);
  }
}

export function assertBalance(tx: Tx | Db, userId: string, needed: number): number {
  const row = tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, userId)).get();
  const balance = row?.balance ?? 0;
  if (balance < needed) throw new InsufficientCredits(needed, balance);
  return balance;
}
