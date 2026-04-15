import { NextRequest } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const userId = await getAuthUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: session } = await supabase
    .from("alongside_sessions")
    .select("id, user_id, title, duration_sec, source_type, audio_storage_path")
    .eq("id", id)
    .single();
  if (!session || session.user_id !== userId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const { data: segments } = await supabase
    .from("alongside_segments")
    .select("id, start_sec, end_sec, text, speaker")
    .eq("session_id", id)
    .order("start_sec", { ascending: true });

  let audio_url: string | null = null;
  if (session.audio_storage_path) {
    const { data: signed } = await supabase.storage
      .from("media")
      .createSignedUrl(session.audio_storage_path, 60 * 60);
    audio_url = signed?.signedUrl ?? null;
  }

  return Response.json({
    session: {
      id: session.id,
      title: session.title,
      duration_sec: session.duration_sec,
    },
    segments: segments ?? [],
    audio_url,
  });
}
