"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AudioManager } from "@/lib/audio";
import { GeminiLiveClient } from "@/lib/gemini-live";

export interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export interface UseVoiceChatOptions {
  /** System prompt for the voice model */
  systemPrompt: string;
  /** BCP-47 language code for the target language (e.g. "ja-JP", "ko-KR") */
  languageCode?: string;
  /** API route that returns { token: string } — defaults to "/api/gemini/token" */
  tokenEndpoint?: string;
  /** API route for transcript cleanup — defaults to "/api/cleanup", set null to disable */
  cleanupEndpoint?: string | null;
  /** Initial text message to send when voice connects */
  greeting?: string;
  /** Called when a turn completes with the full transcript */
  onTurnComplete?: (messages: VoiceMessage[]) => void;
  /** Called on connection error */
  onError?: (err: Error) => void;
  /**
   * Called when the session auto-closes (not a manual toggle-off).
   * - "idle": no audio activity for the idle window (default 30s)
   * - "cap": hard session cap reached (default 10 min)
   * Consumers can use this to surface a "tap mic to continue" hint.
   */
  onAutoDisconnect?: (reason: "idle" | "cap") => void;
}

/** Silence window before the WS auto-closes. */
const IDLE_TIMEOUT_MS = 30_000;
/** Hard ceiling on a single voice session to bound per-session cost. */
const SESSION_CAP_MS = 10 * 60 * 1000;

export interface UseVoiceChatReturn {
  /** Current voice transcript messages */
  messages: VoiceMessage[];
  /** Whether voice WebSocket is connected and streaming */
  voiceActive: boolean;
  /** Whether voice is in the process of connecting */
  voiceConnecting: boolean;
  /** Whether the user is currently speaking */
  userSpeaking: boolean;
  /** Local interim transcript (from Web Speech API) while user speaks */
  interimTranscript: string;
  /** Start or stop voice session */
  toggleVoice: () => Promise<void>;
  /** Send a text message through the voice channel */
  sendText: (text: string) => void;
  /** Stop voice and reset state */
  reset: () => void;
  /** Manually append a message (for hybrid text+voice UIs) */
  appendMessage: (role: "user" | "assistant", content: string) => void;
}

let idCounter = 0;
function nextId(): string {
  return `vm_${Date.now()}_${++idCounter}`;
}

