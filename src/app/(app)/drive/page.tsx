"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";

interface PracticeItem {
  description: string;
  category: string;
  occurrence_count: number;
  severity: string;
  l1_source: string | null;
  priority: number;
}

interface L1Pattern {
  description: string;
  l1_source: string;
}

interface Interest {
  category: string;
  name: string;
  details: string | null;
}

interface AdaptiveData {
  practiceItems: PracticeItem[];
  effectiveLevel: {
    level: string;
    confidence: number;
    totalDataPoints: number;
    grammarMastery: number;
    errorRate: number;
  };
  l1Patterns: L1Pattern[];
  registeredLevel: string;
  targetLanguage: string;
  nativeLanguage: string;
  interests: Interest[];
}

const LANGUAGE_CODES: Record<string, string> = {
  korean: "ko-KR", japanese: "ja-JP", chinese: "zh-CN", mandarin: "zh-CN",
  spanish: "es-ES", french: "fr-FR", german: "de-DE", italian: "it-IT",
  portuguese: "pt-BR", english: "en-US",
};

function buildDrivingPrompt(adaptive: AdaptiveData | null): string {
  const target = adaptive?.targetLanguage || "Korean";
  const native = adaptive?.nativeLanguage || "English";

  let levelNote = adaptive?.registeredLevel || "A2";
  if (adaptive && adaptive.effectiveLevel.confidence > 0.3) {
    const eff = adaptive.effectiveLevel;
    levelNote = `${eff.level} (${Math.round(eff.grammarMastery)}% grammar mastery, ${Math.round(eff.errorRate)}% error rate)`;
  }

  const practiceBlock = adaptive && adaptive.practiceItems.length > 0
    ? `\n\nFOCUS PATTERNS (steer conversation so the learner MUST use these — pick ONE and weave it in):\n${adaptive.practiceItems.slice(0, 5).map((p) => `- ${p.description} (${p.category}, ${p.occurrence_count}x)`).join("\n")}`
    : "";

  const l1Block = adaptive && adaptive.l1Patterns.length > 0
    ? `\n\nKNOWN L1 INTERFERENCE (listen for these):\n${adaptive.l1Patterns.slice(0, 5).map((p) => `- ${p.description}: ${p.l1_source}`).join("\n")}`
    : "";

  const interestsBlock = adaptive && adaptive.interests.length > 0
    ? `\n\nLEARNER'S INTERESTS (talk about these):\n${adaptive.interests.slice(0, 6).map((i) => `- ${i.name}${i.details ? ` (${i.details})` : ""}`).join("\n")}`
    : "";

  return `You are a ${target} language tutor riding in the car with the learner. They are DRIVING — they cannot look at a screen, cannot read anything, cannot take notes. All teaching must be audio-only.

LEARNER:
- Native: ${native}
- Target: ${target}
- Level: ${levelNote}

You are a real teacher with a lesson plan, not a passive chat partner. You actively drill weak spots, stretch the learner, and make every turn count pedagogically — while respecting that they're behind the wheel.

DRIVING CONSTRAINTS (hard rules):
- Keep every turn to 1-2 short sentences. Never monologue.
- Respond primarily in ${target}. Use ${native} only for brief scaffolding (≤1 short phrase).
- Never ask them to read, spell, or visualize anything on a screen.
- No long explanations. No lists. No "first... second... third..." structure.
- If they sound distracted, stressed, or say something like "traffic" / "hold on" — immediately go silent and wait. Don't drill when attention is split.
- Keep the energy calm and steady. No surprises, no loud tonal shifts.

TEACHING POSTURE:
1. RECASTS ARE YOUR PRIMARY TOOL. When the learner makes an error:
   - Reply naturally using the CORRECT form without flagging the error.
   - Example: learner says "昨日映画を見ただった" → you say "へえ、見たんだね！何を見たの？"
   - The contrast does the teaching silently.
2. Use isolated or expanded recasts (just the corrected phrase, optionally extended with a follow-up). Avoid emphatic recasts that sound like corrections.
3. EXPLICIT corrections ONLY when an error is a deeply established pattern (3rd+ time) AND recasts have failed. Then: one short sentence, warm tone, move on immediately.
4. Every 3-4 turns, steer the conversation so the learner's natural reply must use a FOCUS PATTERN. Ask a question that structurally demands it.
5. Stretch one notch above their comfort — model slightly more advanced forms so they can mirror.
6. When the learner correctly uses something they previously got wrong → tiny verbal acknowledgment ("いいね、${target === "Japanese" ? "てしまう" : "that pattern"} きれい"). Quick, then continue.
7. Never correct during emotional/excited speech or mid-thought.
8. No more than one explicit correction per turn, and prefer zero.

CONVERSATION FLOW:
- Ask open-ended questions tied to FOCUS PATTERNS and LEARNER'S INTERESTS.
- React to CONTENT first, correct form second.
- Match their register (casual/formal).
- If they code-switch to ${native}, respond briefly and gently pull them back to ${target}.

SESSION SHAPE:
- Greet briefly and ask where they want to practice today (or pick a pattern from FOCUS yourself if they defer).
- Drive the conversation toward focus patterns across the session.
- Every 8-10 turns, do a ONE-SENTENCE verbal recap: "we've been working on X — nice." Keep moving.

DO NOT:
- Do NOT output any analysis, JSON, brackets, or structured format. Audio only.
- Do NOT spell out grammar labels unless the learner asks directly.
- Do NOT repeat the whole rulebook — just teach in context.${practiceBlock}${l1Block}${interestsBlock}`;
}

