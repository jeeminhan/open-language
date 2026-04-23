"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useVoiceChat, type VoiceMessage } from "@/hooks/useVoiceChat";
import { getLanguageCode } from "@/lib/languages";

interface DueWord {
  word: string;
  srsState: string;
  reviewCount: number;
}

interface DueWordsResponse {
  words: DueWord[];
  targetLanguage: string;
  nativeLanguage: string;
}

interface GradeResult {
  word: string;
  pass: boolean;
  feedback: string;
}

function buildDrillPrompt(words: string[], targetLanguage: string): string {
  const list = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
  return `You are a vocabulary drill coach for a ${targetLanguage} learner.

The learner is drilling these words, in order:
${list}

STYLE
- Keep every reply to ONE short sentence. Never lecture.
- Speak ${targetLanguage}. Drop into English only for a one-word hint if they're truly stuck.
- Warm tone, slightly urgent pacing — like a coach running reps.

FLOW
- When asked to prompt a specific word, ask the learner to use THAT word in a sentence. One clean prompt, nothing else.
- After the learner attempts, give a ONE-sentence reaction in ${targetLanguage} (encouragement or a tiny correction). Do NOT move to the next word on your own — the app will tell you when.
- If the learner gets it wrong, acknowledge warmly and invite them to try again — do NOT switch to a different word.
- Never improvise a different drill, never change word order, never teach grammar.`;
}

interface TranscriptRowProps {
  message: VoiceMessage;
}

