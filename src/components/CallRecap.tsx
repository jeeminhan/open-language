"use client";

import type { VoiceMessage } from "@/hooks/useVoiceChat";

export interface CallSummary {
  tutorName: string;
  targetLanguage: string;
  nativeLanguage: string;
  elapsedSec: number;
  messages: VoiceMessage[];
  /** Unknown words queued into the SRS during this call (deduped, in order). */
  newWords: string[];
  /** Total errors flagged by the analyzer during this call. */
  errorsFoundCount: number;
  /** Server session id, if a turn was successfully recorded. */
  sessionId: string | null;
  /** Present when this was the learner's first-ever call (level test). */
  levelTest?: {
    level: string;
    justification: string;
    seedWords: string[];
  } | null;
  /** Whether the level-test assessment is still in flight. */
  levelTestPending?: boolean;
}

interface Props {
  summary: CallSummary;
  onCallAgain: () => void;
  onDone: () => void;
  /** Optional — only used on the level-test recap to send the user to sign-in. */
  onSignIn?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export default function CallRecap({
  summary,
  onCallAgain,
  onDone,
  onSignIn,
}: Props) {
  const tutorMessages = summary.messages.filter((m) => m.role === "assistant");
  const userMessages = summary.messages.filter((m) => m.role === "user");
  const turnCount = Math.min(tutorMessages.length, userMessages.length);
  const neverConnected = summary.messages.length === 0;
  const isLevelTest =
    summary.levelTestPending === true || summary.levelTest != null;
  if (isLevelTest) {
    return (
      <LevelTestRecap
        summary={summary}
        onCallAgain={onCallAgain}
        onDone={onDone}
        onSignIn={onSignIn}
      />
    );
  }

  // Preview the last couple of things the tutor said so the recap feels grounded.
  const highlights = tutorMessages.slice(-2);

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100svh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 20px 28px",
      }}
    >
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 28,
              color: "var(--gold)",
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            {neverConnected ? "call ended" : "that's a wrap"}
          </h1>
          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 11,
              color: "var(--text-dim)",
              marginTop: 6,
              letterSpacing: "0.02em",
            }}
          >
            {formatDuration(summary.elapsedSec)}
            {" · with "}
            {summary.tutorName}
          </div>
        </div>

        <div
          style={{
            height: 1,
            backgroundImage:
              "linear-gradient(90deg, var(--text-dim) 50%, transparent 50%)",
            backgroundSize: "6px 1px",
            opacity: 0.45,
          }}
        />

        {neverConnected ? (
          <p
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 16,
              color: "var(--text-dim)",
              lineHeight: 1.35,
              margin: 0,
              paddingLeft: 10,
              borderLeft: "2px dashed var(--border)",
            }}
          >
            no one picked up this time — try again when you&apos;re ready.
          </p>
        ) : (
          <>
            {turnCount > 0 && (
              <div
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  fontSize: 22,
                  color: "var(--text)",
                  lineHeight: 1.1,
                }}
              >
                {turnCount} {turnCount === 1 ? "exchange" : "exchanges"}
              </div>
            )}

            {summary.newWords.length > 0 && (
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-caveat), cursive",
                    fontSize: 15,
                    color: "var(--text-dim)",
                    marginBottom: 6,
                  }}
                >
                  saved for review
                </div>
                <div
                  style={{
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--moss)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  {summary.newWords.map((word) => (
                    <div
                      key={word}
                      style={{
                        fontSize: 14,
                        color: "var(--text)",
                        fontFamily:
                          "var(--font-geist-sans), 'Noto Serif JP', serif",
                      }}
                    >
                      {word}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {highlights.length > 0 && (
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-caveat), cursive",
                    fontSize: 15,
                    color: "var(--text-dim)",
                    marginBottom: 6,
                  }}
                >
                  last from {summary.tutorName}
                </div>
                <div
                  style={{
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--gold)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {highlights.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        fontSize: 13,
                        color: "var(--text)",
                        lineHeight: 1.5,
                      }}
                    >
                      {m.content}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p
              style={{
                fontFamily: "var(--font-caveat), cursive",
                fontSize: 15,
                color: "var(--text)",
                lineHeight: 1.35,
                margin: 0,
                paddingLeft: 10,
                borderLeft: "2px dashed var(--border)",
              }}
            >
              nice work showing up. come back anytime.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <button
          type="button"
          onClick={onCallAgain}
          className="w-full transition-transform active:scale-[0.98]"
          style={{
            background: "var(--gold)",
            color: "var(--bg)",
            borderRadius: 99,
            padding: "12px 0",
            textAlign: "center",
            fontFamily: "var(--font-geist-sans), sans-serif",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          Call again
        </button>
        <button
          type="button"
          onClick={onDone}
          className="w-full"
          style={{
            color: "var(--text-dim)",
            padding: "6px 0",
            textAlign: "center",
            fontFamily: "var(--font-caveat), cursive",
            fontSize: 15,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          back home →
        </button>
      </div>
    </div>
  );
}

interface LevelTestProps {
  summary: CallSummary;
  onCallAgain: () => void;
  onDone: () => void;
  onSignIn?: () => void;
}

function LevelTestRecap({ summary, onCallAgain, onDone, onSignIn }: LevelTestProps) {
  const pending = summary.levelTestPending === true || summary.levelTest == null;
  const level = summary.levelTest?.level ?? null;
  const justification = summary.levelTest?.justification ?? null;
  const seedWords = summary.levelTest?.seedWords ?? [];

  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: "100svh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "24px 20px 28px",
      }}
    >
      <div className="flex-1 flex flex-col gap-4">
        <div>
          <div
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 22,
              color: "var(--text-dim)",
              lineHeight: 1.1,
            }}
          >
            your level is
          </div>
          <div
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 64,
              color: "var(--gold)",
              lineHeight: 1,
              marginTop: 4,
              minHeight: 64,
            }}
          >
            {pending ? "…" : level}
          </div>
          <div
            style={{
              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
              fontSize: 10,
              color: "var(--text-dim)",
              marginTop: 8,
              letterSpacing: "0.04em",
            }}
          >
            CEFR · {summary.tutorName} · {Math.floor(summary.elapsedSec / 60)}m{" "}
            {String(summary.elapsedSec % 60).padStart(2, "0")}s
          </div>
        </div>

        <div
          style={{
            height: 1,
            backgroundImage:
              "linear-gradient(90deg, var(--text-dim) 50%, transparent 50%)",
            backgroundSize: "6px 1px",
            opacity: 0.45,
          }}
        />

        {pending ? (
          <p
            style={{
              fontFamily: "var(--font-caveat), cursive",
              fontSize: 16,
              color: "var(--text-dim)",
              lineHeight: 1.35,
              margin: 0,
              paddingLeft: 10,
              borderLeft: "2px dashed var(--border)",
            }}
          >
            placing you now — one moment.
          </p>
        ) : (
          <>
            {justification && (
              <p
                style={{
                  fontFamily: "var(--font-caveat), cursive",
                  fontSize: 15,
                  color: "var(--text)",
                  lineHeight: 1.35,
                  margin: 0,
                  paddingLeft: 10,
                  borderLeft: "2px dashed var(--border-strong, var(--border))",
                }}
              >
                {justification}
              </p>
            )}

            {seedWords.length > 0 && (
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-caveat), cursive",
                    fontSize: 16,
                    color: "var(--text-dim)",
                    marginBottom: 6,
                  }}
                >
                  saved for next time
                </div>
                <div
                  style={{
                    paddingLeft: 10,
                    borderLeft: "2px solid var(--gold)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {seedWords.map((w) => (
                    <div
                      key={w}
                      style={{
                        fontSize: 14,
                        color: "var(--text)",
                        fontFamily:
                          "var(--font-geist-sans), 'Noto Serif JP', serif",
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <button
          type="button"
          onClick={onSignIn ?? onCallAgain}
          disabled={pending}
          className="w-full transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "var(--gold)",
            color: "var(--bg)",
            borderRadius: 99,
            padding: "12px 0",
            textAlign: "center",
            fontFamily: "var(--font-geist-sans), sans-serif",
            fontSize: 14,
            fontWeight: 500,
            border: "none",
            cursor: pending ? "wait" : "pointer",
          }}
        >
          {onSignIn ? "Sign in to save →" : "Call again"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="w-full"
          style={{
            color: "var(--text-dim)",
            padding: "6px 0",
            textAlign: "center",
            fontFamily: "var(--font-caveat), cursive",
            fontSize: 15,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          {onSignIn ? "continue as guest →" : "back home →"}
        </button>
      </div>
    </div>
  );
}
