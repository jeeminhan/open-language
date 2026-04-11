import { getLearner, getVocabulary, markVocabUnknown, markVocabKnown, upsertVocabulary, getActiveLearnerIdFromRequest } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET(request: Request) {
  const userId = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(request), userId ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const vocab = await getVocabulary(learner.id);
  return Response.json(vocab);
}

export async function POST(req: Request) {
  const userId2 = await getAuthUserId();
  const learner = await getLearner(getActiveLearnerIdFromRequest(req), userId2 ?? undefined);
  if (!learner) {
    return Response.json({ error: "No learner found" }, { status: 404 });
  }

  const { word, action } = await req.json();
  if (!word || typeof word !== "string") {
    return Response.json({ error: "word required" }, { status: 400 });
  }

  if (action === "mark_known") {
    await markVocabKnown(learner.id, word);
  } else if (action === "add") {
    await upsertVocabulary(learner.id, word.trim().toLowerCase(), "target");
  } else {
    await markVocabUnknown(learner.id, word);
  }

  return Response.json({ ok: true });
}
