"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SUPPORTED_NATIVE_LANGUAGE,
  SUPPORTED_TARGET_LANGUAGE,
} from "@/lib/supportedLanguage";

const PAIRS = [
  {
    native: SUPPORTED_NATIVE_LANGUAGE,
    target: SUPPORTED_TARGET_LANGUAGE,
    nativeFlag: "En",
    targetFlag: "日",
  },
];

const LEVELS = [
  { value: "A1", label: "Complete Beginner", desc: "I know almost nothing" },
  { value: "A2", label: "Elementary", desc: "I know basic words and phrases" },
  { value: "B1", label: "Intermediate", desc: "I can hold simple conversations" },
  { value: "B2", label: "Upper Intermediate", desc: "I'm comfortable in most situations" },
  { value: "C1", label: "Advanced", desc: "I'm fluent but want to refine" },
  { value: "C2", label: "Near Native", desc: "I want to perfect my skills" },
];

type Step = "welcome" | "pair" | "level" | "name" | "creating";

function isGuestLaunch(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("guest") === "1";
}

function rememberActiveLearner(id: string): void {
  localStorage.setItem("active_learner", id);
  document.cookie = `active_learner=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isGuest] = useState(isGuestLaunch);
  const [step, setStep] = useState<Step>(() =>
    isGuestLaunch() ? "pair" : "welcome"
  );
  const [pairIdx, setPairIdx] = useState<number | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const pair = pairIdx !== null ? PAIRS[pairIdx] : null;

  async function createProfile(nameOverride?: string, levelOverride?: string) {
    const resolvedName = (nameOverride ?? name).trim();
    const resolvedLevel = levelOverride ?? level;
    if (!resolvedName || !pair || !resolvedLevel) return;
    setStep("creating");
    setError("");

    try {
      const res = await fetch("/api/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resolvedName,
          nativeLanguage: pair.native,
          targetLanguage: pair.target,
          level: resolvedLevel,
          tolerance: "moderate",
        }),
      });
      const data = await res.json();
      if (data.id) {
        rememberActiveLearner(data.id);
        router.replace("/home");
      } else {
        setError(data.error || "Something went wrong");
        setStep(isGuest ? "level" : "name");
      }
    } catch {
      setError("Failed to create profile. Please try again.");
      setStep(isGuest ? "level" : "name");
    }
  }

  const stepNumber =
    step === "welcome" ? 0 :
    step === "pair" ? 1 :
    step === "level" ? 2 :
    step === "name" ? 3 : 4;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "var(--bg)", zIndex: 100 }}
    >
      {/* Progress dots */}
      {step !== "welcome" && step !== "creating" && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 flex gap-2">
          {[1, 2, 3].map((n) => (
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
              onClick={() => setStep("pair")}
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

        {/* Pick your pair */}
        {step === "pair" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("welcome")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              Pick your pair
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              Your native language and the one you&apos;re learning
            </p>
            <div className="grid grid-cols-1 gap-3">
              {PAIRS.map((p, i) => (
                <button
                  key={`${p.native}-${p.target}`}
                  onClick={() => { setPairIdx(i); setStep("level"); }}
                  className="flex items-center gap-4 p-4 rounded-lg border transition-all hover:scale-[1.01]"
                  style={{
                    background: pairIdx === i ? "var(--bg-hover)" : "var(--bg-card)",
                    borderColor: pairIdx === i ? "var(--gold)" : "var(--border)",
                    color: "var(--text)",
                  }}
                >
                  <span className="w-8 h-8 rounded-md flex items-center justify-center font-bold"
                    style={{ background: "var(--bg)", color: "var(--text-dim)", fontSize: "14px" }}
                  >
                    {p.nativeFlag}
                  </span>
                  <span className="text-sm font-medium">{p.native}</span>
                  <span className="text-sm" style={{ color: "var(--text-dim)" }}>&rarr;</span>
                  <span className="w-8 h-8 rounded-md flex items-center justify-center font-bold"
                    style={{ background: "var(--bg)", color: "var(--text-dim)", fontSize: "14px" }}
                  >
                    {p.targetFlag}
                  </span>
                  <span className="text-sm font-medium">{p.target}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Proficiency Level */}
        {step === "level" && (
          <div className="animate-in">
            <button
              onClick={() => setStep("pair")}
              className="mb-6 text-sm transition-colors"
              style={{ color: "var(--text-dim)" }}
            >
              &larr; Back
            </button>
            <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text)" }}>
              How well do you speak {pair?.target}?
            </h2>
            <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
              Don&apos;t worry, we&apos;ll adapt as we learn more about you
            </p>
            <div className="space-y-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => {
                    setLevel(l.value);
                    if (isGuest) {
                      createProfile("friend", l.value);
                    } else {
                      setStep("name");
                    }
                  }}
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
              onClick={() => createProfile()}
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
