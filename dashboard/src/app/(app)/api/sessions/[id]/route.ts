import { getSession, getSessionTurns } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const turns = await getSessionTurns(id);
  return Response.json({ session, turns });
}
