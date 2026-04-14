import { getLearner, getGrammar } from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function masteryColor(score: number, total: number): string {
  if (total < 3) return "mastery-gray";
  if (score >= 80) return "mastery-green";
  if (score >= 40) return "mastery-yellow";
  return "mastery-red";
}

function masteryBg(score: number, total: number): string {
  if (total < 3) return "var(--surface-2, var(--border))";
  if (score >= 80) return "rgba(107, 154, 91, 0.12)";
  if (score >= 40) return "rgba(196, 185, 154, 0.12)";
  return "rgba(196, 94, 74, 0.12)";
}

function parseExamples(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s: unknown) => typeof s === "string" && s.trim()) : [];
  } catch {
    return [];
  }
}

export default async function GrammarPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const userId = await getAuthUserId();
  const learner = await getLearner(learnerId, userId ?? undefined);
  if (!learner) return <p style={{ color: "var(--text-dim)" }}>No data.</p>;

  const grammar = await getGrammar(learner.id);

  return (
    <div>
      <h2
        className="text-lg font-bold mb-6"
        style={{ color: "var(--river)" }}
      >
        Grammar Mastery
      </h2>

      {grammar.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>
            No grammar patterns tracked yet.
          </p>
        </div>
      ) : (
        <>
          {/* Legend */}
          <div className="flex gap-6 mb-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: "rgba(107, 154, 91, 0.4)" }} />
              <span style={{ color: "var(--text-dim)" }}>80%+ mastery</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: "rgba(196, 185, 154, 0.4)" }} />
              <span style={{ color: "var(--text-dim)" }}>40-80%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: "rgba(196, 94, 74, 0.4)" }} />
              <span style={{ color: "var(--text-dim)" }}>&lt;40%</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: "var(--border)" }} />
              <span style={{ color: "var(--text-dim)" }}>Not enough data</span>
            </span>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {grammar.map((g) => {
              const total = g.correct_uses + g.incorrect_uses;
              const examples = parseExamples(g.example_sentences);
              return (
                <div
                  key={g.id}
                  className="rounded-lg p-4 border transition-all hover:scale-[1.02]"
                  style={{
                    background: masteryBg(g.mastery_score, total),
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div
                      className="text-base font-semibold"
                      style={{ fontFamily: "var(--font-target, inherit)" }}
                    >
                      {g.pattern}
                    </div>
                    <div
                      className={`font-mono text-sm font-bold shrink-0 ml-2 ${masteryColor(g.mastery_score, total)}`}
                    >
                      {total < 3 ? "—" : `${Math.round(g.mastery_score)}%`}
                    </div>
                  </div>

                  <div className="flex gap-2 items-center mb-2 text-xs" style={{ color: "var(--text-dim)" }}>
                    {g.level && <span>{g.level}</span>}
                    {g.srs_state && g.srs_state !== "seen" && (
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          background:
                            g.srs_state === "learning" ? "rgba(196, 94, 74, 0.15)" :
                            g.srs_state === "reviewing" ? "rgba(230, 176, 85, 0.15)" :
                            "rgba(107, 154, 91, 0.15)",
                          color:
                            g.srs_state === "learning" ? "var(--ember)" :
                            g.srs_state === "reviewing" ? "var(--gold)" :
                            "var(--moss)",
                        }}
                      >
                        {g.srs_state}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3 items-center text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                    <span>
                      <span style={{ color: "var(--moss)" }}>{g.correct_uses}</span> correct
                    </span>
                    <span>
                      <span style={{ color: "var(--ember)" }}>{g.incorrect_uses}</span> incorrect
                    </span>
                  </div>

                  {examples.length > 0 && (
                    <div
                      className="mt-2 pt-2 space-y-1"
                      style={{ borderTop: "1px solid var(--border)" }}
                    >
                      {examples.slice(0, 3).map((ex, i) => (
                        <div
                          key={i}
                          className="text-xs leading-relaxed"
                          style={{ color: "var(--text-dim)" }}
                        >
                          &ldquo;{ex}&rdquo;
                        </div>
                      ))}
                      {examples.length > 3 && (
                        <div className="text-xs" style={{ color: "var(--text-dim)", opacity: 0.6 }}>
                          +{examples.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
