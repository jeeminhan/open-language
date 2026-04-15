"use client";

interface RecapModalProps {
  summary: string;
  vocab: string[];
  interactionCount: number;
  onStartAnother: () => void;
  onClose: () => void;
}

export function RecapModal({
  summary,
  vocab,
  interactionCount,
  onStartAnother,
  onClose,
}: RecapModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-lg max-w-lg w-full p-6 space-y-4">
        <h2 className="text-lg font-semibold">Session recap</h2>
        <p className="text-xs text-gray-500">
          {interactionCount}{" "}
          {interactionCount === 1 ? "question" : "questions"} asked
          {vocab.length > 0 && ` · ${vocab.length} vocab saved`}
        </p>
        <div className="whitespace-pre-wrap text-sm">{summary}</div>
        {vocab.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">New vocab</p>
            <ul className="text-sm list-disc pl-5">
              {vocab.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            className="px-3 py-1 text-sm border rounded"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="px-3 py-1 text-sm border rounded bg-black text-white"
            onClick={onStartAnother}
          >
            Start another
          </button>
        </div>
      </div>
    </div>
  );
}
