import { getAllLearners, createLearner } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getAuthUserId();
  const learners = await getAllLearners(userId ?? undefined);
  return Response.json(learners);
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  const body = await request.json();
  const { name, nativeLanguage, targetLanguage, level, tolerance } = body;

  if (!name || !nativeLanguage || !targetLanguage) {
    return Response.json({ error: "name, nativeLanguage, targetLanguage required" }, { status: 400 });
  }

  const learner = await createLearner(
    name,
    nativeLanguage,
    targetLanguage,
    level || "A2",
    tolerance || "moderate",
    userId ?? undefined
  );

  return Response.json(learner);
}
