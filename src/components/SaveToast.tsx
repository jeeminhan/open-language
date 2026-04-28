"use client";

interface Props {
  word: string;
  onDismiss?: () => void;
}

/**
 * Mid-call "saved to Review" pill. Slides up from the bottom edge above the
 * controls, auto-dismisses after a short window. Tap to dismiss early.
 */
export default function SaveToast({ word, onDismiss }: Props) {
  return (
    <div className="save-toast" role="status" aria-live="polite">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="dismiss"
        className="save-toast-inner"
      >
        <span className="save-toast-dot" aria-hidden="true" />
        <span className="save-toast-body">
          <span className="save-toast-label">saved to Review</span>
          <span className="save-toast-word">{word}</span>
        </span>
      </button>
    </div>
  );
}
