const GEMINI_MODEL = "gemini-2.5-flash-native-audio-preview";
const GEMINI_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export interface GeminiLiveConfig {
  token: string;
  systemPrompt: string;
  /** BCP-47 language code for the learner's target language (e.g. "ja-JP", "ko-KR") */
  languageCode?: string;
  onAudioResponse: (pcmData: ArrayBuffer) => void;
  onTranscript: (role: "user" | "model", text: string) => void;
  onConnectionChange: (connected: boolean) => void;
  onError: (err: Error) => void;
  onSetupComplete?: () => void;
  onTurnComplete?: () => void;
  onUserSpeechStart?: () => void;
  onUserSpeechEnd?: () => void;
  onInterrupted?: () => void;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class GeminiLiveClient {
  private config: GeminiLiveConfig;
  private ws: WebSocket | null = null;
  connected = false;
  setupComplete = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  connect() {
    if (this.ws) this.disconnect();

    const url = `${GEMINI_WS_BASE}?key=${this.config.token}`;
    this.ws = new WebSocket(url);
    this.setupComplete = false;

    this.ws.onopen = () => {
      console.log("[Gemini WS] connected, sending setup...");
      this.connected = true;
      this.config.onConnectionChange(true);
      this.sendSetup();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (event) => {
      console.error("[Gemini WS] error:", event);
      this.config.onError(new Error("WebSocket connection error"));
    };

    this.ws.onclose = (event) => {
      console.log("[Gemini WS] closed:", event.code, event.reason);
      const wasActive = this.connected && this.setupComplete;
      this.connected = false;
      this.setupComplete = false;
      this.config.onConnectionChange(false);
      if (wasActive && event.code !== 1000) {
        this.config.onError(
          new Error(`Connection lost (code ${event.code})`)
        );
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.connected = false;
    this.setupComplete = false;
    this.config.onConnectionChange(false);
  }

  sendAudio(pcmData: ArrayBuffer) {
    if (!this.ws || !this.setupComplete) return;
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: arrayBufferToBase64(pcmData),
            mimeType: "audio/pcm",
          },
        },
      })
    );
  }

  sendText(text: string) {
    if (!this.ws || !this.setupComplete) return;
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        },
      })
    );
  }

  isActive(): boolean {
    return this.connected && this.setupComplete;
  }

  private sendSetup() {
    const msg = {
      setup: {
        model: `models/${GEMINI_MODEL}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
            ...(this.config.languageCode ? { languageCode: this.config.languageCode } : {}),
          },
        },
        systemInstruction: {
          parts: [{ text: this.config.systemPrompt }],
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
            prefixPaddingMs: 300,
            silenceDurationMs: 700,
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    };
    console.log("[Gemini WS] sending setup for model:", msg.setup.model);
    this.ws?.send(JSON.stringify(msg));
  }

  private async handleMessage(raw: string | Blob | ArrayBuffer) {
    let text: string;
    if (typeof raw === "string") {
      text = raw;
    } else if (raw instanceof Blob) {
      text = await raw.text();
    } else if (raw instanceof ArrayBuffer) {
      text = new TextDecoder().decode(raw);
    } else {
      return;
    }

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }

    // Debug: log all message types from Gemini
    const keys = Object.keys(msg);
    console.log("[Gemini WS] message keys:", keys.join(", "), text.length > 500 ? "(large)" : "");

    // Setup complete
    if ("setupComplete" in msg) {
      this.setupComplete = true;
      this.config.onSetupComplete?.();
      return;
    }

    // Server content (audio, transcripts, turn complete)
    const serverContent = msg.serverContent as Record<string, unknown> | undefined;
    if (serverContent) {
      const modelTurn = serverContent.modelTurn as { parts?: Array<{ inlineData?: { data: string } }> } | undefined;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            this.config.onAudioResponse(
              base64ToArrayBuffer(part.inlineData.data)
            );
          }
        }
      }

      const inputTranscription = serverContent.inputTranscription as { text?: string } | undefined;
      if (inputTranscription?.text) {
        this.config.onTranscript("user", inputTranscription.text);
      }

      const outputTranscription = serverContent.outputTranscription as { text?: string } | undefined;
      if (outputTranscription?.text) {
        this.config.onTranscript("model", outputTranscription.text);
      }

      if (serverContent.turnComplete) {
        this.config.onTurnComplete?.();
      }

      if (serverContent.interrupted) {
        this.config.onInterrupted?.();
      }

      return;
    }

    // Activity detection
    const realtimeInput = msg.realtimeInput as { activityHandling?: { activityStart?: boolean; activityEnd?: boolean } } | undefined;
    if (realtimeInput?.activityHandling) {
      const activity = realtimeInput.activityHandling;
      if (activity.activityStart) {
        this.config.onUserSpeechStart?.();
      }
      if (activity.activityEnd) {
        this.config.onUserSpeechEnd?.();
      }
    }
  }
}
