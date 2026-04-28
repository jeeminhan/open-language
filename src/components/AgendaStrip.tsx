"use client";

export type AgendaKind = "listening" | "drill" | "roleplay" | "guided" | "leveltest";

export interface DrillState {
  word: string;
  gloss?: string;
  index: number;
  total: number;
  /** Per-position result. Positions without an entry are pending (or "current" if i === index). */
  results: Array<"pass" | "fail" | undefined>;
}

export interface RoleplayState {
  scenario: string;
  goalLabel: string;
  goalMet: boolean;
}

export interface GuidedState {
  topic: string;
  step: number;
  total: number;
}

export interface LevelTestState {
  step: number;
  total: number;
}

interface Props {
  kind: AgendaKind;
  tutorName: string;
  flag?: string;
  callDurationLabel: string;
  drill?: DrillState;
  roleplay?: RoleplayState;
  guided?: GuidedState;
  levelTest?: LevelTestState;
}

export default function AgendaStrip({
  kind,
  tutorName,
  flag,
  callDurationLabel,
  drill,
  roleplay,
  guided,
  levelTest,
}: Props) {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <TutorLine name={tutorName} flag={flag} durationLabel={callDurationLabel} />
      {kind === "listening" && <ListeningBody />}
      {kind === "drill" && drill && <DrillBody state={drill} />}
      {kind === "roleplay" && roleplay && <RoleplayBody state={roleplay} />}
      {kind === "guided" && guided && <GuidedBody state={guided} />}
      {kind === "leveltest" && levelTest && <LevelTestBody state={levelTest} />}
    </div>
  );
}

function TutorLine({
  name,
  flag,
  durationLabel,
}: {
  name: string;
  flag?: string;
  durationLabel: string;
}) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <div
        className="flex items-center gap-1.5"
        style={{ fontSize: 11, color: "var(--text-dim)" }}
      >
        {flag && <span>{flag}</span>}
        <span>{name}</span>
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-dim)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        {durationLabel}
      </div>
    </div>
  );
}

function ListeningBody() {
  return (
    <div
      className="px-1.5"
      style={{
        fontSize: 11,
        color: "var(--text-dim)",
        opacity: 0.7,
        textAlign: "center",
        fontStyle: "italic",
        letterSpacing: "0.08em",
      }}
    >
      …listening
    </div>
  );
}

function DrillBody({ state }: { state: DrillState }) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <span
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Drill · word {state.index + 1}/{state.total}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: state.total }).map((_, i) => {
          const result = state.results[i];
          const isCurrent = i === state.index && !result;
          let background: string;
          let border: string;
          if (result === "pass") {
            background = "var(--moss)";
            border = "none";
          } else if (result === "fail") {
            background = "var(--ember)";
            border = "none";
          } else if (isCurrent) {
            background = "var(--gold)";
            border = "none";
          } else {
            background = "transparent";
            border = "1px solid var(--border)";
          }
          return (
            <span
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background,
                border,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function RoleplayBody({ state }: { state: RoleplayState }) {
  return (
    <div className="flex items-center justify-between gap-2 px-1.5">
      <span style={{ fontSize: 11, color: "var(--text)" }}>
        <span
          style={{
            color: "var(--text-dim)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginRight: 4,
          }}
        >
          Role-play ·
        </span>
        {state.scenario}
      </span>
      <span
        style={{
          fontSize: 10,
          padding: "2px 9px",
          borderRadius: 99,
          border: `1px solid ${state.goalMet ? "var(--moss)" : "var(--border)"}`,
          color: state.goalMet ? "var(--moss)" : "var(--text-dim)",
          background: state.goalMet ? "rgba(107,154,91,0.08)" : "transparent",
          whiteSpace: "nowrap",
        }}
      >
        {state.goalMet ? "✓ " : ""}
        {state.goalLabel}
      </span>
    </div>
  );
}

function GuidedBody({ state }: { state: GuidedState }) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <span style={{ fontSize: 11, color: "var(--text)" }}>
        <span
          style={{
            color: "var(--text-dim)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            marginRight: 4,
          }}
        >
          Lesson ·
        </span>
        {state.topic}
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-dim)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        {state.step} / {state.total}
      </span>
    </div>
  );
}

function LevelTestBody({ state }: { state: LevelTestState }) {
  return (
    <div className="flex items-center justify-between px-1.5">
      <span
        style={{
          fontSize: 11,
          color: "var(--text)",
          letterSpacing: "0.02em",
        }}
      >
        <span
          style={{
            color: "var(--text-dim)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Assessing your level
        </span>
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--gold)",
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        }}
      >
        {state.step} / {state.total}
      </span>
    </div>
  );
}
