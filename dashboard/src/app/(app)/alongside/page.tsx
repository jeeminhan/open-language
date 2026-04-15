"use client";
import { useEffect, useRef, useState } from "react";
import { SourcePicker } from "./components/SourcePicker";
import { PlayerBar } from "./components/PlayerBar";
import { TranscriptPane } from "./components/TranscriptPane";
import { TutorPanel, type TutorPanelHandle } from "./components/TutorPanel";
import { RecapModal } from "./components/RecapModal";
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

  return (
    <AlongsideSession
      sessionId={sessionId}
      onReset={() => setSessionId(null)}
    />
  );
}

interface RecapState {
  summary: string;
  vocab: string[];
  interactionCount: number;
}

function AlongsideSession({
  sessionId,
  onReset,
}: {
  sessionId: string;
  onReset: () => void;
}) {
  const [data, setData] = useState<SessionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recap, setRecap] = useState<RecapState | null>(null);
  const [ending, setEnding] = useState(false);
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

  async function endSession(): Promise<void> {
    if (ending || recap) return;
    setEnding(true);
    audioRef.current?.pause();
    try {
      const res = await fetch("/api/alongside/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          summary: string;
          vocab: string[];
          interaction_count: number;
        };
        setRecap({
          summary: json.summary,
          vocab: json.vocab,
          interactionCount: json.interaction_count,
        });
      } else {
        setRecap({
          summary: "Session ended. Recap unavailable.",
          vocab: [],
          interactionCount: 0,
        });
      }
    } catch {
      setRecap({
        summary: "Session ended. Recap unavailable.",
        vocab: [],
        interactionCount: 0,
      });
    } finally {
      setEnding(false);
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleEnded = () => {
      void endSession();
    };
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
    // Depend on data?.audio_url so this re-runs after the <audio> element mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.audio_url, ending, recap]);

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
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-4rem)] p-4">
        <div className="flex flex-col min-h-0">
          <h2 className="text-lg font-medium mb-2 truncate">
            {data.session.title ?? "Untitled"}
          </h2>
          <div className="flex items-center gap-2">
            <PlayerBar audioRef={audioRef} audioUrl={data.audio_url} />
            <button
              type="button"
              disabled={ending || recap !== null}
              onClick={() => void endSession()}
              className="shrink-0 px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              {ending ? "Ending…" : "End session"}
            </button>
          </div>
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
      {recap && (
        <RecapModal
          summary={recap.summary}
          vocab={recap.vocab}
          interactionCount={recap.interactionCount}
          onClose={() => setRecap(null)}
          onStartAnother={onReset}
        />
      )}
    </>
  );
}
