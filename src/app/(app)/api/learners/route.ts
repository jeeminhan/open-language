import { getAllLearners, createLearner } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import {
  isSupportedLanguagePair,
  unsupportedLanguagePairMessage,
} from "@/lib/supportedLanguage";

export async function GET() {
  const userId = await getAuthUserId();
  const learners = await getAllLearners(userId ?? undefined);
  return Response.json(
    learners.filter((learner) =>
      isSupportedLanguagePair(learner.native_language, learner.target_language)
    )
  );
}

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  const body = await request.json();
  const { name, nativeLanguage, targetLanguage, level, tolerance } = body;

  if (!name || !nativeLanguage || !targetLanguage) {
    return Response.json({ error: "name, nativeLanguage, targetLanguage required" }, { status: 400 });
  }

  if (!isSupportedLanguagePair(nativeLanguage, targetLanguage)) {
    return Response.json(
      { error: unsupportedLanguagePairMessage() },
      { status: 400 }
    );
  }

  try {
    const learner = await createLearner(
      name,
      nativeLanguage,
      targetLanguage,
      level || "A2",
      tolerance || "moderate",
      userId ?? undefined
    );
    return Response.json(learner);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
