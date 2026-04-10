import { getLearner, getErrors } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = getLearner(learnerId);
  if (!learner) return <p style={{ color: "var(--text-dim)" }}>No data.</p>;

  const errors = getErrors(learner.id);

  return (
    <div>
      <h2 className="text-lg font-bold mb-6" style={{ color: "var(--ember)" }}>
        Error Patterns
      </h2>

      {errors.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>
            No error patterns recorded yet. Start a conversation!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {errors.map((err, i) => {
            const examples: string[] = (() => {
              try {
                return JSON.parse(err.example_utterances || "[]");
              } catch {
                return [];
              }
            })();

            return (
              <div key={err.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold">{err.description}</span>
                    <span
                      className="text-xs ml-2"
                      style={{ color: "var(--text-dim)" }}
                    >
                      [{err.category}]
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-sm">
                      {err.occurrence_count}x
                    </span>
                    <span className={`text-xs severity-${err.severity}`}>
                      {err.severity}
                    </span>
                    <span className={`text-xs status-${err.status}`}>
                      {err.status}
                    </span>
                  </div>
                </div>

                <div className="flex gap-6 text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                  <span>Corrected: {err.times_corrected}x</span>
                  <span>Deferred: {err.times_deferred}x</span>
                  {err.first_seen && (
                    <span>
                      First seen: {err.first_seen.slice(0, 10)}
                    </span>
                  )}
                </div>

                {err.l1_source && (
                  <p className="text-sm italic mb-2" style={{ color: "var(--gold)" }}>
                    Why: {err.l1_source}
                  </p>
                )}

                {examples.length > 0 && (
                  <div className="mt-2">
                    <span
                      className="text-xs uppercase tracking-wider"
                      style={{ color: "var(--text-dim)" }}
                    >
                      Examples:
                    </span>
                    <ul className="mt-1 space-y-1">
                      {examples.slice(-5).map((ex, j) => (
                        <li
                          key={j}
                          className="text-sm font-mono pl-3"
                          style={{
                            borderLeft: "2px solid var(--ember)",
                            color: "var(--ember)",
                          }}
                        >
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
