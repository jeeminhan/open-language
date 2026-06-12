import Link from "next/link";
import { cookies } from "next/headers";
import { getAuthUserId } from "@/lib/auth";
import {
  getDueGrammar,
  getDueVocab,
  getLearner,
  getNextCurriculumLesson,
  getSessions,
} from "@/lib/db";
import { buildScene, itemDisplayText, recallModeLabel } from "@/lib/scenes/builder";
import ScenePlayer from "./ScenePlayer";

export const dynamic = "force-dynamic";

export default async function ScenePage() {
  const cookieStore = await cookies();
  const learnerId = cookieStore.get("active_learner")?.value;
  const userId = await getAuthUserId();
  const learner = await getLearner(learnerId, userId ?? undefined);

  if (!learner) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          No learner profile found. Start from home first.
        </p>
      </div>
    );
  }

  if (!learner.target_language.toLowerCase().includes("japanese")) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          Scene mode is available for Japanese learners first.
        </p>
      </div>
    );
  }

  const [dueVocab, dueGrammar, lessonPlan, sessions] = await Promise.all([
    getDueVocab(learner.id, 8),
    getDueGrammar(learner.id, 5),
    getNextCurriculumLesson(learner, {
      scenarioId: "quest-scene",
      scenarioLabel: "Japanese mystery quest scene",
      scenarioTags: ["mystery", "plans", "travel", "everyday"],
      vocabBudget: 5,
      grammarBudget: 1,
    }),
    getSessions(learner.id, 200),
  ]);

  const completedSceneCount = sessions.filter((session) => session.mode === "scene").length;
  const scene = buildScene({
    learner,
    dueVocab,
    dueGrammar,
    lessonPlan,
    completedSceneCount,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p
              className="mb-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--gold)" }}
            >
              quest scene {scene.questReward.clueNumber}/{scene.questReward.totalClues}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {scene.title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
              {scene.location}
            </p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/dashboard" style={{ color: "var(--river)" }}>
              dashboard
            </Link>
            <Link href="/call" style={{ color: "var(--river)" }}>
              call
            </Link>
          </div>
        </div>

        <p className="max-w-3xl text-sm leading-relaxed" style={{ color: "var(--text)" }}>
          {scene.storyContext}
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            label="new lesson"
            value={scene.focusLesson.target}
            sub={scene.focusLesson.meaning}
            color="var(--gold)"
          />
          <Metric
            label="review load"
            value={`${scene.sessionDefaults.reviewItems} items`}
            sub={`${scene.sessionDefaults.activeTargets} active · ${scene.sessionDefaults.passiveTargets} passive`}
            color="var(--river)"
          />
          <Metric
            label="reward"
            value={`${scene.questReward.xp} XP`}
            sub={scene.questReward.title}
            color="var(--moss)"
          />
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <TargetList
          title="Active Targets"
          items={scene.activeRecallTargets.map((item) => ({
            key: "target" in item ? item.id : item.id,
            label: itemDisplayText(item),
            detail: "meaning" in item ? item.meaning : "",
          }))}
          color="var(--gold)"
        />
        <TargetList
          title="Passive Targets"
          items={scene.passiveRecallTargets.map((item) => ({
            key: item.id,
            label: itemDisplayText(item),
            detail: recallModeLabel(item.mode),
          }))}
          color="var(--river)"
        />
      </section>

      <ScenePlayer scene={scene} />
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="text-xs uppercase tracking-[0.12em]" style={{ color }}>
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs leading-snug" style={{ color: "var(--text-dim)" }}>
        {sub}
      </div>
    </div>
  );
}

function TargetList({
  title,
  items,
  color,
}: {
  title: string;
  items: Array<{ key: string; label: string; detail: string }>;
  color: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <h2 className="text-sm font-semibold" style={{ color }}>
        {title}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.key}
            className="rounded-md px-2.5 py-1.5 text-xs"
            style={{
              background: "rgba(224,221,213,0.04)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            title={item.detail}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
