"use client";

import { useMemo, useState } from "react";
import type { Scene, SceneEvaluation } from "@/lib/scenes/types";
import { evaluateSceneAttempt } from "@/lib/scenes/evaluator";

interface Props {
  scene: Scene;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ScenePlayer({ scene }: Props) {
  const [drillAnswer, setDrillAnswer] = useState("");
  const [roleplayAnswer, setRoleplayAnswer] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<SceneEvaluation | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const draftEvaluation = useMemo(
    () => evaluateSceneAttempt(scene, { drillAnswer, roleplayAnswer, quizAnswers }),
    [scene, drillAnswer, roleplayAnswer, quizAnswers]
  );

  const drill = scene.drillPrompts[0];
  const roleplayPassed = draftEvaluation.checks.some(
    (check) =>
      check.mode === "active" &&
      check.text === scene.focusLesson.target &&
      check.evidence === roleplayAnswer &&
      check.correct
  );

  function setQuizAnswer(id: string, value: string) {
    setQuizAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function finishScene() {
    const finalEvaluation = evaluateSceneAttempt(scene, {
      drillAnswer,
      roleplayAnswer,
      quizAnswers,
    });
    setEvaluation(finalEvaluation);
    setSaveState("saving");

    try {
      const res = await fetch("/api/scenes/result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.id,
          sceneTitle: scene.title,
          checks: finalEvaluation.checks,
          xpEarned: finalEvaluation.xpEarned,
          quizCorrect: finalEvaluation.quizCorrect,
          quizTotal: finalEvaluation.quizTotal,
          clueNumber: scene.questReward.clueNumber,
          totalClues: scene.questReward.totalClues,
        }),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <SectionTitle eyebrow="lesson" title={scene.focusLesson.title} color="var(--gold)" />
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
              {scene.focusLesson.meaning}
            </div>
            <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: "rgba(196,185,154,0.08)", color: "var(--gold)" }}>
              {scene.focusLesson.formation}
            </div>
          </div>
          <div className="space-y-2">
            {scene.focusLesson.examples.map((example) => (
              <div
                key={example}
                className="rounded-md px-3 py-2 text-sm"
                style={{ background: "rgba(224,221,213,0.04)", border: "1px solid var(--border)" }}
              >
                {example}
              </div>
            ))}
            {scene.focusLesson.commonMistakes.slice(0, 1).map((mistake) => (
              <div key={mistake} className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
                {mistake}
              </div>
            ))}
          </div>
        </div>
      </section>

      {drill && (
        <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <SectionTitle eyebrow="drill" title="Focused Story Prompt" color="var(--river)" />
          <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
            {drill.prompt}
          </p>
          <TextArea
            value={drillAnswer}
            onChange={setDrillAnswer}
            placeholder="日本語で一文..."
          />
          {drillAnswer.trim() && (
            <InlineResult
              ok={draftEvaluation.checks[0]?.correct === true}
              okText="Target appeared naturally enough for this prototype check."
              badText={drill.expectedUsage}
            />
          )}
        </section>
      )}

      <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <SectionTitle eyebrow="roleplay" title={scene.roleplayScenario.characterName} color="var(--moss)" />
        <p className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
          {scene.roleplayScenario.characterRole}
        </p>

        <div className="mt-4 space-y-3">
          <Dialogue role={scene.roleplayScenario.characterName} text={scene.roleplayScenario.openingLine} />
          <TextArea
            value={roleplayAnswer}
            onChange={setRoleplayAnswer}
            placeholder={`${scene.focusLesson.target} を使って答える...`}
          />
          {roleplayAnswer.trim() && (
            <>
              <Dialogue
                role={scene.roleplayScenario.characterName}
                text={
                  roleplayPassed
                    ? `${scene.questReward.title}に近づきましたね。${scene.roleplayScenario.passiveLines[1] ?? "次の手がかりを見せます。"}`
                    : `いいですね。次は ${scene.focusLesson.target} を入れて、もう少し自然に言ってみましょう。`
                }
              />
              <InlineResult
                ok={roleplayPassed}
                okText={`${scene.focusLesson.target} was detected in your roleplay answer.`}
                badText={`${scene.focusLesson.target} has not been detected yet.`}
              />
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <SectionTitle eyebrow="quiz" title="Recall Check" color="var(--ember)" />
        <div className="mt-4 space-y-4">
          {scene.quiz.map((question, index) => (
            <div key={question.id} className="rounded-lg p-4" style={{ background: "rgba(224,221,213,0.03)", border: "1px solid var(--border)" }}>
              <div className="text-xs uppercase tracking-[0.12em]" style={{ color: "var(--text-dim)" }}>
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="mt-1 text-sm" style={{ color: "var(--text)" }}>
                {question.prompt}
              </div>
              {question.type === "short_answer" ? (
                <input
                  value={quizAnswers[question.id] ?? ""}
                  onChange={(event) => setQuizAnswer(question.id, event.target.value)}
                  className="mt-3 w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
                  placeholder="日本語で..."
                />
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(question.choices ?? []).map((choice) => {
                    const selected = quizAnswers[question.id] === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => setQuizAnswer(question.id, choice)}
                        className="rounded-md px-3 py-2 text-xs transition-colors"
                        style={{
                          background: selected ? "var(--river)" : "var(--bg)",
                          border: `1px solid ${selected ? "var(--river)" : "var(--border)"}`,
                          color: selected ? "white" : "var(--text)",
                        }}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
              {scene.questReward.title}
            </div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
              {scene.questReward.text}
            </div>
          </div>
          <button
            type="button"
            onClick={finishScene}
            disabled={saveState === "saving"}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{ background: "var(--moss)", color: "white" }}
          >
            {saveState === "saving" ? "Saving..." : "Complete Scene"}
          </button>
        </div>

        {evaluation && (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <ResultMetric label="active" value={`${evaluation.activeCorrect}/${evaluation.activeTotal}`} />
            <ResultMetric label="passive" value={`${evaluation.passiveCorrect}/${evaluation.passiveTotal}`} />
            <ResultMetric label="quiz" value={`${evaluation.quizCorrect}/${evaluation.quizTotal}`} />
            <ResultMetric label="xp" value={`+${evaluation.xpEarned}`} />
          </div>
        )}

        {saveState === "saved" && (
          <p className="mt-3 text-xs" style={{ color: "var(--moss)" }}>
            Scene saved. SRS and progress stats were updated.
          </p>
        )}
        {saveState === "error" && (
          <p className="mt-3 text-xs" style={{ color: "var(--ember)" }}>
            The local result is shown, but saving failed.
          </p>
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  color,
}: {
  eyebrow: string;
  title: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em]" style={{ color }}>
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </h2>
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={3}
      className="mt-3 w-full resize-none rounded-lg px-3 py-3 text-sm leading-relaxed outline-none"
      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
      placeholder={placeholder}
    />
  );
}

function Dialogue({ role, text }: { role: string; text: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: "rgba(91,126,154,0.08)", border: "1px solid rgba(91,126,154,0.22)" }}>
      <div className="text-xs font-semibold" style={{ color: "var(--river)" }}>
        {role}
      </div>
      <div className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
        {text}
      </div>
    </div>
  );
}

function InlineResult({
  ok,
  okText,
  badText,
}: {
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="mt-3 text-xs" style={{ color: ok ? "var(--moss)" : "var(--gold)" }}>
      {ok ? okText : badText}
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md px-3 py-2" style={{ background: "rgba(224,221,213,0.04)", border: "1px solid var(--border)" }}>
      <div className="text-xs" style={{ color: "var(--text-dim)" }}>
        {label}
      </div>
      <div className="mt-1 font-mono text-lg" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
