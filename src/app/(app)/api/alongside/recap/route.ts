import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Body {
  session_id?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const sessionId = body?.session_id;
  if (!sessionId) {
    return Response.json({ error: "session_id required" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("alongside_sessions")
    .select("id, user_id, title, duration_sec, audio_storage_path, completed_at")
    .eq("id", sessionId)
    .single();
  if (!session || session.user_id !== userId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { data: interactions } = await supabase
    .from("alongside_interactions")
    .select("user_message, tutor_reply, vocab_saved")
    .eq("session_id", sessionId)
    .order("at_sec", { ascending: true });

  const vocab = Array.from(
    new Set((interactions ?? []).flatMap((i) => i.vocab_saved ?? []))
  );

  let summary = "";

  if (session.completed_at) {
    // Don't re-bill Gemini; return minimal info.
    summary = "Session already completed.";
  } else {
    const qaBlock = (interactions ?? [])
      .map((i) => `Q: ${i.user_message ?? ""}\nA: ${i.tutor_reply ?? ""}`)
      .join("\n\n");

    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL || "gemini-2.5-flash";
    if (apiKey) {
      const prompt = `Summarize this listening session in 3-5 short bullets: what the learner covered, what they asked about, and one recommended next step. Keep it warm and concise.

Questions and replies:
${qaBlock || "(no questions asked this session)"}

New vocab saved: ${vocab.join(", ") || "(none)"}`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        summary =
          data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      }
    }
    if (!summary) {
      summary = "Session complete. No recap available.";
    }
  }

  // Best-effort: delete audio blob + null the path + set completed_at.
  if (session.audio_storage_path) {
    await supabase.storage
      .from("media")
      .remove([session.audio_storage_path])
      .catch(() => {});
  }
  await supabase
    .from("alongside_sessions")
    .update({
      completed_at: session.completed_at ?? new Date().toISOString(),
      audio_storage_path: null,
    })
    .eq("id", sessionId);

  return Response.json({
    summary,
    vocab,
    interaction_count: interactions?.length ?? 0,
  });
}
