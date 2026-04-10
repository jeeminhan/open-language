"use client";

import { useState, useEffect } from "react";

interface VocabItem {
  id: string;
  word: string;
  language: string;
  times_used: number;
  first_used: string;
  last_used: string | null;
}

interface GrammarItem {
  id: string;
  pattern: string;
  level: string | null;
  correct_uses: number;
  incorrect_uses: number;
  mastery_score: number;
  first_used: string;
  last_used: string | null;
}

interface Expression {
  id: string;
  expression: string;
  type: string;
  meaning: string | null;
  proficiency: string;
  times_encountered: number;
  times_produced: number;
  first_seen: string;
}

interface PhrasingSuggestion {
  id: string;
  original: string;
  suggested: string;
  grammar_point: string | null;
  explanation: string | null;
  category: string;
  created_at: string;
}

type Tab = "overview" | "expressions" | "grammar" | "suggestions";

export default function KnowledgePage() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [grammar, setGrammar] = useState<GrammarItem[]>([]);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [suggestions, setSuggestions] = useState<PhrasingSuggestion[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.vocabulary)) setVocab(data.vocabulary);
        if (Array.isArray(data.grammar)) setGrammar(data.grammar);
        if (Array.isArray(data.expressions)) setExpressions(data.expressions);
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
      })
      .catch(() => {});
  }, []);

  // Derived stats
  const activeVocab = vocab.filter((v) => v.language === "target");
  const unknownVocab = vocab.filter((v) => v.language === "unknown");
  const passiveExpr = expressions.filter((e) => e.proficiency === "passive");
  const emergingExpr = expressions.filter((e) => e.proficiency === "emerging");
  const activeExpr = expressions.filter((e) => e.proficiency === "active" || e.proficiency === "mastered");
  const weakGrammar = grammar.filter((g) => g.mastery_score < 50 && (g.correct_uses + g.incorrect_uses) >= 3);
  const strongGrammar = grammar.filter((g) => g.mastery_score >= 70 && (g.correct_uses + g.incorrect_uses) >= 3);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "expressions", label: `Expressions (${expressions.length})` },
    { key: "grammar", label: `Grammar (${grammar.length})` },
    { key: "suggestions", label: `Suggestions (${suggestions.length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Proficiency spectrum */}
      <div className="card" style={{ borderTop: "3px solid var(--river)" }}>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: "var(--river)" }}>
          Your Knowledge Spectrum
        </h2>
        <div className="grid grid-cols-4 gap-3">
          <SpectrumCard
            label="Don't know"
            count={unknownVocab.length}
            color="var(--ember)"
            description="Words you asked about or marked as unknown"
          />
          <SpectrumCard
            label="Passive"
            count={passiveExpr.length}
            color="var(--gold)"
            description="Understand when you hear it, but haven't used it yourself"
          />
          <SpectrumCard
            label="Emerging"
            count={emergingExpr.length + (vocab.filter((v) => v.language === "target" && v.times_used <= 2).length)}
            color="var(--river)"
            description="Used once or twice — still building confidence"
          />
          <SpectrumCard
            label="Active"
            count={activeExpr.length + (activeVocab.filter((v) => v.times_used >= 3).length)}
            color="var(--moss)"
            description="You use this naturally in conversation"
          />
        </div>
        <p className="text-[11px] mt-3 leading-relaxed" style={{ color: "var(--text-dim)" }}>
          The goal is to move things rightward — from passive understanding to active production.
          The tutor steers conversations to practice your passive and emerging knowledge.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: tab === t.key ? "var(--river)" : "var(--bg-card)",
              color: tab === t.key ? "white" : "var(--text-dim)",
              border: `1px solid ${tab === t.key ? "var(--river)" : "var(--border)"}`,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <OverviewTab
          weakGrammar={weakGrammar}
          strongGrammar={strongGrammar}
          passiveExpr={passiveExpr}
          unknownVocab={unknownVocab}
          suggestions={suggestions.slice(0, 5)}
        />
      )}
      {tab === "expressions" && <ExpressionsTab expressions={expressions} />}
      {tab === "grammar" && <GrammarTab grammar={grammar} />}
      {tab === "suggestions" && <SuggestionsTab suggestions={suggestions} />}
    </div>
  );
}

function SpectrumCard({ label, count, color, description }: { label: string; count: number; color: string; description: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="text-2xl font-bold mb-0.5" style={{ color }}>{count}</div>
      <div className="text-xs font-semibold mb-1" style={{ color }}>{label}</div>
      <p className="text-[10px] leading-snug" style={{ color: "var(--text-dim)" }}>{description}</p>
    </div>
  );
}

// ── Overview: big-picture gaps and growth areas ────────

function OverviewTab({
  weakGrammar, strongGrammar, passiveExpr, unknownVocab, suggestions,
}: {
  weakGrammar: GrammarItem[];
  strongGrammar: GrammarItem[];
  passiveExpr: Expression[];
  unknownVocab: VocabItem[];
  suggestions: PhrasingSuggestion[];
}) {
  return (
    <div className="space-y-4">
      {/* What you don't know you don't know */}
      {passiveExpr.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--gold)" }}>
            You understand these but haven{"'"}t used them yet
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
            These came up in conversation and you understood from context — try using them yourself next time
          </p>
          <div className="flex flex-wrap gap-1.5">
            {passiveExpr.slice(0, 20).map((e) => (
              <span key={e.id} className="px-2.5 py-1 rounded-lg text-xs"
                style={{ background: "rgba(196, 150, 74, 0.1)", border: "1px solid rgba(196, 150, 74, 0.25)", color: "var(--gold)" }}>
                {e.expression}
                {e.meaning && <span style={{ color: "var(--text-dim)" }}> — {e.meaning}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Weak patterns */}
      {weakGrammar.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--ember)" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ember)" }}>
            Patterns to work on
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
            You{"'"}ve used these but get them wrong more than right — the broad areas to focus on
          </p>
          <div className="space-y-2">
            {weakGrammar.slice(0, 8).map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-lg p-2.5"
                style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span className="text-sm" style={{ color: "var(--text)" }}>{g.pattern}</span>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <MasteryBar score={g.mastery_score} />
                  <span style={{ color: "var(--text-dim)" }}>
                    {g.correct_uses}/{g.correct_uses + g.incorrect_uses} correct
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strong patterns */}
      {strongGrammar.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--moss)" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--moss)" }}>
            Things you{"'"}re solid on
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {strongGrammar.map((g) => (
              <span key={g.id} className="px-2.5 py-1 rounded-lg text-xs"
                style={{ background: "rgba(126, 154, 110, 0.1)", border: "1px solid rgba(126, 154, 110, 0.25)", color: "var(--moss)" }}>
                {g.pattern} ({Math.round(g.mastery_score)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent suggestions */}
      {suggestions.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--river)" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--river)" }}>
            Recent phrasing upgrades
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
            Things you said that could be said more naturally
          </p>
          <div className="space-y-2.5">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-lg p-2.5" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span style={{ color: "var(--text-dim)" }}>{s.original}</span>
                  <span style={{ color: "var(--text-dim)" }}>→</span>
                  <span style={{ color: "var(--river)", fontWeight: 600 }}>{s.suggested}</span>
                </div>
                {s.grammar_point && (
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-medium"
                    style={{ background: "rgba(91, 126, 154, 0.15)", color: "var(--river)" }}>
                    {s.grammar_point}
                  </span>
                )}
                {s.explanation && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{s.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unknown vocab */}
      {unknownVocab.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--ember)" }}>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--ember)" }}>
            Words you{"'"}re still learning ({unknownVocab.length})
          </h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {unknownVocab.slice(0, 30).map((v) => (
              <span key={v.id} className="px-2 py-0.5 rounded-lg text-xs"
                style={{ background: "rgba(196, 94, 74, 0.1)", border: "1px solid rgba(196, 94, 74, 0.2)", color: "var(--ember)" }}>
                {v.word}
              </span>
            ))}
          </div>
        </div>
      )}

      {weakGrammar.length === 0 && strongGrammar.length === 0 && passiveExpr.length === 0 && unknownVocab.length === 0 && suggestions.length === 0 && (
        <div className="card text-center py-8">
          <p style={{ color: "var(--text-dim)" }}>
            No knowledge tracked yet. Start a conversation to begin building your map.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Expressions tab ────────────────────────────────────

function ExpressionsTab({ expressions }: { expressions: Expression[] }) {
  const [filter, setFilter] = useState<string>("all");

  const proficiencyOrder = { passive: 0, emerging: 1, active: 2, mastered: 3 };
  const filtered = filter === "all"
    ? expressions
    : expressions.filter((e) => e.proficiency === filter);

  const sorted = [...filtered].sort((a, b) =>
    (proficiencyOrder[a.proficiency as keyof typeof proficiencyOrder] ?? 0) -
    (proficiencyOrder[b.proficiency as keyof typeof proficiencyOrder] ?? 0)
  );

  const profColors: Record<string, string> = {
    passive: "var(--gold)", emerging: "var(--river)", active: "var(--moss)", mastered: "var(--moss)",
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {["all", "passive", "emerging", "active"].map((f) => {
          const count = f === "all" ? expressions.length : expressions.filter((e) => e.proficiency === f || (f === "active" && e.proficiency === "mastered")).length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === f ? (profColors[f] || "var(--river)") : "var(--bg-card)",
                color: filter === f ? "white" : "var(--text-dim)",
                border: `1px solid ${filter === f ? (profColors[f] || "var(--river)") : "var(--border)"}`,
              }}>
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center py-6">
          <p style={{ color: "var(--text-dim)" }}>No expressions tracked yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((e) => (
            <div key={e.id} className="card flex items-start gap-3" style={{ padding: "0.75rem 1rem" }}>
              <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: `color-mix(in srgb, ${profColors[e.proficiency] || "var(--text-dim)"} 15%, transparent)`,
                  color: profColors[e.proficiency] || "var(--text-dim)",
                }}>
                {e.proficiency === "passive" ? "P" : e.proficiency === "emerging" ? "E" : "A"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{e.expression}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: `color-mix(in srgb, ${profColors[e.proficiency] || "var(--text-dim)"} 10%, transparent)`, color: profColors[e.proficiency] }}>
                    {e.type.replace("_", " ")}
                  </span>
                </div>
                {e.meaning && <p className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>{e.meaning}</p>}
                <div className="flex gap-3 mt-1 text-[10px]" style={{ color: "var(--text-dim)" }}>
                  <span>Encountered {e.times_encountered}x</span>
                  <span>Produced {e.times_produced}x</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Grammar tab ────────────────────────────────────────

function GrammarTab({ grammar }: { grammar: GrammarItem[] }) {
  if (grammar.length === 0) {
    return (
      <div className="card text-center py-6">
        <p style={{ color: "var(--text-dim)" }}>No grammar patterns tracked yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grammar.map((g) => {
        const total = g.correct_uses + g.incorrect_uses;
        const hasData = total >= 3;
        return (
          <div key={g.id} className="card flex items-center justify-between gap-3" style={{ padding: "0.75rem 1rem" }}>
            <div className="min-w-0">
              <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{g.pattern}</div>
              {g.level && <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>{g.level}</span>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {hasData ? (
                <>
                  <MasteryBar score={g.mastery_score} />
                  <span className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                    {Math.round(g.mastery_score)}%
                  </span>
                </>
              ) : (
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                  {total} use{total !== 1 ? "s" : ""} — need more data
                </span>
              )}
              <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                {g.correct_uses}/{total}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Suggestions tab ────────────────────────────────────

function SuggestionsTab({ suggestions }: { suggestions: PhrasingSuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <div className="card text-center py-6">
        <p style={{ color: "var(--text-dim)" }}>No phrasing suggestions yet. Complete a session to get feedback.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <div key={s.id} className="card" style={{ padding: "0.75rem 1rem" }}>
          <div className="flex items-center gap-2 text-sm flex-wrap mb-1">
            <span style={{ color: "var(--text-dim)" }}>{s.original}</span>
            <span style={{ color: "var(--text-dim)" }}>→</span>
            <span style={{ color: "var(--river)", fontWeight: 600 }}>{s.suggested}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {s.grammar_point && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(91, 126, 154, 0.15)", color: "var(--river)" }}>
                {s.grammar_point}
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--bg)", color: "var(--text-dim)" }}>
              {s.category}
            </span>
          </div>
          {s.explanation && (
            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{s.explanation}</p>
          )}
          <div className="text-[10px] mt-1" style={{ color: "var(--text-dim)" }}>{s.created_at?.slice(0, 10)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Mastery progress bar ───────────────────────────────

function MasteryBar({ score }: { score: number }) {
  const color = score >= 70 ? "var(--moss)" : score >= 40 ? "var(--gold)" : "var(--ember)";
  return (
    <div className="w-16 h-1.5 rounded-full" style={{ background: "var(--border)" }}>
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, score)}%`, background: color }} />
    </div>
  );
}
