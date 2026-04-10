import { getSession, getSessionTurns } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>Session not found.</p>
        <Link href="/sessions" className="text-sm" style={{ color: "var(--river)" }}>
          Back to sessions
        </Link>
      </div>
    );
  }

  const turns = getSessionTurns(id);

  return (
    <div>
      <Link
        href="/sessions"
        className="text-sm mb-4 inline-block"
        style={{ color: "var(--text-dim)" }}
      >
        ← Back to sessions
      </Link>

      {/* Session header */}
      <div className="card mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">
              {session.started_at?.slice(0, 16).replace("T", " ")}
            </h2>
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              {session.mode} mode
            </span>
          </div>
          <div className="flex gap-6 text-sm" style={{ color: "var(--text-dim)" }}>
            <span>{Math.round((session.duration_seconds ?? 0) / 60)}m</span>
            <span>{session.total_turns} turns</span>
            <span style={{ color: "var(--ember)" }}>
              {session.errors_detected} errors
            </span>
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="space-y-4">
        {turns.map((turn) => {
          let analysis: Record<string, unknown> | null = null;
          if (turn.analysis_json) {
            try {
              analysis = JSON.parse(turn.analysis_json);
            } catch {
              // ignore
            }
          }
          const errors = (analysis?.errors as Array<Record<string, string>>) || [];

          return (
            <div key={turn.id}>
              {/* User message */}
              <div className="flex gap-3 mb-2">
                <span
                  className="text-xs font-semibold shrink-0 mt-0.5"
                  style={{ color: "var(--gold)" }}
                >
                  You
                </span>
                <p className="text-sm">{turn.user_message}</p>
              </div>

              {/* Error annotations */}
              {errors.length > 0 && (
                <div className="ml-10 mb-2 space-y-1">
                  {errors.map((err, j) => (
                    <div
                      key={j}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: "rgba(196, 94, 74, 0.1)",
                        borderLeft: "2px solid var(--ember)",
                      }}
                    >
                      <span style={{ color: "var(--ember)" }}>
                        {err.observed}
                      </span>
                      <span style={{ color: "var(--text-dim)" }}> → </span>
                      <span style={{ color: "var(--moss)" }}>
                        {err.expected}
                      </span>
                      {err.type && (
                        <span style={{ color: "var(--text-dim)" }}>
                          {" "}[{err.type}]
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tutor response */}
              <div className="flex gap-3 mb-1">
                <span
                  className="text-xs font-semibold shrink-0 mt-0.5"
                  style={{ color: "var(--river)" }}
                >
                  Tutor
                </span>
                <p className="text-sm">{turn.tutor_response}</p>
              </div>

              {/* Correction info */}
              {turn.correction_type &&
                turn.correction_type !== "none" && (
                  <div
                    className="ml-10 text-xs mb-1"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Correction: {turn.correction_type}
                    {turn.correction_reasoning &&
                      ` — ${turn.correction_reasoning}`}
                  </div>
                )}

              <hr
                className="my-4"
                style={{ borderColor: "var(--border)", opacity: 0.5 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
