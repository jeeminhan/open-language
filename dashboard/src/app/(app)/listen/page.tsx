"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getLanguageCode } from "@/lib/languages";

interface Utterance {
  id: string;
  speaker: string;
  text: string;
}

interface LearnerInfo {
  target_language?: string;
  native_language?: string;
}

let idCounter = 0;
function nextId() { return `u_${Date.now()}_${++idCounter}`; }

export default function ListenPage() {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [liveText, setLiveText] = useState("");
  const [mySpeaker, setMySpeaker] = useState<string | null>(null);
  const [speakers, setSpeakers] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [learner, setLearner] = useState<LearnerInfo>({});
  const [useTargetLang, setUseTargetLang] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/learner")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d === "object") setLearner(d);
      })
      .catch(() => {});
  }, []);

  const activeLanguage = useTargetLang
    ? learner.target_language || "Korean"
    : learner.native_language || "English";
  const sttLang = getLanguageCode(activeLanguage) || "en-US";

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances]);

  const startLocalSTT = useCallback(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        interim += event.results[i][0].transcript;
      }
      setLiveText(interim);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* */ }
      }
    };
    try { recognition.start(); recognitionRef.current = recognition; } catch { /* */ }
  }, [sttLang]);

  const stopLocalSTT = useCallback(() => {
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch { /* */ }
    }
    setLiveText("");
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

      chunksRef.current = [];
      setListening(true);
      setUtterances([]);
      setSpeakers([]);
      setMySpeaker(null);
      setAnalysis(null);
      setPicking(false);
      setDuration(0);

      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      startLocalSTT();
    } catch (err) {
      console.error("Failed to start listening:", err);
    }
  }, [startLocalSTT]);

  const stopListening = useCallback(async () => {
    // Stop timer
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Stop audio capture
    if (workletRef.current) { workletRef.current.port.close(); workletRef.current.disconnect(); workletRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }

    stopLocalSTT();
    setListening(false);

    // Merge all chunks and send to API
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;
    chunksRef.current = [];

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    const bytes = new Uint8Array(merged.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    setProcessing(true);
    setErrorMsg(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 95000);
      const res = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, language: activeLanguage }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Transcription failed (${res.status})`);
      } else if (data.utterances && Array.isArray(data.utterances) && data.utterances.length > 0) {
        const parsed: Utterance[] = data.utterances.map((u: { speaker: string; text: string }) => ({
          id: nextId(),
          speaker: u.speaker,
          text: u.text,
        }));
        setUtterances(parsed);
        const uniqueSpeakers = [...new Set(data.utterances.map((u: { speaker: string }) => u.speaker))];
        setSpeakers(uniqueSpeakers as string[]);
        if (uniqueSpeakers.length > 0) setPicking(true);
      } else {
        setErrorMsg("No speech detected in the recording.");
      }
    } catch (err) {
      const e = err as Error;
      setErrorMsg(e.name === "AbortError" ? "Transcription timed out. Try a shorter clip." : "Failed to transcribe.");
    }
    setProcessing(false);
  }, [stopLocalSTT, activeLanguage]);

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
    const idx = speakers.indexOf(speaker);
    return idx === 0 ? "var(--river)" : idx === 1 ? "var(--moss)" : "var(--ember)";
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--river)" }}>
        Passive Listening
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
        Have a conversation with someone. I&apos;ll listen and transcribe everything at the end.
        Then choose which voice is yours for feedback.
      </p>

      {/* Language toggle */}
      {learner.target_language && learner.native_language && !listening && !processing && (
        <div className="flex gap-2 mb-4 text-xs">
          <span style={{ color: "var(--text-dim)" }}>Expecting:</span>
          <button
            onClick={() => setUseTargetLang(true)}
            className="px-2.5 py-1 rounded-md transition-all"
            style={{
              background: useTargetLang ? "var(--bg-hover)" : "transparent",
              border: `1px solid ${useTargetLang ? "var(--river)" : "var(--border)"}`,
              color: useTargetLang ? "var(--river)" : "var(--text-dim)",
            }}
          >
            {learner.target_language}
          </button>
          <button
            onClick={() => setUseTargetLang(false)}
            className="px-2.5 py-1 rounded-md transition-all"
            style={{
              background: !useTargetLang ? "var(--bg-hover)" : "transparent",
              border: `1px solid ${!useTargetLang ? "var(--river)" : "var(--border)"}`,
              color: !useTargetLang ? "var(--river)" : "var(--text-dim)",
            }}
          >
            {learner.native_language}
          </button>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3 items-center mb-6">
        {!listening && !processing ? (
          <button
            onClick={startListening}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--moss)", color: "white" }}
          >
            Start Listening
          </button>
        ) : listening ? (
          <button
            onClick={stopListening}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--ember)", color: "white" }}
          >
            Stop &amp; Transcribe
          </button>
        ) : null}

        {listening && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: "var(--ember)", animation: "pulse 1.5s ease-in-out infinite" }}
            />
            Recording
            <span className="font-mono" style={{ color: "var(--text)" }}>
              {formatTime(duration)}
            </span>
          </div>
        )}

        {processing && (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
            <span
              className="w-4 h-4 rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--river)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
            />
            Transcribing {formatTime(duration)} of audio... (this can take up to a minute)
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          className="rounded-lg p-3 mb-4 text-sm border"
          style={{ background: "var(--bg-card)", borderColor: "var(--ember)", color: "var(--ember)" }}
        >
          {errorMsg}
        </div>
      )}

      {/* Live text while recording */}
      {listening && liveText && (
        <div
          className="rounded-lg p-3 mb-4 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-xs mb-1 font-medium" style={{ color: "var(--text-dim)" }}>
            Live preview
          </p>
          <p className="text-sm italic" style={{ color: "var(--text)", opacity: 0.7 }}>
            {liveText}
          </p>
        </div>
      )}

      {/* Speaker picker */}
      {picking && !mySpeaker && speakers.length > 0 && (
        <div
          className="rounded-lg p-4 mb-6 border"
          style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: "var(--text)" }}>
            Which speaker are you?
          </p>
          <div className="flex gap-2 flex-wrap">
            {speakers.map((s) => (
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
        style={{ maxHeight: "calc(100vh - 420px)" }}
      >
        {utterances.length === 0 && !listening && !processing && (
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
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
