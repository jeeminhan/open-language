"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import LaunchPopup from "@/components/LaunchPopup";
import HomeScreen from "@/components/HomeScreen";

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  last_session_at?: string | null;
}

const SUPPORTED_PAIRS = new Set([
  "English→Japanese",
  "Korean→English",
]);

function isSupportedPair(learner: Learner): boolean {
  return SUPPORTED_PAIRS.has(
    `${learner.native_language}→${learner.target_language}`
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

export default function HomePage() {
  const { ready, error: authError } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const loadError = authError ?? fetchError;

  const fetchLearners = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch("/api/learners");
      if (!res.ok) throw new Error(`Failed to load profile (${res.status})`);
      const data = (await res.json()) as Learner[];
      setLearners(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (authError) {
      setLoading(false);
      return;
    }
    void fetchLearners();
  }, [ready, authError, fetchLearners]);

  if (!ready || loading) {
    return (
      <div className="min-h-[100svh] w-full flex items-center justify-center">
        <div
          style={{
            fontSize: 11,
            color: "var(--text-dim)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          loading…
        </div>
      </div>
    );
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

  const activeLearner = pickLearner(learners);

  if (!activeLearner) {
    return <LaunchPopup onChosen={() => void fetchLearners()} />;
  }

  return <HomeScreen learner={activeLearner} />;
}
