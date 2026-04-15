"use client";
import type { RefObject } from "react";

interface PlayerBarProps {
  audioRef: RefObject<HTMLAudioElement | null>;
  audioUrl: string;
}

export function PlayerBar({ audioRef, audioUrl }: PlayerBarProps) {
  return (
    <audio
      ref={audioRef}
      src={audioUrl}
      controls
      preload="metadata"
      className="w-full"
    />
  );
}
