import { getLearner, getInterests, upsertInterest, deleteInterest, getActiveLearnerIdFromRequest } from "@/lib/db";

export async function GET(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const interests = getInterests(learner.id);
  return Response.json(interests);
}

export async function POST(request: Request) {
  const learner = getLearner(getActiveLearnerIdFromRequest(request));
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const body = await request.json();

  // Bulk upsert from interest detection
  if (Array.isArray(body.interests)) {
    for (const i of body.interests) {
      if (i.name && i.category) {
        upsertInterest(
          learner.id,
          i.category,
          i.name,
          i.details || null,
          i.source || "detected",
          i.confidence ?? 0.7
        );
      }
    }
    return Response.json({ ok: true });
  }

  // Single add
  if (body.name && body.category) {
    upsertInterest(
      learner.id,
      body.category,
      body.name,
      body.details || null,
      body.source || "manual",
      body.confidence ?? 1.0
    );
    return Response.json({ ok: true });
  }

  return Response.json({ error: "name and category required" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  deleteInterest(id);
  return Response.json({ ok: true });
}
