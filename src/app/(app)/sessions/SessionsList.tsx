"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Session } from "@/lib/db";

type Mode = "all" | "chat" | "listen";

export interface RecapStats {
  vocabNew: number;
  vocabReviewed: number;
  grammar: number;
}

export default function SessionsList({
  sessions,
  recapStats = {},
}: {
  sessions: Session[];
  recapStats?: Record<string, RecapStats>;
}) {
  const [mode, setMode] = useState<Mode>("all");

  const modes = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) if (s.mode) set.add(s.mode);
    return set;
  }, [sessions]);

  const filtered = useMemo(() => {
    if (mode === "all") return sessions;
    return sessions.filter((s) => s.mode === mode);
  }, [sessions, mode]);

  const pills: { key: Mode; label: string; count: number }[] = [
    { key: "all", label: "All", count: sessions.length },
    ...(modes.has("chat") ? [{ key: "chat" as const, label: "Chat", count: sessions.filter((s) => s.mode === "chat").length }] : []),
    ...(modes.has("listen") ? [{ key: "listen" as const, label: "Listen", count: sessions.filter((s) => s.mode === "listen").length }] : []),
  ];

  return (
    <>
      {pills.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {pills.map((p) => {
            const active = mode === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setMode(p.key)}
                className="text-xs px-3 py-1.5 rounded-full border transition-all"
                style={{
                  background: active ? "var(--river)" : "transparent",
                  color: active ? "white" : "var(--text-dim)",
                  borderColor: active ? "var(--river)" : "var(--border)",
                }}
              >
                {p.label} <span style={{ opacity: 0.7 }}>({p.count})</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="card">
          <p style={{ color: "var(--text-dim)" }}>No sessions match this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const recap = recapStats[s.id];
            const hasRecap = recap && (recap.vocabNew > 0 || recap.vocabReviewed > 0 || recap.grammar > 0);
            return (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="card block hover:border-[var(--river)]"
              >
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <span className="text-sm font-medium">
                      {s.started_at?.slice(0, 16).replace("T", " ")}
                    </span>
                    <span className="text-xs ml-3" style={{ color: "var(--text-dim)" }}>
                      {s.mode} mode
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm" style={{ color: "var(--text-dim)" }}>
                    <span>{Math.round((s.duration_seconds ?? 0) / 60)}m</span>
                    <span>{s.total_turns} turns</span>
                    <span style={{ color: "var(--ember)" }}>{s.errors_detected} errors</span>
                    <span style={{ color: "var(--moss)" }}>{s.corrections_given} corrections</span>
                  </div>
                </div>
                {hasRecap && (
                  <div className="flex gap-3 mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                    {recap.vocabNew > 0 && (
                      <span><span style={{ color: "var(--ember)" }}>{recap.vocabNew}</span> new vocab</span>
                    )}
                    {recap.vocabReviewed > 0 && (
                      <span><span style={{ color: "var(--moss)" }}>{recap.vocabReviewed}</span> reviewed</span>
                    )}
                    {recap.grammar > 0 && (
                      <span><span style={{ color: "var(--river)" }}>{recap.grammar}</span> grammar</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
