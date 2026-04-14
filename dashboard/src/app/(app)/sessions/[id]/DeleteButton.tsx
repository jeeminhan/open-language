"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm("Delete this session? Aggregated grammar/vocab stats will remain but this transcript will be removed.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) {
        alert("Failed to delete session.");
        setBusy(false);
        return;
      }
      router.push("/sessions");
      router.refresh();
    } catch {
      alert("Failed to delete session.");
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="text-xs px-3 py-1.5 rounded border transition-colors"
      style={{
        color: "var(--ember)",
        borderColor: "var(--border)",
        background: "transparent",
        opacity: busy ? 0.5 : 1,
      }}
    >
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
