"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Role = "tutor" | "learner";

type Message = {
  audioId: string;
  role: Role;
  jp: string;
  romaji: string;
  en: string;
};

type VocabItem = { jp: string; romaji: string; en: string; askedAbout?: boolean; due?: boolean };
type GrammarItem = { pattern: string; en: string; count: number };
type ErrorItem = { label: string; en: string; count: number };

type Phase = "chat-1" | "reveal-vocab" | "reveal-grammar" | "reveal-errors" | "chat-2" | "finale";

type Beat = {
  phase: Phase;
  phaseLabel: string;
  caption: string;
  durationMs: number;
  messages: Message[];
  speakIndex?: number;
  vocab: VocabItem[];
  grammar: GrammarItem[];
  errors: ErrorItem[];
  highlight?: { vocab?: string; grammar?: string; error?: string };
};

// ─── Canonical lines (id matches scripts/generate-demo-audio.mjs) ──
const M: Record<string, Message> = {
  "tutor-1":   { audioId: "tutor-1",   role: "tutor",   jp: "今日は何を食べましたか？",                      romaji: "kyou wa nani o tabemashita ka?",          en: "What did you eat today?" },
  "learner-1": { audioId: "learner-1", role: "learner", jp: "りんごを食べました。",                          romaji: "ringo o tabemashita.",                    en: "I ate an apple." },
  "learner-2": { audioId: "learner-2", role: "learner", jp: "「柿」は何ですか？",                            romaji: "'kaki' wa nan desu ka?",                  en: "What is 'kaki'?" },
  "tutor-2":   { audioId: "tutor-2",   role: "tutor",   jp: "「柿」は果物です。英語で persimmon です。",     romaji: "'kaki' wa kudamono desu. eigo de persimmon desu.", en: "'Kaki' is a fruit. In English, persimmon." },
  "learner-3": { audioId: "learner-3", role: "learner", jp: "柿は食べました。",                              romaji: "kaki wa tabemashita.",                    en: "Persimmon, I ate. (wrong particle — should be を)" },
  "tutor-3":   { audioId: "tutor-3",   role: "tutor",   jp: "「柿を食べました」が正しいですね。",            romaji: "'kaki o tabemashita' ga tadashii desu ne.",en: "'Kaki o tabemashita' is correct — use を for the object." },
  "learner-4": { audioId: "learner-4", role: "learner", jp: "本は読みました。",                              romaji: "hon wa yomimashita.",                     en: "Book, I read. (same mistake)" },
  "tutor-4":   { audioId: "tutor-4",   role: "tutor",   jp: "前回聞いていた「柿」、お母さんについて例文を作ってみましょう。", romaji: "zenkai kiiteita 'kaki', okaasan ni tsuite reibun o tsukutte mimashou.", en: "The word you asked about last time — 'kaki'. Try making an example sentence about your mom." },
  "learner-5": { audioId: "learner-5", role: "learner", jp: "母は柿を食べるのが好きです。",                    romaji: "haha wa kaki o taberu no ga suki desu.",  en: "My mom likes eating persimmons. (correct use of 柿 + を this time)" },
};

// Final cumulative state at end of session 1.
const VOCAB_S1: VocabItem[] = [
  { jp: "りんご", romaji: "ringo", en: "apple" },
  { jp: "柿",   romaji: "kaki",  en: "persimmon", askedAbout: true },
  { jp: "本",   romaji: "hon",   en: "book" },
];
const GRAMMAR_S1: GrammarItem[] = [
  { pattern: "〜を + verb",     en: "object marker pattern",  count: 1 },
  { pattern: "〜は何ですか",     en: "asking 'what is X?'",     count: 1 },
];
const ERRORS_S1: ErrorItem[] = [
  { label: "は instead of を", en: "topic-marker confusion with objects", count: 2 },
];

// Session 2 state — same data, but 柿 is now marked "due" for review.
const VOCAB_S2: VocabItem[] = VOCAB_S1.map((v) =>
  v.jp === "柿" ? { ...v, due: true } : v,
);

const chat1Convo = [M["tutor-1"], M["learner-1"], M["learner-2"], M["tutor-2"], M["learner-3"], M["tutor-3"], M["learner-4"]];

