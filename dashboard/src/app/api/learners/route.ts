import { getAllLearners, createLearner } from "@/lib/db";

export async function GET() {
  const learners = getAllLearners();
  return Response.json(learners);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, nativeLanguage, targetLanguage, level, tolerance } = body;

  if (!name || !nativeLanguage || !targetLanguage) {
    return Response.json({ error: "name, nativeLanguage, targetLanguage required" }, { status: 400 });
  }

  const learner = createLearner(
    name,
    nativeLanguage,
    targetLanguage,
    level || "A2",
    tolerance || "moderate"
  );

  return Response.json(learner);
}
