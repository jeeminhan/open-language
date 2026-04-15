"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { useJournalRecorder } from "@/hooks/useJournalRecorder";

interface ErrorAnnotation {
  observed: string;
  expected: string;
  type: string;
  explanation: string;
  l1_source?: string | null;
}

interface TutorEval {
  score: number;
  correction_strategy_effectiveness?: string;
  strengths: string[];
  improvements: string[];
  missed_teaching_moments: string[];
  topic_difficulty_score?: number;
  topic_difficulty_notes?: string;
}

interface UnknownWord {
  word: string;
  context: string;
  definition: string;
}

interface ErrorCluster {
  name: string;
  description: string;
  error_types: string[];
  root_cause: string;
  recommendation: string;
}

interface PhrasingSuggestionItem {
  original: string;
  suggested: string;
  grammar_point: string;
  explanation: string;
  category: string;
}

interface ExpressionItem {
  expression: string;
  type: string;
  meaning: string;
  context: string;
  learner_used: boolean;
}

interface ReviewData {
  errors: ErrorAnnotation[];
  tutorEval: TutorEval | null;
  unknownWords: UnknownWord[];
  errorClusters: ErrorCluster[];
  phrasingSuggestions: PhrasingSuggestionItem[];
  expressions: ExpressionItem[];
}

interface Message {
  role: "user" | "tutor";
  content: string;
  analysis?: Record<string, unknown> | null;
  errors?: ErrorAnnotation[];
  analyzing?: boolean;
}

type ChatMode = "tutor" | "journal";

function buildJournalPrompt(adaptive?: AdaptiveData | null): string {
  const target = adaptive?.targetLanguage || "Korean";
  const native = adaptive?.nativeLanguage || "English";

  let levelNote = "A2";
  if (adaptive) {
    const eff = adaptive.effectiveLevel;
    levelNote = eff.confidence > 0.3
      ? `${eff.level} (${Math.round(eff.grammarMastery)}% grammar mastery)`
      : `${adaptive.registeredLevel} (registered)`;
  }

  let prompt = `You are a silent journal companion for a ${target} language learner. The learner is speaking their thoughts aloud as a voice journal entry in ${target}.

CRITICAL RULES:
- The learner is speaking ${target}. ALL their speech is in ${target}.
- You are NOT a conversational partner. You are a quiet presence.
- DO NOT ask questions. DO NOT prompt them for more. DO NOT react to their stories.
- DO NOT correct errors — corrections come after the journal session ends.
- Your ONLY role is to give a very brief, warm acknowledgment so the learner knows you're still listening.
- Respond with SHORT, minimal affirmations ONLY in ${target}: "네", "음", "그렇군요", "응" (for Korean), "うん", "そうなんだ" (for Japanese), "mm-hmm", "yeah" (for English), etc.
- NEVER respond with more than 3-5 words. One word is ideal.
- NEVER ask a follow-up question. NEVER say "tell me more". NEVER prompt them.
- If they pause, stay silent. They will continue when they're ready.
- Think of yourself as a diary page that occasionally hums to show it's listening.

The learner's native language: ${native}
The learner's level: ${levelNote}`;


  return prompt;
}

function buildVoicePrompt(adaptive?: AdaptiveData | null): string {
  let levelNote = "A2";
  let focusAreas = "";
  let l1Note = "";

  if (adaptive) {
    const eff = adaptive.effectiveLevel;
    if (eff.confidence > 0.3) {
      levelNote = `${eff.level} (computed from ${eff.totalDataPoints} data points, ${Math.round(eff.grammarMastery)}% grammar mastery, ${Math.round(eff.errorRate)}% error rate)`;
    } else {
      levelNote = `${adaptive.registeredLevel} (not enough data yet to adapt)`;
    }

    if (adaptive.practiceItems.length > 0) {
      focusAreas = `\n\nFOCUS AREAS (from spaced repetition — steer conversation toward these):\n${adaptive.practiceItems.map((p: PracticeItem) => `- ${p.description} (${p.category}, seen ${p.occurrence_count}x)`).join("\n")}`;
    }

    if (adaptive.l1Patterns.length > 0) {
      l1Note = `\n\nKNOWN L1 INTERFERENCE (English habits causing errors):\n${adaptive.l1Patterns.map((p: L1Pattern) => `- ${p.description}: ${p.l1_source}`).join("\n")}`;
    }
  }

  const target = adaptive?.targetLanguage || "Korean";
  const native = adaptive?.nativeLanguage || "English";

  let prompt = `You are a friendly ${target} language tutor having a real-time voice conversation.

CRITICAL LANGUAGE RULES:
- The learner is speaking ${target}. ALL their speech is in ${target}.
- You MUST respond ONLY in ${target} (with occasional ${native} explanations when they struggle).
- When you hear the learner speak, interpret their audio as ${target} — never as Korean, Chinese, or any other language.
- Even if the pronunciation is imperfect, the learner is attempting ${target}.

The learner's native language: ${native}
The learner's effective level: ${levelNote}

Your role:
- Have natural conversations in ${target}
- Gently correct errors using recasts (repeating what they said correctly)
- ADAPT your complexity to their computed level — if they're improving, push slightly harder vocabulary and grammar
- Be encouraging and conversational
- Mix in ${native} when they struggle
- Keep responses concise since this is a spoken conversation${focusAreas}${l1Note}

Style:
- Speak naturally, like a patient friend
- Use short sentences appropriate for conversation
- Pause between ideas
- React to what they say before correcting
- If focus areas are listed above, naturally steer topics to practice those patterns`;

  if (adaptive?.interests && adaptive.interests.length > 0) {
    const interestLines = adaptive.interests.slice(0, 6).map(
      (i) => `- ${i.name} (${i.category}${i.details ? `: ${i.details}` : ""})`
    );
    prompt += `\n\nLEARNER'S INTERESTS (talk about these — they enjoy them!):\n${interestLines.join("\n")}
\nUse their interests to make conversation engaging. Reference specific things they like. Ask follow-up questions about their interests. This makes them WANT to talk more.`;
  }

  // Idiom teaching for English learners
  if (target.toLowerCase() === "english") {
    prompt += `\n\nIDIOM TEACHING:
- Naturally weave 1-2 English idioms into each conversation turn
- When you use an idiom, briefly explain what it means in context
- Use idioms that fit the topic — don't force random ones in
- Start with common idioms (a piece of cake, break the ice, hit the nail on the head) then progress to more advanced ones as the learner improves
- When the learner successfully uses an idiom, praise it specifically
- If the learner translates a ${native} idiom literally into English, acknowledge the attempt and teach the English equivalent`;

    if (native.toLowerCase() === "korean") {
      prompt += `\n- Korean learners especially love idioms and 4-character expressions. Bridge with Korean equivalents when one exists:
  - 식은 죽 먹기 → "a piece of cake"
  - 눈이 높다 → "to have high standards" (not "eyes are high")
  - 발이 넓다 → "to be well-connected" (not "feet are wide")
  - 비행기를 태우다 → "to butter someone up" (not "to put someone on a plane")
- Watch for direct Korean-to-English idiom translations — these are great teaching moments
- Introduce phrasal verbs gradually — they're a major stumbling block for Korean speakers`;
    }

    prompt += `\n\nSLANG TEACHING:
- Naturally drop 1-2 pieces of current, conversational English slang per turn when it fits the register
- Briefly gloss what it means and when it's appropriate (casual only, among friends, internet-native, etc.)
- Favor slang that's actually in use (lowkey, no cap, it's giving, vibe, slay, mid, bet, sus, hits different, living rent-free, the ick) over dated slang
- Flag register — make clear what's fine with friends vs. inappropriate in class, interviews, or formal writing
- If the learner uses slang correctly, praise it; if they misuse it or use something dated/cringe, gently update them
- Don't overdo it — slang should feel natural, not performative`;

    if (native.toLowerCase() === "korean") {
      prompt += `\n- Bridge with Korean internet/youth slang when there's a rough equivalent (e.g. 찐 ≈ "for real", 인정 ≈ "facts", 킹받네 ≈ "that's annoying af", 갓생 ≈ "living your best life")
- Korean learners often pick up slang from US shows/TikTok — confirm or correct what they've absorbed`;
    }
  }

  return prompt;
}

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

