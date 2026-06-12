import Link from "next/link";
import { cookies } from "next/headers";
import {
  getCurriculumOverview,
  getLearner,
  type CurriculumGrammarLevel,
  type CurriculumStatusCounts,
  type CurriculumVocabBand,
} from "@/lib/db";
import { getAuthUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

const statusOrder: Array<keyof CurriculumStatusCounts> = [
  "mastered",
  "practiced",
  "introduced",
  "unknown",
];

const statusColors: Record<keyof CurriculumStatusCounts, string> = {
  mastered: "var(--moss)",
  practiced: "var(--river)",
  introduced: "var(--gold)",
  unknown: "var(--border)",
};

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function learnedCount(counts: CurriculumStatusCounts): number {
  return counts.mastered + counts.practiced + counts.introduced;
}

function statusCount(counts: CurriculumStatusCounts): number {
  return counts.unknown + counts.introduced + counts.practiced + counts.mastered;
}

export default async function CurriculumPage() {
  const cookieStore = await cookies();
  const activeLearner = cookieStore.get("active_learner")?.value;
  const userId = await getAuthUserId();
  const learner = await getLearner(activeLearner, userId ?? undefined);

  if (!learner) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          No learner profile found. Start a call first.
        </p>
      </div>
    );
  }

  const overview = await getCurriculumOverview(learner);
  if (!overview) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-dim)" }}>
          Curriculum map is available for Japanese learners first.
        </p>
      </div>
    );
  }

  const grammarTotal = overview.grammarLevels.reduce((sum, level) => sum + level.total, 0);
  const grammarLearned = overview.grammarLevels.reduce(
    (sum, level) => sum + learnedCount(level.counts),
    0
  );
  const vocabTotal = overview.vocabBands.reduce((sum, band) => sum + band.total, 0);
  const vocabLearned = overview.vocabBands.reduce(
    (sum, band) => sum + learnedCount(band.counts),
    0
  );

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="mb-2 text-xs uppercase tracking-[0.16em]"
              style={{ color: "var(--gold)" }}
            >
              Japanese curriculum map
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              The whole ladder, not just today&apos;s cards.
            </h1>
          </div>
          <div className="flex gap-2 text-xs">
            <Link href="/grammar" style={{ color: "var(--river)" }}>
              grammar →
            </Link>
            <Link href="/vocabulary" style={{ color: "var(--river)" }}>
              vocabulary →
            </Link>
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Grammar is the JLPT-anchored skeleton. Vocabulary is the JPDB frequency
          curve. Your state is layered on top as mastered, practiced,
          introduced, or still unknown.
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <Metric
            label="grammar touched"
            value={`${grammarLearned}/${grammarTotal}`}
            sub={`${percent(grammarLearned, grammarTotal)}% of mapped patterns`}
            color="var(--river)"
          />
          <Metric
            label="vocab touched"
            value={`${vocabLearned}/${vocabTotal}`}
            sub="top 10,000 frequency bands"
            color="var(--gold)"
          />
          <Metric
            label="snapshot"
            value={overview.snapshot?.tag ?? "starter"}
            sub={overview.fallback ? "fallback map" : "active picker snapshot"}
            color={overview.fallback ? "var(--ember)" : "var(--moss)"}
          />
        </div>
      </header>

      {overview.notes.length > 0 && (
        <div
          className="rounded-lg p-3 text-xs leading-relaxed"
          style={{
            background: overview.fallback
              ? "rgba(196, 94, 74, 0.08)"
              : "rgba(91, 126, 154, 0.08)",
            border: `1px solid ${overview.fallback ? "rgba(196, 94, 74, 0.24)" : "rgba(91, 126, 154, 0.22)"}`,
            color: "var(--text-dim)",
          }}
        >
          {overview.notes.join(" ")}
        </div>
      )}

      <section className="space-y-3">
        <SectionHeader
          title="Grammar Patterns"
          eyebrow="JLPT skeleton"
          description="Each row is a level band. The examples are representative entries from the catalog."
        />
        <div className="space-y-3">
          {overview.grammarLevels.map((level) => (
            <GrammarLevelRow key={level.level} level={level} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Vocabulary Frequency"
          eyebrow="JPDB rank bands"
          description="The picker walks this curve from high-frequency words toward lower-frequency words, filtered by scenario relevance."
        />
        <div className="space-y-3">
          {overview.vocabBands.map((band) => (
            <VocabBandRow key={band.id} band={band} />
          ))}
        </div>
      </section>

      <Legend />
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
      <div className="mt-2 font-mono text-2xl font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
        {sub}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em]" style={{ color: "var(--text-dim)" }}>
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        {description}
      </p>
    </div>
  );
}

function GrammarLevelRow({ level }: { level: CurriculumGrammarLevel }) {
  const total = Math.max(level.total, statusCount(level.counts));
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="grid gap-3 md:grid-cols-[92px_1fr] md:items-start">
        <div>
          <div className="font-mono text-2xl font-semibold" style={{ color: "var(--gold)" }}>
            {level.level}
          </div>
          <div className="text-xs leading-snug" style={{ color: "var(--text-dim)" }}>
            {level.label}
          </div>
        </div>
        <div className="space-y-3">
          <ProgressBar counts={level.counts} total={total} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span style={{ color: "var(--text-dim)" }}>
              {level.total} patterns · {level.reviewed} reviewed
            </span>
            <span className="font-mono" style={{ color: "var(--moss)" }}>
              {percent(learnedCount(level.counts), total)}% touched
            </span>
          </div>
          {level.samples.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {level.samples.map((sample) => (
                <span
                  key={sample}
                  className="rounded-md px-2 py-1 text-xs"
                  style={{
                    background: "rgba(224,221,213,0.04)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                >
                  {sample}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VocabBandRow({ band }: { band: CurriculumVocabBand }) {
  const total = Math.max(band.total, statusCount(band.counts));
  return (
    <div className="rounded-lg p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="grid gap-3 md:grid-cols-[150px_1fr] md:items-center">
        <div>
          <div className="font-mono text-sm" style={{ color: "var(--gold)" }}>
            {band.rangeLabel}
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: "var(--text)" }}>
            {band.label}
          </div>
        </div>
        <div className="space-y-2">
          <ProgressBar counts={band.counts} total={total} />
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            <span style={{ color: "var(--text-dim)" }}>
              {band.total} ranked items in this band
            </span>
            <span className="font-mono" style={{ color: "var(--moss)" }}>
              {percent(learnedCount(band.counts), total)}% touched
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  counts,
  total,
}: {
  counts: CurriculumStatusCounts;
  total: number;
}) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
      {statusOrder.map((status) => {
        const width = percent(counts[status], total);
        if (width <= 0) return null;
        return (
          <div
            key={status}
            title={`${status}: ${counts[status]}`}
            style={{
              width: `${width}%`,
              minWidth: width > 0 ? 2 : 0,
              background: statusColors[status],
            }}
          />
        );
      })}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-dim)" }}>
      {statusOrder.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: statusColors[status] }}
          />
          {status}
        </span>
      ))}
    </div>
  );
}
