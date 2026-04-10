import { getLearner, getGrammar } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function masteryColor(score: number, total: number): string {
  if (total < 3) return "mastery-gray";
  if (score >= 80) return "mastery-green";
  if (score >= 40) return "mastery-yellow";
  return "mastery-red";
}

function masteryBg(score: number, total: number): string {
  if (total < 3) return "var(--border)";
  if (score >= 80) return "rgba(107, 154, 91, 0.15)";
  if (score >= 40) return "rgba(196, 185, 154, 0.15)";
  return "rgba(196, 94, 74, 0.15)";
}

export default async function GrammarPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = getLearner(learnerId);
  if (!learner) return <p style={{ color: "var(--text-dim)" }}>No data.</p>;

  const grammar = getGrammar(learner.id);

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {grammar.map((g) => {
              const total = g.correct_uses + g.incorrect_uses;
              return (
                <div
                  key={g.id}
                  className="rounded-lg p-3 border transition-all hover:scale-[1.02]"
                  style={{
                    background: masteryBg(g.mastery_score, total),
                    borderColor: "var(--border)",
                  }}
                >
                  <div className="text-sm font-medium mb-1">{g.pattern}</div>
                  {g.level && (
                    <div className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                      {g.level}
                    </div>
                  )}
                  <div className="flex justify-between items-end">
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                      <span style={{ color: "var(--moss)" }}>{g.correct_uses}</span>
                      {" / "}
                      <span style={{ color: "var(--ember)" }}>{g.incorrect_uses}</span>
                    </div>
                    <div
                      className={`font-mono text-sm font-bold ${masteryColor(g.mastery_score, total)}`}
                    >
                      {total < 3 ? "—" : `${Math.round(g.mastery_score)}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