function TranscriptRow({ message }: TranscriptRowProps) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed bg-[color:var(--bg-card)] border border-[color:var(--border)]`}
      >
        <div
          className="text-[10px] uppercase tracking-widest mb-1"
          style={{ color: isUser ? "var(--text-dim)" : "var(--moss)" }}
        >
          {isUser ? "You" : "Coach"}
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  );
}

export default function DrillPage() {
  const auth = useAuthReady();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("Japanese");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<GradeResult[]>([]);
  const [grading, setGrading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const gradedUserMsgIds = useRef<Set<string>>(new Set());
  const currentIndexRef = useRef(0);
  const wordsRef = useRef<string[]>([]);

  // Keep refs in sync for onTurnComplete callback (which closes over stale state otherwise)
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  const systemPrompt = useMemo(() => {
    if (words.length === 0) return "";
    return buildDrillPrompt(words, targetLanguage);
  }, [words, targetLanguage]);

  const languageCode = useMemo(
    () => getLanguageCode(targetLanguage),
    [targetLanguage]
  );

  const greeting = useMemo(() => {
    if (words.length === 0) return undefined;
    return `Ask the learner to use "${words[0]}" in a ${targetLanguage} sentence. Just one clean prompt.`;
  }, [words, targetLanguage]);

  const voice = useVoiceChat({
    systemPrompt,
    languageCode,
    greeting,
    onTurnComplete: (msgs) => {
      // Find the newest user message that hasn't been graded yet.
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role !== "user") continue;
        if (gradedUserMsgIds.current.has(m.id)) return;
        gradedUserMsgIds.current.add(m.id);

        const idx = currentIndexRef.current;
        const activeWords = wordsRef.current;
        if (idx >= activeWords.length) return;
        const targetWord = activeWords[idx];
        const userUtterance = m.content;

        setGrading(true);
        fetch("/api/learn/drill-grade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetWord, userUtterance }),
        })
          .then((r) => r.json())
          .then((data: { pass?: boolean; feedback?: string; error?: string }) => {
            const pass = data?.pass === true;
            const feedback =
              typeof data?.feedback === "string" ? data.feedback : "";
            setResults((prev) => [
              ...prev,
              { word: targetWord, pass, feedback },
            ]);
            if (pass) {
              const next = idx + 1;
              setCurrentIndex(next);
              if (next < activeWords.length) {
                voice.sendText(
                  `Nice — that worked. Now ask the learner to use "${activeWords[next]}" in a ${targetLanguage} sentence.`
                );
              } else {
                voice.sendText(
                  `All words drilled. Congratulate the learner warmly in one short ${targetLanguage} sentence.`
                );
              }
            } else {
              voice.sendText(
                `Not quite. Encourage the learner in one short ${targetLanguage} sentence and invite them to try "${targetWord}" again.`
              );
            }
          })
          .catch(() => {
            setNotice("Grading failed — try another sentence.");
            setTimeout(() => setNotice(null), 5000);
          })
          .finally(() => setGrading(false));
        return;
      }
    },
    onAutoDisconnect: (reason) => {
      setNotice(
        reason === "idle"
          ? "Paused after 30s of silence — tap mic to resume."
          : "10 min session limit reached — tap mic to continue."
      );
      setTimeout(() => setNotice(null), 6000);
    },
    onError: (err) => {
      setNotice(err.message || "Voice session failed to start.");
      setTimeout(() => setNotice(null), 6000);
    },
  });

  useEffect(() => {
    if (!auth.ready) return;
    let cancelled = false;
    fetch("/api/learn/due-words?limit=5")
      .then(async (r) => {
        const data: DueWordsResponse | { error?: string } = await r.json();
        if (cancelled) return;
        if (!r.ok || !("words" in data)) {
          setLoadError(
            ("error" in data && typeof data.error === "string"
              ? data.error
              : null) || "Could not load drill words."
          );
          setLoading(false);
          return;
        }
        setWords(data.words.map((w) => w.word));
        if (data.targetLanguage) setTargetLanguage(data.targetLanguage);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Could not load drill words.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.ready]);

  const done = words.length > 0 && currentIndex >= words.length;
  const currentWord = words[currentIndex];

  const micLabel = voice.voiceConnecting
    ? "Connecting…"
    : voice.voiceActive
      ? "Stop drill"
      : "Start drill";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/chat/learn"
          className="text-xs text-[color:var(--text-dim)] hover:text-[color:var(--gold)]"
        >
          ← All learning modes
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Drill
        </h1>
        <p className="text-sm text-[color:var(--text-dim)]">
          {targetLanguage} · Words pulled from your SRS queue
        </p>
      </div>

      {loading && (
        <div className="text-sm text-[color:var(--text-dim)]">
          Loading your review queue…
        </div>
      )}

      {!loading && loadError && (
        <div className="card border-[color:var(--ember)] text-sm">
          {loadError}
        </div>
      )}

      {!loading && !loadError && words.length === 0 && (
        <div className="card space-y-2">
          <div className="text-sm text-[color:var(--text)]">
            Nothing to drill yet.
          </div>
          <p className="text-sm text-[color:var(--text-dim)]">
            Go have a conversation first — the tutor will queue unknown words
            into your SRS, and they&apos;ll show up here next time.
          </p>
          <Link
            href="/chat"
            className="inline-block mt-2 text-xs uppercase tracking-widest text-[color:var(--gold)]"
          >
            Start a conversation →
          </Link>
        </div>
      )}

      {!loading && !loadError && words.length > 0 && (
        <>
          <section className="card space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)]">
                {done
                  ? "Complete"
                  : `Word ${currentIndex + 1} of ${words.length}`}
              </div>
              <button
                type="button"
                onClick={() => void voice.toggleVoice()}
                disabled={voice.voiceConnecting || done}
                className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                  voice.voiceActive
                    ? "bg-[color:var(--moss)] border-[color:var(--moss)] text-white"
                    : "bg-[color:var(--bg-hover)] border-[color:var(--border)] hover:border-[color:var(--gold)]"
                } disabled:opacity-50`}
              >
                {done ? "Finished" : micLabel}
              </button>
            </div>

            {!done && currentWord && (
              <div className="py-6 text-center">
                <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)] mb-2">
                  Use this word in a sentence
                </div>
                <div className="text-3xl sm:text-4xl font-semibold">
                  {currentWord}
                </div>
              </div>
            )}

            {done && (
              <div className="py-6 text-center space-y-2">
                <div className="text-2xl font-semibold text-[color:var(--moss)]">
                  Drill complete
                </div>
                <div className="text-sm text-[color:var(--text-dim)]">
                  {results.filter((r) => r.pass).length} passed ·{" "}
                  {results.filter((r) => !r.pass).length} failed attempts
                </div>
                <div className="pt-3">
                  <Link
                    href="/chat/learn/drill"
                    className="text-xs uppercase tracking-widest text-[color:var(--gold)]"
                  >
                    Drill again →
                  </Link>
                </div>
              </div>
            )}

            <div className="flex gap-1">
              {words.map((w, i) => {
                const last = results.filter((r) => r.word === w).slice(-1)[0];
                const color = last
                  ? last.pass
                    ? "var(--moss)"
                    : "var(--ember)"
                  : i === currentIndex
                    ? "var(--gold)"
                    : "var(--border)";
                return (
                  <div
                    key={`${w}-${i}`}
                    className="flex-1 h-1.5 rounded-full"
                    style={{ background: color }}
                  />
                );
              })}
            </div>

            {grading && (
              <div className="text-xs text-[color:var(--text-dim)]">
                Grading your attempt…
              </div>
            )}

            {notice && (
              <div className="text-xs text-[color:var(--ember)]">{notice}</div>
            )}
          </section>

          {results.length > 0 && (
            <section className="card space-y-2">
              <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)]">
                Recent attempts
              </div>
              <ul className="space-y-1.5">
                {results.slice(-6).map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-snug"
                  >
                    <span
                      className="mt-0.5 text-xs font-semibold"
                      style={{
                        color: r.pass ? "var(--moss)" : "var(--ember)",
                      }}
                    >
                      {r.pass ? "✓" : "✗"}
                    </span>
                    <span>
                      <span className="font-semibold">{r.word}</span>
                      {r.feedback ? (
                        <span className="text-[color:var(--text-dim)]">
                          {" "}
                          — {r.feedback}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card space-y-2">
            <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)]">
              Live conversation
            </div>
            <div className="space-y-2 min-h-[80px]">
              {voice.messages.length === 0 && (
                <p className="text-sm text-[color:var(--text-dim)]">
                  Tap <strong>Start drill</strong> and respond out loud.
                </p>
              )}
              {voice.messages.slice(-6).map((m) => (
                <TranscriptRow key={m.id} message={m} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
