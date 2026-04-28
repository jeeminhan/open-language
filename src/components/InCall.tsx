"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useRingtone } from "@/hooks/useRingtone";
import { getLanguageCode } from "@/lib/languages";
import { buildCallPrompt } from "@/lib/prompts/ja/call";
import { buildLevelTestPrompt } from "@/lib/prompts/ja/levelTest";
import {
  GREETING_FIRST_CALL,
  GREETING_RECURRING_CALL,
} from "@/lib/prompts/ja/shared";
import {
  classifyAgenda,
  classifyFromTutor,
  extractScenarioLabel,
  extractGuidedTopic,
  type DetectedAgenda,
} from "@/lib/agendaRouter";
import AgendaStrip, {
  type AgendaKind,
  type DrillState,
  type RoleplayState,
  type GuidedState,
  type LevelTestState,
} from "./AgendaStrip";
import CallControls from "./CallControls";
import SaveToast from "./SaveToast";
import type { CallSummary } from "./CallRecap";
import { logSessionEvent } from "@/lib/sessionLogger";

const MAX_DRILL_WORDS = 5;
const ROUTING_GRACE_MESSAGES = 2;

interface Learner {
  id: string;
  name: string;
  native_language: string;
  target_language: string;
  proficiency_level?: string | null;
}

interface Props {
  learner: Learner;
  onEnd: (summary: CallSummary) => void;
}

