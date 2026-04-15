import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  getLearner,
  markVocabUnknown,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";

interface Body {
  session_id?: string;
  user_message?: string;
  at_sec?: number;
}

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const sessionId = body?.session_id;
  const userMessage = body?.user_message?.trim();
  const atSec = Number(body?.at_sec ?? 0);
  if (!sessionId || !userMessage) {
    return Response.json(
      { error: "session_id and user_message required" },
      { status: 400 }
    );
  }

  const { data: session } = await supabase
    .from("alongside_sessions")
    .select("id, user_id, target_language")
    .eq("id", sessionId)
    .single();
  if (!session || session.user_id !== userId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const windowLow = Math.max(0, atSec - 30);
  const windowHigh = atSec + 5;
  const { data: context } = await supabase
    .from("alongside_segments")
    .select("start_sec, end_sec, text, speaker")
    .eq("session_id", sessionId)
    .gte("end_sec", windowLow)
    .lte("start_sec", windowHigh)
    .order("start_sec", { ascending: true });

  const transcriptBlock = (context ?? [])
    .map(
      (s) =>
        `[${Number(s.start_sec).toFixed(1)}s${s.speaker ? ` ${s.speaker}` : ""}] ${s.text}`
    )
    .join("\n");

  const targetLanguage = session.target_language ?? "their target language";
  const prompt = `You are a language tutor helping a learner who is listening to audio in ${targetLanguage}.
Recent transcript around ${atSec.toFixed(1)}s (last ~30s):
${transcriptBlock || "(no transcript context available)"}

Learner asks: ${userMessage}

Reply concisely and warmly. If you reference a word the learner likely doesn't know, wrap it as <unknown>word</unknown> so we can save it for review. Do not use <unknown> on words they clearly know from the question itself.`;

  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  if (!apiKey)
    return Response.json(
      { error: "LLM_API_KEY not configured" },
      { status: 500 }
    );

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) {
    return Response.json(
      { error: `gemini: ${await res.text()}` },
      { status: 502 }
    );
  }
  const data = await res.json();
  const rawReply: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const vocabMatches = Array.from(
    rawReply.matchAll(/<unknown>([^<]+)<\/unknown>/g)
  );
  const vocabSaved = Array.from(
    new Set(vocabMatches.map((m) => m[1].trim()).filter(Boolean))
  );

  // Wire markVocabUnknown via the active learner for this user.
  if (vocabSaved.length > 0) {
    try {
      const learner = await getLearner(
        getActiveLearnerIdFromRequest(req),
        userId
      );
      if (learner) {
        for (const word of vocabSaved) {
          try {
            await markVocabUnknown(learner.id, word);
          } catch {
            // one failing word must not abort the whole reply
          }
        }
      }
    } catch {
      // SRS wire-up is best-effort; continue regardless
    }
  }

  await supabase.from("alongside_interactions").insert({
    session_id: sessionId,
    at_sec: atSec,
    user_message: userMessage,
    tutor_reply: rawReply,
    vocab_saved: vocabSaved,
  });

  const cleanReply = rawReply.replace(/<\/?unknown>/g, "");
  return Response.json({ reply: cleanReply, vocab_saved: vocabSaved });
}