export function useVoiceChat(options: UseVoiceChatOptions): UseVoiceChatReturn {
  const {
    systemPrompt,
    languageCode,
    tokenEndpoint = "/api/gemini/token",
    cleanupEndpoint = "/api/cleanup",
    greeting,
    onTurnComplete,
    onError,
    onAutoDisconnect,
  } = options;

  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceConnecting, setVoiceConnecting] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");

  const audioManagerRef = useRef<AudioManager | null>(null);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const pendingRef = useRef<{ user: number | null; model: number | null }>({
    user: null,
    model: null,
  });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
      audioManagerRef.current?.destroy();
      clientRef.current?.disconnect();
    };
  }, []);

  const teardown = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
    idleTimerRef.current = null;
    capTimerRef.current = null;
    audioManagerRef.current?.destroy();
    audioManagerRef.current = null;
    clientRef.current?.disconnect();
    clientRef.current = null;
    setVoiceActive(false);
    setVoiceConnecting(false);
    setUserSpeaking(false);
    setInterimTranscript("");
  }, []);

  // Reset the idle timer on any audio activity (user speaking, transcripts, turn complete).
  const bumpActivity = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      onAutoDisconnect?.("idle");
      teardown();
    }, IDLE_TIMEOUT_MS);
  }, [onAutoDisconnect, teardown]);

  // Watchdog: keep capture context alive while voice is active
  useEffect(() => {
    if (!voiceActive) return;
    const interval = setInterval(() => {
      audioManagerRef.current?.ensureCaptureActive();
    }, 2000);
    return () => clearInterval(interval);
  }, [voiceActive]);

  const appendTranscript = useCallback(
    (role: "user" | "model", text: string) => {
      if (!text?.trim()) return;
      const chatRole: "user" | "assistant" = role === "user" ? "user" : "assistant";
      const otherRole = role === "user" ? "model" : "user";

      setMessages((prev) => {
        const msgs = [...prev];
        const ownIdx = pendingRef.current[role];
        pendingRef.current[otherRole] = null;

        if (ownIdx != null && msgs[ownIdx]?.role === chatRole) {
          const merged = (msgs[ownIdx].content + text).replace(/\s+/g, " ").trim();
          msgs[ownIdx] = { ...msgs[ownIdx], content: merged };
          return msgs;
        }

        const newMsg: VoiceMessage = { role: chatRole, content: text.trim(), id: nextId() };
        msgs.push(newMsg);
        pendingRef.current[role] = msgs.length - 1;
        return msgs;
      });
    },
    []
  );

  const cleanupTranscript = useCallback(
    async (msgIndex: number) => {
      if (!cleanupEndpoint) return;

      let textToClean = "";
      setMessages((prev) => {
        textToClean = prev[msgIndex]?.content || "";
        return prev;
      });

      if (!textToClean || textToClean.length < 5) return;

      try {
        const res = await fetch(cleanupEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToClean }),
        });
        const { cleaned } = await res.json();
        if (cleaned && cleaned !== textToClean) {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[msgIndex]) {
              updated[msgIndex] = { ...updated[msgIndex], content: cleaned };
            }
            return updated;
          });
        }
      } catch {
        /* silent */
      }
    },
    [cleanupEndpoint]
  );

  const toggleVoice = useCallback(async () => {
    if (voiceActive || voiceConnecting) {
      teardown();
      return;
    }

    setVoiceConnecting(true);
    try {
      const tokenRes = await fetch(tokenEndpoint);
      const body = await tokenRes.json().catch(() => ({} as Record<string, unknown>));
      if (!tokenRes.ok || !body?.token) {
        setVoiceConnecting(false);
        const msg =
          (typeof body?.message === "string" && body.message) ||
          (typeof body?.error === "string" && body.error) ||
          "No API token received";
        onError?.(new Error(msg));
        return;
      }
      const token = body.token as string;

      const audioManager = new AudioManager();
      audioManagerRef.current = audioManager;

      const client = new GeminiLiveClient({
        token,
        systemPrompt,
        languageCode,
        onAudioResponse: (pcmData) => audioManager.playAudio(pcmData),
        onTranscript: (role, text) => {
          if (role === "user") {
            setUserSpeaking(false);
            setInterimTranscript(""); // Gemini transcript replaces local interim
          }
          bumpActivity();
          appendTranscript(role, text);
        },
        onInterrupted: () => audioManager.stopPlayback(),
        onUserSpeechStart: () => {
          setUserSpeaking(true);
          bumpActivity();
          audioManager.stopPlayback();
          audioManager.ensureCaptureActive();
        },
        onUserSpeechEnd: () => setUserSpeaking(false),
        onTurnComplete: () => {
          // Ensure mic capture is active after model finishes speaking
          audioManager.ensureCaptureActive();
          bumpActivity();
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].role === "assistant") {
              cleanupTranscript(lastIdx);
            }
            onTurnComplete?.(prev);
            return prev;
          });
          pendingRef.current = { user: null, model: null };
        },
        onError: (err) => {
          onError?.(err);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          if (capTimerRef.current) clearTimeout(capTimerRef.current);
          idleTimerRef.current = null;
          capTimerRef.current = null;
          setVoiceActive(false);
          setVoiceConnecting(false);
        },
        onConnectionChange: (connected) => {
          if (connected) {
            setVoiceConnecting(false);
            setVoiceActive(true);
            // Start the idle timer and the hard session cap on successful connect.
            bumpActivity();
            if (capTimerRef.current) clearTimeout(capTimerRef.current);
            capTimerRef.current = setTimeout(() => {
              onAutoDisconnect?.("cap");
              teardown();
            }, SESSION_CAP_MS);
          }
        },
        onSetupComplete: async () => {
          console.log("[Voice] setup complete, starting capture...");
          try {
            await audioManager.startCapture((pcmData) => client.sendAudio(pcmData));
            console.log("[Voice] capture started");
          } catch (err) {
            console.error("[Voice] capture failed:", err);
            onError?.(err instanceof Error ? err : new Error(String(err)));
          }
          if (greeting) {
            console.log("[Voice] sending greeting");
            client.sendText(greeting);
          }
        },
      });

      clientRef.current = client;
      client.connect();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
      setVoiceConnecting(false);
    }
  }, [
    voiceActive,
    voiceConnecting,
    tokenEndpoint,
    systemPrompt,
    languageCode,
    greeting,
    appendTranscript,
    cleanupTranscript,
    onTurnComplete,
    onError,
    onAutoDisconnect,
    teardown,
    bumpActivity,
  ]);

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (clientRef.current?.isActive()) {
        clientRef.current.sendText(text);
        appendTranscript("user", text);
      }
    },
    [appendTranscript]
  );

  const reset = useCallback(() => {
    teardown();
    setMessages([]);
    pendingRef.current = { user: null, model: null };
  }, [teardown]);

  const appendMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setMessages((prev) => [...prev, { role, content, id: nextId() }]);
    },
    []
  );

  return {
    messages,
    voiceActive,
    voiceConnecting,
    userSpeaking,
    interimTranscript,
    toggleVoice,
    sendText,
    reset,
    appendMessage,
  };
}
