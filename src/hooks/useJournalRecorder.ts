"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface JournalRecorderReturn {
  /** Whether currently recording */
  recording: boolean;
  /** Seconds elapsed */
  duration: number;
  /** Live interim text from Web Speech API */
  interimText: string;
  /** Finalized text segments from Web Speech API */
  segments: string[];
  /** Start recording */
  start: (languageCode?: string) => Promise<void>;
  /** Stop recording and return audio as base64 PCM */
  stop: () => Promise<string | null>;
}

export function useJournalRecorder(): JournalRecorderReturn {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [interimText, setInterimText] = useState("");
  const [segments, setSegments] = useState<string[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Int16Array[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch { /* */ }
      if (workletRef.current) { workletRef.current.port.close(); workletRef.current.disconnect(); }
      if (sourceRef.current) sourceRef.current.disconnect();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const start = useCallback(async (languageCode?: string) => {
    // Audio capture
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
    setSegments([]);
    setInterimText("");
    setDuration(0);
    setRecording(true);

    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);

    // Local Web Speech API for live text
    const SR = typeof window !== "undefined"
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    if (SR) {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = languageCode || "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = "";
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (finalText.trim()) {
          setSegments((prev) => [...prev, finalText.trim()]);
        }
        setInterimText(interim);
      };
      recognition.onerror = () => {};
      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          try { recognition.start(); } catch { /* */ }
        }
      };
      try { recognition.start(); recognitionRef.current = recognition; } catch { /* */ }
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Stop speech recognition
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try { r.stop(); } catch { /* */ }
    }
    setInterimText("");

    // Stop audio capture
    if (workletRef.current) { workletRef.current.port.close(); workletRef.current.disconnect(); workletRef.current = null; }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null; }
    if (mediaStreamRef.current) { mediaStreamRef.current.getTracks().forEach((t) => t.stop()); mediaStreamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }

    setRecording(false);

    // Merge chunks to base64
    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (chunks.length === 0) return null;

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
    return btoa(binary);
  }, []);

  return { recording, duration, interimText, segments, start, stop };
}
