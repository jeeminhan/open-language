"use client";

interface RecapModalProps {
  summary: string;
  vocabUnknown: string[];
  vocabTranscript: string[];
  interactionCount: number;
  onStartAnother: () => void;
  onClose: () => void;
}

export function RecapModal({
  summary,
  vocabUnknown,
  vocabTranscript,
  interactionCount,
  onStartAnother,
  onClose,
}: RecapModalProps) {
  const totalVocab = vocabUnknown.length + vocabTranscript.length;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded shadow-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">Session recap</h2>
        <p className="text-xs text-gray-500">
          {interactionCount}{" "}
          {interactionCount === 1 ? "question" : "questions"} asked
          {totalVocab > 0 && ` · ${totalVocab} vocab saved`}
        </p>
        <div className="whitespace-pre-wrap text-sm">{summary}</div>
        {vocabUnknown.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">
              New vocab (flagged by tutor)
            </p>
            <ul className="text-sm list-disc pl-5">
              {vocabUnknown.map((w) => (
                <li key={`u-${w}`}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {vocabTranscript.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-700 mb-1">
              From the transcript
            </p>
            <ul className="text-sm list-disc pl-5 grid grid-cols-2 gap-x-4">
              {vocabTranscript.map((w) => (
                <li key={`t-${w}`}>{w}</li>
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
