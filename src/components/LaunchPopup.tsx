"use client";

import { useState } from "react";
import {
  SUPPORTED_NATIVE_LANGUAGE,
  SUPPORTED_TARGET_LANGUAGE,
} from "@/lib/supportedLanguage";

interface Pair {
  native: string;
  target: string;
  nativeScript: string;
  targetScript: string;
  description: string;
}

const PAIRS: Pair[] = [
  {
    native: SUPPORTED_NATIVE_LANGUAGE,
    target: SUPPORTED_TARGET_LANGUAGE,
    nativeScript: "EN",
    targetScript: "日本語",
    description: SUPPORTED_TARGET_LANGUAGE,
  },
];

interface Props {
  onChosen: () => void;
}

export default function LaunchPopup({ onChosen }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(idx: number) {
    if (submitting) return;
    const pair = PAIRS[idx];
    setSelectedIdx(idx);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Guest",
          nativeLanguage: pair.native,
          targetLanguage: pair.target,
          tolerance: "moderate",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "Could not save your choice");
      }
      localStorage.setItem("active_learner", data.id);
      document.cookie = `active_learner=${encodeURIComponent(data.id)}; path=/; max-age=31536000; SameSite=Lax`;
      onChosen();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSelectedIdx(null);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{
        background: "rgba(10, 10, 15, 0.82)",
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="launch-popup-title"
    >
      <div
        className="w-full max-w-sm flex flex-col gap-5 px-6 py-7"
        style={{
          background: "var(--bg-card)",
          border: "1.5px dashed var(--text-dim)",
          borderRadius: 16,
        }}
      >
        <div>
          <h1
            id="launch-popup-title"
            className="leading-[1.05]"
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: "clamp(1.9rem, 1.4rem + 2vw, 2.4rem)",
              color: "var(--text)",
              fontWeight: 600,
            }}
          >
            What are you<br />
            learning?
          </h1>
          <p
            className="mt-2 uppercase"
            style={{
              fontSize: 10,
              color: "var(--text-dim)",
              letterSpacing: "0.1em",
            }}
          >
            pick once — we&apos;ll remember
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {PAIRS.map((pair, i) => {
            const isSelected = selectedIdx === i;
            const isPrimary = i === 0;
            return (
              <button
                key={`${pair.native}-${pair.target}`}
                type="button"
                disabled={submitting}
                onClick={() => choose(i)}
                className="flex items-baseline justify-between px-4 py-3.5 transition-colors disabled:opacity-60"
                style={{
                  background: isPrimary
                    ? "rgba(196, 185, 154, 0.06)"
                    : "transparent",
                  border: `1.5px solid ${
                    isSelected
                      ? "var(--moss)"
                      : isPrimary
                        ? "var(--gold)"
                        : "var(--border)"
                  }`,
                  borderRadius: 12,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: "var(--text)",
                    letterSpacing: "0.02em",
                  }}
                >
                  {pair.nativeScript}{" "}
                  <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>
                    →
                  </span>{" "}
                  {pair.targetScript}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-dim)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {isSelected ? "…" : pair.description}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <p
            style={{
              fontSize: 11,
              color: "var(--ember)",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            fontSize: 10,
            color: "var(--text-dim)",
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          no back, no skip
        </p>
      </div>
    </div>
  );
}
