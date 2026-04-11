"use client";

import { useState } from "react";

const LANGUAGES = [
  { code: "Korean", flag: "\ud55c", label: "Korean" },
  { code: "Japanese", flag: "\u65e5", label: "Japanese" },
  { code: "Chinese", flag: "\u4e2d", label: "Chinese" },
  { code: "English", flag: "En", label: "English" },
  { code: "Spanish", flag: "Es", label: "Spanish" },
  { code: "French", flag: "Fr", label: "French" },
  { code: "German", flag: "De", label: "German" },
  { code: "Portuguese", flag: "Pt", label: "Portuguese" },
];

const LEVELS = [
  { value: "A1", label: "Complete Beginner", desc: "I know almost nothing" },
  { value: "A2", label: "Elementary", desc: "I know basic words and phrases" },
  { value: "B1", label: "Intermediate", desc: "I can hold simple conversations" },
  { value: "B2", label: "Upper Intermediate", desc: "I'm comfortable in most situations" },
  { value: "C1", label: "Advanced", desc: "I'm fluent but want to refine" },
  { value: "C2", label: "Near Native", desc: "I want to perfect my skills" },
];

type Step = "welcome" | "native" | "target" | "level" | "name" | "creating";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("welcome");
  const [native, setNative] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function createProfile() {
    if (!name.trim() || !native || !target || !level) return;
    setStep("creating");
    setError("");

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
      if (data.id) {
        localStorage.setItem("active_learner", data.id);
        document.cookie = `active_learner=${encodeURIComponent(data.id)}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.href = "/chat";
      } else {
        setError(data.error || "Something went wrong");
        setStep("name");
      }
    } catch {
      setError("Failed to create profile. Please try again.");
      setStep("name");
    }
  }

  const stepNumber =
    step === "welcome" ? 0 :
    step === "native" ? 1 :
    step === "target" ? 2 :
    step === "level" ? 3 :
    step === "name" ? 4 : 5;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "var(--bg)", zIndex: 100 }}
    >
      {/* Progress dots */}
      {step !== "welcome" && step !== "creating" && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: n <= stepNumber ? "var(--gold)" : "var(--border)",
                transform: n === stepNumber ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      )}

      <div className="w-full max-w-lg px-6">
        {/* Welcome */}
        {step === "welcome" && (
          <div className="text-center animate-in">
            <h1
              className="text-4xl font-bold mb-3 tracking-tight"
              style={{ color: "var(--gold)" }}
            >
              open-language
            </h1>
            <p className="text-lg mb-2" style={{ color: "var(--text)" }}>
              Your AI language tutor
            </p>
            <p className="mb-10 text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
              Practice speaking naturally through conversation.<br />
              Get real-time feedback on grammar, vocabulary, and pronunciation.
            </p>
            <button
              onClick={() => setStep("native")}
              className="px-8 py-3 rounded-lg text-base font-medium transition-all hover:scale-105"
              style={{
                background: "var(--gold)",
                color: "var(--bg)",
              }}
            >
              Get Started
            </button>
          </div>
        )}

        {/* Native Language */}
        {step === "native" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("welcome")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              What&apos;s your native language?
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              This helps us understand your learning patterns
            </p>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setNative(lang.code); setStep("target"); }}
                  className="flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.02]"
                  style={{
                    background: native === lang.code ? "var(--bg-hover)" : "var(--bg-card)",
                    borderColor: native === lang.code ? "var(--gold)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <span className="text-xl w-8 h-8 rounded-md flex items-center justify-center font-bold"
                    style={{ background: "var(--bg)", color: "var(--text-dim)", fontSize: "14px" }}
                  >
                    {lang.flag}
                  </span>
                  <span className="text-sm font-medium">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Target Language */}
        {step === "target" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("native")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              What language are you learning?
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              Choose the language you want to practice
            </p>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.filter((l) => l.code !== native).map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => { setTarget(lang.code); setStep("level"); }}
                  className="flex items-center gap-3 p-4 rounded-lg border transition-all hover:scale-[1.02]"
                  style={{
                    background: target === lang.code ? "var(--bg-hover)" : "var(--bg-card)",
                    borderColor: target === lang.code ? "var(--gold)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <span className="text-xl w-8 h-8 rounded-md flex items-center justify-center font-bold"
                    style={{ background: "var(--bg)", color: "var(--text-dim)", fontSize: "14px" }}
                  >
                    {lang.flag}
                  </span>
                  <span className="text-sm font-medium">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Proficiency Level */}
        {step === "level" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("target")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              How well do you speak {target}?
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              Don&apos;t worry, we&apos;ll adapt as we learn more about you
            </p>
            <div className="space-y-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => { setLevel(l.value); setStep("name"); }}
                  className="w-full flex items-center justify-between p-4 rounded-lg border transition-all hover:scale-[1.01]"
                  style={{
                    background: level === l.value ? "var(--bg-hover)" : "var(--bg-card)",
                    borderColor: level === l.value ? "var(--gold)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">{l.label}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                      {l.desc}
                    </div>
                  </div>
                  <span
                    className="font-mono text-xs px-2 py-1 rounded"
                    style={{ background: "var(--bg)", color: "var(--text-dim)" }}
                  >
                    {l.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Name */}
        {step === "name" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("level")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              What should we call you?
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              Your tutor will use this name in conversations
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) createProfile(); }}
              placeholder="Your name"
              autoFocus
              className="w-full p-4 rounded-lg border text-base mb-4 outline-none transition-colors"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
            {error && (
              <p className="text-sm mb-3" style={{ color: "var(--ember)" }}>{error}</p>
            )}
            <button
              onClick={createProfile}
              disabled={!name.trim()}
              className="w-full py-3 rounded-lg text-base font-medium transition-all hover:scale-[1.02]"
              style={{
                background: name.trim() ? "var(--gold)" : "var(--border)",
                color: name.trim() ? "var(--bg)" : "var(--text-dim)",
                cursor: name.trim() ? "pointer" : "default",
              }}
            >
              Start Learning
            </button>
          </div>
        )}

        {/* Creating */}
        {step === "creating" && (
          <div className="text-center animate-in">
            <div
              className="w-10 h-10 rounded-full border-2 border-t-transparent mx-auto mb-4"
              style={{
                borderColor: "var(--gold)",
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <p style={{ color: "var(--text-dim)" }}>Setting up your profile...</p>
          </div>
        )}
      </div>

      <style>{`
        .animate-in {
          animation: fadeSlideIn 0.3s ease-out;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
