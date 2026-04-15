"use client";

import { useState, useEffect } from "react";

type SrsState = "seen" | "learning" | "reviewing" | "known";

interface VocabItem {
  id: string;
  word: string;
  reading: string | null;
  language: string;
  times_used: number;
  times_used_correctly: number;
  first_used: string;
  last_used: string | null;
  srs_state: SrsState;
  interval_days: number;
  next_review_at: string | null;
  review_count: number;
}

type Filter = "learning" | "known" | "all";

export default function VocabularyPage() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [filter, setFilter] = useState<Filter>("learning");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/vocabulary")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVocab(data);
      })
      .catch(() => {});
  }, []);

  async function toggleWord(word: string, state: SrsState) {
    const action = state === "learning" || state === "reviewing" ? "mark_known" : "mark_unknown";
    await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, action }),
    });
    setVocab((prev) =>
      prev.map((v) =>
        v.word === word
          ? {
              ...v,
              srs_state: action === "mark_known" ? "known" : "learning",
              language: action === "mark_known" ? "target" : "unknown",
            }
          : v
      )
    );
  }

  const nowMs = Date.now();
  const learning = vocab.filter((v) => v.srs_state === "learning" || v.srs_state === "reviewing");
  const known = vocab.filter((v) => v.srs_state === "known");
  const dueToday = learning.filter(
    (v) => !v.next_review_at || new Date(v.next_review_at).getTime() <= nowMs
  );

  const base = filter === "learning" ? learning : filter === "known" ? known : vocab;
  const filtered = base.filter((v) => !search || v.word.includes(search));

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center" style={{ borderTop: "3px solid var(--ember)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--ember)" }}>{learning.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Learning</div>
        </div>
        <div className="card text-center" style={{ borderTop: "3px solid var(--gold)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{dueToday.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Due now</div>
        </div>
        <div className="card text-center" style={{ borderTop: "3px solid var(--moss)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--moss)" }}>{known.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Known</div>
        </div>
      </div>

      {/* Filter + search */}
      <div className="flex gap-2 items-center flex-wrap">
        {(["learning", "known", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: filter === f ? "var(--river)" : "var(--bg-card)",
              color: filter === f ? "white" : "var(--text-dim)",
              border: `1px solid ${filter === f ? "var(--river)" : "var(--border)"}`,
            }}
          >
            {f === "learning" ? `Learning (${learning.length})` : f === "known" ? `Known (${known.length})` : `All (${vocab.length})`}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search words..."
          className="ml-auto px-3 py-1.5 rounded-lg text-xs outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text)" }}
        />
      </div>

      {/* Word list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-8">
          <p style={{ color: "var(--text-dim)" }}>
            {vocab.length === 0
              ? "No vocabulary tracked yet. Start a conversation to begin building your word list."
              : "No words match your filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filtered.map((v) => {
            const isLearning = v.srs_state === "learning" || v.srs_state === "reviewing";
            const stateColor = v.srs_state === "learning"
              ? "var(--ember)"
              : v.srs_state === "reviewing"
                ? "var(--gold)"
                : v.srs_state === "known"
                  ? "var(--moss)"
                  : "var(--text-dim)";
            const stateBg = v.srs_state === "learning"
              ? "rgba(196, 94, 74, 0.15)"
              : v.srs_state === "reviewing"
                ? "rgba(201, 162, 39, 0.15)"
                : v.srs_state === "known"
                  ? "rgba(126, 154, 110, 0.15)"
                  : "rgba(138, 135, 128, 0.15)";
            return (
              <button
                key={v.id}
                onClick={() => toggleWord(v.word, v.srs_state)}
                className="group rounded-xl p-3 text-left transition-all"
                style={{
                  background: "var(--bg-card)",
                  border: `1px solid ${isLearning ? "rgba(196, 94, 74, 0.3)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                    {v.word}
                  </span>
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: stateBg, color: stateColor }}>
                    {v.srs_state}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: "var(--text-dim)" }}>
                  <span>{v.times_used}x</span>
                  {v.review_count > 0 && <span>·  reviewed {v.review_count}x</span>}
                  {v.interval_days > 0 && <span>·  {v.interval_days}d interval</span>}
                </div>
                <div className="text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: isLearning ? "var(--moss)" : "var(--ember)" }}>
                  {isLearning ? "Click to mark as known" : "Click to mark as learning"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
