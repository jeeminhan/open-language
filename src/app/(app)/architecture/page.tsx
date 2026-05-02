import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MermaidChart } from "./MermaidChart";

export const dynamic = "force-dynamic";

function extractMermaid(md: string): string | null {
  const match = md.match(/```mermaid\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

function loadPipelineDiagram(): string | null {
  try {
    const md = readFileSync(join(process.cwd(), "PIPELINE.md"), "utf-8");
    return extractMermaid(md);
  } catch {
    return null;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4">
      <h2 className="text-lg font-bold" style={{ color: "var(--gold)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre
      className="text-xs leading-relaxed overflow-x-auto rounded-lg p-4"
      style={{ background: "var(--bg)", border: "1px solid var(--border)" }}
    >
      <code>{children}</code>
    </pre>
  );
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-mono" style={{ color: "var(--gold)", minWidth: "12rem" }}>{label}</span>
      <span style={{ color: "var(--text)" }}>{value}</span>
    </div>
  );
}

export default function ArchitecturePage() {
  const pipelineDiagram = loadPipelineDiagram();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold mb-1">Architecture</h1>
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          How the voice system, APIs, and analysis pipeline work under the hood.
        </p>
      </div>

      {/* ─── Pipeline Diagram (source: PIPELINE.md) ─── */}
      {pipelineDiagram && (
        <Section title="Pipeline">
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            Rendered from the <code className="font-mono">mermaid</code> block in{" "}
            <code className="font-mono">PIPELINE.md</code>. Edit that file and refresh — this updates.
          </p>
          <MermaidChart source={pipelineDiagram} />
        </Section>
      )}

      {/* ─── Voice Pipeline ─── */}
      <Section title="Voice Pipeline">
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          End-to-end flow from microphone to AI response and back to speakers.
        </p>
        <Code>{`Mic (browser)
 │  getUserMedia({ echoCancellation, noiseSuppression })
 ▼
AudioWorklet (capture.worklet.js)
 │  Captures at native sample rate (typically 44.1/48 kHz)
 │  Resamples → 16 kHz mono PCM16 (linear interpolation)
 ▼
WebSocket  ───────────────────────────────►  Gemini Live API
 │  realtimeInput.audio.data (base64 PCM)     wss://generativelanguage.googleapis.com/ws/...
 │                                              BidiGenerateContent
 │  ◄─── serverContent.modelTurn.inlineData    (bidirectional streaming)
 ▼
AudioPlayback
 │  Decodes base64 → PCM ArrayBuffer
 │  Plays at 24 kHz via Web Audio API
 │  Sequential buffer scheduling (no gaps)
 ▼
Speakers`}</Code>
        <div className="space-y-1">
          <Prop label="Capture rate" value="16,000 Hz mono PCM16" />
          <Prop label="Playback rate" value="24,000 Hz mono PCM16" />
          <Prop label="Encoding" value="Base64-encoded raw PCM (no WAV header)" />
          <Prop label="Echo cancellation" value="Browser-native (getUserMedia constraint)" />
          <Prop label="Resampling" value="Linear interpolation in AudioWorklet" />
        </div>
      </Section>

      {/* ─── Gemini Live WebSocket ─── */}
      <Section title="Gemini Live WebSocket">
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          Persistent WebSocket connection to Gemini&apos;s BidiGenerateContent endpoint for real-time voice conversation.
        </p>

        <h3 className="text-sm font-semibold mt-4" style={{ color: "var(--text)" }}>Model</h3>
        <div className="space-y-1">
          <Prop label="Model ID" value="gemini-3.1-flash-live-preview" />
          <Prop label="Type" value="Non-native audio (supports speechConfig.languageCode)" />
          <Prop label="Voice" value='Kore (prebuilt)' />
          <Prop label="WS endpoint" value="generativelanguage.googleapis.com/ws/...BidiGenerateContentConstrained (v1alpha)" />
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          The client connects using a short-lived ephemeral token (not the raw API key — see <code className="font-mono">/api/gemini/token</code> below).
          We use the non-native audio model instead of <code className="font-mono">gemini-2.5-flash-native-audio-preview</code> because
          the native model on the Developer API doesn&apos;t support <code className="font-mono">speechConfig.languageCode</code>,
          causing transcription errors for non-English languages. The non-native model supports language hints
          while staying on the Developer API (Vertex AI supports language codes but has no free tier).
        </p>

        <h3 className="text-sm font-semibold mt-4" style={{ color: "var(--text)" }}>Setup Message</h3>
        <Code>{`{
  "setup": {
    "model": "models/gemini-3.1-flash-live-preview",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": { "voiceName": "Kore" }
        },
        "languageCode": "ja-JP"  // BCP-47 for Japanese
      }
    },
    "systemInstruction": {
      "parts": [{ "text": "..." }]
    },
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
        "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
        "prefixPaddingMs": 300,
        "silenceDurationMs": 700
      }
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {}
  }
}`}</Code>

        <h3 className="text-sm font-semibold mt-4" style={{ color: "var(--text)" }}>Message Types</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full" style={{ color: "var(--text)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--gold)" }}>Direction</th>
                <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--gold)" }}>Key</th>
                <th className="text-left py-2 font-semibold" style={{ color: "var(--gold)" }}>Description</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Client →</td>
                <td className="py-2 pr-4">setup</td>
                <td className="py-2 font-sans">Initial config (model, voice, language, system prompt)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">setupComplete</td>
                <td className="py-2 font-sans">Ready to send/receive audio</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Client →</td>
                <td className="py-2 pr-4">realtimeInput.audio</td>
                <td className="py-2 font-sans">Base64 PCM audio chunks from mic</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Client →</td>
                <td className="py-2 pr-4">clientContent.turns</td>
                <td className="py-2 font-sans">Text message (for text input mode)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">serverContent.modelTurn</td>
                <td className="py-2 font-sans">Audio response (base64 PCM in inlineData)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">serverContent.inputTranscription</td>
                <td className="py-2 font-sans">STT of user&apos;s speech</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">serverContent.outputTranscription</td>
                <td className="py-2 font-sans">Transcript of model&apos;s spoken response</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">serverContent.turnComplete</td>
                <td className="py-2 font-sans">Model finished speaking</td>
              </tr>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">serverContent.interrupted</td>
                <td className="py-2 font-sans">User started speaking, model cut off</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Server →</td>
                <td className="py-2 pr-4">realtimeInput.activityHandling</td>
                <td className="py-2 font-sans">VAD signals (activityStart / activityEnd)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ─── API Endpoints ─── */}
      <Section title="API Endpoints">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>GET /api/gemini/token</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Mints a <strong>short-lived ephemeral token</strong> by POSTing to Google&apos;s{" "}
              <code className="font-mono">v1alpha/auth_tokens</code> endpoint, then returns it to the browser for the
              WebSocket connection. The real <code className="font-mono">LLM_API_KEY</code> never leaves the server.
              Gated by auth and a daily per-user voice quota (<code className="font-mono">RATE_LIMITS.voice</code> — 10 sessions/day),
              which — paired with the 10-min session cap — bounds worst-case audio spend to ~100 min/user/day.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/session/start</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Creates the <code className="font-mono">sessions</code> row before the voice socket opens. This gives
              every raw voice turn a stable session id; sessions are no longer lazily created by per-turn analysis.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/session/turn</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Called after each complete user/tutor exchange. Saves the raw transcript pair only. It does not call an LLM
              and does not persist errors, vocabulary, or grammar.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/session/finish</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Called when the user ends the voice session. Runs one full-transcript Gemini Flash review, replays any missing
              raw turns, stamps the session complete, and persists error patterns, grammar, vocabulary, phrasing suggestions,
              expressions, and detected interests.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/session/end</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Fallback close path for unloads and finish failures. Stamps <code className="font-mono">ended_at</code> and
              <code className="font-mono">duration_seconds</code> without running the full review.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/review (legacy)</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Post-session deep review. Runs <strong>6 parallel LLM passes</strong> on the full conversation transcript:
            </p>
            <ol className="text-xs mt-2 space-y-1 list-decimal list-inside" style={{ color: "var(--text-dim)" }}>
              <li><strong>Error patterns</strong> &mdash; grouped by recurring mistake type, not individual nitpicks</li>
              <li><strong>Tutor evaluation</strong> &mdash; scores tutor effectiveness 1-10, identifies missed teaching moments</li>
              <li><strong>Unknown vocabulary</strong> &mdash; words the learner didn&apos;t understand</li>
              <li><strong>Phrasing suggestions</strong> &mdash; how a native speaker would say it (idioms, phrasal verbs, connectors)</li>
              <li><strong>Expression detection</strong> &mdash; idioms, set phrases, grammar patterns encountered or used</li>
              <li><strong>Interest detection</strong> &mdash; personal topics the learner cares about (for future conversations)</li>
            </ol>
            <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
              If 2+ errors are found, a 7th sequential pass clusters them by root cause.
              All results are persisted to Supabase Postgres for long-term tracking.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-mono" style={{ color: "var(--moss)" }}>POST /api/chat</h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>
              Text-based chat mode. Uses the full learner context (SRS, errors, interests, history) with
              <code className="font-mono"> gemini-2.5-flash</code> — this is where the &quot;deep&quot; tutor lives,
              because text tokens are cheap. The voice path deliberately stays lean and saves durable learning state
              at session finish.
            </p>
          </div>
        </div>
      </Section>

      {/* ─── Analysis Model ─── */}
      <Section title="Analysis Model">
        <div className="space-y-1">
          <Prop label="Model" value="gemini-2.5-flash (configurable via LLM_MODEL)" />
          <Prop label="API" value="Google Generative AI REST (generateContent)" />
          <Prop label="Temperature" value="0.2-0.3 (low for consistent analysis)" />
          <Prop label="Max tokens" value="800-2000 depending on pass" />
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
          The voice conversation uses Gemini Live (WebSocket, real-time audio). The post-session analysis
          uses the standard REST API with the same API key but a different model optimized for text reasoning.
        </p>
      </Section>

      {/* ─── Data Flow ─── */}
      <Section title="Data Persistence">
        <Code>{`Session Start
 │  ↓ POST /api/session/start
 │  └── Create sessions row before voice starts
 │