const LANGUAGE_CODES: Record<string, string> = {
  korean: "ko-KR", japanese: "ja-JP", chinese: "zh-CN", mandarin: "zh-CN",
  cantonese: "zh-HK", spanish: "es-ES", french: "fr-FR", german: "de-DE",
  italian: "it-IT", portuguese: "pt-BR", russian: "ru-RU", arabic: "ar-SA",
  hindi: "hi-IN", thai: "th-TH", vietnamese: "vi-VN", indonesian: "id-ID",
  turkish: "tr-TR", dutch: "nl-NL", polish: "pl-PL", swedish: "sv-SE",
  english: "en-US",
};

function getLanguageCode(targetLanguage?: string): string | undefined {
  if (!targetLanguage) return undefined;
  return LANGUAGE_CODES[targetLanguage.toLowerCase()];
}

interface LearnerInterest {
  category: string;
  name: string;
  details: string | null;
  mention_count: number;
}

interface AdaptiveData {
  practiceItems: PracticeItem[];
  effectiveLevel: {
    level: string;
    confidence: number;
    grammarMastery: number;
    errorRate: number;
    totalDataPoints: number;
  };
  l1Patterns: L1Pattern[];
  registeredLevel: string;
  targetLanguage: string;
  nativeLanguage: string;
  interests: LearnerInterest[];
}

