"use client";
import type { Segment } from "../hooks/useTimedTranscript";

interface TranscriptPaneProps {
  segments: Segment[];
  activeSegmentId: number | null;
  onSeek: (sec: number) => void;
  onAsk: (segment: Segment) => void;
}

export function TranscriptPane({
  segments,
  activeSegmentId,
  onSeek,
  onAsk,
}: TranscriptPaneProps) {
  return (
    <ol className="space-y-2 overflow-y-auto h-full px-2 py-1">
      {segments.map((s) => {
        const active = s.id === activeSegmentId;
        return (
          <li
            key={s.id}
            className={
              active
                ? "bg-yellow-100 p-2 rounded transition-colors"
                : "p-2 rounded hover:bg-gray-50"
            }
          >
            <button
              type="button"
              className="text-xs text-gray-500 mr-2 underline-offset-2 hover:underline"
              onClick={() => onSeek(s.start_sec)}
              aria-label={`Seek to ${formatTime(s.start_sec)}`}
            >
              {formatTime(s.start_sec)}
            </button>
            {s.speaker && (
              <span className="text-xs font-semibold text-gray-700 mr-1">
                {s.speaker}:
              </span>
            )}
            <span>{s.text}</span>
            <button
              type="button"
              className="ml-2 text-xs underline text-blue-600 hover:text-blue-800"
              onClick={() => onAsk(s)}
            >
              ask
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
