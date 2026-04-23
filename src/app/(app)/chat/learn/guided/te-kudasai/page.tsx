"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useVoiceChat, type VoiceMessage } from "@/hooks/useVoiceChat";

const LESSON_TITLE = "Polite requests with ～てください";
const LESSON_LEVEL = "Beginner · Japanese";
const TARGET_LANGUAGE_CODE = "ja-JP";

const OUTLINE = [
  "Quick intro — what ～てください means and when to use it.",
  "Pattern: te-form + ください = \"Please do X.\"",
  "3 example verbs walked through with you.",
  "3 practice prompts — you produce a full polite request.",
  "Mini role-play: order water at a restaurant using what you learned.",
];

const SYSTEM_PROMPT = `You are a warm but efficient Japanese teacher running a short voice-based mini-lesson for a beginner English speaker.

TOPIC: Polite requests using ～てください (te-kudasai).

STYLE
- Reply in short turns — usually one or two sentences.
- Mix Japanese and English: speak Japanese for examples and target phrases, explain rules in English.
- Be warm, encouraging, and move briskly. This is a 5-minute lesson, not an hour.

LESSON SCRIPT (follow this order; do not skip steps; wait for the learner after each step)

STEP 1 — Intro (you lead)
- In English, say: "Today we'll learn how to politely ask someone to do something, using ～てください."
- Say: "Literally, this is the te-form of a verb plus ください. It's like saying 'please do X.'"
- Ask: "Ready? Say 'ready' when you are."

STEP 2 — Show the pattern (you lead)
- Once the learner says ready, walk through 3 examples in Japanese, with English gloss:
  - 食べる (to eat) → 食べてください (Please eat.)
  - 待つ (to wait) → 待ってください (Please wait.)
  - 見る (to see) → 見てください (Please look.)
- Do ONE example per turn. After each one, say "try repeating it" and wait for the learner to echo it back before continuing.

STEP 3 — Practice prompts (you prompt, learner produces)
- Give the learner three English scenarios, one at a time. They must produce the Japanese polite request.
  1. "Ask someone to wait. (use 待つ)"
  2. "Ask someone to read this. (use 読む → 読んで)"
  3. "Ask someone to teach you. (use 教える → 教えて)"
- After each attempt: one-sentence feedback. If wrong, give the correct form and ask them to say it back.

STEP 4 — Mini role-play
- Tell the learner: "Now let's use it for real. You're at a restaurant. Ask the server to bring you water. Go."
- Play the server role (in Japanese, polite). Accept any reasonable request. React briefly.

STEP 5 — Wrap up
- In one short English sentence, congratulate them and say the lesson is complete.

RULES
- Never jump ahead of the script. Never repeat a step already completed.
- If the learner asks an unrelated question, briefly answer then return to the current step.
- Do not correct pronunciation unless it changes meaning.`;

const GREETING =
  "Start the lesson now. Greet the learner in one sentence and then run STEP 1.";

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
          style={{ color: isUser ? "var(--text-dim)" : "var(--river)" }}
        >
          {isUser ? "You" : "Teacher"}
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  );
}

export default function TeKudasaiLessonPage() {
  const auth = useAuthReady();
  const [notice, setNotice] = useState<string | null>(null);

  const voice = useVoiceChat({
    systemPrompt: SYSTEM_PROMPT,
    languageCode: TARGET_LANGUAGE_CODE,
    greeting: GREETING,
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

  const micLabel = useMemo(() => {
    if (voice.voiceConnecting) return "Connecting…";
    if (voice.voiceActive) return "Pause lesson";
    return "Start lesson";
  }, [voice.voiceActive, voice.voiceConnecting]);

  if (!auth.ready) {
    return (
      <div className="text-sm text-[color:var(--text-dim)]">Loading…</div>
    );
  }

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
          {LESSON_TITLE}
        </h1>
        <p className="text-sm text-[color:var(--text-dim)]">{LESSON_LEVEL}</p>
      </div>

      <section className="card space-y-3">
        <div className="text-xs uppercase tracking-widest text-[color:var(--river)]">
          What we&apos;ll cover
        </div>
        <ol className="space-y-1.5 text-sm text-[color:var(--text)] list-decimal list-inside">
          {OUTLINE.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)]">
            Lesson
          </div>
          <button
            type="button"
            onClick={() => void voice.toggleVoice()}
            disabled={voice.voiceConnecting}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              voice.voiceActive
                ? "bg-[color:var(--river)] border-[color:var(--river)] text-white"
                : "bg-[color:var(--bg-hover)] border-[color:var(--border)] hover:border-[color:var(--gold)]"
            } disabled:opacity-50`}
          >
            {micLabel}
          </button>
        </div>

        {notice && (
          <div className="text-xs text-[color:var(--ember)] bg-[color:var(--bg-hover)] border border-[color:var(--border)] rounded-md px-3 py-2">
            {notice}
          </div>
        )}

        {voice.userSpeaking && (
          <div className="text-xs text-[color:var(--moss)]">Listening…</div>
        )}

        <div className="space-y-2 min-h-[120px]">
          {voice.messages.length === 0 && !voice.voiceActive && (
            <p className="text-sm text-[color:var(--text-dim)]">
              Tap <strong>Start lesson</strong> to begin.
            </p>
          )}
          {voice.messages.map((m) => (
            <TranscriptRow key={m.id} message={m} />
          ))}
        </div>
      </section>
    </div>
  );
}
