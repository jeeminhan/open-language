import { getLearner, getSessions, getSessionRecaps } from "@/lib/db";
import { cookies } from "next/headers";
import SessionsList, { type RecapStats } from "./SessionsList";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = await getLearner(learnerId);
  const sessions = learner ? await getSessions(learner.id, 100) : await getSessions(100);

  const recaps = await getSessionRecaps(sessions.map((s) => s.id));
  const recapStats: Record<string, RecapStats> = {};
  for (const [id, r] of recaps) {
    recapStats[id] = {
      vocabNew: r.vocabLearned.length,
      vocabReviewed: r.vocabReviewed.length,
      grammar: r.grammarPracticed.length,
    };
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-6" style={{ color: "var(--river)" }}>
        Session History
      </h2>
      {sessions.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>No sessions yet.</p>
        </div>
      ) : (
        <SessionsList sessions={sessions} recapStats={recapStats} />
      )}
    </div>
  );
}
