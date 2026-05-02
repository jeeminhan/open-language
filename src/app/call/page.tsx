"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthReady } from "@/hooks/useAuthReady";
import InCall from "@/components/InCall";
import CallRecap, { type CallSummary } from "@/components/CallRecap";
import {
  clearCachedLearner,
  readCachedLearner,
  writeCachedLearner,
  type CachedLearner,
} from "@/lib/learnerCache";
import { isSupportedLanguagePair } from "@/lib/supportedLanguage";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level?: string | null;
  last_session_at?: string | null;
}

function isSupportedPair(learner: {
  native_language: string;
  target_language: string;
}): boolean {
  return isSupportedLanguagePair(
    learner.native_language,
    learner.target_language
  );
}

function readActiveLearnerId(): string | null {
  if (typeof window === "undefined") return null;
  const ls = localStorage.getItem("active_learner");
  if (ls) return ls;
  const match = document.cookie.match(/(?:^|;\s*)active_learner=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function pickLearner(learners: Learner[]): Learner | null {
  const supported = learners.filter(isSupportedPair);
  if (supported.length === 0) return null;
  const activeId = readActiveLearnerId();
  if (activeId) {
    const match = supported.find((l) => l.id === activeId);
    if (match) return match;
  }
  return supported[0];
}

export default function CallPage() {
  const router = useRouter();
  const { ready, error: authError } = useAuthReady();

  // Seed with the cached learner on first render so we skip the loading screen
  // when coming from /home. If the cache is missing (direct URL, cleared
  // storage), we fall back to the fetch path.
  const [learner, setLearner] = useState<CachedLearner | null>(() => {
    const cached = readCachedLearner();
    if (!cached) return null;
    if (isSupportedPair(cached)) return cached;
    clearCachedLearner();
    return null;
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchDone, setFetchDone] = useState(false);
  const loadError = authError ?? fetchError;

  // Background refresh — confirms the cached learner is still valid and
  // populates the cache if we started empty.
  useEffect(() => {
    if (!ready || authError) return;
    let cancelled = false;
    fetch("/api/learners")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load profile (${r.status})`);
        return r.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const list: Learner[] = Array.isArray(data) ? (data as Learner[]) : [];
        const picked = pickLearner(list);
        if (picked) {
          setLearner(picked);
          writeCachedLearner({
            id: picked.id,
            name: picked.name,
            native_language: picked.native_language,
            target_language: picked.target_language,
            proficiency_level: picked.proficiency_level,
            last_session_at: picked.last_session_at,
          });
        } else {
          // No supported learner on the server — send the user through the
          // launch popup on /home.
          setLearner(null);
        }
        setFetchDone(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(
          err instanceof Error ? err.message : "Could not load profile"
        );
        setFetchDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, authError]);

  // If we have no learner after the background fetch settles, redirect.
  useEffect(() => {
    if (fetchDone && !learner) {
      router.replace("/home");
    }
  }, [fetchDone, learner, router]);

  // Happy path: cached learner present — render InCall (or the recap after End).
  if (learner) {
    return <CallFlow learner={learner} />;
  }

  if (loadError) {
    return (
      <div className="min-h-[100svh] w-full flex items-center justify-center px-6">
        <div
          className="max-w-sm text-center"
          style={{ fontSize: 13, color: "var(--ember)" }}
        >
          {loadError}
        </div>
      </div>
    );
  }

  // Fallback: direct URL with no cached learner. Show a minimal placeholder
  // while the background fetch settles.
  return (
    <div className="min-h-[100svh] w-full flex items-center justify-center">
      <div
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          opacity: 0.6,
        }}
      >
        …
      </div>
    </div>
  );
}

/**
 * Manages the call → recap phase within a single route.
 * A fresh `call` key remounts InCall when the user taps "Call again" so the
 * voice hook, timer, and ringing reset cleanly.
 */
function CallFlow({ learner }: { learner: CachedLearner }) {
  const router = useRouter();
  const [recap, setRecap] = useState<CallSummary | null>(null);
  const [callKey, setCallKey] = useState(0);

  const handleEnd = useCallback((summary: CallSummary) => {
    setRecap(summary);
    // If this was a first-call level test, fetch the assessment and update
    // the recap when it lands. Best-effort — on failure the recap shows a
    // graceful default.
    if (summary.levelTestPending) {
      fetch("/api/level-test/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: summary.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then(
          (
            data: {
              level?: string;
              justification?: string;
              seedWords?: string[];
            } | null
          ) => {
            setRecap((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                levelTestPending: false,
                levelTest: data
                  ? {
                      level: data.level ?? "A2",
                      justification:
                        data.justification ??
                        "First call complete — placing you here.",
                      seedWords: Array.isArray(data.seedWords)
                        ? data.seedWords
                        : [],
                    }
                  : {
                      level: "A2",
                      justification:
                        "Couldn't reach the assessor — placing you at A2 for now.",
                      seedWords: [],
                    },
              };
            });
          }
        )
        .catch(() => {
          setRecap((prev) =>
            prev
              ? {
                  ...prev,
                  levelTestPending: false,
                  levelTest: {
                    level: "A2",
                    justification:
                      "Couldn't reach the assessor — placing you at A2 for now.",
                    seedWords: [],
                  },
                }
              : prev
          );
        });
    }
  }, []);

  const handleCallAgain = useCallback(() => {
    setRecap(null);
    setCallKey((k) => k + 1);
  }, []);

  const handleDone = useCallback(() => {
    router.push("/home");
  }, [router]);

  const handleSignIn = useCallback(() => {
    router.push("/login?next=/home");
  }, [router]);

  if (recap) {
    const isLevelTest =
      recap.levelTestPending === true || recap.levelTest != null;
    return (
      <CallRecap
        summary={recap}
        onCallAgain={handleCallAgain}
        onDone={handleDone}
        onSignIn={isLevelTest ? handleSignIn : undefined}
      />
    );
  }

  return <InCall key={callKey} learner={learner} onEnd={handleEnd} />;
}
