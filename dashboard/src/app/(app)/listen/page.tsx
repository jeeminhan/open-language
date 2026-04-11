"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Utterance {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

const CHUNK_INTERVAL_MS = 8000; // Send audio for transcription every 8 seconds

let idCounter = 0;
function nextId() { return `u_${Date.now()}_${++idCounter}`; }

export default function ListenPage() {
  const [listening, setListening] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [mySpeaker, setMySpeaker] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<Set<string>>(new Set());
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances]);

  const sendChunkForTranscription = useCallback(async () => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;
    chunksRef.current = [];

    // Merge chunks into one buffer
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64
    const bytes = new Uint8Array(merged.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    try {
      const res = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });
      const data = await res.json();
      if (data.utterances && Array.isArray(data.utterances)) {
        setUtterances((prev) => {
          const newUtterances: Utterance[] = data.utterances.map((u: { speaker: string; text: string }) => ({
            id: nextId(),
            speaker: u.speaker,
            text: u.text,
            timestamp: Date.now(),
          }));
          return [...prev, ...newUtterances];
        });
        setSpeakers((prev) => {
          const next = new Set(prev);
          for (const u of data.utterances) {
            if (u.speaker) next.add(u.speaker);
          }
          return next;
        });
      }
    } catch {
      /* silent — best effort */
    }
  }, []);

  const startListening = useCallback(async () => {
    try {
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;

      await ctx.audioWorklet.addModule("/capture.worklet.js");
      const worklet = new AudioWorkletNode(ctx, "audio-capture-processor");
      workletRef.current = worklet;

      worklet.port.onmessage = (event: MessageEvent) => {
        if (event.data.type !== "audio") return;
        const float32: Float32Array = event.data.data;
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7fff;
        }
        chunksRef.current.push(int16);
      };

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(worklet);

      // Send chunks periodically
      intervalRef.current = setInterval(sendChunkForTranscription, CHUNK_INTERVAL_MS);

      setListening(true);
      setUtterances([]);
      setSpeakers(new Set());
      setMySpeaker(null);
      setAnalysis(null);
    } catch (err) {
      console.error("Failed to start listening:", err);
    }
  }, [sendChunkForTranscription]);

  const stopListening = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    // Send any remaining audio
    await sendChunkForTranscription();

    if (workletRef.current) { workletRef.current.port.close(); workletRef.current.disconnect(); workletRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }

    setListening(false);
    if (speakers.size > 0) setPicking(true);
  }, [sendChunkForTranscription, speakers]);

  const analyzeMySpeeech = useCallback(async () => {
    if (!mySpeaker) return;
    setAnalyzing(true);
    const myUtterances = utterances.filter((u) => u.speaker === mySpeaker).map((u) => u.text);
    if (myUtterances.length === 0) { setAnalyzing(false); return; }

    try {
      const res = await fetch("/api/listen/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: myUtterances }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || "No analysis available.");
    } catch {
      setAnalysis("Failed to analyze.");
    }
    setAnalyzing(false);
  }, [mySpeaker, utterances]);

  const speakerColor = (speaker: string) => {
    if (mySpeaker === speaker) return "var(--gold)";
    const arr = Array.from(speakers);
    const idx = arr.indexOf(speaker);
    return idx === 0 ? "var(--river)" : idx === 1 ? "var(--moss)" : "var(--ember)";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--river)" }}>
        Passive Listening
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
        Have a conversation with someone. I&apos;ll listen and identify speakers.
        After you stop, choose which voice is yours for feedback.
      </p>

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        {!listening ? (
          <button
            onClick={startListening}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--moss)", color: "white" }}
          >
            Start Listening
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--ember)", color: "white" }}
          >
            Stop
          </button>
        )}
        {listening && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--ember)", animation: "pulse 1.5s ease-in-out infinite" }}
            />
            Listening...
          </div>
        )}
      </div>

      {/* Speaker picker */}
      {picking && !mySpeaker && speakers.size > 0 && (
        <div
          className="rounded-lg p-4 mb-6 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
            Which speaker are you?
          </p>
          <div className="flex gap-2 flex-wrap">
            {Array.from(speakers).map((s) => (
              <button
                key={s}
                onClick={() => { setMySpeaker(s); setPicking(false); }}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 border"
                style={{
                  background: "var(--bg-hover)",
                  borderColor: speakerColor(s),
                  color: speakerColor(s),
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Analysis button */}
      {mySpeaker && !analysis && (
        <div className="mb-6">
          <button
            onClick={analyzeMySpeeech}
            disabled={analyzing}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{
              background: analyzing ? "var(--border)" : "var(--gold)",
              color: analyzing ? "var(--text-dim)" : "var(--bg)",
            }}
          >
            {analyzing ? "Analyzing..." : "Analyze My Speech"}
          </button>
          <span className="text-xs ml-3" style={{ color: "var(--text-dim)" }}>
            Speaking as {mySpeaker}
          </span>
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div
          className="rounded-lg p-4 mb-6 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--gold)", borderWidth: "1px" }}
        >
          <h3 className="text-sm font-bold mb-2" style={{ color: "var(--gold)" }}>
            Analysis
          </h3>
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap"
            style={{ color: "var(--text)" }}
          >
            {analysis}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 380px)" }}
      >
        {utterances.length === 0 && !listening && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            No transcript yet. Start listening to begin.
          </p>
        )}
        {utterances.map((u) => (
          <div key={u.id} className="flex gap-3 items-start">
            <span
              className="text-xs font-mono font-bold shrink-0 mt-0.5 px-2 py-0.5 rounded"
              style={{
                color: speakerColor(u.speaker),
                background: "var(--bg-hover)",
                minWidth: "80px",
                textAlign: "center",
              }}
            >
              {u.speaker === mySpeaker ? "You" : u.speaker}
            </span>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              {u.text}
            </p>
          </div>
        ))}
        {listening && utterances.length === 0 && (
          <p className="text-sm italic" style={{ color: "var(--text-dim)" }}>
            Waiting for speech...
          </p>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
