import { getLearner, getInterests, upsertInterest, deleteInterest, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const interests = await getInterests(learner.id);
  return Response.json(interests);
}

export async function POST(request: Request) {
  const userId2 = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId2 ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const body = await request.json();

  const sanitizeFacts = (f: unknown): string[] =>
    Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];

  // Bulk upsert from interest detection
  if (Array.isArray(body.interests)) {
    for (const i of body.interests) {
      if (i.name && i.category) {
        await upsertInterest(
          learner.id,
          i.category,
          i.name,
          i.details || null,
          i.source || "detected",
          i.confidence ?? 0.7,
          sanitizeFacts(i.facts)
        );
      }
    }
    return Response.json({ ok: true });
  }

  // Single add
  if (body.name && body.category) {
    await upsertInterest(
      learner.id,
      body.category,
      body.name,
      body.details || null,
      body.source || "manual",
      body.confidence ?? 1.0,
      sanitizeFacts(body.facts)
    );
    return Response.json({ ok: true });
  }

  return Response.json({ error: "name and category required" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  await deleteInterest(id);
  return Response.json({ ok: true });
}
