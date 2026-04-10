import Link from "next/link";
import { getLearner, getSessions, isDbAvailable } from "@/lib/db";
import LocalOnly from "@/components/LocalOnly";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  if (!isDbAvailable()) return <LocalOnly />;
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = getLearner(learnerId);
  const sessions = learner ? getSessions(learner.id, 100) : getSessions(100);

  return (
    <div>
      <h2
        className="text-lg font-bold mb-6"
        style={{ color: "var(--river)" }}
      >
        Session History
      </h2>

      {sessions.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>No sessions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/sessions/${s.id}`}
              className="card block hover:border-[var(--river)]"
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm font-medium">
                    {s.started_at?.slice(0, 16).replace("T", " ")}
                  </span>
                  <span
                    className="text-xs ml-3"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {s.mode} mode
                  </span>
                </div>
                <div
                  className="flex gap-6 text-sm"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span>
                    {Math.round((s.duration_seconds ?? 0) / 60)}m
                  </span>
                  <span>{s.total_turns} turns</span>
                  <span style={{ color: "var(--ember)" }}>
                    {s.errors_detected} errors
                  </span>
                  <span style={{ color: "var(--moss)" }}>
                    {s.corrections_given} corrections
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
