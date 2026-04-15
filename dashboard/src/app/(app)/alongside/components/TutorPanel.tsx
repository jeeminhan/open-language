"use client";
import {
  FormEvent,
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";

interface Message {
  role: "user" | "tutor";
  text: string;
  vocab?: string[];
}

export interface TutorPanelHandle {
  prefill: (text: string) => void;
}

interface TutorPanelProps {
  sessionId: string;
  getCurrentTime: () => number;
  onPause: () => void;
}

export const TutorPanel = forwardRef<TutorPanelHandle, TutorPanelProps>(
  function TutorPanel({ sessionId, getCurrentTime, onPause }, ref) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const logRef = useRef<HTMLOListElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        prefill: (text: string) => {
          setInput(text);
          inputRef.current?.focus();
        },
      }),
      []
    );

    useEffect(() => {
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    }, [messages]);

    async function submit(e: FormEvent<HTMLFormElement>): Promise<void> {
      e.preventDefault();
      const text = input.trim();
      if (!text) return;
      onPause();
      setMessages((m) => [...m, { role: "user", text }]);
      setInput("");
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/alongside/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            user_message: text,
            at_sec: getCurrentTime(),
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          reply: string;
          vocab_saved?: string[];
        };
        setMessages((m) => [
          ...m,
          { role: "tutor", text: data.reply, vocab: data.vocab_saved },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "tutor failed");
      } finally {
        setBusy(false);
      }
    }

    return (
      <div className="flex flex-col h-full">
        <ol ref={logRef} className="flex-1 overflow-y-auto space-y-2 p-2">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "text-right" : ""}>
              <span
                className={
                  m.role === "user"
                    ? "inline-block bg-blue-100 px-2 py-1 rounded max-w-[85%] text-left"
                    : "inline-block bg-gray-100 px-2 py-1 rounded max-w-[85%]"
                }
              >
                {m.text}
              </span>
              {m.vocab && m.vocab.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Saved: {m.vocab.join(", ")}
                </div>
              )}
            </li>
          ))}
          {busy && <li className="text-xs text-gray-500">Thinking…</li>}
        </ol>
        {error && <p className="text-xs text-red-600 px-2">{error}</p>}
        <form onSubmit={submit} className="p-2 border-t flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 border rounded px-2 py-1 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about what you just heard…"
            disabled={busy}
          />
          <button
            type="submit"
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            disabled={busy || !input.trim()}
          >
            Ask
          </button>
        </form>
      </div>
    );
  }
);
