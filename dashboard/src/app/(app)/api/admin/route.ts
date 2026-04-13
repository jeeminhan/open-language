import { getAuthUserId } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

function isAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const admins = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return admins.includes(userId);
}

export async function GET() {
  const userId = await getAuthUserId();
  if (!isAdmin(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    learnersRes,
    newLearnersRes,
    sessionsRes,
    recentSessionsRes,
    turnsRes,
    errorsRes,
    grammarRes,
    vocabRes,
  ] = await Promise.all([
    supabase.from("learners").select("*", { count: "exact" }).order("created_at", { ascending: false }),
    supabase.from("learners").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
    supabase.from("sessions").select("*", { count: "exact", head: true }),
    supabase.from("sessions").select("*").not("ended_at", "is", null).order("started_at", { ascending: false }).limit(20),
    supabase.from("turns").select("*", { count: "exact", head: true }).gte("created_at", oneDayAgo),
    supabase.from("error_patterns").select("category"),
    supabase.from("grammar_inventory").select("pattern, mastery_score"),
    supabase.from("vocabulary").select("id", { count: "exact", head: true }),
  ]);

  // Aggregate error categories
  const errorCounts: Record<string, number> = {};
  (errorsRes.data || []).forEach((e: { category: string }) => {
    errorCounts[e.category] = (errorCounts[e.category] || 0) + 1;
  });
  const topErrors = Object.entries(errorCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([category, count]) => ({ category, count }));

  // Per-learner activity
  const learnerIds = (learnersRes.data || []).map((l) => l.id);
  const sessionCountsByLearner: Record<string, number> = {};
  const turnCountsByLearner: Record<string, number> = {};

  if (learnerIds.length > 0) {
    const { data: allSessions } = await supabase
      .from("sessions")
      .select("learner_id, total_turns, duration_seconds")
      .in("learner_id", learnerIds);

    (allSessions || []).forEach((s) => {
      sessionCountsByLearner[s.learner_id] = (sessionCountsByLearner[s.learner_id] || 0) + 1;
      turnCountsByLearner[s.learner_id] = (turnCountsByLearner[s.learner_id] || 0) + (s.total_turns || 0);
    });
  }

  const learners = (learnersRes.data || []).map((l) => ({
    id: l.id,
    name: l.name,
    native_language: l.native_language,
    target_language: l.target_language,
    proficiency_level: l.proficiency_level,
    created_at: l.created_at,
    user_id: l.user_id,
    sessions: sessionCountsByLearner[l.id] || 0,
    turns: turnCountsByLearner[l.id] || 0,
  }));

  // Group learners by user_id (UUID)
  const usersMap: Record<string, {
    user_id: string;
    learner_count: number;
    learners: typeof learners;
    sessions: number;
    turns: number;
    first_joined: string;
    languages: Set<string>;
  }> = {};

  for (const l of learners) {
    const key = l.user_id || "(none)";
    if (!usersMap[key]) {
      usersMap[key] = {
        user_id: key,
        learner_count: 0,
        learners: [],
        sessions: 0,
        turns: 0,
        first_joined: l.created_at,
        languages: new Set(),
      };
    }
    const u = usersMap[key];
    u.learner_count += 1;
    u.learners.push(l);
    u.sessions += l.sessions;
    u.turns += l.turns;
    u.languages.add(`${l.native_language}→${l.target_language}`);
    if (new Date(l.created_at) < new Date(u.first_joined)) u.first_joined = l.created_at;
  }

  const users = Object.values(usersMap)
    .map((u) => ({
      user_id: u.user_id,
      learner_count: u.learner_count,
      learners: u.learners,
      sessions: u.sessions,
      turns: u.turns,
      first_joined: u.first_joined,
      languages: Array.from(u.languages),
    }))
    .sort((a, b) => new Date(b.first_joined).getTime() - new Date(a.first_joined).getTime());

  const avgMastery = grammarRes.data && grammarRes.data.length > 0
    ? grammarRes.data.reduce((sum: number, g: { mastery_score: number }) => sum + (g.mastery_score || 0), 0) / grammarRes.data.length
    : 0;

  return Response.json({
    summary: {
      totalLearners: learnersRes.count || 0,
      totalUsers: users.length,
      newLearners7d: newLearnersRes.count || 0,
      totalSessions: sessionsRes.count || 0,
      turnsLast24h: turnsRes.count || 0,
      totalVocab: vocabRes.count || 0,
      avgMastery: Math.round(avgMastery * 100) / 100,
      totalErrors: errorsRes.data?.length || 0,
    },
    learners,
    users,
    recentSessions: recentSessionsRes.data || [],
    topErrors,
  });
}
