import Link from "next/link";
import styles from "./landing.module.css";

const weekOneTags = [
  { word: "カップ", meta: "#2,184", tone: "gold", x: 18, y: 56 },
  { word: "お会計", meta: "#871", tone: "moss", x: 64, y: 63 },
  { word: "ください", meta: "N5", tone: "river", x: 42, y: 31 },
];

const weekFourTags = [
  { word: "カップ", meta: "#2,184", tone: "gold", kept: true, x: 13, y: 55 },
  { word: "お会計", meta: "#871", tone: "moss", kept: true, x: 63, y: 63 },
  { word: "アイス少なめ", meta: "learner phrase", tone: "moss", x: 44, y: 77 },
  { word: "おかわり", meta: "#1,940", tone: "gold", x: 27, y: 40 },
  { word: "常連", meta: "#3,402", tone: "river", x: 72, y: 34 },
  { word: "ホット", meta: "top-1000", tone: "gold", x: 9, y: 24 },
  { word: "おでん", meta: "winter menu", tone: "ember", x: 78, y: 55 },
  { word: "〜ちゃう", meta: "N4 casual", tone: "river", x: 49, y: 19 },
];

export default function LandingPage() {
  return (
    <main className={styles.landing}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroShell}>
          <div className={styles.copy}>
            <p className={styles.kicker}>Yuki · Japanese tutor · Koenji, 7:04am</p>
            <h1 id="landing-title" className={styles.title}>
              A coffee shop you keep coming back to, in{" "}
              <span>Japanese</span>.
            </h1>
            <p className={styles.subtitle}>
              Pick a scene. Learn it word by word. The barista uses it next
              time.
            </p>
          </div>

          <div className={styles.stage} aria-label="The same Japanese coffee shop in week one and week four">
            <CafeFrame
              label="week 1"
              caption="first call"
              tags={weekOneTags}
              density="sparse"
            />
            <div className={styles.thread} aria-hidden="true">
              <span>every lesson goes in here</span>
            </div>
            <CafeFrame
              label="week 4"
              caption="eighth call"
              tags={weekFourTags}
              density="full"
            />
          </div>

          <div className={styles.ctaRow} aria-label="Start open-language">
            <Link href="/login" className={styles.ctaPrimary}>
              <GoogleMark />
              <span>Sign in with Google</span>
            </Link>
            <Link href="/home" className={styles.ctaSecondary}>
              try one call without signing in
            </Link>
            <Link href="/demo" className={styles.ctaSecondary}>
              watch the 60-second demo
            </Link>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>open-language</span>
        <a href="https://github.com/jeeminhan/open-language" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <Link href="/about/data">data sources</Link>
      </footer>
    </main>
  );
}

function CafeFrame({
  label,
  caption,
  tags,
  density,
}: {
  label: string;
  caption: string;
  tags: Array<{
    word: string;
    meta: string;
    tone: string;
    kept?: boolean;
    x: number;
    y: number;
  }>;
  density: "sparse" | "full";
}) {
  const isFull = density === "full";

  return (
    <div className={styles.frame} data-density={density}>
      <div className={styles.frameHeader}>
        <span>{label}</span>
        <small>{caption}</small>
      </div>

      <div className={styles.cafeScene}>
        <div className={styles.window}>
          <span>高円寺</span>
        </div>
        <div className={styles.lamp} />
        <div className={styles.menuBoard}>
          <span>menu</span>
          <b>コーヒー</b>
          <b>ラテ</b>
          <b>トースト</b>
          {isFull && (
            <>
              <b>ホット</b>
              <b>おでん</b>
              <b>おかわり</b>
            </>
          )}
        </div>
        <div className={styles.barista} />
        <div className={styles.counter}>
          <i />
          <i />
          {isFull && (
            <>
              <i />
              <i />
              <i />
            </>
          )}
        </div>
        <div className={styles.register} />
        {isFull && (
          <>
            <div className={styles.regular} />
            <div className={styles.coat} />
            <div className={styles.doorCustomer} />
            <div className={styles.noteOne}>you ordered less ice yesterday</div>
            <div className={styles.noteTwo}>〜ちゃう showed up again</div>
          </>
        )}
        <div className={styles.noteSeed}>ordered with ください</div>

        {tags.map((tag) => (
          <div
            key={`${label}-${tag.word}`}
            className={styles.vocabTag}
            data-tone={tag.tone}
            data-kept={tag.kept ? "true" : undefined}
            style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
          >
            <strong>{tag.word}</strong>
            <em>{tag.meta}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