Voice Turn
 │  user transcription + tutor transcription
 │  ↓ POST /api/session/turn
 │  └── Save raw turn to turns table, no LLM analysis
 │
Session Auto-Close (idle 30s / cap 10min) or manual end
 │  full transcript
 │  ↓ POST /api/session/finish
 │  ├── One full-session review (Gemini Flash, REST)
 │  ├── Replay any missing raw turns
 │  ├── Stamp ended_at + duration_seconds on sessions
 │  ├── Persist error_patterns
 │  ├── Persist unknown vocabulary
 │  ├── Persist grammar_inventory
 │  ├── Persist phrasing_suggestions
 │  ├── Persist expressions
 │  └── Persist detected interests
 │
Fallback End
 │  ↓ POST /api/session/end
 │  └── Stamp ended_at + duration_seconds without analysis
 │
Database: Supabase Postgres (shared with the Python CLI)
 │  Tables: learners, sessions, turns, error_patterns,
 │          grammar_inventory, vocabulary, expressions,
 │          phrasing_suggestions, learner_interests,
 │          alongside_sessions, alongside_segments,
 │          alongside_interactions, rate_limits`}</Code>
        <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
          Invariant: the voice WebSocket never writes to the DB directly. Every DB write goes through a Next.js API route.
        </p>
      </Section>

      {/* ─── Key Files ─── */}
      <Section title="Key Source Files">
        <div className="space-y-2 text-xs font-mono" style={{ color: "var(--text-dim)" }}>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/gemini-live.ts</span>
            <span className="font-sans">WebSocket client for Gemini Live API (setup, audio framing, transcripts)</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/audio.ts</span>
            <span className="font-sans">Mic capture, PCM resampling, audio playback</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/hooks/useVoiceChat.ts</span>
            <span className="font-sans">React hook bridging audio + WebSocket + UI state; owns idle + session-cap timers</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/tutor.ts</span>
            <span className="font-sans">System prompt builder for the text path + text chat handler</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/app/(app)/chat/page.tsx</span>
            <span className="font-sans">Chat UI; hosts the compact <code>buildVoicePrompt()</code> and onAutoDisconnect UX</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/db.ts</span>
            <span className="font-sans">Supabase query helpers and typed row interfaces</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/supabase.ts</span>
            <span className="font-sans">Supabase service-role client (server-only)</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/rateLimit.ts</span>
            <span className="font-sans">Supabase RPC-backed rate limiter; voice / standard / expensive profiles</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/auth.ts</span>
            <span className="font-sans">Resolves the current learner&apos;s Supabase user id</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>public/capture.worklet.js</span>
            <span className="font-sans">AudioWorklet for mic PCM capture (16 kHz mono)</span>
          </div>
          <div className="flex gap-2">
            <span style={{ color: "var(--river)", minWidth: "16rem" }}>src/lib/prompts/ja/</span>
            <span className="font-sans">All English→Japanese prompts (call, level test, chat) — share style/mode rules via shared.ts</span>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--text-dim)" }}>
          See <code className="font-mono">PIPELINE.md</code> for the voice-cost levers, rate-limit ceilings,
          and optimization backlog.
        </p>
      </Section>
    </div>
  );
}
