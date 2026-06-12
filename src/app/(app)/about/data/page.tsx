const sources = [
  {
    name: "JMdict",
    role: "Japanese headwords, readings, glosses, and priority tags.",
    license: "CC BY-SA 4.0",
    url: "https://www.edrdg.org/jmdict/edict_doc.html",
  },
  {
    name: "KANJIDIC2",
    role: "Kanji readings, JLPT metadata, frequency rank, and stroke count.",
    license: "CC BY-SA 4.0",
    url: "https://www.edrdg.org/kanjidic/kanjidic2.html",
  },
  {
    name: "JPDB frequency list",
    role: "Modern Japanese frequency rank used by the picker.",
    license: "Freely downloadable, attribution required.",
    url: "https://jpdb.io",
  },
  {
    name: "Tatoeba",
    role: "Japanese and English example sentence pairs.",
    license: "CC BY 2.0 FR",
    url: "https://tatoeba.org/en/downloads",
  },
  {
    name: "UniDic",
    role: "Japanese morphological analysis for tagging examples and learner input.",
    license: "BSD-style NINJAL license",
    url: "https://clrd.ninjal.ac.jp/unidic/",
  },
];

export default function DataAttributionPage() {
  return (
    <div className="max-w-3xl space-y-8 py-6">
      <section>
        <p
          className="mb-2 text-xs uppercase tracking-[0.16em]"
          style={{ color: "var(--gold)" }}
        >
          Japanese curriculum data
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Open sources, pinned snapshots.
        </h1>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-dim)" }}
        >
          open-language uses source-derived Japanese data for vocabulary,
          kanji, frequency ranks, and example sentences. Processed
          JMdict/KANJIDIC2-derived data is published under CC BY-SA 4.0.
          Authored grammar notes are written in-house.
        </p>
      </section>

      <section className="space-y-3">
        {sources.map((source) => (
          <a
            key={source.name}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg p-4 transition-colors"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>
                {source.name}
              </h2>
              <span
                className="font-mono text-[11px]"
                style={{ color: "var(--text-dim)" }}
              >
                {source.license}
              </span>
            </div>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "var(--text-dim)" }}
            >
              {source.role}
            </p>
          </a>
        ))}
      </section>

      <section
        className="rounded-lg p-4 text-sm leading-relaxed"
        style={{
          background: "rgba(196,185,154,0.06)",
          border: "1px solid rgba(196,185,154,0.18)",
          color: "var(--text-dim)",
        }}
      >
        Raw downloads live in gitignored `data/raw/`. Committed processed
        snapshots live in `data/processed/`, and authored grammar lives in
        `data/generated/`.
      </section>
    </div>
  );
}
