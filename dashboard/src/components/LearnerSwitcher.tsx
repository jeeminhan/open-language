"use client";

import { useState, useEffect, useRef } from "react";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level: string;
}

export default function LearnerSwitcher() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/learners")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLearners(data);
          const stored = localStorage.getItem("active_learner");
          const valid = data.find((l: Learner) => l.id === stored);
          setActive(valid ? stored : data[0].id);
        } else {
          // No learners — redirect to onboarding
          window.location.href = "/onboarding";
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (active) {
      localStorage.setItem("active_learner", active);
      document.cookie = `active_learner=${encodeURIComponent(active)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [active]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = learners.find((l) => l.id === active);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); setShowCreate(false); }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          color: "var(--text)",
        }}
      >
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: learners.length > 0 ? "var(--moss)" : "var(--ember)" }}
        />
        {current?.name ?? "Create Learner"}
        <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>
          {current ? `${current.target_language} ${current.proficiency_level}` : ""}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.5 }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 min-w-[240px] rounded-lg overflow-hidden z-50 shadow-lg"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
          }}
        >
          {learners.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setActive(l.id);
                setOpen(false);
                window.location.reload();
              }}
              className="w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors"
              style={{
                background: l.id === active ? "var(--bg-hover)" : "transparent",
                color: l.id === active ? "var(--gold)" : "var(--text)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = l.id === active ? "var(--bg-hover)" : "transparent")}
            >
              <span>{l.name}</span>
              <span style={{ color: "var(--text-dim)", fontSize: "11px" }}>
                {l.native_language} → {l.target_language} ({l.proficiency_level})
              </span>
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {showCreate ? (
              <CreateLearnerForm
                onCreated={(l) => {
                  setLearners([...learners, l]);
                  setActive(l.id);
                  setShowCreate(false);
                  setOpen(false);
                  window.location.reload();
                }}
              />
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full text-left px-3 py-2 text-sm transition-colors"
                style={{ color: "var(--moss)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                + New Learner
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateLearnerForm({ onCreated }: { onCreated: (l: Learner) => void }) {
  const [name, setName] = useState("");
  const [native, setNative] = useState("English");
  const [target, setTarget] = useState("Korean");
  const [level, setLevel] = useState("A2");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nativeLanguage: native,
          targetLanguage: target,
          level,
          tolerance: "moderate",
        }),
      });
      const data = await res.json();
      if (data.id) onCreated(data);
    } catch { /* ignore */ }
    setSaving(false);
  }

  const inputStyle = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: "6px",
    padding: "4px 8px",
    fontSize: "12px",
    width: "100%",
  };

  return (
    <form onSubmit={submit} className="p-3 space-y-2">
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <select value={native} onChange={(e) => setNative(e.target.value)} style={inputStyle}>
          {["English", "Korean", "Japanese", "Chinese", "Spanish", "French", "German", "Portuguese"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle}>
          {["Korean", "English", "Japanese", "Chinese", "Spanish", "French", "German", "Portuguese"].map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <select value={level} onChange={(e) => setLevel(e.target.value)} style={inputStyle}>
        {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full py-1.5 rounded-md text-xs font-medium transition-all"
        style={{
          background: name.trim() ? "var(--moss)" : "var(--border)",
          color: name.trim() ? "white" : "var(--text-dim)",
        }}
      >
        {saving ? "Creating..." : "Create Learner"}
      </button>
    </form>
  );
}
