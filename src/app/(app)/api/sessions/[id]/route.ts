import { getSession, getSessionTurns, deleteSession, getLearner, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner" }, { status: 400 });

  const { id } = await params;
  const session = await getSession(id);
  if (!session || session.learner_id !== learner.id) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  const turns = await getSessionTurns(id);
  return Response.json({ session, turns });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId);
  if (!learner) return Response.json({ error: "No learner" }, { status: 400 });

  const { id } = await params;
  const ok = await deleteSession(id, learner.id);
  if (!ok) return Response.json({ error: "Not found or forbidden" }, { status: 404 });
  return Response.json({ ok: true });
}
