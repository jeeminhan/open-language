import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function isAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const admins = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return admins.includes(userId);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId();
  if (!isAdmin(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [learnerRes, sessionsRes, errorsRes, grammarRes, vocabRes] = await Promise.all([
    supabase.from("learners").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .eq("learner_id", id)
      .order("started_at", { ascending: false })
      .limit(50),
    supabase
      .from("error_patterns")
      .select("*")
      .eq("learner_id", id)
      .order("last_seen", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("grammar_inventory")
      .select("*")
      .eq("learner_id", id)
      .order("mastery_score", { ascending: false })
      .limit(50),
    supabase
      .from("vocabulary")
      .select("srs_state")
      .eq("learner_id", id),
  ]);

  if (!learnerRes.data) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const vocab = (vocabRes.data || []) as Array<{ srs_state: string | null }>;
  const vocabStats = {
    total: vocab.length,
    mastered: vocab.filter((v) => v.srs_state === "known").length,
    learning: vocab.filter((v) => v.srs_state === "learning" || v.srs_state === "reviewing").length,
    weak: vocab.filter((v) => !v.srs_state || v.srs_state === "seen").length,
  };

  const errorCategoryCounts: Record<string, number> = {};
  (errorsRes.data || []).forEach((e: { category: string }) => {
    errorCategoryCounts[e.category] = (errorCategoryCounts[e.category] || 0) + 1;
  });

  return Response.json({
    learner: learnerRes.data,
    sessions: sessionsRes.data || [],
    errors: errorsRes.data || [],
    grammar: grammarRes.data || [],
    vocabStats,
    errorCategoryCounts,
  });
}
