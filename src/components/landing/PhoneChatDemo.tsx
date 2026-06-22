"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./PhoneChatDemo.module.css";

type Role = "tutor" | "learner";

type Step =
  | { kind: "msg"; role: Role; jp: string; romaji: string; en: string }
  | { kind: "note"; tone: "save" | "error" | "time" | "recall"; text: string };

// One self-contained story: the learner asks about 柿, slips a particle, gets
// corrected — then two days later the tutor surfaces the same word and the
// learner nails it. The whole "it remembers" pitch inside one chat thread.
const STEPS: Step[] = [
  { kind: "msg", role: "tutor", jp: "今日は何を食べましたか？", romaji: "kyou wa nani o tabemashita ka?", en: "What did you eat today?" },
  { kind: "msg", role: "learner", jp: "りんごを食べました。", romaji: "ringo o tabemashita.", en: "I ate an apple." },
  { kind: "msg", role: "learner", jp: "「柿」は何ですか？", romaji: "'kaki' wa nan desu ka?", en: "What is 'kaki'?" },
  { kind: "msg", role: "tutor", jp: "「柿」は果物です。英語で persimmon。", romaji: "'kaki' wa kudamono desu.", en: "'Kaki' is a fruit — persimmon." },
  { kind: "note", tone: "save", text: "柿 (kaki) saved to your words" },
  { kind: "msg", role: "learner", jp: "柿は食べました。", romaji: "kaki wa tabemashita.", en: "Persimmon, I ate. (wrong particle)" },
  { kind: "msg", role: "tutor", jp: "「柿を食べました」が正しいですね。", romaji: "'kaki o tabemashita' ga tadashii.", en: "Use を for the object." },
  { kind: "note", tone: "error", text: "noted: は → を mix-up" },
  { kind: "note", tone: "time", text: "2 days later" },
  { kind: "msg", role: "tutor", jp: "前回聞いた「柿」で、お母さんの例文を作ってみましょう。", romaji: "zenkai kiita 'kaki' de…", en: "The word you asked about — try a sentence about your mom." },
  { kind: "note", tone: "recall", text: "remembered 柿 from last session" },
  { kind: "msg", role: "learner", jp: "母は柿を食べるのが好きです。", romaji: "haha wa kaki o taberu no ga suki desu.", en: "My mom likes eating persimmons." },
  { kind: "note", tone: "recall", text: "柿 reused · particle correct ✓" },
];

const HOLD_BEFORE_LOOP_MS = 4000;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void): () => void {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}

function typingDelay(step: Extract<Step, { kind: "msg" }>): number {
  return Math.min(1500, 550 + step.jp.length * 45);
}

function readDelay(step: Extract<Step, { kind: "msg" }>): number {
  return Math.min(2800, 1100 + (step.jp.length + step.en.length) * 22);
}

export default function PhoneChatDemo() {
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(0);
  const [typingRole, setTypingRole] = useState<Role | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  // Drive the auto-play loop. A cancellable promise chain reveals one step at a
  // time, shows a typing indicator before each bubble, then loops.
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    (async () => {
      // Reduced motion: reveal the whole thread at once, no looping.
      if (reducedMotion) {
        setShown(STEPS.length);
        setTypingRole(null);
        return;
      }
      while (!cancelled) {
        setShown(0);
        setTypingRole(null);
        await wait(600);
        for (let i = 0; i < STEPS.length && !cancelled; i++) {
          const step = STEPS[i];
          if (step.kind === "msg") {
            setTypingRole(step.role);
            await wait(typingDelay(step));
            if (cancelled) break;
            setTypingRole(null);
            setShown(i + 1);
            await wait(readDelay(step));
          } else {
            await wait(step.tone === "time" ? 1000 : 650);
            if (cancelled) break;
            setShown(i + 1);
            await wait(1500);
          }
        }
        if (cancelled) break;
        await wait(HOLD_BEFORE_LOOP_MS);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  // Keep the newest line in view as the thread fills.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [shown, typingRole, reducedMotion]);

  return (
    <div className={styles.phone} aria-hidden="true">
      <div className={styles.notch} />
      <div className={styles.screen}>
        <header className={styles.bar}>
          <span className={styles.avatar}>🇯🇵</span>
          <div className={styles.barText}>
            <span className={styles.barName}>Yuki</span>
            <span className={styles.barStatus}>
              {typingRole === "tutor" ? "typing…" : "Japanese tutor"}
            </span>
          </div>
          <span className={styles.barDot} />
        </header>

        <div className={styles.thread} ref={threadRef}>
          {STEPS.slice(0, shown).map((step, i) =>
            step.kind === "msg" ? (
              <div
                key={i}
                className={`${styles.row} ${
                  step.role === "tutor" ? styles.rowLeft : styles.rowRight
                }`}
              >
                <div
                  className={`${styles.bubble} ${
                    step.role === "tutor" ? styles.bubbleTutor : styles.bubbleLearner
                  }`}
                >
                  <span className={styles.jp}>{step.jp}</span>
                  <span className={styles.romaji}>{step.romaji}</span>
                  <span className={styles.en}>{step.en}</span>
                </div>
              </div>
            ) : (
              <div key={i} className={styles.note} data-tone={step.tone}>
                {step.tone === "time" ? (
                  <span className={styles.noteTime}>{step.text}</span>
                ) : (
                  <span className={styles.noteChip}>↳ {step.text}</span>
                )}
              </div>
            )
          )}

          {typingRole && (
            <div
              className={`${styles.row} ${
                typingRole === "tutor" ? styles.rowLeft : styles.rowRight
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  typingRole === "tutor" ? styles.bubbleTutor : styles.bubbleLearner
                } ${styles.typing}`}
              >
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </div>
            </div>
          )}
        </div>

        <div className={styles.composer}>
          <span className={styles.composerHint}>Speak or type…</span>
          <span className={styles.mic}>🎙</span>
        </div>
      </div>
    </div>
  );
}
