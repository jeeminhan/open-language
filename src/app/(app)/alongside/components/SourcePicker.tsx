"use client";
import { useState } from "react";

interface SourcePickerProps {
  onReady: (sessionId: string) => void;
}

export function SourcePicker({ onReady }: SourcePickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  async function handleFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      setStatus("Uploading…");
      const fd = new FormData();
      fd.append("audio", file);
      const ingestRes = await fetch("/api/alongside/ingest", {
        method: "POST",
        body: fd,
      });
      if (!ingestRes.ok) {
        const text = await ingestRes.text();
        throw new Error(`Upload failed: ${text}`);
      }
      const { session_id } = (await ingestRes.json()) as { session_id: string };

      setStatus("Transcribing… this can take up to a minute.");
      const transRes = await fetch("/api/alongside/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id }),
      });
      if (!transRes.ok) {
        const text = await transRes.text();
        throw new Error(`Transcription failed: ${text}`);
      }

      onReady(session_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium mb-1">Upload audio file</span>
        <input
          type="file"
          accept="audio/*,video/mp4"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="block w-full text-sm"
        />
      </label>
      {busy && <p className="text-sm text-gray-600">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
