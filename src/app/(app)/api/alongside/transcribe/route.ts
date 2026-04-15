import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { session_id?: string } | null;
  const sessionId = body?.session_id;
  if (!sessionId || typeof sessionId !== "string") {
    return Response.json({ error: "session_id required" }, { status: 400 });
  }

  const { data: session, error: sessErr } = await supabase
    .from("alongside_sessions")
    .select("id, user_id, audio_storage_path, target_language")
    .eq("id", sessionId)
    .single();
  if (sessErr || !session) return Response.json({ error: "not found" }, { status: 404 });
  if (session.user_id !== userId) return Response.json({ error: "not found" }, { status: 404 });
  if (!session.audio_storage_path) {
    return Response.json({ error: "audio unavailable (session ended)" }, { status: 410 });
  }

  const { count: existingCount } = await supabase
    .from("alongside_segments")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  if ((existingCount ?? 0) > 0) {
    return Response.json({ status: "already_transcribed", count: existingCount });
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from("media")
    .download(session.audio_storage_path);
  if (dlErr || !blob) {
    return Response.json({ error: dlErr?.message ?? "download failed" }, { status: 500 });
  }
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = blob.type || "audio/mpeg";

  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gemini-2.5-flash";
  if (!apiKey) return Response.json({ error: "LLM_API_KEY not configured" }, { status: 500 });

  const prompt = buildPrompt(session.target_language ?? "");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    return Response.json({ error: `gemini: ${await res.text()}` }, { status: 502 });
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";

  let segments: Segment[];
  try {
    const parsed = JSON.parse(raw);
    segments = Array.isArray(parsed) ? parsed : (parsed.segments ?? []);
  } catch {
    return Response.json({ error: "bad transcript json", raw }, { status: 502 });
  }
  if (!Array.isArray(segments) || segments.length === 0) {
    return Response.json({ error: "no segments returned" }, { status: 502 });
  }

  const rows = segments
    .filter((s) => typeof s.text === "string" && s.text.trim() !== "")
    .map((s) => ({
      session_id: sessionId,
      start_sec: Number.isFinite(Number(s.start)) ? Number(s.start) : 0,
      end_sec: Number.isFinite(Number(s.end)) ? Number(s.end) : 0,
      text: String(s.text).trim(),
      speaker: s.speaker ?? null,
    }));

  if (rows.length === 0) {
    return Response.json({ error: "all segments empty" }, { status: 502 });
  }

  const { error: insErr } = await supabase.from("alongside_segments").insert(rows);
  if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

  const duration = rows[rows.length - 1].end_sec;
  await supabase
    .from("alongside_sessions")
    .update({ duration_sec: duration })
    .eq("id", sessionId);

  return Response.json({ status: "ok", count: rows.length });
}

function buildPrompt(language: string): string {
  const langHint = language
    ? `The audio is in ${language}. Use natural orthography for that language.`
    : "Detect the language automatically and use natural orthography.";
  return `Transcribe this audio with timestamps. Return ONLY a JSON array like:
[{"start":0.0,"end":3.2,"text":"...","speaker":"A"}]
Rules:
- start and end are seconds (floats, precision 0.1s)
- Segment on natural sentence or clause boundaries (3-12 seconds each)
- If multiple speakers, label "A", "B", etc. Otherwise omit the speaker field.
- No translation, no romanization, no markdown.
- ${langHint}`;
}