export default function ChatPage() {
  const [chatMode, setChatMode] = useState<ChatMode>("tutor");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turnNumber, setTurnNumber] = useState(0);
  const [topics, setTopics] = useState<Array<{ topic: string; context?: string | null; webSnippet?: string | null; grammarTarget?: string | null; interestConnection?: string | null }>>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData>({ errors: [], tutorEval: null, unknownWords: [], errorClusters: [], phrasingSuggestions: [], expressions: [] });
  const [reviewing, setReviewing] = useState(false);
  const [reviewStage, setReviewStage] = useState("");
  const [adaptive, setAdaptive] = useState<AdaptiveData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [wordPopup, setWordPopup] = useState<{ word: string; x: number; y: number } | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Fetch adaptive learning data on mount
  useEffect(() => {
    fetch("/api/practice")
      .then((r) => r.json())
      .then((data) => {
        if (data.effectiveLevel) setAdaptive(data);
      })
      .catch(() => {});
  }, []);

  // Track which voice messages we've already analyzed/saved
  const analyzedVoiceRef = useRef<Set<string>>(new Set());
  const savedVoiceTurnsRef = useRef<Set<string>>(new Set());
  const voiceSessionIdRef = useRef<string | null>(null);
  const voiceTurnRef = useRef(0);

  const journal = useJournalRecorder();

  const voice = useVoiceChat({
    systemPrompt: buildVoicePrompt(adaptive),
    languageCode: getLanguageCode(adaptive?.targetLanguage),
    greeting: "Start the conversation. Greet the learner warmly and suggest a topic to talk about.",
    onTurnComplete: (msgs) => {
      // Find the last complete user→assistant pair that hasn't been saved
      for (let i = msgs.length - 2; i >= 0; i--) {
        const userMsg = msgs[i];
        const assistantMsg = msgs[i + 1];
        if (
          userMsg?.role === "user" &&
          assistantMsg?.role === "assistant" &&
          !savedVoiceTurnsRef.current.has(userMsg.id)
        ) {
          savedVoiceTurnsRef.current.add(userMsg.id);
          voiceTurnRef.current += 1;
          // Delay slightly to let final transcript chunks settle
          setTimeout(() => {
            const latestUser = userMsg.content;
            const latestAssistant = assistantMsg.content;
            const msgIdx = i;
            fetch("/api/voice-turn", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: voiceSessionIdRef.current,
                turnNumber: voiceTurnRef.current,
                userMessage: latestUser,
                tutorResponse: latestAssistant,
                mode: chatMode === "journal" ? "voice-journal" : undefined,
              }),
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.sessionId && !voiceSessionIdRef.current) {
                  voiceSessionIdRef.current = data.sessionId;
                }
                // Use server-side analysis errors for display (filter false positives)
                if (Array.isArray(data.errors)) {
                  const realErrors = data.errors.filter(
                    (e: ErrorAnnotation) => e.observed?.trim().toLowerCase() !== e.expected?.trim().toLowerCase()
                  );
                  if (realErrors.length > 0) {
                    setVoiceErrors((prev) => ({ ...prev, [msgIdx]: realErrors }));
                    analyzedVoiceRef.current.add(userMsg.id);
                  }
                }
              })
              .catch(() => {});
          }, 1500);
          break;
        }
      }
    },
  });

  useEffect(() => {
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        if (data?.topics && Array.isArray(data.topics)) setTopics(data.topics);
        else if (Array.isArray(data)) setTopics(data.map((t: string) => ({ topic: t })));
      })
      .catch(() => {});
  }, []);

  // Analyze a user message for errors in the background
  const analyzeMessage = useCallback(
    async (msgIndex: number, text: string, target: "voice" | "text") => {
      if (!text || text.trim().length < 2) return;

      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            targetLanguage: adaptive?.targetLanguage || "Korean",
            nativeLanguage: adaptive?.nativeLanguage || "English",
            level: adaptive?.effectiveLevel?.level || adaptive?.registeredLevel || "A2",
          }),
        });
        const data = await res.json();
        const errors: ErrorAnnotation[] = (data.errors || []).filter(
          (e: ErrorAnnotation) => e.observed?.trim().toLowerCase() !== e.expected?.trim().toLowerCase()
        );

        if (errors.length > 0) {
          if (target === "text") {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[msgIndex]) {
                updated[msgIndex] = {
                  ...updated[msgIndex],
                  errors,
                  analyzing: false,
                };
              }
              return updated;
            });
          } else {
            // For voice messages, store in a separate map keyed by index
            setVoiceErrors((prev) => ({ ...prev, [msgIndex]: errors }));
          }
        } else {
          if (target === "text") {
            setMessages((prev) => {
              const updated = [...prev];
              if (updated[msgIndex]) {
                updated[msgIndex] = { ...updated[msgIndex], analyzing: false };
              }
              return updated;
            });
          }
        }
      } catch {
        if (target === "text") {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[msgIndex]) {
              updated[msgIndex] = { ...updated[msgIndex], analyzing: false };
            }
            return updated;
          });
        }
      }
    },
    [adaptive]
  );

  // Voice error annotations (keyed by voice message index)
  const [voiceErrors, setVoiceErrors] = useState<
    Record<number, ErrorAnnotation[]>
  >({});

  // Analyze voice user messages as they finalize
  useEffect(() => {
    voice.messages.forEach((vm, i) => {
      if (
        vm.role === "user" &&
        vm.content.trim().length >= 2 &&
        !analyzedVoiceRef.current.has(vm.id)
      ) {
        const nextMsg = voice.messages[i + 1];
        if (nextMsg && nextMsg.role === "assistant") {
          analyzedVoiceRef.current.add(vm.id);
          analyzeMessage(i, vm.content, "voice");
        }
      }
    });
  }, [voice.messages, analyzeMessage]);

  // Combine text messages and voice messages for display
  const allMessages: Message[] = [
    ...messages,
    ...voice.messages.map((vm, i) => ({
      role: (vm.role === "user" ? "user" : "tutor") as "user" | "tutor",
      content: vm.content,
      errors: voiceErrors[i],
    })),
  ];

  // Text selection → vocab popup
  const handleTextSelect = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setWordPopup(null);
      return;
    }
    const word = sel.toString().trim();
    if (word.length < 1 || word.length > 40 || word.includes("\n")) {
      setWordPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const container = chatContainerRef.current?.getBoundingClientRect();
    if (!container) return;
    setWordPopup({
      word,
      x: rect.left + rect.width / 2 - container.left,
      y: rect.top - container.top - 8,
    });
  }, []);

  const saveWordToVocab = useCallback(async (word: string) => {
    setSavedWords((prev) => new Set(prev).add(word.toLowerCase()));
    setWordPopup(null);
    window.getSelection()?.removeAllRanges();
    try {
      await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: word.trim(), action: "add" }),
      });
    } catch { /* silent */ }
  }, []);

  // Dismiss popup on click outside
  useEffect(() => {
    const dismiss = (e: MouseEvent) => {
      if (wordPopup && !(e.target as HTMLElement)?.closest?.("[data-vocab-popup]")) {
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) setWordPopup(null);
        }, 10);
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, [wordPopup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (voice.voiceActive) {
      voice.sendText(msg);
      setInput("");
      return;
    }

    setInput("");
    setLoading(true);

    const userMsg: Message = {
      role: "user",
      content: msg,
      analyzing: true,
    };
    const newMessages: Message[] = [...messages, userMsg];
    setMessages(newMessages);

    // Fire off analysis in background
    const userMsgIndex = newMessages.length - 1;
    analyzeMessage(userMsgIndex, msg, "text");

    const history = newMessages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          sessionId,
          history: history.slice(-20),
          turnNumber: turnNumber + 1,
        }),
      });

      const data = await res.json();

      if (data.sessionId && !sessionId) setSessionId(data.sessionId);
      setTurnNumber(data.turnNumber || turnNumber + 1);

      setMessages((prev) => [
        ...prev,
        {
          role: "tutor",
          content: data.response,
          analysis: data.analysis,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "tutor", content: "Connection error. Try again." },
      ]);
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  // End the active session (text or voice)
  const endActiveSession = useCallback(() => {
    const sid = sessionId || voiceSessionIdRef.current;
    if (sid) {
      // Use sendBeacon for reliability on unload, fetch otherwise
      const body = JSON.stringify({ sessionId: sid });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/session/end", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/session/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }).catch(() => {});
      }
    }
  }, [sessionId]);

  // End session on page unload
  useEffect(() => {
    const handleUnload = () => endActiveSession();
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      endActiveSession();
    };
  }, [endActiveSession]);

  function endSession() {
    endActiveSession();
    voice.reset();
    setSessionEnded(true);

    // Fire the self-correction review agent with all loops
    setReviewing(true);
    setReviewStage("Scanning conversation for errors...");
    const reviewMessages = allMessages.map((m) => ({
      role: m.role === "user" ? "user" : "tutor",
      content: m.content,
    }));

    // Animate through stages
    const stages = chatMode === "journal" ? [
      "Reading your journal entry...",
      "Noting natural phrasing...",
      "Finding expression upgrades...",
      "Detecting unknown vocabulary...",
      "Building your corrections...",
      "Finalizing review...",
    ] : [
      "Scanning conversation for errors...",
      "Checking L1 interference patterns...",
      "Evaluating tutor effectiveness...",
      "Detecting unknown vocabulary...",
      "Clustering error patterns...",
      "Finalizing review...",
    ];
    let stageIdx = 0;
    const stageInterval = setInterval(() => {
      stageIdx = Math.min(stageIdx + 1, stages.length - 1);
      setReviewStage(stages[stageIdx]);
    }, 2500);

    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: reviewMessages }),
    })
      .then((r) => r.json())
      .then((data) => {
        setReviewData({
          errors: Array.isArray(data.errors) ? data.errors.filter(
            (e: ErrorAnnotation) => e.observed?.trim().toLowerCase() !== e.expected?.trim().toLowerCase()
          ) : [],
          tutorEval: data.tutorEval || null,
          unknownWords: Array.isArray(data.unknownWords) ? data.unknownWords : [],
          errorClusters: Array.isArray(data.errorClusters) ? data.errorClusters : [],
          phrasingSuggestions: Array.isArray(data.phrasingSuggestions) ? data.phrasingSuggestions : [],
          expressions: Array.isArray(data.expressions) ? data.expressions : [],
        });
      })
      .catch(() => {})
      .finally(() => {
        clearInterval(stageInterval);
        setReviewing(false);
      });
  }

  function startNewSession() {
    setMessages([]);
    setVoiceErrors({});
    setReviewData({ errors: [], tutorEval: null, unknownWords: [], errorClusters: [], phrasingSuggestions: [], expressions: [] });
    setReviewing(false);
    setReviewStage("");
    analyzedVoiceRef.current.clear();
    savedVoiceTurnsRef.current.clear();
    voiceSessionIdRef.current = null;
    voiceTurnRef.current = 0;
    setSessionId(null);
    setTurnNumber(0);
    setSessionEnded(false);
    fetch("/api/topics")
      .then((r) => r.json())
      .then((data) => {
        if (data?.topics && Array.isArray(data.topics)) setTopics(data.topics);
        else if (Array.isArray(data)) setTopics(data.map((t: string) => ({ topic: t })));
      })
      .catch(() => {});
  }

  // Collect all errors from this session for the review screen
  const allSessionErrors: ErrorAnnotation[] = [
    ...messages.flatMap((m) => m.errors || []),
    ...Object.values(voiceErrors).flat(),
  ];

  // Collect dismissed error keys
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());

  function dismissError(err: ErrorAnnotation) {
    setDismissedErrors((prev) => {
      const next = new Set(prev);
      next.add(`${err.observed}::${err.expected}`);
      return next;
    });
  }

  const activeSessionErrors = allSessionErrors.filter(
    (e) => !dismissedErrors.has(`${e.observed}::${e.expected}`)
  );

  // Group errors by type for the review
  const errorsByType: Record<string, ErrorAnnotation[]> = {};
  for (const err of activeSessionErrors) {
    const t = err.type || "other";
    if (!errorsByType[t]) errorsByType[t] = [];
    // Deduplicate
    if (!errorsByType[t].some((e) => e.observed === err.observed && e.expected === err.expected)) {
      errorsByType[t].push(err);
    }
  }

  // Extract unique words from tutor messages for the vocab picker
  const conversationWords = Array.from(
    new Set(
      allMessages
        .filter((m) => m.role === "tutor")
        .flatMap((m) => m.content.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((w) => w.length >= 2))
    )
  );

  if (sessionEnded) {
    return (
      <SessionReview
        errorsByType={errorsByType}
        totalMessages={allMessages.filter((m) => m.role === "user").length}
        totalErrors={activeSessionErrors.length}
        onDismiss={dismissError}
        onNewSession={startNewSession}
        reviewData={reviewData}
        reviewing={reviewing}
        reviewStage={reviewStage}
        conversationWords={conversationWords}
        isJournal={chatMode === "journal"}
      />
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 180px)" }}>
      {/* Chat messages */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto space-y-4 pb-4"
        style={{ position: "relative" }}
        onMouseUp={handleTextSelect}
      >
        {/* Vocab save popup */}
        {wordPopup && (
          <div
            data-vocab-popup
            style={{
              position: "absolute",
              left: Math.max(8, Math.min(wordPopup.x - 60, (chatContainerRef.current?.clientWidth || 300) - 128)),
              top: wordPopup.y - 36,
              zIndex: 50,
              animation: "vocabPopIn 0.15s ease-out",
            }}
          >
            {savedWords.has(wordPopup.word.toLowerCase()) ? (
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg"
                style={{ background: "var(--moss)", color: "white" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Saved
              </span>
            ) : (
              <button
                onClick={() => saveWordToVocab(wordPopup.word)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg transition-all hover:scale-105"
                style={{
                  background: "var(--river)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Save &ldquo;{wordPopup.word}&rdquo;
              </button>
            )}
          </div>
        )}

        {allMessages.length === 0 &&
          !voice.voiceActive &&
          !voice.voiceConnecting && (
            <div className="py-8 space-y-6">
              {/* Mode toggle */}
              <div className="flex justify-center">
                <div
                  className="inline-flex rounded-xl p-1"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <button
                    onClick={() => setChatMode("tutor")}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: chatMode === "tutor" ? "var(--river)" : "transparent",
                      color: chatMode === "tutor" ? "white" : "var(--text-dim)",
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
                      </svg>
                      Tutor
                    </span>
                  </button>
                  <button
                    onClick={() => setChatMode("journal")}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: chatMode === "journal" ? "var(--gold)" : "transparent",
                      color: chatMode === "journal" ? "white" : "var(--text-dim)",
                    }}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                      Journal
                    </span>
                  </button>
                </div>
              </div>

              <div className="text-center">
                <p
                  className="text-lg mb-2"
                  style={{ color: "var(--text-dim)" }}
                >
                  {chatMode === "journal"
                    ? "Your voice journal"
                    : "Start a conversation in your target language"}
                </p>
                <p
                  className="text-xs mb-2"
                  style={{ color: "var(--text-dim)" }}
                >
                  {chatMode === "journal"
                    ? "Speak or type freely — no interruptions, corrections come after"
                    : "Type below or tap the mic for real-time voice"}
                </p>
              </div>

              {/* Adaptive level indicator — tutor mode only */}
              {chatMode === "tutor" && adaptive && adaptive.effectiveLevel.confidence > 0.3 && (
                <div
                  className="mx-auto max-w-md rounded-xl p-3"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                      Adaptive Level
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "var(--river)" }}>
                      {adaptive.effectiveLevel.level}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs" style={{ color: "var(--text-dim)" }}>
                    <span>Grammar: {Math.round(adaptive.effectiveLevel.grammarMastery)}%</span>
                    <span>Error rate: {Math.round(adaptive.effectiveLevel.errorRate)}%</span>
                  </div>
                  {adaptive.registeredLevel !== adaptive.effectiveLevel.level && (
                    <p className="text-xs mt-1" style={{ color: "var(--moss)" }}>
                      Registered as {adaptive.registeredLevel} — tutor adapting to your actual performance
                    </p>
                  )}
                </div>
              )}

              {/* Work on these — merged practice + L1 items, tutor mode only */}
              {chatMode === "tutor" && adaptive && (() => {
                const targetLang = (adaptive.targetLanguage || "").toLowerCase();
                const hasTargetScript = (s: string) => {
                  if (!s) return false;
                  if (targetLang.includes("japanese")) return /[\u3040-\u30ff\u4e00-\u9fff]/.test(s);
                  if (targetLang.includes("korean")) return /[\uac00-\ud7af]/.test(s);
                  if (targetLang.includes("chinese")) return /[\u4e00-\u9fff]/.test(s);
                  if (targetLang.includes("english")) return /[a-zA-Z]/.test(s);
                  return true;
                };
                const seen = new Set<string>();
                const items: { description: string; priority?: number; count?: number }[] = [];
                for (const p of adaptive.practiceItems) {
                  if (!hasTargetScript(p.description)) continue;
                  if (seen.has(p.description)) continue;
                  seen.add(p.description);
                  items.push({ description: p.description, priority: p.priority, count: p.occurrence_count });
                }
                for (const p of adaptive.l1Patterns) {
                  if (!hasTargetScript(p.description)) continue;
                  if (seen.has(p.description)) continue;
                  seen.add(p.description);
                  items.push({ description: p.description });
                }
                if (items.length === 0) return null;
                return (
                  <div className="mx-auto max-w-md">
                    <p
                      className="text-xs uppercase tracking-wider mb-2 text-center"
                      style={{ color: "var(--ember)" }}
                    >
                      Work on these
                    </p>
                    <div className="space-y-1.5">
                      {items.slice(0, 6).map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <span style={{ color: "var(--text)" }}>{item.description}</span>
                          {item.count && (
                            <span className="ml-auto shrink-0" style={{ color: "var(--text-dim)" }}>
                              {item.count}x
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Suggested topics — tutor mode only */}
              {chatMode === "tutor" && topics.length > 0 && (
                <div className="text-center">
                  <p
                    className="text-xs uppercase tracking-wider mb-3"
                    style={{ color: "var(--text-dim)" }}
                  >
                    Suggested topics
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {topics.map((t, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(t.topic)}
                        className="text-sm px-3 py-2 rounded-lg transition-all hover:scale-[1.02] text-left"
                        style={{
                          background: "var(--bg-card)",
                          border: `1px solid ${t.interestConnection ? "var(--gold)" : "var(--border)"}`,
                          color: "var(--text)",
                        }}
                        title={[t.context, t.webSnippet].filter(Boolean).join("\n\n") || undefined}
                      >
                        <span>{t.topic}</span>
                        {t.interestConnection && (
                          <span className="text-[10px] ml-1.5" style={{ color: "var(--gold)" }}>
                            ({t.interestConnection})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        {allMessages.length === 0 &&
          (voice.voiceActive || voice.voiceConnecting) && (
            <VoiceIndicator
              connecting={voice.voiceConnecting}
              speaking={voice.userSpeaking}
              isJournal={chatMode === "journal"}
            />
          )}

        {chatMode === "journal" ? (
          /* ── Journal layout: flowing text, not chat bubbles ── */
          <>
            {allMessages.filter(m => m.role === "user").length > 0 && (
              <div
                className="max-w-2xl mx-auto px-6 py-4 rounded-2xl"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  minHeight: "200px",
                }}
              >
                <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span className="text-xs font-medium" style={{ color: "var(--gold)" }}>
                    {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </span>
                </div>
                <div className="space-y-3">
                  {allMessages.map((msg, i) => {
                    if (msg.role !== "user") return null;
                    return (
                      <p
                        key={i}
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--text)" }}
                      >
                        {msg.content}
                      </p>
                    );
                  })}
                  {journal.recording && (journal.segments.length > 0 || journal.interimText) && (
                    <>
                      {journal.segments.map((seg, i) => (
                        <p key={`jseg-${i}`} className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                          {seg}
                        </p>
                      ))}
                      {journal.interimText && (
                        <p className="text-sm leading-relaxed italic" style={{ color: "var(--text-dim)" }}>
                          {journal.interimText}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Chat layout: standard chat bubbles ── */
          allMessages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" ? (
                <div>
                  <div className="flex justify-end">
                    <div
                      className="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5"
                      style={{ background: "var(--river)", color: "white" }}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {/* Error annotations for user messages */}
                  {msg.analyzing && (
                    <div className="flex justify-end mt-1 mr-1">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ color: "var(--text-dim)" }}
                      >
                        checking...
                      </span>
                    </div>
                  )}
                  {msg.errors && msg.errors.length > 0 && (
                    <ErrorBox errors={msg.errors} onDismiss={dismissError} />
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-start">
                    <div
                      className="max-w-[75%] rounded-2xl rounded-bl-sm px-4 py-2.5"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                  {/* Legacy analysis errors from text chat API */}
                  {msg.analysis &&
                    Array.isArray(msg.analysis.errors) &&
                    (msg.analysis.errors as Array<Record<string, string>>)
                      .length > 0 && (
                      <div className="ml-2 mt-1 space-y-1">
                        {(
                          msg.analysis.errors as Array<Record<string, string>>
                        ).map((err, j) => (
                          <div
                            key={j}
                            className="text-xs px-2 py-1 rounded inline-block mr-2"
                            style={{
                              background: "rgba(196, 94, 74, 0.1)",
                              borderLeft: "2px solid var(--ember)",
                            }}
                          >
                            <span style={{ color: "var(--ember)" }}>
                              {err.observed}
                            </span>
                            <span style={{ color: "var(--text-dim)" }}>
                              {" → "}
                            </span>
                            <span style={{ color: "var(--moss)" }}>
                              {err.expected}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Interim local transcript while user speaks */}
        {voice.voiceActive && voice.interimTranscript && (
          <div className="flex justify-end">
            <div
              className="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 italic"
              style={{
                background: "rgba(98, 148, 184, 0.35)",
                color: "rgba(255, 255, 255, 0.7)",
                transition: "opacity 0.2s",
              }}
            >
              {voice.interimTranscript}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-bl-sm px-4 py-2.5"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
              }}
            >
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-4 items-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <MicButton
          active={chatMode === "journal" ? journal.recording : voice.voiceActive}
          connecting={chatMode === "journal" ? false : voice.voiceConnecting}
          speaking={chatMode === "journal" ? journal.recording : voice.userSpeaking}
          onClick={chatMode === "journal"
            ? async () => {
                if (journal.recording) {
                  const audio = await journal.stop();
                  // Add all finalized segments as user messages
                  if (journal.segments.length > 0) {
                    const fullText = journal.segments.join(" ");
                    setMessages((prev) => [...prev, { role: "user", content: fullText }]);
                  }
                  // Send audio for transcription to get a better version
                  if (audio) {
                    const res = await fetch("/api/transcribe", {
                      method: "POST",
                      body: (() => { const fd = new FormData(); fd.append("audio", new Blob([Uint8Array.from(atob(audio), c => c.charCodeAt(0))], { type: "audio/pcm;rate=16000" }), "journal.pcm"); fd.append("language", adaptive?.targetLanguage || ""); return fd; })(),
                    });
                    const data = await res.json();
                    if (data.text) {
                      // Replace with better transcription
                      setMessages((prev) => {
                        const updated = [...prev];
                        if (updated.length > 0 && updated[updated.length - 1].role === "user") {
                          updated[updated.length - 1] = { ...updated[updated.length - 1], content: data.text };
                        }
                        return updated;
                      });
                    }
                  }
                } else {
                  journal.start(getLanguageCode(adaptive?.targetLanguage));
                }
              }
            : voice.toggleVoice
          }
        />

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={
            chatMode === "journal"
              ? journal.recording
                ? "Speaking... tap mic to stop"
                : "Write about your day..."
              : voice.voiceActive
                ? "Type while voice is active, or just speak..."
                : "Type in your target language..."
          }
          className="flex-1 min-w-0 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-sm outline-none"
          style={{
            background: "var(--bg-card)",
            border: chatMode === "journal" ? "1px solid rgba(196, 150, 74, 0.3)" : "1px solid var(--border)",
            color: "var(--text)",
          }}
          disabled={loading}
          autoFocus
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm font-medium transition-all shrink-0"
          style={{
            background: input.trim()
              ? chatMode === "journal" ? "var(--gold)" : "var(--river)"
              : "var(--border)",
            color: input.trim() ? "white" : "var(--text-dim)",
          }}
        >
          {chatMode === "journal" ? "Write" : "Send"}
        </button>

        {allMessages.length > 0 && (
          <button
            onClick={endSession}
            className="px-3 py-3 rounded-xl text-xs font-medium transition-all"
            style={{
              background: chatMode === "journal" ? "rgba(196, 150, 74, 0.1)" : "rgba(196, 94, 74, 0.1)",
              border: chatMode === "journal" ? "1px solid rgba(196, 150, 74, 0.3)" : "1px solid rgba(196, 94, 74, 0.3)",
              color: chatMode === "journal" ? "var(--gold)" : "var(--ember)",
            }}
          >
            {chatMode === "journal" ? "Done" : "End"}
          </button>
        )}
      </div>

      {(voice.voiceActive || journal.recording) && (
        <div
          className="text-center text-xs py-1.5 mt-2 rounded-lg"
          style={{
            background: "var(--bg-card)",
            border: `1px solid ${chatMode === "journal" ? "rgba(196, 150, 74, 0.3)" : "var(--border)"}`,
            color: chatMode === "journal" ? "var(--gold)" : voice.userSpeaking ? "var(--river)" : "var(--moss)",
          }}
        >
          {chatMode === "journal"
            ? `Recording journal — ${Math.floor(journal.duration / 60)}:${(journal.duration % 60).toString().padStart(2, "0")}`
            : voice.userSpeaking
              ? "Listening..."
              : "Voice active — speak naturally"}
        </div>
      )}

      <style jsx>{`
        @keyframes vocabPopIn {
          from { opacity: 0; transform: translateY(4px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ── Error annotation box ────────────────────────────────

function ErrorBox({
  errors,
  onDismiss,
}: {
  errors: ErrorAnnotation[];
  onDismiss?: (err: ErrorAnnotation) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localDismissed, setLocalDismissed] = useState<Set<number>>(new Set());

  const visible = errors.filter((_, i) => !localDismissed.has(i));
  if (visible.length === 0) return null;

  return (
    <div
      className="flex justify-end mt-1.5 mr-1"
      style={{ animation: "slideIn 0.3s ease-out" }}
    >
      <div
        className="max-w-[75%] rounded-xl overflow-hidden"
        style={{
          background: "rgba(196, 94, 74, 0.08)",
          border: "1px solid rgba(196, 94, 74, 0.25)",
        }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-left"
        >
          <span className="text-xs font-medium" style={{ color: "var(--ember)" }}>
            {visible.length} {visible.length === 1 ? "error" : "errors"} found
          </span>
          <svg
            width="10" height="6" viewBox="0 0 10 6" fill="none"
            style={{
              color: "var(--ember)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              marginLeft: "auto",
            }}
          >
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        <div className="px-3 pb-2 space-y-1">
          {errors.map((err, j) => {
            if (localDismissed.has(j)) return null;
            return (
              <div key={j} className="flex items-center gap-1.5 text-xs group">
                <span style={{ color: "var(--ember)", textDecoration: "line-through", opacity: 0.7 }}>
                  {err.observed}
                </span>
                <span style={{ color: "var(--text-dim)" }}>→</span>
                <span style={{ color: "var(--moss)", fontWeight: 500 }}>
                  {err.expected}
                </span>
                {/* Dismiss — "not my error" */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLocalDismissed((prev) => new Set(prev).add(j));
                    onDismiss?.(err);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity px-1"
                  title="Not my error (transcription mistake)"
                  style={{ color: "var(--text-dim)" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="2" y1="2" x2="8" y2="8" />
                    <line x1="8" y1="2" x2="2" y2="8" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {expanded && (
          <div
            className="px-3 pb-2.5 space-y-2"
            style={{ borderTop: "1px solid rgba(196, 94, 74, 0.15)" }}
          >
            {errors.map((err, j) => {
              if (localDismissed.has(j)) return null;
              return (
                <div key={j} className="pt-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(196, 94, 74, 0.15)", color: "var(--ember)" }}
                    >
                      {err.type}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                    {err.explanation}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Session review screen ───────────────────────────────

function SessionReview({
  errorsByType,
  totalMessages,
  totalErrors,
  onDismiss,
  onNewSession,
  reviewData,
  reviewing,
  reviewStage,
  conversationWords,
  isJournal,
}: {
  errorsByType: Record<string, ErrorAnnotation[]>;
  totalMessages: number;
  totalErrors: number;
  onDismiss: (err: ErrorAnnotation) => void;
  onNewSession: () => void;
  reviewData: ReviewData;
  reviewing: boolean;
  reviewStage: string;
  conversationWords: string[];
  isJournal?: boolean;
}) {
  const typeLabels: Record<string, string> = {
    particle: "Particles", spacing: "Spacing", conjugation: "Conjugation",
    word_choice: "Word Choice", grammar: "Grammar", spelling: "Spelling",
    formality: "Formality", word_order: "Word Order", phrasing: "Phrasing",
    pattern: "Patterns", context: "Context", idiom: "Idiom Errors",
    collocation: "Collocations", other: "Other",
  };

  const typeColors: Record<string, string> = {
    particle: "var(--ember)", spacing: "var(--gold)", conjugation: "var(--river)",
    grammar: "var(--ember)", word_choice: "var(--moss)", spelling: "var(--gold)",
    formality: "var(--river)", word_order: "var(--gold)", phrasing: "var(--moss)",
    pattern: "var(--river)", context: "var(--gold)", idiom: "var(--river)",
    collocation: "var(--river)", other: "var(--text-dim)",
  };

  const sortedTypes = Object.entries(errorsByType).sort(
    (a, b) => b[1].length - a[1].length
  );

  // If still reviewing, show a full-screen loading state
  if (reviewing) {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ height: "calc(100vh - 160px)", animation: "slideIn 0.4s ease-out" }}
      >
        <div className="relative mb-6">
          <div
            className="w-20 h-20 rounded-full border-4 border-t-transparent"
            style={{ borderColor: "var(--river)", borderTopColor: "transparent", animation: "spin 1s linear infinite" }}
          />
          <svg
            width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--river)" strokeWidth="2"
            className="absolute top-1/2 left-1/2"
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
        </div>
        <h2 className="text-lg font-bold mb-2" style={{ color: "var(--river)" }}>
          Review Agent Running
        </h2>
        <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
          {reviewStage || "Analyzing conversation..."}
        </p>
        <div className="flex gap-3 text-xs" style={{ color: "var(--text-dim)" }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--ember)", animation: "pulse 1.5s infinite" }} />
            Error scan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--gold)", animation: "pulse 1.5s infinite 0.3s" }} />
            L1 interference
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--river)", animation: "pulse 1.5s infinite 0.6s" }} />
            Tutor eval
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--moss)", animation: "pulse 1.5s infinite 0.9s" }} />
            Vocab check
          </span>
        </div>
        <style jsx>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
          @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ animation: "slideIn 0.4s ease-out" }}
    >
      <div className="pb-4 space-y-4">
        {/* Header */}
        <div className="text-center py-6">
          <h2 className="text-xl font-bold mb-2" style={{ color: isJournal ? "var(--gold)" : "var(--gold)" }}>
            {isJournal ? "Journal Entry Complete" : "Session Complete"}
          </h2>
          {isJournal && (
            <p className="text-xs mb-2" style={{ color: "var(--text-dim)" }}>
              Here{"'"}s how you expressed yourself — and how a native speaker would say it
            </p>
          )}
          <div className="flex justify-center gap-6 text-sm" style={{ color: "var(--text-dim)" }}>
            <span>{totalMessages} messages</span>
            <span style={{ color: totalErrors > 0 ? "var(--ember)" : "var(--moss)" }}>
              {totalErrors + reviewData.errors.length} errors found
            </span>
            {reviewData.unknownWords.length > 0 && (
              <span style={{ color: "var(--gold)" }}>
                {reviewData.unknownWords.length} new vocab
              </span>
            )}
          </div>
        </div>

        {/* Tutor Self-Evaluation */}
        {reviewData.tutorEval && (
          <div className="card" style={{ borderLeft: "3px solid var(--moss)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
                <h3 className="text-sm font-semibold" style={{ color: "var(--moss)" }}>
                  Tutor Self-Evaluation
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold" style={{ color: "var(--moss)" }}>
                  {reviewData.tutorEval.score}
                </span>
                <span className="text-xs" style={{ color: "var(--text-dim)" }}>/10</span>
              </div>
            </div>
            {reviewData.tutorEval.topic_difficulty_score && (
              <div className="flex items-center gap-2 mb-2 text-xs">
                <span style={{ color: "var(--text-dim)" }}>Topic difficulty:</span>
                <span className="font-semibold" style={{ color: "var(--river)" }}>
                  {reviewData.tutorEval.topic_difficulty_score}/10
                </span>
                {reviewData.tutorEval.topic_difficulty_notes && (
                  <span style={{ color: "var(--text-dim)" }}>— {reviewData.tutorEval.topic_difficulty_notes}</span>
                )}
              </div>
            )}
            {reviewData.tutorEval.correction_strategy_effectiveness && (
              <p className="text-xs mb-2 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                {reviewData.tutorEval.correction_strategy_effectiveness}
              </p>
            )}
            <div className="grid md:grid-cols-2 gap-3 mt-2">
              {reviewData.tutorEval.strengths.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--moss)" }}>Strengths</div>
                  {reviewData.tutorEval.strengths.map((s, i) => (
                    <p key={i} className="text-xs mb-0.5" style={{ color: "var(--text-dim)" }}>+ {s}</p>
                  ))}
                </div>
              )}
              {reviewData.tutorEval.improvements.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--ember)" }}>To Improve</div>
                  {reviewData.tutorEval.improvements.map((s, i) => (
                    <p key={i} className="text-xs mb-0.5" style={{ color: "var(--text-dim)" }}>- {s}</p>
                  ))}
                </div>
              )}
            </div>
            {reviewData.tutorEval.missed_teaching_moments.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--gold)" }}>Missed Teaching Moments</div>
                {reviewData.tutorEval.missed_teaching_moments.map((s, i) => (
                  <p key={i} className="text-xs mb-0.5" style={{ color: "var(--text-dim)" }}>{s}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Phrasing Suggestions — how you could've said it better */}
        {reviewData.phrasingSuggestions.length > 0 && (
          <div className="card" style={{ borderLeft: "3px solid var(--river)" }}>
            <div className="flex items-center gap-2 mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--river)" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <h3 className="text-sm font-semibold" style={{ color: "var(--river)" }}>
                How you could say it
              </h3>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
              Not errors — just ways to sound more natural or use new patterns
            </p>
            <div className="space-y-3">
              {reviewData.phrasingSuggestions.map((ps, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 text-sm mb-1.5 flex-wrap">
                    <span style={{ color: "var(--text-dim)" }}>{ps.original}</span>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                    <span style={{ color: "var(--river)", fontWeight: 600 }}>{ps.suggested}</span>
                  </div>
                  {ps.grammar_point && (
                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full mb-1.5 font-medium"
                      style={{ background: "rgba(91, 126, 154, 0.15)", color: "var(--river)" }}>
                      {ps.grammar_point}
                    </span>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{ps.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expressions encountered — passive vs active knowledge */}
        {reviewData.expressions.length > 0 && (
          <div className="card" style={{ borderLeft: "3px solid var(--moss)" }}>
            <div className="flex items-center gap-2 mb-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              <h3 className="text-sm font-semibold" style={{ color: "var(--moss)" }}>
                Expressions &amp; Idioms
              </h3>
            </div>
            <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
              Idioms, phrasal verbs, and expressions from this session — tracked by whether you used them or just heard them
            </p>
            <div className="grid md:grid-cols-2 gap-2">
              {reviewData.expressions.map((expr, i) => {
                const typeLabel: Record<string, string> = {
                  idiom: "Idiom", slang: "Slang", phrasal_verb: "Phrasal Verb", set_phrase: "Set Phrase",
                  grammar_pattern: "Grammar", colloquial: "Colloquial", honorific: "Honorific",
                  l1_transfer: "L1 Transfer",
                };
                const typeColor: Record<string, string> = {
                  idiom: "var(--river)", slang: "var(--ember)", phrasal_verb: "var(--river)", l1_transfer: "var(--ember)",
                  colloquial: "var(--gold)", set_phrase: "var(--moss)", grammar_pattern: "var(--text-dim)",
                  honorific: "var(--gold)",
                };
                return (
                <div key={i} className="rounded-lg p-2.5 flex gap-2.5" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{
                      background: expr.learner_used ? "rgba(126, 154, 110, 0.2)" : "rgba(196, 150, 74, 0.2)",
                      color: expr.learner_used ? "var(--moss)" : "var(--gold)",
                    }}>
                    {expr.learner_used ? "A" : "P"}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{expr.expression}</div>
                    <div className="text-xs" style={{ color: "var(--text-dim)" }}>{expr.meaning}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `color-mix(in srgb, ${typeColor[expr.type] || "var(--text-dim)"} 15%, transparent)`,
                          color: typeColor[expr.type] || "var(--text-dim)",
                        }}>
                        {typeLabel[expr.type] || expr.type}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: expr.learner_used ? "rgba(126, 154, 110, 0.1)" : "rgba(196, 150, 74, 0.1)",
                          color: expr.learner_used ? "var(--moss)" : "var(--gold)",
                        }}>
                        {expr.learner_used ? "You used this" : "Passive"}
                      </span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unknown Vocabulary */}
        {reviewData.unknownWords.length > 0 && (
          <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <h3 className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
                New Vocabulary
              </h3>
              <span className="text-xs ml-auto" style={{ color: "var(--text-dim)" }}>
                Words you didn{"'"}t know — saved for review
              </span>
            </div>
            <div className="space-y-2">
              {reviewData.unknownWords.map((w, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-semibold" style={{ color: "var(--gold)" }}>{w.word}</span>
                    <span className="text-xs" style={{ color: "var(--text)" }}>{w.definition}</span>
                  </div>
                  <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>{w.context}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Vocab Picker — tap words you don't know */}
        {conversationWords.length > 0 && <VocabPicker words={conversationWords} />}

        {/* Error Clusters */}
        {reviewData.errorClusters.length > 0 && (
          <div className="card" style={{ borderLeft: "3px solid var(--river)" }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--river)" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <circle cx="5" cy="6" r="2" />
                <circle cx="19" cy="6" r="2" />
                <circle cx="5" cy="18" r="2" />
                <circle cx="19" cy="18" r="2" />
                <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
                <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
                <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
                <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
              </svg>
              <h3 className="text-sm font-semibold" style={{ color: "var(--river)" }}>
                Error Clusters — Root Causes
              </h3>
            </div>
            <div className="space-y-3">
              {reviewData.errorClusters.map((c, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: "var(--river)" }}>{c.name}</div>
                  <p className="text-xs mb-1.5" style={{ color: "var(--text-dim)" }}>{c.description}</p>
                  <div className="text-xs mb-1">
                    <span style={{ color: "var(--ember)" }}>Root cause: </span>
                    <span style={{ color: "var(--text-dim)" }}>{c.root_cause}</span>
                  </div>
                  <div className="text-xs">
                    <span style={{ color: "var(--moss)" }}>Recommendation: </span>
                    <span style={{ color: "var(--text-dim)" }}>{c.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inline errors by type (from real-time checker) */}
        {sortedTypes.length > 0 && (
          <>
            <div className="card">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ember)" }}>
                Errors by Type
              </h3>
              <div className="flex flex-wrap gap-2">
                {sortedTypes.map(([type, errs]) => (
                  <span key={type} className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: `color-mix(in srgb, ${typeColors[type] || "var(--text-dim)"} 15%, transparent)`, color: typeColors[type] || "var(--text-dim)" }}>
                    {typeLabels[type] || type} ({errs.length})
                  </span>
                ))}
              </div>
            </div>

            {sortedTypes.map(([type, errs]) => (
              <div key={type} className="card">
                <h3 className="text-sm font-semibold mb-3" style={{ color: typeColors[type] || "var(--text-dim)" }}>
                  {typeLabels[type] || type}
                </h3>
                <div className="space-y-2.5">
                  {errs.map((err, j) => (
                    <div key={j} className="rounded-lg p-3 group" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span style={{ color: "var(--ember)", textDecoration: "line-through" }}>{err.observed}</span>
                          <span style={{ color: "var(--text-dim)" }}>→</span>
                          <span style={{ color: "var(--moss)", fontWeight: 600 }}>{err.expected}</span>
                        </div>
                        <button onClick={() => onDismiss(err)}
                          className="shrink-0 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: "var(--bg-hover)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                          title="Not my error">
                          Not my error
                        </button>
                      </div>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{err.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* Review Agent Errors */}
        {reviewData.errors.length > 0 && (
          <div className="card" style={{ borderLeft: "3px solid var(--river)" }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--river)" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <h3 className="text-sm font-semibold" style={{ color: "var(--river)" }}>
                Review Agent Findings
              </h3>
              <span className="text-xs" style={{ color: "var(--text-dim)" }}>
                {reviewData.errors.length} errors from second-pass
              </span>
            </div>
            <div className="space-y-2.5">
              {reviewData.errors.map((err, j) => (
                <div key={j} className="rounded-lg p-3 group" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(98, 148, 184, 0.15)", color: "var(--river)" }}>{err.type}</span>
                      <span style={{ color: "var(--ember)", textDecoration: "line-through" }}>{err.observed}</span>
                      <span style={{ color: "var(--text-dim)" }}>→</span>
                      <span style={{ color: "var(--moss)", fontWeight: 600 }}>{err.expected}</span>
                    </div>
                    <button onClick={() => onDismiss(err)}
                      className="shrink-0 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "var(--bg-hover)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
                      title="Not my error">Not my error</button>
                  </div>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "var(--text-dim)" }}>{err.explanation}</p>
                  {err.l1_source && (
                    <p className="text-xs mt-1" style={{ color: "var(--gold)" }}>L1: {err.l1_source}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {totalErrors === 0 && reviewData.errors.length === 0 && (
          <div className="card text-center py-8">
            <p className="text-lg mb-1" style={{ color: "var(--moss)" }}>No errors this session!</p>
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>Great work — keep practicing.</p>
          </div>
        )}
      </div>

      {/* Bottom action */}
      <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onNewSession}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all"
          style={{ background: "var(--river)", color: "white" }}>
          Start New Session
        </button>
      </div>

      <style jsx>{`
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Mic button ──────────────────────────────────────────

function MicButton({
  active,
  connecting,
  speaking,
  onClick,
}: {
  active: boolean;
  connecting: boolean;
  speaking: boolean;
  onClick: () => void;
}) {
  const bg = active
    ? speaking
      ? "var(--river)"
      : "var(--moss)"
    : connecting
      ? "var(--border)"
      : "var(--bg-card)";
  const border = active
    ? speaking
      ? "var(--river)"
      : "var(--moss)"
    : "var(--border)";

  return (
    <button
      onClick={onClick}
      disabled={connecting}
      className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        color: active || connecting ? "white" : "var(--text-dim)",
        animation: active && speaking ? "pulse 1.5s infinite" : "none",
      }}
      title={
        active
          ? "End voice session"
          : connecting
            ? "Connecting..."
            : "Start voice conversation"
      }
    >
      {active ? (
        speaking ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        )
      ) : connecting ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </button>
  );
}

function VoiceIndicator({
  connecting,
  speaking,
  isJournal,
}: {
  connecting: boolean;
  speaking: boolean;
  isJournal?: boolean;
}) {
  return (
    <div className="text-center py-12">
      <div
        className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
        style={{
          background: connecting
            ? "var(--border)"
            : speaking
              ? "var(--river)"
              : isJournal ? "var(--gold)" : "var(--moss)",
          animation: !connecting ? "pulse 2s infinite" : "none",
        }}
      >
        {isJournal && !connecting ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </div>
      <p style={{ color: "var(--text-dim)" }}>
        {connecting
          ? "Connecting..."
          : speaking
            ? "Listening..."
            : isJournal
              ? "Tell me about your day..."
              : "Speak naturally — I'm listening"}
      </p>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

// ── Vocab picker — select words you don't know ─────────

function VocabPicker({ words }: { words: string[] }) {
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  async function toggleWord(word: string) {
    if (saving.has(word)) return;
    const isMarked = marked.has(word);

    setSaving((prev) => new Set(prev).add(word));
    try {
      await fetch("/api/vocabulary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, action: isMarked ? "mark_known" : "mark_unknown" }),
      });
      setMarked((prev) => {
        const next = new Set(prev);
        if (isMarked) next.delete(word);
        else next.add(word);
        return next;
      });
    } catch { /* ignore */ }
    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(word);
      return next;
    });
  }

  return (
    <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
      <div className="flex items-center gap-2 mb-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <h3 className="text-sm font-semibold" style={{ color: "var(--gold)" }}>
          Words from this session
        </h3>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
        Tap any word you don{"'"}t know to add it to your study list
      </p>
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => {
          const isMarked = marked.has(word);
          return (
            <button
              key={word}
              onClick={() => toggleWord(word)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isMarked ? "rgba(196, 94, 74, 0.15)" : "var(--bg)",
                border: `1px solid ${isMarked ? "rgba(196, 94, 74, 0.4)" : "var(--border)"}`,
                color: isMarked ? "var(--ember)" : "var(--text)",
                opacity: saving.has(word) ? 0.5 : 1,
              }}
            >
              {word}
              {isMarked && " ×"}
            </button>
          );
        })}
      </div>
      {marked.size > 0 && (
        <p className="text-xs mt-2" style={{ color: "var(--ember)" }}>
          {marked.size} word{marked.size !== 1 ? "s" : ""} added to your study list
        </p>
      )}
    </div>
  );
}
