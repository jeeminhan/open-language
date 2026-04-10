import { getLearner, getSessions, getVocabulary, getSessionMetrics, getVocabGrowth, getGrammar } from "@/lib/db";
import { ErrorRateChart, TurnsPerSessionChart, VocabGrowthChart, GrammarMasteryChart } from "@/components/Charts";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function FluencyPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = getLearner(learnerId);
  if (!learner) return <p style={{ color: "var(--text-dim)" }}>No data.</p>;

  const sessions = getSessions(learner.id, 100);
  const vocab = getVocabulary(learner.id);
  const sessionMetrics = getSessionMetrics(learner.id, 50);
  const vocabGrowth = getVocabGrowth(learner.id);
  const grammar = getGrammar(learner.id);

  const grammarTrends = grammar
    .filter((g) => g.correct_uses + g.incorrect_uses >= 2)
    .map((g) => ({
      pattern: g.pattern,
      mastery: g.mastery_score,
      uses: g.correct_uses + g.incorrect_uses,
    }));

  const totalWords = vocab.length;
  const totalSessions = sessions.length;
  const avgErrorRate =
    sessionMetrics.length > 0
      ? Math.round(
          sessionMetrics.reduce((sum, s) => sum + s.errorRate, 0) /
            sessionMetrics.length
        )
      : 0;

  return (
    <div>
      <h2
        className="text-lg font-bold mb-6"
        style={{ color: "var(--moss)" }}
      >
        Fluency Trends
      </h2>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <div className="stat-value">{totalWords}</div>
          <div className="stat-label">Unique Words</div>
        </div>
        <div className="card text-center">
          <div className="stat-value">{totalSessions}</div>
          <div className="stat-label">Sessions</div>
        </div>
        <div className="card text-center">
          <div className="stat-value">{avgErrorRate}%</div>
          <div className="stat-label">Avg Error Rate</div>
        </div>
        <div className="card text-center">
          <div className="stat-value">
            {vocab.filter((v) => v.times_used >= 3).length}
          </div>
          <div className="stat-label">Words Used 3+</div>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <h3
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--ember)" }}
          >
            Error Rate Over Time
          </h3>
          {sessionMetrics.length < 2 ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Need more sessions to show trends.
            </p>
          ) : (
            <ErrorRateChart data={sessionMetrics} />
          )}
        </div>

        <div className="card">
          <h3
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--river)" }}
          >
            Turns Per Session
          </h3>
          {sessionMetrics.length < 2 ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Need more sessions to show trends.
            </p>
          ) : (
            <TurnsPerSessionChart data={sessionMetrics} />
          )}
        </div>

        <div className="card">
          <h3
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--gold)" }}
          >
            Vocabulary Growth
          </h3>
          {vocabGrowth.length < 2 ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Need more data to show growth.
            </p>
          ) : (
            <VocabGrowthChart data={vocabGrowth} />
          )}
        </div>

        <div className="card">
          <h3
            className="text-sm font-semibold uppercase tracking-wider mb-4"
            style={{ color: "var(--moss)" }}
          >
            Grammar Mastery
          </h3>
          {grammarTrends.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Need more grammar data to show mastery.
            </p>
          ) : (
            <GrammarMasteryChart data={grammarTrends} />
          )}
        </div>
      </div>

      {/* Top vocabulary */}
      <div className="card">
        <h3
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: "var(--text-dim)" }}
        >
          Most Used Words
        </h3>
        {vocab.length === 0 ? (
          <p style={{ color: "var(--text-dim)" }}>No vocabulary tracked yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vocab.slice(0, 50).map((v) => (
              <span
                key={v.id}
                className="text-sm px-2 py-1 rounded"
                style={{
                  background: "var(--bg-hover)",
                  border: "1px solid var(--border)",
                  opacity: Math.min(1, 0.4 + v.times_used * 0.1),
                }}
              >
                {v.word}
                <span
                  className="text-xs ml-1"
                  style={{ color: "var(--text-dim)" }}
                >
                  {v.times_used}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
