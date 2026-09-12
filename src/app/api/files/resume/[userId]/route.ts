import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { currentUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { userId } = await params;
  const profile = db.select({ resumePath: schema.specialistProfiles.resumePath }).from(schema.specialistProfiles).where(eq(schema.specialistProfiles.userId, userId)).get();
  if (!profile?.resumePath) return new Response("Not found", { status: 404 });
  // resumePath is server-generated (`uploads/<userId>.pdf`), never user input.
  const file = path.join(process.cwd(), profile.resumePath);
  try {
    const { size } = await stat(file);
    const data = await readFile(file);
    return new Response(data, {
      headers: { "Content-Type": "application/pdf", "Content-Length": String(size), "Content-Disposition": `inline; filename="resume-${userId}.pdf"` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
