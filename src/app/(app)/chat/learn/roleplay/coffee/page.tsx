"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useVoiceChat, type VoiceMessage } from "@/hooks/useVoiceChat";

const SCENARIO_TITLE = "Ordering at a café";
const SCENARIO_LOCATION = "A small café in Tokyo";
const TARGET_LANGUAGE = "Japanese";
const TARGET_LANGUAGE_CODE = "ja-JP";

const SYSTEM_PROMPT = `You are a friendly staff member at a small café in Tokyo. The learner is a customer who has just walked in.

LANGUAGE
- Speak Japanese only. The learner is practicing Japanese (native English speaker).
- Use polite ですます form (no casual speech, no keigo beyond standard shop politeness).
- If the learner is clearly stuck, drop into one short English hint, then return to Japanese.
- Keep every reply SHORT — one or two sentences max.

ROLE
- You are NOT a teacher. You are a café staff member with a job to do.
- Your goal: find out what they want to drink, what size, and whether they want anything else (pastry, extra shot, milk type).
- React naturally — a real staff member is polite, a little busy, asks follow-up questions.

PACING
- Start by greeting the customer (いらっしゃいませ) and asking what they'd like.
- Ask ONE question per turn.
- Do not correct their Japanese. Do not explain grammar. Do not break character.
- When the order is complete (drink + size + any extras confirmed), announce the total in yen and say goodbye warmly (ありがとうございました). At that point the scenario is finished.`;

const GREETING = "いらっしゃいませ！ご注文はお決まりですか？";

interface TranscriptRowProps {
  message: VoiceMessage;
}

function TranscriptRow({ message }: TranscriptRowProps) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[color:var(--bg-hover)] border border-[color:var(--border)]"
            : "bg-[color:var(--bg-card)] border border-[color:var(--border)]"
        }`}
      >
        <div
          className="text-[10px] uppercase tracking-widest mb-1"
          style={{
            color: isUser ? "var(--text-dim)" : "var(--ember)",
          }}
        >
          {isUser ? "You" : "Staff"}
        </div>
        <div>{message.content}</div>
      </div>
    </div>
  );
}

export default function CoffeeRoleplayPage() {
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
    if (voice.voiceActive) return "Stop scenario";
    return "Start scenario";
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
          {SCENARIO_TITLE}
        </h1>
        <p className="text-sm text-[color:var(--text-dim)]">
          {SCENARIO_LOCATION} · {TARGET_LANGUAGE}
        </p>
      </div>

      <section className="card space-y-3">
        <div className="text-xs uppercase tracking-widest text-[color:var(--ember)]">
          Scenario goal
        </div>
        <ul className="text-sm space-y-1 text-[color:var(--text)]">
          <li>· Greet the staff and place a drink order.</li>
          <li>· Specify size and any extras (milk, pastry, etc.).</li>
          <li>· The scenario ends when the staff gives you a total in yen.</li>
        </ul>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-widest text-[color:var(--text-dim)]">
            Live conversation
          </div>
          <button
            type="button"
            onClick={() => void voice.toggleVoice()}
            disabled={voice.voiceConnecting}
            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
              voice.voiceActive
                ? "bg-[color:var(--ember)] border-[color:var(--ember)] text-white"
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
          <div className="text-xs text-[color:var(--moss)]">
            Listening…{" "}
            {voice.interimTranscript && (
              <span className="text-[color:var(--text-dim)]">
                {voice.interimTranscript}
              </span>
            )}
          </div>
        )}

        <div className="space-y-2 min-h-[120px]">
          {voice.messages.length === 0 && !voice.voiceActive && (
            <p className="text-sm text-[color:var(--text-dim)]">
              Tap <strong>Start scenario</strong> and greet the staff.
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
