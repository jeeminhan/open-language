import Link from "next/link";

/**
 * Shown when a page requires a local SQLite database that isn't available
 * (e.g. when deployed to Vercel).
 */
export default function LocalOnly() {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "4rem auto",
        textAlign: "center",
        padding: "2.5rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
      }}
    >
      <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>&#x1F4BB;</div>
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          marginBottom: "0.75rem",
        }}
      >
        Local dashboard
      </h2>
      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "0.9rem",
          lineHeight: 1.6,
          marginBottom: "1.5rem",
        }}
      >
        This page reads from your local SQLite database, which is only available
        when running the dashboard on your machine. To see your progress data,
        run:
      </p>
      <code
        style={{
          display: "inline-block",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "0.5rem 1.25rem",
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem",
          color: "var(--gold)",
        }}
      >
        cd dashboard && npm run dev
      </code>
      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
        <Link
          href="/chat"
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: 10,
            background: "var(--gold)",
            color: "var(--bg)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Try the web tutor
        </Link>
        <Link
          href="/"
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
