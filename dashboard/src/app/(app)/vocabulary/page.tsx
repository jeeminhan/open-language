"use client";

import { useState, useEffect } from "react";

interface VocabItem {
  id: string;
  word: string;
  reading: string | null;
  language: string;
  times_used: number;
  times_used_correctly: number;
  first_used: string;
  last_used: string | null;
}

export default function VocabularyPage() {
  const [vocab, setVocab] = useState<VocabItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unknown" | "known">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/vocabulary")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setVocab(data);
      })
      .catch(() => {});
  }, []);

  async function toggleWord(word: string, currentLang: string) {
    const action = currentLang === "unknown" ? "mark_known" : "mark_unknown";
    await fetch("/api/vocabulary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, action }),
    });
    setVocab((prev) =>
      prev.map((v) =>
        v.word === word
          ? { ...v, language: currentLang === "unknown" ? "target" : "unknown" }
          : v
      )
    );
  }

  const unknown = vocab.filter((v) => v.language === "unknown");
  const known = vocab.filter((v) => v.language !== "unknown");

  const filtered = (filter === "unknown" ? unknown : filter === "known" ? known : vocab)
    .filter((v) => !search || v.word.includes(search));

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center" style={{ borderTop: "3px solid var(--gold)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--gold)" }}>{vocab.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Total Words</div>
        </div>
        <div className="card text-center" style={{ borderTop: "3px solid var(--moss)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--moss)" }}>{known.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Known</div>
        </div>
        <div className="card text-center" style={{ borderTop: "3px solid var(--ember)" }}>
          <div className="text-2xl font-bold" style={{ color: "var(--ember)" }}>{unknown.length}</div>
          <div className="text-xs" style={{ color: "var(--text-dim)" }}>Learning</div>
        </div>
      </div>

      {/* Filter + search */}
      <div className="flex gap-2 items-center flex-wrap">
        {(["all", "unknown", "known"] as const).map((f) => (
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
            {f === "all" ? `All (${vocab.length})` : f === "unknown" ? `Learning (${unknown.length})` : `Known (${known.length})`}
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
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => toggleWord(v.word, v.language)}
              className="group rounded-xl p-3 text-left transition-all"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${v.language === "unknown" ? "rgba(196, 94, 74, 0.3)" : "var(--border)"}`,
              }}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
                  {v.word}
                </span>
                {v.language === "unknown" ? (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(196, 94, 74, 0.15)", color: "var(--ember)" }}>
                    learning
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(126, 154, 110, 0.15)", color: "var(--moss)" }}>
                    known
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px]" style={{ color: "var(--text-dim)" }}>
                <span>{v.times_used}x used</span>
                {v.last_used && <span>{v.last_used.slice(0, 10)}</span>}
              </div>
              <div className="text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: v.language === "unknown" ? "var(--moss)" : "var(--ember)" }}>
                {v.language === "unknown" ? "Click to mark as known" : "Click to mark as learning"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