const TUTOR_BY_TARGET: Record<string, { name: string; flag: string }> = {
  Japanese: { name: "Yuki", flag: "🇯🇵" },
  English: { name: "Sam", flag: "🇺🇸" },
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function InCall({ learner, onEnd }: Props) {
  const tutor = TUTOR_BY_TARGET[learner.target_language] ?? {
    name: "Tutor",
    flag: "",
  };

  const [captionsOn, setCaptionsOn] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoStartedRef = useRef(false);
  const isMountedRef = useRef(true);
  const startTimeRef = useRef<number | null>(null);

  // Per-call analytics — populated as turns finalize and surfaced in the recap.
  const sessionIdRef = useRef<string | null>(null);
  const turnNumberRef = useRef(0);
  const savedTurnsRef = useRef<Set<string>>(new Set());
  const newWordsRef = useRef<string[]>([]);
  const newWordsSeenRef = useRef<Set<string>>(new Set());
  const errorsCountRef = useRef(0);

  // Mid-call toast — queue of newly-saved words awaiting their moment.
  const [toastQueue, setToastQueue] = useState<string[]>([]);
  const [activeToast, setActiveToast] = useState<string | null>(null);

  // Drill words pre-fetched before the voice session starts, so the prompt
  // has them baked in if the user picks drill mode.
  const [drillWords, setDrillWords] = useState<string[]>([]);
  const [wordsReady, setWordsReady] = useState(false);
  const [ringDone, setRingDone] = useState(false);

  // Level-test mode is forced on the learner's very first call.
  // null until the session-count check completes.
  const [isFirstCall, setIsFirstCall] = useState<boolean | null>(null);

  // Agenda routing — classifies the user's first reply and morphs the strip.
  const [detectedAgenda, setDetectedAgenda] = useState<DetectedAgenda | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string>("open chat");
  const [guidedTopic, setGuidedTopic] = useState<string>("custom topic");
  const userMessagesScannedRef = useRef<Set<string>>(new Set());
  const tutorMessagesScannedRef = useRef<Set<string>>(new Set());
  // Tracks whether the current agenda was set by an explicit user signal.
  // Passive signals (tutor phrases, drill word mentions) can never override
  // an explicit choice — only upgrade from null or default-roleplay.
  const agendaIsExplicitRef = useRef(false);

  // Phone-call metaphor — show "ringing" before the socket starts so the
  // transition doesn't feel like a lag spike.
  const RING_DELAY_MS = 1800;
  const WORDS_FETCH_TIMEOUT_MS = 1500;

  const systemPrompt = useMemo(() => {
    if (isFirstCall) {
      return buildLevelTestPrompt();
    }
    return buildCallPrompt({
      level: learner.proficiency_level,
      drillWords,
    });
  }, [isFirstCall, learner.proficiency_level, drillWords]);

  const languageCode = useMemo(
    () => getLanguageCode(learner.target_language),
    [learner.target_language]
  );

  const greeting = isFirstCall ? GREETING_FIRST_CALL : GREETING_RECURRING_CALL;

  const voice = useVoiceChat({
    systemPrompt,
    languageCode,
    greeting,
    onTurnComplete: (msgs) => {
      // Find the most recent complete user→assistant pair that hasn't been
      // saved, and post it to /api/voice-turn for analysis + SRS queueing.
      // Walk backwards from the second-to-last message so we're saving a
      // pair, not a half-formed turn.
      for (let i = msgs.length - 2; i >= 0; i--) {
        const userMsg = msgs[i];
        const assistantMsg = msgs[i + 1];
        if (
          userMsg?.role !== "user" ||
          assistantMsg?.role !== "assistant" ||
          savedTurnsRef.current.has(userMsg.id)
        ) {
          continue;
        }
        savedTurnsRef.current.add(userMsg.id);
        turnNumberRef.current += 1;
        const turnNumber = turnNumberRef.current;

        // Slight delay so trailing transcript chunks settle before we send.
        setTimeout(() => {
          if (!isMountedRef.current) return;
          fetch("/api/voice-turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sessionIdRef.current,
              turnNumber,
              userMessage: userMsg.content,
              tutorResponse: assistantMsg.content,
            }),
          })
            .then((r) => r.json())
            .then(
              (data: {
                sessionId?: string;
                errors?: unknown[];
                unknownWords?: string[];
              }) => {
                if (!isMountedRef.current) return;
                if (data.sessionId && !sessionIdRef.current) {
                  sessionIdRef.current = data.sessionId;
                }
                if (Array.isArray(data.unknownWords)) {
                  const fresh: string[] = [];
                  for (const w of data.unknownWords) {
                    if (typeof w !== "string" || !w.trim()) continue;
                    if (newWordsSeenRef.current.has(w)) continue;
                    newWordsSeenRef.current.add(w);
                    newWordsRef.current.push(w);
                    fresh.push(w);
                  }
                  if (fresh.length > 0) {
                    setToastQueue((prev) => [...prev, ...fresh]);
                  }
                }
                if (Array.isArray(data.errors)) {
                  errorsCountRef.current += data.errors.length;
                }
              }
            )
            .catch(() => {
              // Silent failure — analysis is best-effort, the call keeps working.
            });
        }, 1500);
        break;
      }
    },
    onError: (err) => {
      setErrorMsg(err.message || "Voice session failed to start.");
    },
    onAutoDisconnect: (reason) => {
      setErrorMsg(
        reason === "idle"
          ? "Paused after 30s of silence — tap mic to resume."
          : "10 min session limit reached — tap mic to continue."
      );
    },
  });

  // Mount tracker for the delayed auto-start.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    logSessionEvent({
      type: "call-mounted",
      learnerId: learner.id,
      learnerName: learner.name,
      targetLanguage: learner.target_language,
      nativeLanguage: learner.native_language,
      proficiencyLevel: learner.proficiency_level ?? null,
    });
  }, [learner.id, learner.name, learner.target_language, learner.native_language, learner.proficiency_level]);

  useEffect(() => {
    if (isFirstCall === null) return;
    logSessionEvent({ type: "first-call-detected", isFirstCall });
  }, [isFirstCall]);

  const drillWordsKey = drillWords.join("|");
  useEffect(() => {
    if (!wordsReady) return;
    logSessionEvent({ type: "drill-words-loaded", words: drillWords });
    // drillWords is keyed via drillWordsKey to avoid array-identity churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillWordsKey, wordsReady]);

  const previousAgendaRef = useRef<DetectedAgenda | null>(null);
  useEffect(() => {
    const current: DetectedAgenda | null = isFirstCall ? "leveltest" : detectedAgenda;
    if (previousAgendaRef.current === current) return;
    if (current !== null) {
      logSessionEvent({
        type: "agenda-change",
        from: previousAgendaRef.current,
        to: current,
        explicit: agendaIsExplicitRef.current,
        scenarioLabel: current === "roleplay" ? scenarioLabel : undefined,
        guidedTopic: current === "guided" ? guidedTopic : undefined,
      });
    }
    previousAgendaRef.current = current;
  }, [detectedAgenda, isFirstCall, scenarioLabel, guidedTopic]);

  const previousDrillIndexRef = useRef<number | null>(null);
  const loggedMessageIdsRef = useRef<Set<string>>(new Set());

  const loggedVoiceStartRef = useRef(false);
  useEffect(() => {
    if (voice.voiceActive && !loggedVoiceStartRef.current) {
      loggedVoiceStartRef.current = true;
      logSessionEvent({ type: "voice-started" });
    }
  }, [voice.voiceActive]);

  // Detect first-time learner (no past sessions) → run level test.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions")
      .then((r) => (r.ok ? r.json() : []))
      .then((sessions) => {
        if (cancelled) return;
        const count = Array.isArray(sessions) ? sessions.length : 0;
        setIsFirstCall(count === 0);
      })
      .catch(() => {
        if (cancelled) return;
        // On failure, assume not a first call so the user gets a normal call
        // rather than being trapped in a level test.
        setIsFirstCall(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pre-fetch SRS due words. Hard-cap the wait so a slow API never holds up
  // the call. If words aren't loaded by the cap, we fall through to the
  // "no drill available" branch of the prompt.
  useEffect(() => {
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setWordsReady(true);
    };
    const cap = setTimeout(settle, WORDS_FETCH_TIMEOUT_MS);
    fetch(`/api/learn/due-words?limit=${MAX_DRILL_WORDS}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { words?: Array<{ word: string }> } | null) => {
        if (!isMountedRef.current) return;
        if (data && Array.isArray(data.words)) {
          setDrillWords(data.words.map((w) => w.word).filter(Boolean));
        }
        clearTimeout(cap);
        settle();
      })
      .catch(() => {
        clearTimeout(cap);
        settle();
      });
    return () => {
      clearTimeout(cap);
    };
  }, []);

  // Ringing timer runs in parallel with the words fetch.
  useEffect(() => {
    const t = setTimeout(() => setRingDone(true), RING_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Auto-start voice once the ring delay, words fetch, and first-call check
  // have all settled. We must know `isFirstCall` before starting because it
  // determines which system prompt the session is created with.
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!ringDone || !wordsReady || isFirstCall === null) return;
    if (voice.voiceActive || voice.voiceConnecting) return;
    autoStartedRef.current = true;
    void voice.toggleVoice();
  }, [voice, ringDone, wordsReady, isFirstCall]);

  // Track elapsed time while session is active
  useEffect(() => {
    if (!voice.voiceActive) {
      // pause timer on disconnect but don't reset
      return;
    }
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now() - elapsedSec * 1000;
    }
    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsedSec(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
    // elapsedSec intentionally excluded — we don't want to restart the interval each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.voiceActive]);

  // Drain the save-toast queue. One toast at a time, ~2.5s window each.
  useEffect(() => {
    if (activeToast || toastQueue.length === 0) return;
    const next = toastQueue[0];
    setActiveToast(next);
    setToastQueue((prev) => prev.slice(1));
    const t = setTimeout(() => setActiveToast(null), 2500);
    return () => clearTimeout(t);
  }, [activeToast, toastQueue]);

  const muted = !voice.voiceActive && !voice.voiceConnecting;

  function handleToggleMute() {
    setErrorMsg(null);
    void voice.toggleVoice();
  }

  function handleToggleCaptions() {
    setCaptionsOn((prev) => !prev);
  }

  function handleEnd() {
    const sessionId = sessionIdRef.current;
    logSessionEvent({
      type: "call-ended",
      elapsedSec,
      messageCount: voice.messages.length,
      newWordsCount: newWordsRef.current.length,
      errorsCount: errorsCountRef.current,
    });
    const summary: CallSummary = {
      tutorName: tutor.name,
      targetLanguage: learner.target_language,
      nativeLanguage: learner.native_language,
      elapsedSec,
      messages: voice.messages,
      newWords: [...newWordsRef.current],
      errorsFoundCount: errorsCountRef.current,
      sessionId,
      levelTest: null,
      levelTestPending: isFirstCall === true,
    };
    voice.reset();
    // Best-effort session close — fire and forget.
    if (sessionId) {
      fetch("/api/session/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {
        // Silent — the session row will naturally age out server-side.
      });
    }
    onEnd(summary);
  }

  const agendaKind: AgendaKind = isFirstCall
    ? "leveltest"
    : (detectedAgenda ?? "listening");

  // While in drill mode, find the current word by looking at the most recent
  // tutor message that mentions EXACTLY ONE drill word — that's the word
  // they're prompting on right now. Messages that mention multiple words are
  // typically "menu" / recap messages (e.g. the opening "we'll do A, B, C")
  // and don't represent the current prompt.
  const drillIndex = (() => {
    if (detectedAgenda !== "drill" || drillWords.length === 0) return 0;
    for (let i = voice.messages.length - 1; i >= 0; i--) {
      const msg = voice.messages[i];
      if (msg.role !== "assistant") continue;
      const matchedIndices: number[] = [];
      for (let w = 0; w < drillWords.length; w++) {
        const word = drillWords[w];
        if (word && msg.content.includes(word)) matchedIndices.push(w);
      }
      if (matchedIndices.length === 1) return matchedIndices[0];
      // 0 or 2+ matches → this message isn't a single-word prompt; keep looking back
    }
    return 0;
  })();

  useEffect(() => {
    if (detectedAgenda !== "drill") {
      previousDrillIndexRef.current = null;
      return;
    }
    if (previousDrillIndexRef.current === drillIndex) return;
    const prev = previousDrillIndexRef.current ?? 0;
    logSessionEvent({
      type: "drill-index-change",
      from: prev,
      to: drillIndex,
      total: drillWords.length,
      currentWord: drillWords[drillIndex] ?? null,
    });
    previousDrillIndexRef.current = drillIndex;
  }, [drillIndex, detectedAgenda, drillWords]);

  useEffect(() => {
    for (const msg of voice.messages) {
      if (loggedMessageIdsRef.current.has(msg.id)) continue;
      if (!msg.content || !msg.content.trim()) continue;
      loggedMessageIdsRef.current.add(msg.id);
      logSessionEvent({
        type: "turn",
        role: msg.role === "assistant" ? "assistant" : "user",
        messageId: msg.id,
        content: msg.content,
        messageCount: voice.messages.length,
        agenda: isFirstCall ? "leveltest" : (detectedAgenda ?? "listening"),
        drillIndex: detectedAgenda === "drill" ? drillIndex : undefined,
        drillTotal: detectedAgenda === "drill" ? drillWords.length : undefined,
        isFirstCall,
      });
    }
  }, [voice.messages, detectedAgenda, drillIndex, drillWords, isFirstCall]);

  const drillState: DrillState | undefined =
    detectedAgenda === "drill" && drillWords.length > 0
      ? {
          word: drillWords[drillIndex],
          index: drillIndex,
          total: drillWords.length,
          results: drillWords.map((_, i) =>
            i < drillIndex ? "pass" : undefined
          ),
        }
      : undefined;

  const roleplayState: RoleplayState | undefined =
    detectedAgenda === "roleplay"
      ? {
          scenario: scenarioLabel,
          goalLabel: "in progress",
          goalMet: false,
        }
      : undefined;

  const guidedState: GuidedState | undefined =
    detectedAgenda === "guided"
      ? {
          topic: guidedTopic,
          step: 1,
          total: 4,
        }
      : undefined;

  const levelTestState: LevelTestState | undefined = isFirstCall
    ? {
        // step counter advances with each user turn (cap at 5)
        step: Math.min(
          voice.messages.filter((m) => m.role === "user").length,
          5
        ) || 1,
        total: 5,
      }
    : undefined;

  // Captions show only what the tutor is saying — last two tutor turns.
  // Previous turn lingers dim until a new one arrives and pushes it off.
  const tutorMessages = voice.messages.filter((m) => m.role === "assistant");
  const currentTutorMessage = tutorMessages[tutorMessages.length - 1] ?? null;
  const previousTutorMessage =
    tutorMessages.length >= 2 ? tutorMessages[tutorMessages.length - 2] : null;

  // Watch user + tutor messages and route to an agenda. Three signal tiers:
  //   1. Explicit user keyword (English or target-language) — strongest
  //   2. Tutor mentions one of the SRS drill words — strong drill cue,
  //      survives mangled user STT
  //   3. Tutor mode-adoption phrasing (e.g. "first word", "let me explain")
  // If none of those fire after a couple of substantive turns, we default
  // to role-play so the strip stops sitting in "listening" forever.
  //
  // Explicit signals (1, 2, 3) can override a prior role-play default —
  // they cannot be overridden by the default fallback.
  //
  // First-call learners always get the level test; routing is skipped.
  useEffect(() => {
    if (isFirstCall) return;
    const userMessages = voice.messages.filter((m) => m.role === "user");
    const tutorMessages = voice.messages.filter((m) => m.role === "assistant");

    // Pass 1 — explicit match in user speech (always wins; can re-route)
    for (const msg of userMessages) {
      if (userMessagesScannedRef.current.has(msg.id)) continue;
      userMessagesScannedRef.current.add(msg.id);
      const match = classifyAgenda(msg.content);
      if (match && match !== detectedAgenda) {
        setDetectedAgenda(match);
        agendaIsExplicitRef.current = true;
        if (match === "guided") setGuidedTopic(extractGuidedTopic(msg.content));
        if (match === "roleplay")
          setScenarioLabel(extractScenarioLabel(msg.content));
        return;
      }
    }

    // Passive signals (Pass 2 + Pass 3) can ONLY upgrade from null or
    // default-roleplay — never override an explicit user choice.
    const passiveAllowed =
      !agendaIsExplicitRef.current &&
      (detectedAgenda === null || detectedAgenda === "roleplay");

    // Pass 2 — tutor mentions a drill word → almost certainly in drill mode.
    if (passiveAllowed && drillWords.length > 0) {
      for (const msg of tutorMessages) {
        const mentionsDrillWord = drillWords.some(
          (w) => w && msg.content.includes(w)
        );
        if (mentionsDrillWord) {
          setDetectedAgenda("drill");
          return;
        }
      }
    }

    // Pass 3 — tutor mode-adoption phrasing
    if (passiveAllowed) {
      for (const msg of tutorMessages) {
        if (tutorMessagesScannedRef.current.has(msg.id)) continue;
        tutorMessagesScannedRef.current.add(msg.id);
        const match = classifyFromTutor(msg.content);
        if (match && match !== detectedAgenda) {
          setDetectedAgenda(match);
          return;
        }
      }
    }

    // Default to role-play — only if nothing has routed yet.
    if (detectedAgenda) return;
    const substantive = userMessages.filter(
      (m) => m.content.trim().split(/\s+/).filter(Boolean).length >= 3
    );
    if (
      substantive.length >= ROUTING_GRACE_MESSAGES ||
      userMessages.length >= 4
    ) {
      setDetectedAgenda("roleplay");
      setScenarioLabel(extractScenarioLabel(userMessages[0].content));
      // Default-roleplay is NOT explicit — passive signals can still override.
      agendaIsExplicitRef.current = false;
    }
  }, [voice.messages, detectedAgenda, drillWords, isFirstCall]);

  // "Ringing" covers the gap between tapping Call and the tutor picking up.
  // Once any message has come through the socket, we've connected; from that
  // point on a muted session shows "tap mic to resume" instead of ringing.
  const hasEverConnected = voice.messages.length > 0 || voice.voiceActive;
  const isRinging = !hasEverConnected;

  // Play ringback tone while ringing, stop when connected.
  const setRinging = useRingtone();
  useEffect(() => {
    setRinging(isRinging);
  }, [isRinging, setRinging]);

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100svh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "12px 16px",
      }}
    >
      <AgendaStrip
        kind={agendaKind}
        tutorName={tutor.name}
        flag={tutor.flag}
        callDurationLabel={formatDuration(elapsedSec)}
        drill={drillState}
        roleplay={roleplayState}
        guided={guidedState}
        levelTest={levelTestState}
      />

      <div className="flex-1 flex flex-col items-center justify-center gap-8 py-8">
        <div
          className={`call-avatar ${voice.voiceActive ? "pulse" : ""}`}
          style={{
            width: 160,
            height: 160,
            fontSize: 56,
          }}
          aria-hidden="true"
        >
          {tutor.name[0]}
        </div>

        {isRinging ? (
          <div className="call-status call-status-ringing">ringing…</div>
        ) : captionsOn ? (
          <div
            className="call-captions-stack"
            style={{ maxWidth: 340 }}
            aria-live="polite"
          >
            {previousTutorMessage && (
              <div
                key={previousTutorMessage.id}
                className="call-caption-previous"
              >
                {previousTutorMessage.content}
              </div>
            )}
            {currentTutorMessage && (
              <div
                key={currentTutorMessage.id}
                className="call-caption-current"
              >
                {currentTutorMessage.content}
              </div>
            )}
          </div>
        ) : (
          <div className="call-status">
            {voice.voiceActive
              ? voice.userSpeaking
                ? "listening to you"
                : `${tutor.name} is speaking`
              : "tap mic to resume"}
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          className="mb-2 text-center"
          style={{
            fontSize: 11,
            color: "var(--ember)",
            opacity: 0.85,
          }}
        >
          {errorMsg}
        </div>
      )}

      <CallControls
        muted={muted}
        captionsOn={captionsOn}
        onToggleMute={handleToggleMute}
        onToggleCaptions={handleToggleCaptions}
        onEnd={handleEnd}
        disabled={voice.voiceConnecting}
      />

      {activeToast && (
        <SaveToast
          key={activeToast}
          word={activeToast}
          onDismiss={() => setActiveToast(null)}
        />
      )}
    </div>
  );
}
