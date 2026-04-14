"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { INTEREST_PRESETS } from "@/lib/interestPresets";

interface InterestFact {
  fact: string;
  source: string;
  ts: string;
}

interface Interest {
  id: string;
  category: string;
  name: string;
  details: string | null;
  source: string;
  confidence: number;
  mention_count: number;
  facts?: InterestFact[] | null;
}

interface Topic {
  topic: string;
  context?: string | null;
  webSnippet?: string | null;
  grammarTarget?: string | null;
  interestConnection?: string | null;
}

const CATEGORIES = [
  "music", "movies", "tv_shows", "anime", "games", "sports",
  "food", "travel", "technology", "books", "culture", "hobbies",
  "work", "school", "news", "other",
];

export default function InterestsPage() {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<Set<number>>(new Set());

  // Add interest form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newDetails, setNewDetails] = useState("");
  const [saving, setSaving] = useState(false);

  // Preset picker + expanded facts
  const [showPresets, setShowPresets] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const existingNames = useMemo(
    () => new Set(interests.map((i) => i.name.toLowerCase().trim())),
    [interests]
  );

  const fetchInterests = useCallback(async () => {
    try {
      const res = await fetch("/api/interests");
      const data = await res.json();
      if (Array.isArray(data)) setInterests(data);
    } catch { /* */ }
  }, []);

  const fetchTopics = useCallback(async () => {
    setLoadingTopics(true);
    try {
      const res = await fetch("/api/topics");
      const data = await res.json();
      if (data.topics) setTopics(data.topics);
    } catch { /* */ }
    setLoadingTopics(false);
  }, []);

  useEffect(() => { fetchInterests(); fetchTopics(); }, [fetchInterests, fetchTopics]);

  async function addInterest() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          details: newDetails.trim() || null,
          source: "manual",
          confidence: 1.0,
        }),
      });
      setNewName("");
      setNewDetails("");
      setShowAdd(false);
      await fetchInterests();
    } catch { /* */ }
    setSaving(false);
  }

  async function addPreset(name: string, category: string) {
    try {
      await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, source: "preset", confidence: 1.0 }),
      });
      await fetchInterests();
    } catch { /* */ }
  }

  async function removeInterest(id: string) {
    setInterests((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch("/api/interests", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch { /* */ }
  }

  function toggleTopic(idx: number) {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function startChatWithTopics() {
    const chosen = Array.from(selectedTopics).map((i) => topics[i]?.topic).filter(Boolean);
    if (chosen.length === 0) return;
    // Store selected topics and navigate to chat
    sessionStorage.setItem("chat_topics", JSON.stringify(chosen));
    window.location.href = "/chat";
  }

  const groupedInterests = interests.reduce<Record<string, Interest[]>>((acc, i) => {
    const cat = i.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(i);
    return acc;
  }, {});

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--river)" }}>
            Interests &amp; Topics
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
            Your interests shape what your tutor talks about
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowPresets(!showPresets); if (!showPresets) setShowAdd(false); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: showPresets ? "var(--river)" : "var(--bg-card)", color: showPresets ? "white" : "var(--text)", border: "1px solid var(--border)" }}
          >
            Browse presets
          </button>
          <button
            onClick={() => { setShowAdd(!showAdd); if (!showAdd) setShowPresets(false); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--moss)", color: "white" }}
          >
            + Add Interest
          </button>
        </div>
      </div>

      {/* Presets picker */}
      {showPresets && (
        <div
          className="rounded-lg p-4 mb-6 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
            Tap any to add. Your tutor will start learning specifics from chats.
          </p>
          {Object.entries(
            INTEREST_PRESETS.reduce<Record<string, typeof INTEREST_PRESETS>>((acc, p) => {
              (acc[p.category] ||= []).push(p);
              return acc;
            }, {})
          ).map(([cat, items]) => (
            <div key={cat} className="mb-3 last:mb-0">
              <div className="text-xs uppercase tracking-wider mb-1.5" style={{ color: "var(--text-dim)" }}>
                {cat.replace("_", " ")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {items.map((p) => {
                  const added = existingNames.has(p.name.toLowerCase().trim());
                  return (
                    <button
                      key={p.name}
                      onClick={() => !added && addPreset(p.name, p.category)}
                      disabled={added}
                      title={p.hint}
                      className="px-2.5 py-1 rounded-full text-xs border transition-all"
                      style={{
                        background: added ? "var(--bg)" : "var(--bg-card)",
                        borderColor: added ? "var(--moss)" : "var(--border)",
                        color: added ? "var(--moss)" : "var(--text)",
                        cursor: added ? "default" : "pointer",
                        opacity: added ? 0.7 : 1,
                      }}
                    >
                      {added ? "✓ " : "+ "}{p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div
          className="rounded-lg p-4 mb-6 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              placeholder="Interest name (e.g. BTS, cooking, basketball)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.replace("_", " ")}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Details (optional — e.g. 'favorite member is Jimin', 'love Italian food')"
            value={newDetails}
            onChange={(e) => setNewDetails(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addInterest(); }}
            className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={addInterest}
              disabled={saving || !newName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: newName.trim() ? "var(--moss)" : "var(--border)",
                color: newName.trim() ? "white" : "var(--text-dim)",
              }}
            >
              {saving ? "Saving..." : "Add"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg text-sm transition-all"
              style={{ color: "var(--text-dim)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Interests by category */}
      {Object.keys(groupedInterests).length > 0 ? (
        <div className="mb-8">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text)" }}>
            Your Interests
          </h3>
          <div className="space-y-3">
            {Object.entries(groupedInterests).map(([category, items]) => (
              <div key={category}>
                <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-dim)" }}>
                  {category.replace("_", " ")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {items.map((interest) => {
                    const factCount = interest.facts?.length ?? 0;
                    const isOpen = expandedId === interest.id;
                    return (
                      <div key={interest.id} className="flex flex-col">
                        <div
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-all cursor-pointer"
                          onClick={() => setExpandedId(isOpen ? null : interest.id)}
                          style={{
                            background: isOpen ? "var(--bg-hover)" : "var(--bg-card)",
                            borderColor: isOpen ? "var(--river)" : "var(--border)",
                            color: "var(--text)",
                          }}
                        >
                          <span>{interest.name}</span>
                          {factCount > 0 && (
                            <span className="text-xs px-1.5 rounded-full" style={{ background: "var(--bg)", color: "var(--gold)" }}>
                              {factCount}
                            </span>
                          )}
                          {interest.mention_count > 1 && (
                            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                              {interest.mention_count}x
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeInterest(interest.id); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            style={{ color: "var(--ember)" }}
                          >
                            x
                          </button>
                        </div>
                        {isOpen && (
                          <div
                            className="mt-2 ml-2 rounded-lg p-3 border text-xs space-y-1.5 max-w-sm"
                            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                          >
                            {interest.details && (
                              <div style={{ color: "var(--text-dim)" }}>
                                <span className="uppercase tracking-wider text-[10px] mr-1">notes</span>
                                {interest.details}
                              </div>
                            )}
                            {factCount > 0 ? (
                              <ul className="space-y-1">
                                {interest.facts!.map((f, idx) => (
                                  <li key={idx} style={{ color: "var(--text)" }}>
                                    <span style={{ color: "var(--gold)" }}>•</span> {f.fact}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p style={{ color: "var(--text-dim)" }}>
                                No specifics learned yet — chat about {interest.name} and your tutor will start filling this in.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rounded-lg p-6 mb-8 text-center border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm mb-2" style={{ color: "var(--text-dim)" }}>
            No interests yet. Add some to get personalized conversation topics!
          </p>
          <p className="text-xs" style={{ color: "var(--text-dim)" }}>
            Your tutor also detects interests from your conversations automatically.
          </p>
        </div>
      )}

      {/* Topics */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Suggested Topics
        </h3>
        <div className="flex gap-2">
          {selectedTopics.size > 0 && (
            <button
              onClick={startChatWithTopics}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
              style={{ background: "var(--river)", color: "white" }}
            >
              Chat about {selectedTopics.size} topic{selectedTopics.size > 1 ? "s" : ""}
            </button>
          )}
          <button
            onClick={fetchTopics}
            disabled={loadingTopics}
            className="px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{ color: "var(--text-dim)", border: "1px solid var(--border)" }}
          >
            {loadingTopics ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {loadingTopics && topics.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Generating personalized topics...
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {topics.map((topic, i) => (
            <button
              key={i}
              onClick={() => toggleTopic(i)}
              className="text-left rounded-lg p-4 border transition-all hover:scale-[1.01]"
              style={{
                background: selectedTopics.has(i) ? "var(--bg-hover)" : "var(--bg-card)",
                borderColor: selectedTopics.has(i) ? "var(--river)" : "var(--border)",
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
                {topic.topic}
              </p>
              {topic.context && (
                <p className="text-xs leading-relaxed mb-1" style={{ color: "var(--text-dim)" }}>
                  {topic.context}
                </p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                {topic.grammarTarget && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--river)" }}>
                    {topic.grammarTarget}
                  </span>
                )}
                {topic.interestConnection && (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--bg)", color: "var(--gold)" }}>
                    {topic.interestConnection}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
