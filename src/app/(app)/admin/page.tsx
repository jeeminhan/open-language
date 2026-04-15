"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level: string;
  created_at: string;
  sessions: number;
  turns: number;
}

interface SessionRow {
  id: string;
  learner_id: string;
  mode: string;
  started_at: string;
  duration_seconds: number | null;
  total_turns: number;
  errors_detected: number;
}

interface UserGroup {
  user_id: string;
  learner_count: number;
  learners: Learner[];
  sessions: number;
  turns: number;
  first_joined: string;
  languages: string[];
}

interface AdminData {
  summary: {
    totalLearners: number;
    totalUsers: number;
    newLearners7d: number;
    totalSessions: number;
    turnsLast24h: number;
    totalVocab: number;
    avgMastery: number;
    totalErrors: number;
  };
  learners: Learner[];
  users: UserGroup[];
  recentSessions: SessionRow[];
  topErrors: { category: string; count: number }[];
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin")
      .then(async (r) => {
        if (r.status === 403) {
          setError("Forbidden — your user ID is not in ADMIN_USER_IDS");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setError("Failed to load"));
  }, []);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <p style={{ color: "var(--ember)" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto">
        <p style={{ color: "var(--text-dim)" }}>Loading...</p>
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--river)" }}>
        Admin
      </h2>
      <p className="text-xs mb-6" style={{ color: "var(--text-dim)" }}>
        Internal data view — not linked from user nav
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Users" value={s.totalUsers} sub={`${s.totalLearners} learners, +${s.newLearners7d} wk`} />
        <StatCard label="Sessions" value={s.totalSessions} sub={`${s.turnsLast24h} turns (24h)`} />
        <StatCard label="Vocab Items" value={s.totalVocab} />
        <StatCard label="Errors Logged" value={s.totalErrors} sub={`${s.avgMastery} avg mastery`} />
      </div>

      {/* Activity chart */}
      {data.users.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
            Activity by User
          </h3>
          <div
            className="rounded-lg border p-4"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.users.map((u) => ({
                  label: u.learners.map((l) => l.name).join(", ") || u.user_id.slice(0, 8),
                  sessions: u.sessions,
                  turns: u.turns,
                  learners: u.learner_count,
                }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
                <XAxis dataKey="label" stroke="#8a8780" fontSize={11} />
                <YAxis stroke="#8a8780" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#12121a",
                    border: "1px solid #2a2a36",
                    borderRadius: "8px",
                    color: "#e0ddd5",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="sessions" fill="#5b8a9a" />
                <Bar dataKey="turns" fill="#c45e4a" />
                <Bar dataKey="learners" fill="#8a8780" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top error categories */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          Top Error Categories
        </h3>
        <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
          {data.topErrors.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: "var(--text-dim)", background: "var(--bg-card)" }}>
              No errors logged yet
            </p>
          ) : (
            data.topErrors.map((e, i) => (
              <div
                key={e.category}
                className="flex items-center justify-between px-4 py-2.5 text-sm"
                style={{
                  background: "var(--bg-card)",
                  borderTop: i > 0 ? "1px solid var(--border)" : "none",
                }}
              >
                <span style={{ color: "var(--text)" }}>{e.category}</span>
                <span className="font-mono" style={{ color: "var(--text-dim)" }}>{e.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Users grouped by UUID */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          Users ({data.users.length})
        </h3>
        <div className="space-y-3">
          {data.users.map((u) => (
            <div
              key={u.user_id}
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-xs" style={{ color: "var(--text)" }}>
                    {u.user_id}
                  </span>
                  <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                    {u.learner_count} {u.learner_count === 1 ? "learner" : "learners"} · {u.languages.join(", ")}
                  </span>
                </div>
                <div className="text-xs font-mono" style={{ color: "var(--text-dim)" }}>
                  {u.sessions} sessions · {u.turns} turns · joined {formatDate(u.first_joined)}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <Th>Name</Th>
                    <Th>Native → Target</Th>
                    <Th>Level</Th>
                    <Th>Sessions</Th>
                    <Th>Turns</Th>
                    <Th>Joined</Th>
                  </tr>
                </thead>
                <tbody>
                  {u.learners.map((l) => (
                    <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <Td bold>
                        <Link href={`/admin/learners/${l.id}`} style={{ color: "var(--river)" }}>
                          {l.name}
                        </Link>
                      </Td>
                      <Td>{l.native_language} → {l.target_language}</Td>
                      <Td>{l.proficiency_level}</Td>
                      <Td mono>{l.sessions}</Td>
                      <Td mono>{l.turns}</Td>
                      <Td dim>{formatDate(l.created_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {data.users.length === 0 && (
            <p className="p-4 text-sm text-center rounded-lg border" style={{ color: "var(--text-dim)", background: "var(--bg-card)", borderColor: "var(--border)" }}>
              No users yet
            </p>
          )}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
          Recent Sessions
        </h3>
        <div className="rounded-lg overflow-x-auto border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-sm" style={{ background: "var(--bg-card)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <Th>When</Th>
                <Th>Mode</Th>
                <Th>Duration</Th>
                <Th>Turns</Th>
                <Th>Errors</Th>
                <Th>View</Th>
              </tr>
            </thead>
            <tbody>
              {data.recentSessions.map((sess) => (
                <tr key={sess.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <Td dim>{formatDate(sess.started_at)}</Td>
                  <Td>{sess.mode}</Td>
                  <Td mono>{formatDuration(sess.duration_seconds)}</Td>
                  <Td mono>{sess.total_turns}</Td>
                  <Td mono>
                    <span style={{ color: sess.errors_detected > 5 ? "var(--ember)" : "var(--text-dim)" }}>
                      {sess.errors_detected}
                    </span>
                  </Td>
                  <Td>
                    <Link href={`/sessions/${sess.id}`} style={{ color: "var(--river)" }}>
                      open →
                    </Link>
                  </Td>
                </tr>
              ))}
              {data.recentSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center" style={{ color: "var(--text-dim)" }}>
                    No completed sessions yet
                  </td>
                </tr>
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
    <div
      className="rounded-lg p-4 border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: "var(--text)" }}>
        {value.toLocaleString()}
      </div>
      {sub && (
        <div className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-4 py-2.5 text-xs uppercase tracking-wider font-semibold"
      style={{ color: "var(--text-dim)" }}
    >
      {children}
    </th>
  );
}

function Td({ children, bold, mono, dim }: { children: React.ReactNode; bold?: boolean; mono?: boolean; dim?: boolean }) {
  return (
    <td
      className={`px-4 py-2.5 ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""}`}
      style={{ color: dim ? "var(--text-dim)" : "var(--text)" }}
    >
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