const SCRIPT: Beat[] = [
  // ── Session 1: pure chat, no side panel ────────────────────────
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "The tutor starts a conversation.",
    durationMs: 4500, messages: [M["tutor-1"]], speakIndex: 0,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "The learner replies.",
    durationMs: 4500, messages: chat1Convo.slice(0, 2), speakIndex: 1,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "The learner asks what a word means.",
    durationMs: 4500, messages: chat1Convo.slice(0, 3), speakIndex: 2,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "The tutor answers.",
    durationMs: 5500, messages: chat1Convo.slice(0, 4), speakIndex: 3,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "The learner uses the wrong particle…",
    durationMs: 5000, messages: chat1Convo.slice(0, 5), speakIndex: 4,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "…and the tutor corrects them.",
    durationMs: 5500, messages: chat1Convo.slice(0, 6), speakIndex: 5,
    vocab: [], grammar: [], errors: [] },
  { phase: "chat-1", phaseLabel: "Session 1 · today", caption: "Later, the same mistake happens again.",
    durationMs: 5000, messages: chat1Convo, speakIndex: 6,
    vocab: [], grammar: [], errors: [] },

  // ── Reveal: extraction buckets fade in one at a time ───────────
  { phase: "reveal-vocab", phaseLabel: "Behind the scenes", caption: "Every word the learner used — or asked about — was saved.",
    durationMs: 5500, messages: chat1Convo,
    vocab: VOCAB_S1, grammar: [], errors: [], highlight: { vocab: "柿" } },
  { phase: "reveal-grammar", phaseLabel: "Behind the scenes", caption: "Every grammar pattern they used was tracked.",
    durationMs: 5500, messages: chat1Convo,
    vocab: VOCAB_S1, grammar: GRAMMAR_S1, errors: [], highlight: { grammar: "〜を + verb" } },
  { phase: "reveal-errors", phaseLabel: "Behind the scenes", caption: "Repeated mistakes are grouped by root cause — not logged 50 times.",
    durationMs: 6000, messages: chat1Convo,
    vocab: VOCAB_S1, grammar: GRAMMAR_S1, errors: ERRORS_S1, highlight: { error: "は instead of を" } },

  // ── Session 2: tutor uses memory ───────────────────────────────
  { phase: "chat-2", phaseLabel: "Session 2 · 2 days later", caption: "Two days later, the tutor surfaces the word the learner asked about — and asks them to use it.",
    durationMs: 7500, messages: [M["tutor-4"]], speakIndex: 0,
    vocab: VOCAB_S2, grammar: GRAMMAR_S1, errors: ERRORS_S1, highlight: { vocab: "柿" } },
  { phase: "chat-2", phaseLabel: "Session 2 · 2 days later", caption: "The learner answers — and this time, gets the particle right.",
    durationMs: 6500, messages: [M["tutor-4"], M["learner-5"]], speakIndex: 1,
    vocab: VOCAB_S2, grammar: GRAMMAR_S1, errors: ERRORS_S1, highlight: { vocab: "柿" } },

  // ── Finale ─────────────────────────────────────────────────────
  { phase: "finale", phaseLabel: "open-language", caption: "Every conversation feeds a memory that shapes the next one.",
    durationMs: 6000, messages: [M["tutor-4"], M["learner-5"]],
    vocab: VOCAB_S2, grammar: GRAMMAR_S1, errors: ERRORS_S1 },
];

// Browser TTS fallback if preloaded audio is missing.
function speakViaSpeechSynthesis(text: string, role: Role) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.lang === "ja-JP") || voices.find((x) => x.lang.startsWith("ja")) || null;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  if (v) u.voice = v;
  u.rate = 0.9;
  u.pitch = role === "tutor" ? 1.05 : 0.95;
  window.speechSynthesis.speak(u);
}

