"use client";
import { useEffect, useRef, useState } from "react";

export interface Segment {
  id: number;
  start_sec: number;
  end_sec: number;
  text: string;
  speaker?: string | null;
}

export function useTimedTranscript(segments: Segment[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  const activeSegmentId = findActive(segments, currentTime)?.id ?? null;

  return {
    audioRef,
    currentTime,
    playing,
    activeSegmentId,
    seek: (s: number) => {
      if (audioRef.current) audioRef.current.currentTime = s;
    },
    pause: () => audioRef.current?.pause(),
    play: () => audioRef.current?.play(),
  };
}

function findActive(segments: Segment[], t: number): Segment | undefined {
  return segments.find((s) => t >= s.start_sec && t < s.end_sec);
}
