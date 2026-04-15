"use client";
import { useState } from "react";
import { SourcePicker } from "./components/SourcePicker";

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
    <main className="mx-auto max-w-2xl p-6">
      <p>Session {sessionId} — player coming in Task 5</p>
    </main>
  );
}
