import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  getLearner,
  getActiveLearnerIdFromRequest,
} from "@/lib/db";

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(req: NextRequest): Promise<Response> {
  const userId = await getAuthUserId();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    return Response.json(
      { error: "multipart/form-data required" },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return Response.json({ error: "no audio file" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return Response.json({ error: "file too large (>100MB)" }, { status: 413 });
  }

  const type = file.type || "";
  if (!type.startsWith("audio/") && !type.startsWith("video/")) {
    return Response.json({ error: "unsupported file type" }, { status: 400 });
  }

  const safeName =
    file.name.replace(/[^\w.\-]/g, "_").slice(0, 120) || "audio.bin";
  const storagePath = `alongside/${userId}/${crypto.randomUUID()}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(storagePath, arrayBuffer, { contentType: type, upsert: false });

  if (upErr) {
    return Response.json(
      { error: `upload failed: ${upErr.message}` },
      { status: 500 }
    );
  }

  const learner = await getLearner(getActiveLearnerIdFromRequest(req), userId);

  const { data: session, error: sessErr } = await supabase
    .from("alongside_sessions")
    .insert({
      user_id: userId,
      source_type: "upload",
      audio_storage_path: storagePath,
      title: safeName,
      target_language: learner?.target_language ?? null,
    })
    .select("id")
    .single();

  if (sessErr || !session) {
    // best-effort cleanup
    await supabase.storage.from("media").remove([storagePath]);
    return Response.json(
      { error: sessErr?.message ?? "db insert failed" },
      { status: 500 }
    );
  }

  return Response.json({ session_id: session.id });
}
