import Link from "next/link";

interface ModeCard {
  href: string;
  title: string;
  tagline: string;
  description: string;
  accent: string;
}

const MODES: ModeCard[] = [
  {
    href: "/chat/learn/roleplay/coffee",
    title: "Role-play",
    tagline: "Rehearse real situations",
    description:
      "Step into a scenario — order coffee, check into a hotel — and talk until the goal is met.",
    accent: "var(--ember)",
  },
  {
    href: "/chat/learn/drill",
    title: "Drill",
    tagline: "Make words stick",
    description:
      "Fast voice reps on words already in your review queue. Use each one in a real sentence, get graded, move on.",
    accent: "var(--moss)",
  },
  {
    href: "/chat/learn/guided/te-kudasai",
    title: "Guided lesson",
    tagline: "Teach me something",
    description:
      "A mini lesson: brief explanation, a few practice prompts, then a short role-play to use what you just learned.",
    accent: "var(--river)",
  },
];

export default function LearnModePicker() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Learning mode
        </h1>
        <p className="text-sm text-[color:var(--text-dim)] max-w-xl">
          Three ways to practice beyond free conversation. Each one hooks into
          your vocabulary queue, so what you learn here shows up in review.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {MODES.map((mode) => (
          <li key={mode.href}>
            <Link
              href={mode.href}
              className="card block h-full focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]"
              style={{ borderTopColor: mode.accent, borderTopWidth: 2 }}
            >
              <div className="space-y-3">
                <div>
                  <div
                    className="text-xs uppercase tracking-widest"
                    style={{ color: mode.accent }}
                  >
                    {mode.tagline}
                  </div>
                  <div className="text-lg font-semibold mt-1">{mode.title}</div>
                </div>
                <p className="text-sm text-[color:var(--text-dim)]">
                  {mode.description}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
