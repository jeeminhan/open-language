"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level: string;
  created_at: string;
  user_id: string | null;
}

interface SessionRow {
  id: string;
  mode: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  total_turns: number;
  errors_detected: number;
}

interface ErrorRow {
  id: string;
  category: string;
  severity: string | null;
  description: string | null;
  l1_source: string | null;
  example_utterances: string | null;
  occurrence_count: number;
  times_corrected: number;
  first_seen: string;
  last_seen: string | null;
  status: string | null;
}

interface GrammarRow {
  id: string;
  pattern: string;
  level: string | null;
  mastery_score: number;
}

interface DetailData {
  learner: Learner;
  sessions: SessionRow[];
  errors: ErrorRow[];
  grammar: GrammarRow[];
  vocabStats: { total: number; mastered: number; learning: number; weak: number };
  errorCategoryCounts: Record<string, number>;
}

export default function LearnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/learners/${id}`)
      .then(async (r) => {
        if (r.status === 403) {
          setError("Forbidden");
          return null;
        }
        if (r.status === 404) {
          setError("Learner not found");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d && !d.error) setData(d);
      })
      .catch(() => setError("Failed to load"));
  }, [id]);

  if (error) {
    return <div className="max-w-3xl mx-auto"><p style={{ color: "var(--ember)" }}>{error}</p></div>;
  }
  if (!data) {
    return <div className="max-w-3xl mx-auto"><p style={{ color: "var(--text-dim)" }}>Loading...</p></div>;
  }

  const l = data.learner;
  const totalSessions = data.sessions.length;
  const totalTurns = data.sessions.reduce((n, s) => n + (s.total_turns || 0), 0);
  const totalErrors = data.errors.reduce((n, e) => n + (e.occurrence_count || 0), 0);
  const filteredErrors = categoryFilter
    ? data.errors.filter((e) => e.category === categoryFilter)
    : data.errors;

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/admin" className="text-xs" style={{ color: "var(--river)" }}>
        ← Back to admin
      </Link>

      <div className="mt-3 mb-6">
        <h2 className="text-lg font-bold" style={{ color: "var(--river)" }}>{l.name}</h2>
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          {l.native_language} → {l.target_language} · {l.proficiency_level} · joined {new Date(l.created_at).toLocaleDateString()}
        </p>
        <p className="text-xs font-mono mt-1" style={{ color: "var(--text-dim)" }}>
          learner: {l.id} · user: {l.user_id || "(none)"}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Sessions" value={totalSessions} />
        <StatCard label="Turns" value={totalTurns} />
        <StatCard label="Error Instances" value={totalErrors} sub={`${data.errors.length} patterns`} />
        <StatCard label="Vocab" value={data.vocabStats.total} sub={`${data.vocabStats.mastered} mastered`} />
      </div>

      {/* Error categories as filter chips */}
      <div className="mb-3">
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>
          Error Patterns ({filteredErrors.length})
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <Chip
            active={categoryFilter === null}
            onClick={() => setCategoryFilter(null)}
            label={`all (${data.errors.length})`}
          />
          {Object.entries(data.errorCategoryCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <Chip
                key={cat}
                active={categoryFilter === cat}
                onClick={() => setCategoryFilter(cat)}
                label={`${cat} (${count})`}
              />
            ))}
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden mb-6" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm" style={{ background: "var(--bg-card)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <Th>Category</Th>
              <Th>Severity</Th>
              <Th>Description</Th>
              <Th>Example</Th>
              <Th>Count</Th>
              <Th>Last seen</Th>
            </tr>
          </thead>
          <tbody>
            {filteredErrors.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)", verticalAlign: "top" }}>
                <Td><span className="font-mono text-xs">{e.category}</span></Td>
                <Td>
                  <span style={{
                    color: e.severity === "high" ? "var(--ember)" : e.severity === "low" ? "var(--text-dim)" : "var(--text)",
                  }}>
                    {e.severity || "—"}
                  </span>
                </Td>
                <Td>{e.description || "—"}</Td>
                <Td dim>
                  <span className="text-xs italic">{truncate(e.example_utterances, 80)}</span>
                </Td>
                <Td mono>{e.occurrence_count}</Td>
                <Td dim>{e.last_seen ? formatDate(e.last_seen) : "—"}</Td>
              </tr>
            ))}
            {filteredErrors.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-dim)" }}>No errors</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Grammar */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          Grammar Inventory ({data.grammar.length})
        </h3>
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--bg-card)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <Th>Pattern</Th>
                <Th>Level</Th>
                <Th>Mastery</Th>
              </tr>
            </thead>
            <tbody>
              {data.grammar.map((g) => (
                <tr key={g.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td>{g.pattern}</Td>
                  <Td dim>{g.level || "—"}</Td>
                  <Td><MasteryBar score={g.mastery_score || 0} /></Td>
                </tr>
              ))}
              {data.grammar.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center" style={{ color: "var(--text-dim)" }}>None tracked</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessions */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          Sessions ({data.sessions.length})
        </h3>
        <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--bg-card)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <Th>When</Th>
                <Th>Mode</Th>
                <Th>Duration</Th>
                <Th>Turns</Th>
                <Th>Errors</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td dim>{formatDate(s.started_at)}</Td>
                  <Td>{s.mode}</Td>
                  <Td mono>{formatDuration(s.duration_seconds)}</Td>
                  <Td mono>{s.total_turns}</Td>
                  <Td mono>
                    <span style={{ color: s.errors_detected > 5 ? "var(--ember)" : "var(--text-dim)" }}>
                      {s.errors_detected}
                    </span>
                  </Td>
                  <Td>
                    {s.ended_at ? (
                      <Link href={`/sessions/${s.id}`} style={{ color: "var(--river)" }}>open →</Link>
                    ) : (
                      <span style={{ color: "var(--text-dim)" }}>in progress</span>
                    )}
                  </Td>
                </tr>
              ))}
              {data.sessions.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-dim)" }}>No sessions</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg p-4 border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-dim)" }}>{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>{value.toLocaleString()}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>{sub}</div>}
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-mono border transition-colors"
      style={{
        background: active ? "var(--river)" : "var(--bg-card)",
        color: active ? "var(--bg)" : "var(--text-dim)",
        borderColor: active ? "var(--river)" : "var(--border)",
      }}
    >
      {label}
    </button>
  );
}

function MasteryBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score)) * 100;
  const color = score >= 0.8 ? "var(--river)" : score >= 0.4 ? "var(--text)" : "var(--ember)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--border)", minWidth: 80, maxWidth: 160 }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color: "var(--text-dim)", minWidth: 36 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2.5 text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-dim)" }}>
      {children}
    </th>
  );
}

function Td({ children, mono, dim }: { children: React.ReactNode; mono?: boolean; dim?: boolean }) {
  return (
    <td className={`px-4 py-2.5 ${mono ? "font-mono" : ""}`} style={{ color: dim ? "var(--text-dim)" : "var(--text)" }}>
      {children}
    </td>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function truncate(s: string | null, max: number): string {
  if (!s) return "—";
  return s.length > max ? s.slice(0, max) + "…" : s;
}
