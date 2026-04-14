import Link from "next/link";
import { cookies } from "next/headers";
import {
  getLearner,
  getStats,
  getSessions,
  getSpacedRepetitionItems,
  getWeakGrammar,
  getGrammar,
  getVocabSummary,
  getGrammarSummary,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

interface DayBucket {
  date: string;
  label: string;
  turns: number;
  sessions: number;
  minutes: number;
}

function lastNDays(n: number): DayBucket[] {
  const buckets: DayBucket[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    buckets.push({
      date: iso,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      turns: 0,
      sessions: 0,
      minutes: 0,
    });
  }
  return buckets;
}

function computeStreak(daysSet: Set<string>): number {
  let streak = 0;
  const d = new Date();
  // If today has no activity, the streak counts from yesterday
  if (!daysSet.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() - 1);
  }
  while (daysSet.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default async function ProgressPage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const userId = await getAuthUserId();
  const learner = await getLearner(learnerId, userId ?? undefined);
  if (!learner) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          No learner profile found. Start a conversation first.
        </p>
      </div>
    );
  }

  const [stats, sessions, reviewItems, weakGrammar, allGrammar, vocabSummary, grammarSummary] = await Promise.all([
    getStats(learner.id),
    getSessions(learner.id, 200),
    getSpacedRepetitionItems(learner.id, 5),
    getWeakGrammar(learner.id),
    getGrammar(learner.id),
    getVocabSummary(learner.id),
    getGrammarSummary(learner.id),
  ]);

  // Build week buckets
  const week = lastNDays(7);
  const activeDays = new Set<string>();
  for (const s of sessions) {
    if (!s.started_at) continue;
    const day = s.started_at.slice(0, 10);
    activeDays.add(day);
    const bucket = week.find((b) => b.date === day);
    if (bucket) {
      bucket.sessions += 1;
      bucket.turns += s.total_turns ?? 0;
      bucket.minutes += Math.round((s.duration_seconds ?? 0) / 60);
    }
  }
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = week.find((b) => b.date === todayIso) ?? { turns: 0, sessions: 0, minutes: 0, date: todayIso, label: "Today" };
  const streak = computeStreak(activeDays);
  const maxTurns = Math.max(1, ...week.map((b) => b.turns));

  // Recent wins: grammar patterns with mastery >= 70 and at least 3 uses, newest first
  const wins = allGrammar
    .filter((g) => g.correct_uses + g.incorrect_uses >= 3 && g.mastery_score >= 70)
    .sort((a, b) => b.mastery_score - a.mastery_score)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--river)" }}>
            {greetingFor(learner.name)}
          </h2>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            {learner.native_language} → {learner.target_language} · {learner.proficiency_level}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="px-3 py-1.5 rounded-lg flex items-center gap-2"
            style={{ background: streak > 0 ? "rgba(230, 176, 85, 0.15)" : "var(--bg-card)", border: `1px solid ${streak > 0 ? "var(--gold)" : "var(--border)"}` }}
          >
            <span>{streak > 0 ? "🔥" : "·"}</span>
            <span className="text-sm font-bold" style={{ color: streak > 0 ? "var(--gold)" : "var(--text-dim)" }}>
              {streak}-day streak
            </span>
          </div>
        </div>
      </div>

      {/* Vocabulary SRS */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Vocabulary</SectionLabel>
          <Link href="/vocabulary" className="text-xs" style={{ color: "var(--river)" }}>see all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <VocabStat value={vocabSummary.due} label="due now" color="var(--ember)" highlight={vocabSummary.due > 0} />
          <VocabStat value={vocabSummary.learning} label="learning" color="var(--gold)" />
          <VocabStat value={vocabSummary.known} label="known" color="var(--moss)" />
        </div>
      </section>

      {/* Grammar SRS */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Grammar</SectionLabel>
          <Link href="/grammar" className="text-xs" style={{ color: "var(--river)" }}>see all →</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <VocabStat value={grammarSummary.due} label="due now" color="var(--ember)" highlight={grammarSummary.due > 0} />
          <VocabStat value={grammarSummary.learning} label="learning" color="var(--gold)" />
          <VocabStat value={grammarSummary.known} label="known" color="var(--moss)" />
        </div>
      </section>

      {/* Today at a glance */}
      <section>
        <SectionLabel>Today</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat value={today.sessions} label="sessions" />
          <MiniStat value={today.turns} label="turns" />
          <MiniStat value={today.minutes} label="minutes" />
        </div>
        {today.sessions === 0 && (
          <Link
            href="/chat"
            className="mt-3 block text-center rounded-lg py-3 text-sm font-medium transition-all hover:scale-[1.01]"
            style={{ background: "var(--moss)", color: "white" }}
          >
            Start today&apos;s session →
          </Link>
        )}
      </section>

      {/* Today's review */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Today&apos;s review</SectionLabel>
          {reviewItems.length > 0 && (
            <Link href="/errors" className="text-xs" style={{ color: "var(--river)" }}>see all →</Link>
          )}
        </div>
        {reviewItems.length === 0 ? (
          <div className="card">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Nothing to review yet. Have a few conversations and review items will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reviewItems.map((item) => (
              <li
                key={item.id}
                className="rounded-lg p-3 border flex items-start gap-3"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                <span
                  className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                  style={{ background: "rgba(98, 148, 184, 0.18)", color: "var(--river)" }}
                >
                  {item.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--text)" }}>{item.description}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                    {item.category} · {item.occurrence_count}x · {item.times_corrected} corrected
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Weak grammar + wins side-by-side on wider screens */}
      <div className="grid gap-4 md:grid-cols-2">
        <section>
          <SectionLabel>Needs work</SectionLabel>
          {weakGrammar.length === 0 ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>Nothing flagged yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {weakGrammar.slice(0, 3).map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg p-3 border flex justify-between items-center"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{g.pattern}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--ember)" }}>
                    {Math.round(g.mastery_score)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionLabel>Recent wins</SectionLabel>
          {wins.length === 0 ? (
            <div className="card">
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>Keep practicing — wins will show up here.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {wins.map((g) => (
                <li
                  key={g.id}
                  className="rounded-lg p-3 border flex justify-between items-center"
                  style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                >
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{g.pattern}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--moss)" }}>
                    {Math.round(g.mastery_score)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 7-day activity */}
      <section>
        <SectionLabel>This week</SectionLabel>
        <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
          <div className="flex items-end gap-2 h-24">
            {week.map((b) => {
              const height = b.turns === 0 ? 4 : Math.max(6, (b.turns / maxTurns) * 100);
              const isToday = b.date === todayIso;
              return (
                <div key={b.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${height}%`,
                      background: b.turns === 0 ? "var(--border)" : isToday ? "var(--gold)" : "var(--river)",
                      minHeight: "4px",
                    }}
                    title={`${b.turns} turns · ${b.sessions} sessions · ${b.minutes}m`}
                  />
                  <span className="text-[10px]" style={{ color: isToday ? "var(--gold)" : "var(--text-dim)" }}>
                    {b.label.slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between items-center mt-3 text-xs" style={{ color: "var(--text-dim)" }}>
            <span>{week.reduce((s, b) => s + b.turns, 0)} turns this week</span>
            <span>{week.reduce((s, b) => s + b.minutes, 0)}m total</span>
          </div>
        </div>
      </section>

      {/* All-time totals */}
      <section>
        <SectionLabel>All time</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Totals label="Sessions" value={stats.sessions} />
          <Totals label="Hours" value={stats.hours} />
          <Totals label="Turns" value={stats.turns} />
          <Totals label="Words" value={stats.uniqueWords} />
          <Totals label="Errors" value={stats.errorPatterns} />
        </div>
      </section>
    </div>
  );
}

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  if (hour < 5) return `Still up, ${name}?`;
  if (hour < 12) return `Good morning, ${name}`;
  if (hour < 18) return `Good afternoon, ${name}`;
  return `Good evening, ${name}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-wider mb-2"
      style={{ color: "var(--text-dim)" }}
    >
      {children}
    </h3>
  );
}

function MiniStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg p-3 border text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}

function VocabStat({ value, label, color, highlight }: { value: number; label: string; color: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-lg p-3 border text-center"
      style={{
        background: highlight ? "rgba(196, 94, 74, 0.08)" : "var(--bg-card)",
        borderColor: highlight ? color : "var(--border)",
      }}
    >
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}

function Totals({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg p-2.5 border text-center" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="text-base font-bold font-mono" style={{ color: "var(--text)" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>{label}</div>
    </div>
  );
}