export default function DemoPage() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload all audio elements once.
  const audioRefs = useMemo(() => {
    const refs: Record<string, HTMLAudioElement> = {};
    if (typeof window !== "undefined") {
      for (const id of Object.keys(M)) {
        const a = new Audio(`/demo/audio/${id}.wav`);
        a.preload = "auto";
        refs[id] = a;
      }
    }
    return refs;
  }, []);

  const stopAudio = () => {
    Object.values(audioRefs).forEach((a) => {
      a.pause();
      a.currentTime = 0;
    });
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const playAudio = (msg: Message) => {
    if (muted) return;
    stopAudio();
    const a = audioRefs[msg.audioId];
    if (!a) return speakViaSpeechSynthesis(msg.jp, msg.role);
    const p = a.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => speakViaSpeechSynthesis(msg.jp, msg.role));
    }
  };

  // Speak when beat changes (after user gesture).
  useEffect(() => {
    if (!started) return;
    const beat = SCRIPT[index];
    if (beat.speakIndex !== undefined) {
      const msg = beat.messages[beat.speakIndex];
      if (msg) playAudio(msg);
    } else {
      stopAudio();
    }
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, started]);

  // Beat timer.
  useEffect(() => {
    if (!playing || finished || !started) return;
    const beat = SCRIPT[index];
    timerRef.current = setTimeout(() => {
      if (index === SCRIPT.length - 1) setFinished(true);
      else setIndex((i) => i + 1);
    }, beat.durationMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, playing, finished, started]);

  const beat = SCRIPT[index];
  const progress = ((index + 1) / SCRIPT.length) * 100;
  const showMemoryPanel = beat.phase !== "chat-1";
  const showVocab = ["reveal-vocab", "reveal-grammar", "reveal-errors", "chat-2", "finale"].includes(beat.phase);
  const showGrammar = ["reveal-grammar", "reveal-errors", "chat-2", "finale"].includes(beat.phase);
  const showErrors = ["reveal-errors", "chat-2", "finale"].includes(beat.phase);

  const restart = () => {
    stopAudio();
    setIndex(0);
    setFinished(false);
    setPlaying(true);
  };

  // ── Start screen (browser autoplay gate) ─────────────────────────
  if (!started) {
    return (
      <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-6">
        <div className="max-w-lg text-center">
          <div className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-3">
            open-language · demo
          </div>
          <h1 className="text-3xl md:text-4xl font-light text-[var(--gold)] mb-4 leading-tight">
            A 60-second look at a tutor that remembers you.
          </h1>
          <p className="text-sm text-[var(--text-dim)] mb-8">
            You'll hear a short Japanese conversation between a tutor and a learner. Each line is shown in Japanese, romaji, and English. After the chat, you'll see what the app quietly remembered behind the scenes.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="px-6 py-3 rounded-lg border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--bg-hover)] text-sm font-medium"
          >
            ▶ Start demo (with audio)
          </button>
          <div className="mt-4">
            <button
              onClick={() => { setMuted(true); setStarted(true); }}
              className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] underline"
            >
              Start muted
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex flex-col">
      {/* Top bar */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium">open-language</span>
          <span className="text-xs text-[var(--text-dim)] px-2 py-0.5 rounded border border-[var(--border)]">demo</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-dim)]">
          <span className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)]">
            Learning: Japanese 🇯🇵
          </span>
          <button
            onClick={() => { if (!muted) stopAudio(); setMuted(!muted); }}
            className="px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
          >
            {muted ? "🔇 muted" : "🔊 audio on"}
          </button>
        </div>
      </header>

      {/* Caption */}
      <div className="px-6 pt-6 pb-4 text-center max-w-3xl mx-auto">
        <div className="text-xs uppercase tracking-widest text-[var(--text-dim)] mb-2">{beat.phaseLabel}</div>
        <p
          key={`cap-${index}`}
          className="text-xl md:text-2xl font-light text-[var(--gold)] leading-snug animate-[fadeIn_400ms_ease-out]"
        >
          {beat.caption}
        </p>
      </div>

      {/* Stage */}
      <div
        className={`flex-1 px-6 pb-6 max-w-6xl w-full mx-auto grid gap-6 transition-[grid-template-columns] duration-500 ${
          showMemoryPanel ? "md:grid-cols-[1fr_340px]" : "md:grid-cols-1"
        }`}
      >
        {/* Chat */}
        <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 min-h-[440px] flex flex-col">
          <div className="text-xs text-[var(--text-dim)] mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--moss)] animate-pulse" />
            live conversation
          </div>
          {beat.phase === "finale" ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-3xl text-[var(--gold)] mb-2">a tutor that remembers you</div>
              <div className="text-sm text-[var(--text-dim)]">vocab · grammar · mistakes — all persisted, all reused</div>
            </div>
          ) : (
            <div className="space-y-4">
              {beat.messages.map((m, i) => (
                <MessageBubble
                  key={`${m.audioId}-${i}`}
                  message={m}
                  active={i === beat.speakIndex}
                />
              ))}
            </div>
          )}
        </section>

        {/* Memory side panel (animated reveal) */}
        {showMemoryPanel && (
          <aside className="space-y-3 animate-[fadeIn_500ms_ease-out]">
            {showVocab && (
              <Bucket title="Vocabulary" subtitle="words used or asked about" accent="var(--gold)">
                {beat.vocab.map((v) => {
                  const fresh = beat.highlight?.vocab === v.jp;
                  return (
                    <li
                      key={v.jp}
                      className={`p-2.5 rounded border transition-all duration-500 ${
                        fresh
                          ? "border-[var(--gold)] bg-[var(--bg-hover)] shadow-[0_0_0_3px_rgba(196,185,154,0.18)]"
                          : "border-[var(--border)] bg-[var(--bg)]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-lg">{v.jp}</span>
                        <div className="flex gap-1">
                          {v.askedAbout && (
                            <span className="text-[9px] uppercase tracking-wider text-[var(--river)] border border-[var(--river)] rounded px-1 py-0.5">
                              asked
                            </span>
                          )}
                          {v.due && (
                            <span className="text-[9px] uppercase tracking-wider text-[var(--ember)] border border-[var(--ember)] rounded px-1 py-0.5">
                              due
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                        {v.romaji} — {v.en}
                      </div>
                    </li>
                  );
                })}
              </Bucket>
            )}

            {showGrammar && (
              <Bucket title="Grammar patterns" subtitle="structures the learner uses" accent="var(--moss)">
                {beat.grammar.map((g) => {
                  const fresh = beat.highlight?.grammar === g.pattern;
                  return (
                    <li
                      key={g.pattern}
                      className={`p-2.5 rounded border transition-all duration-500 ${
                        fresh
                          ? "border-[var(--moss)] bg-[var(--bg-hover)] shadow-[0_0_0_3px_rgba(107,154,91,0.18)]"
                          : "border-[var(--border)] bg-[var(--bg)]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm">{g.pattern}</span>
                        <span className="text-[10px] text-[var(--text-dim)] tabular-nums">×{g.count}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{g.en}</div>
                    </li>
                  );
                })}
              </Bucket>
            )}

            {showErrors && (
              <Bucket title="Error patterns" subtitle="mistakes grouped by root cause" accent="var(--ember)">
                {beat.errors.map((e) => {
                  const fresh = beat.highlight?.error === e.label;
                  return (
                    <li
                      key={e.label}
                      className={`p-2.5 rounded border transition-all duration-500 ${
                        fresh
                          ? "border-[var(--ember)] bg-[var(--bg-hover)] shadow-[0_0_0_3px_rgba(196,94,74,0.18)]"
                          : "border-[var(--border)] bg-[var(--bg)]"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm">{e.label}</span>
                        <span className="text-[10px] text-[var(--text-dim)] tabular-nums">×{e.count}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-dim)] mt-0.5">{e.en}</div>
                    </li>
                  );
                })}
              </Bucket>
            )}
          </aside>
        )}
      </div>

      {/* Controls */}
      <footer className="border-t border-[var(--border)] px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <div className="flex-1 h-1 bg-[var(--bg-card)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--gold)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-[var(--text-dim)] tabular-nums">{index + 1} / {SCRIPT.length}</span>
          {finished ? (
            <button onClick={restart} className="px-4 py-2 rounded border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--bg-hover)] text-sm">
              ↻ Replay
            </button>
          ) : (
            <button
              onClick={() => { if (playing) stopAudio(); setPlaying((p) => !p); }}
              className="px-4 py-2 rounded border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)] text-sm"
            >
              {playing ? "❚❚ Pause" : "▶ Play"}
            </button>
          )}
          <Link href="/" className="px-4 py-2 rounded text-sm text-[var(--text-dim)] hover:text-[var(--text)]">
            ← Home
          </Link>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  );
}

function MessageBubble({ message, active }: { message: Message; active: boolean }) {
  const isTutor = message.role === "tutor";
  return (
    <div className={`flex ${isTutor ? "justify-start" : "justify-end"} ${active ? "animate-[slideIn_400ms_ease-out]" : ""}`}>
      <div className={`max-w-[80%] ${isTutor ? "" : "text-right"}`}>
        <div className="text-[10px] uppercase tracking-widest text-[var(--text-dim)] mb-1 flex items-center gap-2 justify-between">
          <span>{isTutor ? "Tutor" : "Learner"}</span>
          {active && <span className="text-[var(--gold)]">🔊 speaking</span>}
        </div>
        <div
          className={`p-3 rounded-lg border transition-opacity duration-300 ${
            isTutor ? "bg-[var(--bg)] border-[var(--border)]" : "bg-[var(--bg-hover)] border-[var(--border)]"
          } ${active ? "opacity-100" : "opacity-70"}`}
        >
          <div className="text-lg leading-snug">{message.jp}</div>
          <div className="text-xs text-[var(--text-dim)] mt-1 italic">{message.romaji}</div>
          <div className="text-sm text-[var(--text)] mt-2 border-t border-[var(--border)] pt-2">{message.en}</div>
        </div>
      </div>
    </div>
  );
}

function Bucket({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 animate-[fadeIn_500ms_ease-out]">
      <div className="text-sm font-medium" style={{ color: accent }}>{title}</div>
      <div className="text-[11px] text-[var(--text-dim)] mb-3">{subtitle}</div>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
