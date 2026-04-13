"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

type Step = "email" | "code";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage(`We sent a code to ${email}`);
      setStep("code");
    }
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    if (next) {
      window.location.href = next;
    } else {
      const res = await fetch("/api/learners");
      const learners = await res.json();
      window.location.href =
        Array.isArray(learners) && learners.length > 0 ? "/chat" : "/onboarding";
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--gold)" }}>
            open-language
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-dim)" }}>
            {step === "email" ? "Sign in with your email" : "Enter the code we sent you"}
          </p>
        </div>

        {step === "email" ? (
          <form onSubmit={handleSendCode} className="space-y-3">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />

            {error && <p className="text-xs px-1" style={{ color: "var(--ember)" }}>{error}</p>}
            {message && <p className="text-xs px-1" style={{ color: "var(--moss)" }}>{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--river)", color: "white", opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="12345678"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
              autoFocus
              maxLength={8}
              className="w-full rounded-xl px-4 py-3 text-lg text-center font-mono tracking-[0.4em] outline-none"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text)",
              }}
            />

            {error && <p className="text-xs px-1" style={{ color: "var(--ember)" }}>{error}</p>}
            {message && <p className="text-xs px-1" style={{ color: "var(--moss)" }}>{message}</p>}

            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "var(--river)",
                color: "white",
                opacity: loading || code.length < 6 ? 0.6 : 1,
              }}
            >
              {loading ? "Verifying..." : "Verify code"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
                setMessage(null);
              }}
              className="w-full text-xs underline"
              style={{ color: "var(--text-dim)" }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
