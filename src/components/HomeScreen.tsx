"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { writeCachedLearner } from "@/lib/learnerCache";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level?: string | null;
  last_session_at?: string | null;
}

interface Props {
  learner: Learner;
}

const TUTOR_BY_TARGET: Record<string, { name: string; label: string; callWord: string }> = {
  Japanese: { name: "Yuki", label: "日本語 tutor", callWord: "CALL" },
};

function formatLastSession(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const daysAgo = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (daysAgo === 0) return "last called today";
  if (daysAgo === 1) return "last called yesterday";
  return `last called ${daysAgo} days ago`;
}

export default function HomeScreen({ learner }: Props) {
  const router = useRouter();
  const tutor = TUTOR_BY_TARGET[learner.target_language] ?? {
    name: "Tutor",
    label: `${learner.target_language} tutor`,
    callWord: "CALL",
  };
  const lastSession = formatLastSession(learner.last_session_at);

  // Cache the active learner so /call can render instantly without a loading
  // screen on navigation.
  useEffect(() => {
    writeCachedLearner({
      id: learner.id,
      name: learner.name,
      native_language: learner.native_language,
      target_language: learner.target_language,
      proficiency_level: learner.proficiency_level,
      last_session_at: learner.last_session_at,
    });
  }, [
    learner.id,
    learner.name,
    learner.native_language,
    learner.target_language,
    learner.proficiency_level,
    learner.last_session_at,
  ]);

  function startCall() {
    router.push("/call");
  }

  return (
    <div className="min-h-[100svh] w-full flex items-center justify-center px-6 py-10">
      <div className="flex flex-col items-center gap-7">
        <button
          type="button"
          onClick={startCall}
          aria-label={`Call ${tutor.name}, your ${tutor.label}`}
          className="relative flex items-center justify-center transition-transform active:scale-[0.97]"
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            border: "2px solid var(--gold)",
            background:
              "radial-gradient(circle at 40% 35%, rgba(196,185,154,0.10), rgba(196,185,154,0.02) 70%)",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -12,
              borderRadius: "50%",
              border: "1px dashed var(--gold)",
              opacity: 0.4,
            }}
          />
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: -26,
              borderRadius: "50%",
              border: "1px dashed var(--gold)",
              opacity: 0.18,
            }}
          />
          <span
            style={{
              fontSize: 18,
              color: "var(--gold)",
              letterSpacing: "0.2em",
              fontWeight: 500,
            }}
          >
            {tutor.callWord}
          </span>
        </button>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <div style={{ fontSize: 14, color: "var(--text)" }}>
            {tutor.name} · {tutor.label}
          </div>
          {lastSession && (
            <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
              {lastSession}
            </div>
          )}
        </div>

        <Link
          href="/dashboard"
          className="transition-opacity hover:opacity-100"
          style={{
            fontFamily: "var(--font-caveat), cursive",
            fontSize: 16,
            color: "var(--text-dim)",
            opacity: 0.7,
            textDecoration: "none",
            marginTop: 14,
          }}
        >
          or see your progress →
        </Link>
      </div>
    </div>
  );
}
