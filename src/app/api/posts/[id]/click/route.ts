import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { recordClick } from "@/lib/services/post";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ counted: false, rewarded: false, reason: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = db.transaction((tx) => recordClick(tx, id, user.id, new Date()));
  return Response.json(r);
}
