import { getLearner, getSessions } from "@/lib/db";
import { cookies } from "next/headers";
import SessionsList from "./SessionsList";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = await getLearner(learnerId);
  const sessions = learner ? await getSessions(learner.id, 100) : await getSessions(100);

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
        <SessionsList sessions={sessions} />
      )}
    </div>
  );
}
