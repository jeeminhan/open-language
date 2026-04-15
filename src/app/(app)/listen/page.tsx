"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { getLanguageCode } from "@/lib/languages";

interface Utterance {
  id: string;
  speaker: string;
  text: string;
  mine: boolean;
}

const CHUNK_MS = 10 * 60 * 1000; // 10 min per chunk
const MAX_MS = 30 * 60 * 1000;   // 30 min cap

interface LearnerInfo {
  target_language?: string;
  native_language?: string;
}

let idCounter = 0;
function nextId() { return `u_${Date.now()}_${++idCounter}`; }

// Pause threshold (ms) above which we assume speaker switched
const SPEAKER_SWITCH_MS = 1500;

export default function ListenPage() {
  const [listening, setListening] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [liveText, setLiveText] = useState("");
  const [chooseMode, setChooseMode] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<{ sessionId?: string; errorsFound?: number; sentencesAnalyzed?: number } | null>(null);
  const [duration, setDuration] = useState(0);
  const [learner, setLearner] = useState<LearnerInfo>({});
  const [useTargetLang, setUseTargetLang] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    fetch("/api/learner")
      .then((r) => r.json())
      .then((d) => { if (d && typeof d === "object") setLearner(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (!SR) setSupported(false);
  }, []);

  const activeLanguage = useTargetLang
    ? learner.target_language || "Korean"
    : learner.native_language || "English";
  const sttLang = getLanguageCode(activeLanguage) || "en-US";

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastFinalAtRef = useRef<number>(0);
  const currentSpeakerRef = useRef<"A" | "B">("A");

  // Gemini long-recording state
  const [geminiRecording, setGeminiRecording] = useState(false);
  const [geminiProcessing, setGeminiProcessing] = useState(false);
  const [geminiDuration, setGeminiDuration] = useState(0);
  const [geminiStatus, setGeminiStatus] = useState<string>("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunkBlobsRef = useRef<Blob[]>([]);
  const completedChunksRef = useRef<Blob[]>([]);
  const geminiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRequestedRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [utterances, liveText]);

  const startListening = useCallback(() => {
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (!SR) { setErrorMsg("Speech recognition not supported in this browser. Try Chrome on desktop or Safari on iOS."); return; }

    setUtterances([]);
    setLiveText("");
    setAnalysis(null);
    setAnalysisMeta(null);
    setChooseMode(false);
    setDuration(0);
    setErrorMsg(null);
    lastFinalAtRef.current = 0;
    currentSpeakerRef.current = "A";

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = sttLang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript.trim();
        if (result.isFinal) {
          if (!transcript) continue;
          const now = Date.now();
          const gap = lastFinalAtRef.current ? now - lastFinalAtRef.current : 0;
          if (lastFinalAtRef.current && gap > SPEAKER_SWITCH_MS) {
            currentSpeakerRef.current = currentSpeakerRef.current === "A" ? "B" : "A";
          }
          lastFinalAtRef.current = now;
          const speaker = currentSpeakerRef.current;
          setUtterances((prev) => [...prev, { id: nextId(), speaker, text: transcript, mine: false }]);
        } else {
          interim += transcript + " ";
        }
      }
      setLiveText(interim.trim());
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setErrorMsg(`Recognition error: ${e.error}`);
    };

    recognition.onend = () => {
      // Auto-restart while listening flag is still on
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* */ }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to start recognition.");
    }
  }, [sttLang]);

  const stopListening = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (r) { try { r.stop(); } catch { /* */ } }
    setListening(false);
    setLiveText("");
    setChooseMode(true);
  }, []);

  const toggleMine = useCallback((id: string) => {
    setUtterances((prev) => prev.map((u) => u.id === id ? { ...u, mine: !u.mine } : u));
  }, []);

  const selectAllSpeaker = useCallback((speaker: string) => {
    setUtterances((prev) => prev.map((u) => ({ ...u, mine: u.speaker === speaker })));
  }, []);

  const analyzeMine = useCallback(async () => {
    const myTexts = utterances.filter((u) => u.mine).map((u) => u.text);
    if (myTexts.length === 0) { setErrorMsg("Tap your lines first, then analyze."); return; }
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/listen/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: myTexts }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || "No analysis available.");
      setAnalysisMeta({ sessionId: data.sessionId, errorsFound: data.errorsFound, sentencesAnalyzed: data.sentencesAnalyzed });
    } catch {
      setAnalysis("Failed to analyze.");
      setAnalysisMeta(null);
    }
    setAnalyzing(false);
  }, [utterances]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const speakerColor = (speaker: string) => {
    if (speaker === "A" || speaker === "Speaker 1") return "var(--river)";
    if (speaker === "B" || speaker === "Speaker 2") return "var(--moss)";
    return "var(--ember)";
  };
  const mineCount = utterances.filter((u) => u.mine).length;

  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const transcribeChunk = useCallback(async (blob: Blob, mime: string, idx: number, total: number): Promise<Utterance[]> => {
    setGeminiStatus(`Transcribing chunk ${idx + 1}/${total}...`);
    const base64 = await blobToBase64(blob);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85000);
    try {
      const res = await fetch("/api/listen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, language: activeLanguage, mimeType: mime }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chunk ${idx + 1} failed (${res.status})`);
      }
      const data = await res.json();
      const arr = Array.isArray(data.utterances) ? data.utterances : [];
      return arr.map((u: { speaker: string; text: string }) => ({
        id: nextId(),
        speaker: u.speaker || "Speaker 1",
        text: u.text,
        mine: false,
      }));
    } finally {
      clearTimeout(timer);
    }
  }, [activeLanguage]);

  const processCollectedChunks = useCallback(async () => {
    const blobs = completedChunksRef.current;
    completedChunksRef.current = [];
    if (blobs.length === 0) { setGeminiProcessing(false); setGeminiStatus(""); return; }
    const mime = blobs[0].type || "audio/webm";
    const collected: Utterance[] = [];
    try {
      for (let i = 0; i < blobs.length; i++) {
        const us = await transcribeChunk(blobs[i], mime, i, blobs.length);
        collected.push(...us);
        setUtterances([...collected]);
      }
      setGeminiStatus("");
      setChooseMode(true);
    } catch (err) {
      const e = err as Error;
      setErrorMsg(e.message || "Transcription failed.");
      setGeminiStatus("");
    }
    setGeminiProcessing(false);
  }, [transcribeChunk]);

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const startNewRecorder = useCallback((stream: MediaStream): MediaRecorder => {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const mimeType = types.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) || "";
    const rec = mimeType
      ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 })
      : new MediaRecorder(stream, { audioBitsPerSecond: 32000 });

    chunkBlobsRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunkBlobsRef.current.push(e.data);
    };
    rec.onstop = () => {
      const parts = chunkBlobsRef.current;
      chunkBlobsRef.current = [];
      if (parts.length > 0) {
        const blob = new Blob(parts, { type: parts[0].type || mimeType || "audio/webm" });
        completedChunksRef.current.push(blob);
      }
      // If user hasn't stopped and we haven't hit max, start the next chunk
      if (!stopRequestedRef.current && geminiDuration * 1000 < MAX_MS) {
        const next = startNewRecorder(stream);
        mediaRecorderRef.current = next;
        next.start();
        chunkTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current === next && next.state === "recording") next.stop();
        }, CHUNK_MS);
      } else {
        // Final stop — clean up and process
        stopMediaTracks();
        if (geminiTimerRef.current) { clearInterval(geminiTimerRef.current); geminiTimerRef.current = null; }
        setGeminiRecording(false);
        setGeminiProcessing(true);
        processCollectedChunks();
      }
    };
    return rec;
  }, [geminiDuration, processCollectedChunks]);

  const startGeminiRecording = useCallback(async () => {
    if (typeof MediaRecorder === "undefined") {
      setErrorMsg("MediaRecorder not supported in this browser.");
      return;
    }
    setErrorMsg(null);
    setUtterances([]);
    setAnalysis(null);
    setAnalysisMeta(null);
    setChooseMode(false);
    setGeminiDuration(0);
    setGeminiStatus("");
    completedChunksRef.current = [];
    stopRequestedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;
      const rec = startNewRecorder(stream);
      mediaRecorderRef.current = rec;
      rec.start();
      setGeminiRecording(true);
      geminiTimerRef.current = setInterval(() => {
        setGeminiDuration((d) => {
          const next = d + 1;
          if (next * 1000 >= MAX_MS) {
            stopRequestedRef.current = true;
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
              mediaRecorderRef.current.stop();
            }
          }
          return next;
        });
      }, 1000);
      // First chunk rotation
      chunkTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current === rec && rec.state === "recording") rec.stop();
      }, CHUNK_MS);
    } catch (err) {
      console.error(err);
      setErrorMsg("Microphone permission denied.");
    }
  }, [startNewRecorder]);

  const stopGeminiRecording = useCallback(() => {
    stopRequestedRef.current = true;
    if (chunkTimerRef.current) { clearTimeout(chunkTimerRef.current); chunkTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    } else {
      stopMediaTracks();
      if (geminiTimerRef.current) { clearInterval(geminiTimerRef.current); geminiTimerRef.current = null; }
      setGeminiRecording(false);
      setGeminiProcessing(true);
      processCollectedChunks();
    }
  }, [processCollectedChunks]);

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-lg font-bold mb-1" style={{ color: "var(--river)" }}>
        Passive Listening
      </h2>
      <p className="text-sm mb-6" style={{ color: "var(--text-dim)" }}>
        I&apos;ll transcribe live in your browser (free, no upload). After, tap your lines and I&apos;ll give feedback.
      </p>

      {!supported && (
        <div className="rounded-lg p-3 mb-4 text-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--ember)", color: "var(--ember)" }}>
          Your browser doesn&apos;t support live speech recognition. Use Chrome (desktop) or Safari (iOS).
        </div>
      )}

      {/* Language toggle */}
      {learner.target_language && learner.native_language && !listening && utterances.length === 0 && (
        <div className="flex gap-2 mb-4 text-xs items-center">
          <span style={{ color: "var(--text-dim)" }}>Language:</span>
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
      <div className="flex gap-3 items-center mb-4 flex-wrap">
        {!listening ? (
          <button
            onClick={startListening}
            disabled={!supported}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ background: supported ? "var(--moss)" : "var(--border)", color: "white" }}
          >
            {utterances.length > 0 ? "Restart" : "Start Listening"}
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
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--ember)", animation: "pulse 1.5s ease-in-out infinite" }} />
            Recording <span className="font-mono" style={{ color: "var(--text)" }}>{formatTime(duration)}</span>
          </div>
        )}

        {!listening && utterances.length > 0 && (
          <button
            onClick={() => setChooseMode((v) => !v)}
            className="px-3 py-2 rounded-lg text-sm font-medium border transition-all"
            style={{
              background: chooseMode ? "var(--gold)" : "transparent",
              borderColor: "var(--gold)",
              color: chooseMode ? "var(--bg)" : "var(--gold)",
            }}
          >
            {chooseMode ? "Done choosing" : "Choose my lines"}
          </button>
        )}
      </div>

      {/* Choose mode helpers */}
      {chooseMode && utterances.length > 0 && (
        <div
          className="rounded-lg p-3 mb-4 border text-xs"
          style={{ background: "var(--bg-card)", borderColor: "var(--gold)" }}
        >
          <p className="mb-2" style={{ color: "var(--text)" }}>
            Tap any line to mark it as yours. <span style={{ color: "var(--gold)" }}>{mineCount}</span> selected.
          </p>
          <div className="flex gap-2 flex-wrap">
            {[...new Set(utterances.map((u) => u.speaker))].map((sp) => (
              <button
                key={sp}
                onClick={() => selectAllSpeaker(sp)}
                className="px-2.5 py-1 rounded border"
                style={{ borderColor: speakerColor(sp), color: speakerColor(sp) }}
              >
                All {sp.length === 1 ? `Speaker ${sp}` : sp}
              </button>
            ))}
            <button
              onClick={() => setUtterances((prev) => prev.map((u) => ({ ...u, mine: false })))}
              className="px-2.5 py-1 rounded border"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Analyze button */}
      {!listening && utterances.length > 0 && !chooseMode && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={analyzeMine}
            disabled={analyzing || mineCount === 0}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "var(--gold)", color: "var(--bg)" }}
          >
            {analyzing ? "Analyzing..." : `Analyze My Speech (${mineCount})`}
          </button>
          {mineCount === 0 && (
            <span className="text-xs" style={{ color: "var(--text-dim)" }}>
              Choose your lines first
            </span>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg p-3 mb-4 text-sm border" style={{ background: "var(--bg-card)", borderColor: "var(--ember)", color: "var(--ember)" }}>
          {errorMsg}
        </div>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="rounded-lg p-4 mb-6 border" style={{ background: "var(--bg-card)", borderColor: "var(--gold)" }}>
          <div className="flex items-baseline justify-between mb-2 gap-2 flex-wrap">
            <h3 className="text-sm font-bold" style={{ color: "var(--gold)" }}>Analysis</h3>
            {analysisMeta && (
              <div className="text-xs flex gap-3" style={{ color: "var(--text-dim)" }}>
                {analysisMeta.sentencesAnalyzed != null && <span>{analysisMeta.sentencesAnalyzed} sentences</span>}
                {analysisMeta.errorsFound != null && <span>{analysisMeta.errorsFound} errors saved</span>}
                {analysisMeta.sessionId && (
                  <a href={`/sessions/${analysisMeta.sessionId}`} style={{ color: "var(--river)" }}>view session →</a>
                )}
              </div>
            )}
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>
            {analysis}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="space-y-2 overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 360px)" }}
      >
        {utterances.length === 0 && !listening && (
          <p className="text-sm" style={{ color: "var(--text-dim)" }}>
            No transcript yet. Start listening to begin.
          </p>
        )}
        {utterances.map((u) => {
          const isMine = u.mine;
          return (
            <button
              key={u.id}
              onClick={() => chooseMode && toggleMine(u.id)}
              disabled={!chooseMode}
              className="w-full flex gap-3 items-start text-left rounded-lg p-2 transition-all"
              style={{
                background: isMine ? "var(--bg-hover)" : "transparent",
                border: `1px solid ${isMine ? "var(--gold)" : "transparent"}`,
                cursor: chooseMode ? "pointer" : "default",
              }}
            >
              <span
                className="text-xs font-mono font-bold shrink-0 mt-0.5 px-2 py-0.5 rounded"
                style={{
                  color: isMine ? "var(--gold)" : speakerColor(u.speaker),
                  background: "var(--bg-hover)",
                  minWidth: "70px",
                  textAlign: "center",
                }}
              >
                {isMine ? "You" : (u.speaker.length === 1 ? `Speaker ${u.speaker}` : u.speaker)}
              </span>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {u.text}
              </p>
            </button>
          );
        })}
        {listening && liveText && (
          <div className="flex gap-3 items-start opacity-60 p-2">
            <span
              className="text-xs font-mono font-bold shrink-0 mt-0.5 px-2 py-0.5 rounded"
              style={{ color: "var(--text-dim)", background: "var(--bg-hover)", minWidth: "70px", textAlign: "center" }}
            >
              ...
            </span>
            <p className="text-sm leading-relaxed italic" style={{ color: "var(--text-dim)" }}>
              {liveText}
            </p>
          </div>
        )}
      </div>

      {/* Gemini long-recording section */}
      <div
        className="mt-8 rounded-lg p-4 border"
        style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-bold mb-1" style={{ color: "var(--gold)" }}>
          High-quality mode (Gemini, paid)
        </h3>
        <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
          Records up to 30 min, splits into 10-min chunks, and uploads to Gemini for accurate
          transcription with real speaker diarization. ~$0.06 per 30 min.
        </p>

        <div className="flex gap-3 items-center flex-wrap">
          {!geminiRecording && !geminiProcessing ? (
            <button
              onClick={startGeminiRecording}
              disabled={listening}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: "var(--gold)", color: "var(--bg)" }}
            >
              Start HQ Recording
            </button>
          ) : geminiRecording ? (
            <button
              onClick={stopGeminiRecording}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
              style={{ background: "var(--ember)", color: "white" }}
            >
              Stop &amp; Transcribe
            </button>
          ) : null}

          {geminiRecording && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--gold)", animation: "pulse 1.5s ease-in-out infinite" }} />
              <span className="font-mono" style={{ color: "var(--text)" }}>{formatTime(geminiDuration)}</span>
              <span style={{ color: "var(--text-dim)" }}> / 30:00</span>
            </div>
          )}

          {geminiProcessing && (
            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-dim)" }}>
              <span
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: "var(--gold)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }}
              />
              {geminiStatus || "Processing..."}
            </div>
          )}
        </div>
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
