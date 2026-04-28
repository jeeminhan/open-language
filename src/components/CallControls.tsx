"use client";

interface Props {
  muted: boolean;
  captionsOn: boolean;
  onToggleMute: () => void;
  onToggleCaptions: () => void;
  onEnd: () => void;
  disabled?: boolean;
}

export default function CallControls({
  muted,
  captionsOn,
  onToggleMute,
  onToggleCaptions,
  onEnd,
  disabled = false,
}: Props) {
  return (
    <div className="flex items-center justify-around px-4 pt-3 pb-5">
      <ControlButton
        label={muted ? "muted" : "mic"}
        onClick={onToggleMute}
        disabled={disabled}
        variant={muted ? "muted" : "live"}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      >
        <MicIcon muted={muted} />
      </ControlButton>

      <ControlButton
        label={captionsOn ? "CC on" : "CC"}
        onClick={onToggleCaptions}
        disabled={disabled}
        variant={captionsOn ? "gold" : "neutral"}
        aria-label={captionsOn ? "Hide captions" : "Show captions"}
      >
        <CCIcon />
      </ControlButton>

      <ControlButton
        label="end"
        onClick={onEnd}
        variant="end"
        aria-label="End call"
      >
        <PhoneDownIcon />
      </ControlButton>
    </div>
  );
}

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant: "live" | "muted" | "gold" | "neutral" | "end";
  "aria-label": string;
  children: React.ReactNode;
}

function ControlButton({
  label,
  onClick,
  disabled,
  variant,
  "aria-label": ariaLabel,
  children,
}: ControlButtonProps) {
  const size = variant === "end" ? 72 : 64;
  const color = (() => {
    switch (variant) {
      case "end":
        return "var(--paper, #0a0a0f)";
      case "muted":
        return "var(--ember)";
      case "gold":
        return "var(--gold)";
      default:
        return "var(--text)";
    }
  })();
  const borderColor = (() => {
    switch (variant) {
      case "end":
        return "var(--ember)";
      case "muted":
        return "var(--ember)";
      case "gold":
        return "var(--gold)";
      default:
        return "var(--text-dim)";
    }
  })();
  const background = (() => {
    switch (variant) {
      case "end":
        return "var(--ember)";
      case "gold":
        return "rgba(196,185,154,0.08)";
      case "live":
        return "rgba(255,255,255,0.04)";
      default:
        return "transparent";
    }
  })();

  return (
    <div className="relative flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className="flex items-center justify-center transition-transform active:scale-[0.94] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `1.5px solid ${borderColor}`,
          background,
          color,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {children}
      </button>
      <span
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          fontFamily: "var(--font-caveat), cursive",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      {muted && <line x1="4" y1="4" x2="20" y2="20" />}
    </svg>
  );
}

function CCIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 11h3M7 14h3M14 11h3M14 14h3" />
    </svg>
  );
}

function PhoneDownIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 14c3-3 7-4.5 9-4.5S18 11 21 14l-2 2-3-2v-2.5a12 12 0 0 0-8 0V14l-3 2z" transform="rotate(135 12 12)" />
    </svg>
  );
}
