import { getLearner, getStats, getErrors, getSessions, computeEffectiveLevel, getSpacedRepetitionItems, getL1Patterns, getInterests, isDbAvailable } from "@/lib/db";
import LocalOnly from "@/components/LocalOnly";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!isDbAvailable()) return <LocalOnly />;
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const learner = getLearner(learnerId);
  if (!learner) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          No learner profile found. Run a conversation session first.
        </p>
      </div>
    );
  }

  const stats = getStats(learner.id);
  const topErrors = getErrors(learner.id).slice(0, 5);
  const recentSessions = getSessions(learner.id, 5);

  return (
    <div className="space-y-10">
      {/* Learner header */}
      <div className="card">
        <div className="flex items-baseline gap-4 flex-wrap">
          <h2 className="text-xl font-bold">{learner.name}</h2>
          <span style={{ color: "var(--gold)" }}>
            {learner.native_language} → {learner.target_language}
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            Level: {learner.proficiency_level}
          </span>
        </div>
      </div>

      {/* ─── SECTION 1: Overview (gold) ─── */}
      <section>
        <SectionHeader color="var(--gold)" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-10" />
          </svg>
        }>Overview</SectionHeader>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Sessions" value={stats.sessions} color="var(--gold)" />
          <StatCard label="Hours" value={stats.hours} color="var(--gold)" />
          <StatCard label="Turns" value={stats.turns} color="var(--gold)" />
          <StatCard label="Unique Words" value={stats.uniqueWords} color="var(--gold)" />
          <StatCard label="Error Patterns" value={stats.errorPatterns} color="var(--gold)" />
        </div>
      </section>

      {/* ─── SECTION 2: Progress (ember) ─── */}
      <section>
        <SectionHeader color="var(--ember)" icon={
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
          </svg>
        }>Session Progress</SectionHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card" style={{ borderTop: "3px solid var(--ember)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ember)" }}>
              Top Error Patterns
            </h3>
            {topErrors.length === 0 ? (
              <p style={{ color: "var(--text-dim)" }}>No errors yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {topErrors.map((err) => (
                  <li key={err.id} className="flex justify-between items-start">
                    <div>
                      <span className="text-sm">{err.description}</span>
                      <span className="text-xs ml-2" style={{ color: "var(--text-dim)" }}>[{err.category}]</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm">{err.occurrence_count}x</span>
                      <span className={`text-xs status-${err.status}`}>{err.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card" style={{ borderTop: "3px solid var(--ember)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ember)" }}>
              Recent Sessions
            </h3>
            {recentSessions.length === 0 ? (
              <p style={{ color: "var(--text-dim)" }}>No sessions yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {recentSessions.map((s) => (
                  <li key={s.id} className="flex justify-between text-sm">
                    <span style={{ color: "var(--text-dim)" }}>
                      {s.started_at?.slice(0, 16).replace("T", " ")}
                    </span>
                    <div className="flex gap-4">
                      <span>{Math.round((s.duration_seconds ?? 0) / 60)}m</span>
                      <span>{s.total_turns} turns</span>
                      <span style={{ color: "var(--ember)" }}>{s.errors_detected} err</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: Self-Learning System (river/blue) ─── */}
      {(() => {
        const eff = computeEffectiveLevel(learner.id);
        const practiceItems = getSpacedRepetitionItems(learner.id, 5);
        const l1Patterns = getL1Patterns(learner.id);

        return (
          <section>
            <SectionHeader color="var(--river)" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
                <line x1="10" y1="22" x2="14" y2="22" />
              </svg>
            }>Self-Learning System</SectionHeader>

            {/* Live status cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              <div className="card" style={{ borderTop: "3px solid var(--river)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Computed Level</div>
                <div className="text-2xl font-bold" style={{ color: "var(--river)" }}>
                  {eff.confidence > 0.3 ? eff.level : learner.proficiency_level}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
                  {eff.confidence > 0.3
                    ? `${Math.round(eff.grammarMastery)}% mastery, ${Math.round(eff.errorRate)}% error rate`
                    : "Gathering data..."}
                </div>
                {eff.confidence > 0.3 && eff.level !== learner.proficiency_level && (
                  <div className="text-[10px] mt-1.5" style={{ color: "var(--river)" }}>
                    Registered as {learner.proficiency_level} — tutor is adapting
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, eff.confidence * 100)}%`, background: "var(--river)" }} />
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{eff.totalDataPoints} data pts</span>
                </div>
              </div>

              <div className="card" style={{ borderTop: "3px solid var(--river)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>L1 Interference</div>
                <div className="text-2xl font-bold" style={{ color: "var(--river)" }}>{l1Patterns.length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>L1 habits identified</div>
                {l1Patterns.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {l1Patterns.slice(0, 2).map((p, i) => (
                      <p key={i} className="text-[11px] leading-snug" style={{ color: "var(--river)" }}>{p.l1_source}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className="card" style={{ borderTop: "3px solid var(--river)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--text-dim)" }}>Practice Queue</div>
                <div className="text-2xl font-bold" style={{ color: "var(--river)" }}>{practiceItems.length}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>items via spaced repetition</div>
                {practiceItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {practiceItems.slice(0, 2).map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold"
                          style={{ background: "rgba(98, 148, 184, 0.2)", color: "var(--river)" }}>
                          {item.priority}
                        </span>
                        <span className="truncate" style={{ color: "var(--text)" }}>{item.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* How It Works */}
            <div className="card" style={{ borderLeft: "3px solid var(--river)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--river)" }}>
                How It Works — 9 Learning Loops
              </h3>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-5">
                <LoopCard num={1} title="Adaptive Difficulty">
                  Computes your effective level from grammar mastery and error rate. As you improve,
                  the tutor pushes harder vocabulary and grammar automatically.
                </LoopCard>
                <LoopCard num={2} title="Spaced Repetition">
                  Prioritizes patterns you haven{"'"}t practiced recently or keep getting wrong,
                  then steers conversation toward them.
                </LoopCard>
                <LoopCard num={3} title="L1 Interference Detection">
                  Identifies errors caused by native language habits and feeds them back to the tutor
                  so it explains <em>why</em> you make the mistake.
                </LoopCard>
                <LoopCard num={4} title="Second-Pass Review Agent">
                  After each session, an outside agent reviews the full conversation to catch
                  errors the real-time checker missed.
                </LoopCard>
                <LoopCard num={5} title="Tutor Self-Evaluation">
                  Grades the tutor{"'"}s own responses — correction effectiveness, missed teaching
                  moments. Makes the tutor smarter over time.
                </LoopCard>
                <LoopCard num={6} title="Error Clustering">
                  Groups related errors by root cause with specific recommendations instead
                  of showing isolated mistakes.
                </LoopCard>
                <LoopCard num={7} title="Unknown Vocab Tracking">
                  When you ask what a word means, it{"'"}s saved for review. Builds a personal
                  dictionary of words you{"'"}re actively learning.
                </LoopCard>
                <LoopCard num={8} title="Topic Difficulty Scoring">
                  Each conversation is scored for difficulty so future topic suggestions
                  better match your current level.
                </LoopCard>
                <LoopCard num={9} title="Interest Profiling">
                  Detects your interests from conversations — books, music, shows, hobbies — pulls
                  real web info, and generates personalized topics you actually want to discuss.
                </LoopCard>
              </div>

              {/* Feedback loop diagram */}
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px]">
                  {["You speak", "Errors detected", "L1 + vocab tagged", "Interests learned", "Tutor self-evaluates", "Clusters + adapts", "Better next session"].map((step, i) => (
                    <span key={i} className="flex items-center gap-2">
                      {i > 0 && <span style={{ color: "var(--text-dim)" }}>→</span>}
                      <span className="px-2 py-1 rounded" style={{ background: "rgba(98, 148, 184, 0.1)", color: "var(--river)" }}>{step}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ─── SECTION 4: Your Profile (sage/green) ─── */}
      {(() => {
        const interests = getInterests(learner.id);
        const categoryIcons: Record<string, string> = {
          books: "\u{1F4DA}", music: "\u{1F3B5}", tv_shows: "\u{1F4FA}", movies: "\u{1F3AC}",
          anime: "\u{1F30A}", hobbies: "\u{2728}", sports: "\u{26BD}", food: "\u{1F372}",
          travel: "\u{2708}\u{FE0F}", work: "\u{1F4BC}", culture: "\u{1F3AF}", games: "\u{1F3AE}",
          technology: "\u{1F4BB}", people: "\u{1F465}", news: "\u{1F4F0}", other: "\u{1F4AD}",
        };

        return (
          <section>
            <SectionHeader color="var(--moss)" icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }>Your Profile</SectionHeader>

            {interests.length === 0 ? (
              <div className="card" style={{ borderTop: "3px solid var(--moss)" }}>
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                  No interests detected yet. As you have conversations, the tutor will automatically learn what you care about
                  and use those topics to make sessions more engaging.
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="card" style={{ borderTop: "3px solid var(--moss)" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--moss)" }}>
                    Detected Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {interests.map((interest) => (
                      <div
                        key={interest.id}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm"
                        style={{ background: "rgba(107, 154, 91, 0.1)", border: "1px solid rgba(107, 154, 91, 0.2)" }}
                        title={interest.details || undefined}
                      >
                        <span className="text-xs">{categoryIcons[interest.category] || "\u{1F4AD}"}</span>
                        <span style={{ color: "var(--text)" }}>{interest.name}</span>
                        {interest.mention_count > 1 && (
                          <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{interest.mention_count}x</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ borderTop: "3px solid var(--moss)" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--moss)" }}>
                    How This Works
                  </h3>
                  <div className="space-y-2">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                      The tutor automatically detects your interests from conversations. It uses them to:
                    </p>
                    <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "var(--moss)" }}>1.</span>
                        Generate personalized conversation topics you actually want to discuss
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "var(--moss)" }}>2.</span>
                        Pull real, current information from the web about your interests
                      </li>
                      <li className="flex items-start gap-2">
                        <span style={{ color: "var(--moss)" }}>3.</span>
                        Steer grammar practice toward topics that keep you engaged
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        );
      })()}
    </div>
  );
}

function SectionHeader({ color, icon, children }: { color: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span style={{ color }}>{icon}</span>
      <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color }}>{children}</h2>
      <div className="flex-1 h-px" style={{ background: `color-mix(in srgb, ${color} 25%, transparent)` }} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="card text-center" style={color ? { borderTop: `3px solid ${color}` } : undefined}>
      <div className="stat-value" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LoopCard({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "rgba(98, 148, 184, 0.15)", color: "var(--river)" }}>{num}</span>
        <h4 className="text-sm font-semibold" style={{ color: "var(--river)" }}>{title}</h4>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{children}</p>
    </div>
  );
}