export default function DrivePage() {
  const [adaptive, setAdaptive] = useState<AdaptiveData | null>(null);
  const [adaptiveLoaded, setAdaptiveLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/practice")
      .then((r) => r.json())
      .then((d) => {
        if (d && !d.error) setAdaptive(d as AdaptiveData);
      })
      .catch(() => {})
      .finally(() => setAdaptiveLoaded(true));
  }, []);

  const languageCode = adaptive
    ? LANGUAGE_CODES[adaptive.targetLanguage.toLowerCase()] || "en-US"
    : "ko-KR";

  const sessionIdRef = useRef<string | null>(null);
  const turnCountRef = useRef(0);
  const savedTurnsRef = useRef<Set<string>>(new Set());

  const voice = useVoiceChat({
    systemPrompt: adaptiveLoaded ? buildDrivingPrompt(adaptive) : "",
    languageCode,
    greeting: adaptive
      ? `Greet the driver briefly in ${adaptive.targetLanguage} (one short sentence), then ask what they want to practice today or suggest one focus pattern.`
      : undefined,
    onTurnComplete: (msgs) => {
      for (let i = msgs.length - 2; i >= 0; i--) {
        const userMsg = msgs[i];
        const assistantMsg = msgs[i + 1];
        if (
          userMsg?.role === "user" &&
          assistantMsg?.role === "assistant" &&
          !savedTurnsRef.current.has(userMsg.id)
        ) {
          savedTurnsRef.current.add(userMsg.id);
          turnCountRef.current += 1;
          const turnNumber = turnCountRef.current;
          setTimeout(() => {
            fetch("/api/voice-turn", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: sessionIdRef.current,
                turnNumber,
                userMessage: userMsg.content,
                tutorResponse: assistantMsg.content,
                mode: "drive",
              }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.sessionId && !sessionIdRef.current) {
                  sessionIdRef.current = data.sessionId;
                }
              })
              .catch(() => {});
          }, 1500);
          break;
        }
      }
    },
  });

  const endSession = useCallback(() => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    const body = JSON.stringify({ sessionId: sid });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/session/end", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }).catch(() => {});
    }
    sessionIdRef.current = null;
    turnCountRef.current = 0;
    savedTurnsRef.current = new Set();
  }, []);

  useEffect(() => {
    const handleUnload = () => endSession();
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      endSession();
    };
  }, [endSession]);

  const handlePauseResume = useCallback(async () => {
    // Toggle voice connection without ending the session
    await voice.toggleVoice();
  }, [voice]);

  const handleEnd = useCallback(async () => {
    if (voice.voiceActive) {
      await voice.toggleVoice();
    }
    endSession();
  }, [voice, endSession]);

  const active = voice.voiceActive;
  const connecting = voice.voiceConnecting;
  const hasSession = sessionIdRef.current !== null;
  const paused = hasSession && !active && !connecting;

  const statusText = connecting
    ? "Connecting..."
    : active
      ? voice.userSpeaking
        ? "Listening"
        : "Tutor is speaking"
      : paused
        ? "Paused"
        : "Tap to start";

  const statusColor = connecting
    ? "var(--text-dim)"
    : active
      ? voice.userSpeaking
        ? "var(--moss)"
        : "var(--river)"
      : paused
        ? "var(--ember)"
        : "var(--gold)";

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center" style={{ minHeight: "70vh" }}>
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--river)" }}>
        Driving Mode
      </h2>
      <p className="text-sm mb-8 text-center" style={{ color: "var(--text-dim)" }}>
        Hands-free voice lesson. Eyes on the road.
      </p>

      {/* Giant primary button — START / PAUSE / RESUME */}
      <button
        onClick={handlePauseResume}
        disabled={!adaptiveLoaded || connecting}
        aria-label={active ? "Pause driving mode" : paused ? "Resume driving mode" : "Start driving mode"}
        className="rounded-full flex items-center justify-center transition-all"
        style={{
          width: "260px",
          height: "260px",
          background: active ? "var(--bg-card)" : "var(--gold)",
          border: `4px solid ${statusColor}`,
          color: active ? statusColor : "var(--bg)",
          fontSize: "28px",
          fontWeight: 700,
          marginBottom: "24px",
          animation: active && !voice.userSpeaking ? "pulse 1.8s ease-in-out infinite" : undefined,
          cursor: connecting ? "wait" : "pointer",
        }}
      >
        {active ? "PAUSE" : paused ? "RESUME" : "START"}
      </button>

      <div
        className="text-xl font-semibold mb-2"
        style={{ color: statusColor, minHeight: "2rem" }}
        aria-live="polite"
      >
        {statusText}
      </div>

      {adaptive && (
        <div className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
          {adaptive.targetLanguage} · {adaptive.effectiveLevel.confidence > 0.3 ? adaptive.effectiveLevel.level : adaptive.registeredLevel}
        </div>
      )}

      {(active || paused) && (
        <button
          onClick={handleEnd}
          className="px-6 py-3 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: "transparent",
            border: "1px solid var(--ember)",
            color: "var(--ember)",
          }}
        >
          End session
        </button>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
