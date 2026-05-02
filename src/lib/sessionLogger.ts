type SessionLogEvent =
  | {
      type: "call-mounted";
      learnerId: string;
      learnerName: string;
      targetLanguage: string;
      nativeLanguage: string;
      proficiencyLevel?: string | null;
    }
  | {
      type: "first-call-detected";
      isFirstCall: boolean;
    }
  | {
      type: "drill-words-loaded";
      words: string[];
    }
  | {
      type: "voice-started";
    }
  | {
      type: "agenda-change";
      from: string | null;
      to: string;
      explicit: boolean;
      scenarioLabel?: string;
      guidedTopic?: string;
    }
  | {
      type: "drill-index-change";
      from: number;
      to: number;
      total: number;
      currentWord: string | null;
    }
  | {
      type: "turn";
      role: "user" | "assistant";
      messageId: string;
      content: string;
      messageCount: number;
      agenda: string;
      drillIndex?: number;
      drillTotal?: number;
      isFirstCall: boolean | null;
    }
  | {
      type: "call-ended";
      elapsedSec: number;
      messageCount: number;
      newWordsCount: number;
      errorsCount: number;
    }
  | {
      type: "leveltest-auto-end-scheduled";
      trigger: "token" | "phrase";
      content: string;
    };

const ENABLED =
  typeof process !== "undefined" && process.env.NODE_ENV !== "production";

export function logSessionEvent(event: SessionLogEvent): void {
  if (!ENABLED) return;
  if (typeof window === "undefined") return;

  fetch("/api/debug/session-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {
    // best-effort, debug logging never breaks the call
  });
}
