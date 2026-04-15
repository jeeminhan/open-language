import { getLearner, getErrors, getGrammar } from "@/lib/db";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function PronunciationPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = await getLearner(learnerId);
  if (!learner) return <p style={{ color: "var(--text-dim)" }}>No data.</p>;

  const allErrors = await getErrors(learner.id);
  const pronErrors = allErrors.filter(
    (e) =>
      e.category.toLowerCase().includes("pronunciation") ||
      e.category.toLowerCase().includes("phonol") ||
      e.description.toLowerCase().includes("pronunciation") ||
      e.description.toLowerCase().includes("intonation") ||
      e.description.toLowerCase().includes("accent") ||
      e.description.toLowerCase().includes("tone") ||
      e.description.toLowerCase().includes("vowel") ||
      e.description.toLowerCase().includes("consonant")
  );

  const grammarAll = await getGrammar(learner.id);
  const phonGrammar = grammarAll.filter(
    (g) =>
      g.pattern.toLowerCase().includes("pronunciation") ||
      g.pattern.toLowerCase().includes("phonol") ||
      g.pattern.toLowerCase().includes("intonation") ||
      g.pattern.toLowerCase().includes("tone")
  );

  const totalOccurrences = pronErrors.reduce((s, e) => s + e.occurrence_count, 0);
  const activeCount = pronErrors.filter((e) => e.status === "active").length;
  const improvingCount = pronErrors.filter((e) => e.status === "improving").length;
  const resolvedCount = pronErrors.filter((e) => e.status === "resolved").length;

  return (
    <div>
      <h2
        className="text-lg font-bold mb-6"
        style={{ color: "var(--gold)" }}
      >
        Pronunciation Tracking
      </h2>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="stat-value">{pronErrors.length}</div>
          <div className="stat-label">Patterns Found</div>
        </div>
        <div className="card text-center">
          <div className="stat-value" style={{ color: "var(--ember)" }}>{activeCount}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="card text-center">
          <div className="stat-value" style={{ color: "var(--gold)" }}>{improvingCount}</div>
          <div className="stat-label">Improving</div>
        </div>
        <div className="card text-center">
          <div className="stat-value" style={{ color: "var(--moss)" }}>{resolvedCount}</div>
          <div className="stat-label">Resolved</div>
        </div>
      </div>

      {pronErrors.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>
            No pronunciation patterns tracked yet. Pronunciation errors are detected
            during voice conversations and text chats where the tutor identifies
            phonological patterns in your writing.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Error patterns list */}
          <div className="card">
            <h3
              className="text-sm font-semibold uppercase tracking-wider mb-4"
              style={{ color: "var(--ember)" }}
            >
              Pronunciation Patterns ({totalOccurrences} total occurrences)
            </h3>
            <div className="space-y-4">
              {pronErrors.map((err) => {
                let examples: string[] = [];
                try { examples = JSON.parse(err.example_utterances || "[]"); } catch { /* skip */ }

                return (
                  <div
                    key={err.id}
                    className="rounded-lg p-3"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-sm font-medium">{err.description}</span>
                        <span
                          className="text-xs ml-2 px-1.5 py-0.5 rounded"
                          style={{
                            background: "var(--bg-hover)",
                            color: "var(--text-dim)",
                          }}
                        >
                          {err.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm">{err.occurrence_count}x</span>
                        <span className={`text-xs status-${err.status}`}>
                          {err.status}
                        </span>
                      </div>
                    </div>

                    {err.l1_source && (
                      <p className="text-xs mb-2" style={{ color: "var(--river)" }}>
                        L1 interference: {err.l1_source}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs mb-2" style={{ color: "var(--text-dim)" }}>
                      <span>Corrected: {err.times_corrected}x</span>
                      <span>Deferred: {err.times_deferred}x</span>
                      <span className={`severity-${err.severity}`}>
                        {err.severity} severity
                      </span>
                    </div>

                    {examples.length > 0 && (
                      <div className="space-y-1">
                        {examples.slice(-3).map((ex, i) => (
                          <p
                            key={i}
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              background: "var(--bg-card)",
                              color: "var(--text-dim)",
                              fontStyle: "italic",
                            }}
                          >
                            &ldquo;{ex}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Phonological grammar patterns */}
          {phonGrammar.length > 0 && (
            <div className="card">
              <h3
                className="text-sm font-semibold uppercase tracking-wider mb-4"
                style={{ color: "var(--moss)" }}
              >
                Phonological Grammar Mastery
              </h3>
              <div className="space-y-2">
                {phonGrammar.map((g) => {
                  const total = g.correct_uses + g.incorrect_uses;
                  const masteryColor =
                    g.mastery_score >= 80
                      ? "var(--moss)"
                      : g.mastery_score >= 40
                        ? "var(--gold)"
                        : "var(--ember)";

                  return (
                    <div key={g.id} className="flex items-center gap-3">
                      <span className="text-sm flex-1">{g.pattern}</span>
                      <div
                        className="w-24 h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--border)" }}
                      >
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(100, g.mastery_score)}%`,
                            background: masteryColor,
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs w-12 text-right" style={{ color: masteryColor }}>
                        {Math.round(g.mastery_score)}%
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                        ({total} uses)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
