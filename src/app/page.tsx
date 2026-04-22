import Link from "next/link";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* ─── Hero ─── */}
      <div className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.badgeGreen}>●</span> A language tutor with a
          memory
        </div>
        <h1 className={styles.heroTitle}>
          open<span className={styles.accent}>-</span>language
        </h1>
        <p className={styles.subtitle}>
          Every word you ask about, every mistake you keep making, every topic
          you love &mdash; it remembers. ChatGPT doesn&apos;t.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/chat" className={styles.ctaPrimary}>
            Try it free
            <Arrow />
          </Link>
        </div>
        <p className={styles.heroNote}>
          Sign in with Google. Takes 10 seconds.
        </p>
      </div>

      {/* ─── ChatGPT comparison ─── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>
          ChatGPT forgets.{" "}
          <span className={styles.dim}>open-language doesn&apos;t.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Every AI chatbot starts from scratch. Every session, forever.
          open-language is the one that takes notes.
        </p>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard} data-kind="dim">
            <div className={styles.compareHead}>
              <span className={styles.compareIconBad}>✗</span>
              <span className={styles.compareTitle}>ChatGPT &amp; friends</span>
            </div>
            <ul className={styles.compareList}>
              <li>Forgets every word you asked last time</li>
              <li>Same small talk, every session</li>
              <li>No sense of your actual level</li>
              <li>Can&apos;t quiz you on a thing</li>
            </ul>
          </div>
          <div className={styles.compareCard} data-kind="accent">
            <div className={styles.compareHead}>
              <span className={styles.compareIconGood}>✓</span>
              <span className={styles.compareTitle}>open-language</span>
            </div>
            <ul className={styles.compareList}>
              <li>Saves every word you look up</li>
              <li>Talks about things you actually like</li>
              <li>Tracks the mistakes you keep making</li>
              <li>Quizzes you on words you&apos;re forgetting</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ─── What it remembers ─── */}
      <section className={styles.section}>
        <h2 className={styles.h2}>
          Picks up right{" "}
          <span className={styles.dim}>where you left off.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Three things that compound every time you come back.
        </p>

        <div className={styles.memoryGrid}>
          <div className={styles.memoryCard}>
            <div className={styles.memoryLabel} data-color="gold">
              Words you asked about
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>
                柿 <span className={styles.memoryPron}>(kaki)</span>
              </span>
              <span className={styles.memoryMeaning}>persimmon</span>
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>
                空気を読む{" "}
                <span className={styles.memoryPron}>(kuuki o yomu)</span>
              </span>
              <span className={styles.memoryMeaning}>reading the room</span>
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>
                懐かしい{" "}
                <span className={styles.memoryPron}>(natsukashii)</span>
              </span>
              <span className={styles.memoryMeaning}>
                that nostalgic feeling
              </span>
            </div>
            <div className={styles.memoryMeta}>
              12 added this week · 3 due for review
            </div>
          </div>

          <div className={styles.memoryCard}>
            <div className={styles.memoryLabel} data-color="ember">
              Mistakes you keep making
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>は vs が</span>
              <span className={styles.memoryCount}>×7</span>
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>Past-tense endings</span>
              <span className={styles.memoryCount}>×5</span>
            </div>
            <div className={styles.memoryEntry}>
              <span className={styles.memoryWord}>Keigo slip-ups</span>
              <span className={styles.memoryCount}>×3</span>
            </div>
            <div className={styles.memoryMeta}>
              Grouped by root cause, not random slip-ups
            </div>
          </div>

          <div className={styles.memoryCard}>
            <div className={styles.memoryLabel} data-color="moss">
              Stuff you&apos;re into
            </div>
            <div className={styles.memoryTags}>
              <span>Anime</span>
              <span>Ramen</span>
              <span>Tokyo trip</span>
              <span>Yoga</span>
              <span>Coffee shops</span>
              <span>Dogs</span>
            </div>
            <div className={styles.memoryMeta}>
              So conversations never feel like homework
            </div>
          </div>
        </div>

        <div className={styles.quizCard}>
          <div className={styles.quizHead}>
            <span className={styles.quizBadge}>Quick quiz</span>
            <span className={styles.quizMeta}>
              You asked about this 3 days ago
            </span>
          </div>
          <div className={styles.quizQ}>
            Remember what <span className={styles.quizWord}>柿</span> means?
          </div>
          <div className={styles.quizOptions}>
            <span className={styles.quizOpt}>A. pear</span>
            <span className={styles.quizOpt} data-correct="true">
              B. persimmon
            </span>
            <span className={styles.quizOpt}>C. apple</span>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className={styles.section}>
        <div className={styles.closer}>
          <h2 className={styles.h2}>
            Say something{" "}
            <span className={styles.dim}>in Japanese.</span>
          </h2>
          <p className={styles.closerNote}>
            English &harr; Japanese. On your phone or your laptop. Free to
            start.
          </p>
          <Link href="/chat" className={styles.ctaPrimary}>
            Try it free
            <Arrow />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <p className={styles.footerTitle}>open-language</p>
        <p className={styles.footerDesc}>
          A language tutor that remembers your 柿 from last Tuesday.
        </p>
        <p className={styles.footerTech}>
          Open source &middot;{" "}
          <a
            href="https://github.com/jeeminhan/open-language"
            target="_blank"
            rel="noreferrer"
            className={styles.footerLink}
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

/* ─── Small helpers ─── */

function Arrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
