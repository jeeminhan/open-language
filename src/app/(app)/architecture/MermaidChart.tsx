"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidChartProps {
  source: string;
  id?: string;
}

export function MermaidChart({ source, id = "pipeline-diagram" }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
        });

        const renderId = `${id}-${Date.now()}`;
        const { svg } = await mermaid.render(renderId, source);

        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Render failed";
        setError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, id]);

  if (error) {
    return (
      <div
        className="rounded-lg p-4 text-xs font-mono"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
      >
        Mermaid render error: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg p-6 overflow-x-auto flex justify-center"
      style={{ background: "#ffffff" }}
    />
  );
}
