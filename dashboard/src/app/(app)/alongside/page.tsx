"use client";
import { useEffect, useRef, useState } from "react";
import { SourcePicker } from "./components/SourcePicker";
import { PlayerBar } from "./components/PlayerBar";
import { TranscriptPane } from "./components/TranscriptPane";
import { TutorPanel, type TutorPanelHandle } from "./components/TutorPanel";
import { useTimedTranscript, type Segment } from "./hooks/useTimedTranscript";

interface SessionMeta {
  id: string;
  title: string | null;
  duration_sec: number | null;
}

interface SessionData {
  session: SessionMeta;
  segments: Segment[];
  audio_url: string | null;
}

export default function AlongsidePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Listen alongside</h1>
        <p className="text-sm text-gray-600 mb-6">
          Upload any audio file. Your tutor follows along in the sidebar while you listen.
        </p>
        <SourcePicker onReady={setSessionId} />
      </main>
    );
  }

  return <AlongsideSession sessionId={sessionId} />;
}

function AlongsideSession({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tutorRef = useRef<TutorPanelHandle>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/alongside/session/${sessionId}`);
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as SessionData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const { audioRef, activeSegmentId, seek } = useTimedTranscript(data?.segments ?? []);

  if (loadError) return <main className="p-6 text-red-600">{loadError}</main>;
  if (!data) return <main className="p-6">Loading…</main>;
  if (!data.audio_url) {
    return (
      <main className="p-6 text-gray-600">
        Audio is no longer available for this session.
      </main>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-4rem)] p-4">
      <div className="flex flex-col min-h-0">
        <h2 className="text-lg font-medium mb-2 truncate">{data.session.title ?? "Untitled"}</h2>
        <PlayerBar audioRef={audioRef} audioUrl={data.audio_url} />
        <div className="flex-1 overflow-hidden mt-4 border rounded">
          <TranscriptPane
            segments={data.segments}
            activeSegmentId={activeSegmentId}
            onSeek={seek}
            onAsk={(segment) => {
              audioRef.current?.pause();
              tutorRef.current?.prefill(`Explain: ${segment.text}`);
            }}
          />
        </div>
      </div>
      <aside className="border rounded p-2 overflow-hidden">
        <TutorPanel
          ref={tutorRef}
          sessionId={sessionId}
          getCurrentTime={() => audioRef.current?.currentTime ?? 0}
          onPause={() => audioRef.current?.pause()}
        />
      </aside>
    </div>
  );
}
