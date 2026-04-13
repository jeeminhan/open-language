import Link from "next/link";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.landing}>
      {/* ─── Hero ─── */}
      <div className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={styles.badgeGreen}>open source</span> &middot; CLI +
          Web &middot; Any language pair
        </div>
        <h1 className={styles.heroTitle}>
          open<span className={styles.accent}>-</span>language
        </h1>
        <p className={styles.subtitle}>
          An AI language tutor that remembers your mistakes, adapts to your
          level, and gets smarter every session.
        </p>
        <div className={styles.ctaRow}>
          <Link href="/chat" className={styles.ctaPrimary}>
            Try the web version
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
          </Link>
          <Link href="/dashboard" className={styles.ctaSecondary}>
            View dashboard
          </Link>
        </div>
      </div>

      {/* ─── Conversation demo ─── */}
      <section className={styles.section}>
        <SectionLabel color="gold">What It Does</SectionLabel>
        <h2 className={styles.h2}>
          Have a real conversation.{" "}
          <span className={styles.dim}>Get real feedback.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Talk to an AI tutor that corrects you like a good friend would —
          naturally, not robotically. It tracks every error, learns your weak
          points, and steers future conversations toward what you need to
          practice.
        </p>

        <div className={styles.terminal}>
          <div className={styles.terminalBar}>
            <span className={`${styles.dot} ${styles.dotRed}`} />
            <span className={`${styles.dot} ${styles.dotYellow}`} />
            <span className={`${styles.dot} ${styles.dotGreen}`} />
            <span className={styles.terminalTitle}>
              open-language — Session #14
            </span>
          </div>
          <div className={styles.terminalBody}>
            <Line>
              <Prompt>
                I goed to the store yesterday and buyed some fruits
              </Prompt>
            </Line>
            <Line blank />
            <Line>
              <Tutor />
            </Line>
            <Line>
              &nbsp;&nbsp;Oh nice! I{" "}
              <Gold bold>went</Gold> to the farmer&apos;s market last weekend
              too.
            </Line>
            <Line>
              &nbsp;&nbsp;What kind of fruit did you <Gold bold>buy</Gold>?
              I&apos;ve been really into
            </Line>
            <Line>&nbsp;&nbsp;persimmons lately.</Line>
            <Line blank />
            <Line>
              <Prompt>I buyed apples and some persimmon too!</Prompt>
            </Line>
            <Line blank />
            <Line>
              <Tutor />
            </Line>
            <Line>
              &nbsp;&nbsp;Persimmons are so good this time of year! Just a quick
            </Line>
            <Line>
              &nbsp;&nbsp;note — the past tense of &quot;buy&quot; is{" "}
              <Gold bold>&quot;bought&quot;</Gold>, not &quot;buyed&quot;.
            </Line>
            <Line>
              &nbsp;&nbsp;It&apos;s irregular, like go/went.{" "}
              <span className={styles.tDim}>
                (Korean doesn&apos;t have
              </span>
            </Line>
            <Line>
              <span className={styles.tDim}>
                &nbsp;&nbsp;irregular verbs, so this is a tricky one!)
              </span>
            </Line>
            <Line>&nbsp;&nbsp;Do you prefer the crunchy or soft kind?</Line>
          </div>
        </div>

        <p className={styles.caption}>
          First time → models correctly in response. Second time → recasts
          prominently. Third time → explains gently.
        </p>
      </section>

      {/* ─── Four Modes ─── */}
      <section className={styles.section}>
        <SectionLabel color="river">Four Modes</SectionLabel>
        <h2 className={styles.h2}>
          Chat, speak, journal, or just listen.{" "}
          <span className={styles.dim}>Your choice.</span>
        </h2>

        <div className={styles.modeGrid}>
          <ModeCard
            color="var(--gold)"
            icon="&gt;_"
            title="Chat"
            desc="Type back and forth. Great for focused grammar practice and studying on the go."
            items={[
              "Zero setup",
              "Highlight any word to save it",
              "Review corrections at your pace",
            ]}
          />
          <ModeCard
            color="var(--river)"
            icon="«))"
            title="Voice"
            desc="Speak and listen. Live Gemini voice with real-time transcription."
            items={[
              "Push-to-talk or hands-free",
              "Auto-pauses while tutor speaks",
              "Type mid-session if needed",
            ]}
          />
          <ModeCard
            color="var(--gold)"
            icon="&#x1F4D6;"
            title="Journal"
            desc="Write or talk freely with no interruptions. Corrections come after you're done."
            items={[
              "No mid-flow corrections",
              "Full error report when finished",
              "Builds fluency without anxiety",
            ]}
          />
          <ModeCard
            color="var(--moss)"
            icon="&#x1F3A7;"
            title="Listen"
            desc="Passive learning. Record real conversations, tag speakers, get everything analyzed."
            items={[
              "Browser or HQ Gemini mode",
              "Tap-to-tag speakers",
              "Errors + grammar saved to your profile",
            ]}
          />
        </div>
      </section>

      {/* ─── Journal Mode ─── */}
      <section className={styles.section}>
        <SectionLabel color="gold">Journal Mode</SectionLabel>
        <h2 className={styles.h2}>
          Write freely first.{" "}
          <span className={styles.dim}>Learn from mistakes after.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Journal mode flips the script: you speak or type your thoughts with
          zero interruptions. The tutor stays silent — just a quiet
          &quot;hmm&quot; or &quot;yeah&quot; so you know it&apos;s listening.
          When you&apos;re done, you get a full error report with corrections.
        </p>

        <div className={styles.journalGrid}>
          <div>
            <div className={styles.journalPage}>
              <div className={styles.journalDate}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                Thursday, April 10
              </div>
              <div className={styles.journalEntry}>
                <p>
                  오늘 회사에서 정말 바쁜 하루였어요. 아침부터 미팅이 많았고 점심도
                  제대로 못 먹었어요.
                </p>
                <p>
                  퇴근 후에 친구를 만나서 카페에 갔는데, 새로운 디저트를
                  먹어봤어요. 너무 맛있었어요!{" "}
                  <span className={styles.hmm}>응...</span>
                </p>
                <p>
                  요즘 한국어 공부가 좀 어려운 것 같아요. 특히 존댓말이랑 반말을
                  언제 써야 하는지 헷갈려요.{" "}
                  <span className={styles.hmm}>그렇군요</span>
                </p>
                <p>내일은 좀 더 여유로운 하루가 됐으면 좋겠어요.</p>
              </div>
            </div>
            <p className={styles.caption}>
              The tutor only gives tiny acknowledgments — like a diary that hums.
            </p>
          </div>

          <div>
            <div className={styles.feedbackBox}>
              <h4 className={styles.feedbackTitle}>Post-Journal Corrections</h4>
              <p className={styles.feedbackSubtitle}>
                These appear only after you press &quot;Done&quot; — never during
                writing.
              </p>

              <div className={styles.correction}>
                <span className={styles.arrow}>→</span>
                <div>
                  <span className={styles.strike}>바쁜 하루였어요</span>
                  <span className={styles.fix}>
                    {" "}
                    &nbsp;바쁜 하루를 보냈어요
                  </span>
                  <div className={styles.correctionNote}>
                    More natural phrasing — &quot;spent a busy day&quot; vs
                    &quot;it was a busy day&quot;
                  </div>
                </div>
              </div>

              <div className={styles.correction}>
                <span className={styles.arrow}>→</span>
                <div>
                  <span className={styles.strike}>됐으면</span>
                  <span className={styles.fix}> &nbsp;되었으면</span>
                  <div className={styles.correctionNote}>
                    Written Korean prefers the full form over the contracted
                    spoken form
                  </div>
                </div>
              </div>

              <div className={styles.wellDone}>
                <div className={styles.wellDoneTitle}>What you did well</div>
                <div className={styles.wellDoneList}>
                  <div>
                    + Natural use of —(으)ㄴ 것 같아요 for expressing uncertainty
                  </div>
                  <div>
                    + Correct honorific level throughout (polite —요 form)
                  </div>
                  <div>+ Good topic variety and sentence connectors</div>
                </div>
              </div>
            </div>

            <div className={styles.whyBox}>
              <div className={styles.whyTitle}>Why journal mode?</div>
              <div className={styles.whyList}>
                <div>
                  <span className={styles.whyNum}>1.</span> Builds fluency —
                  uninterrupted output trains your brain to produce language
                  without pausing
                </div>
                <div>
                  <span className={styles.whyNum}>2.</span> Reduces anxiety — no
                  fear of being corrected mid-thought
                </div>
                <div>
                  <span className={styles.whyNum}>3.</span> Better error quality
                  — reviewing corrections after writing is more effective than
                  real-time interruption
                </div>
                <div>
                  <span className={styles.whyNum}>4.</span> Captures natural
                  speech — errors in free expression reveal your true level
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Behind the scenes ─── */}
      <section className={styles.section}>
        <SectionLabel color="ember">Behind Every Turn</SectionLabel>
        <h2 className={styles.h2}>
          The tutor analyzes{" "}
          <span className={styles.dim}>everything you say.</span>
        </h2>
        <p className={styles.sectionDesc}>
          Every message you send is parsed for errors, grammar patterns,
          vocabulary, and fluency signals. This data feeds 9 learning loops that
          make the tutor smarter over time.
        </p>

        <div className={styles.twoUp}>
          <div className={styles.terminal} style={{ fontSize: "0.72rem" }}>
            <div className={styles.terminalBar}>
              <span className={`${styles.dot} ${styles.dotRed}`} />
              <span className={`${styles.dot} ${styles.dotYellow}`} />
              <span className={`${styles.dot} ${styles.dotGreen}`} />
              <span className={styles.terminalTitle}>
                analysis (hidden from learner)
              </span>
            </div>
            <div className={styles.terminalBody}>
              <Line>
                <span className={styles.tDim}>{"{"}</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"  "}
                  {'"errors"'}: [{"{"}{" "}
                </span>
              </Line>
              <Line>
                <span className={styles.tDim}>{"    "}&quot;type&quot;:</span>{" "}
                <span className={styles.tEmber}>
                  &quot;irregular_past_tense&quot;
                </span>
                <span className={styles.tDim}>,</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"    "}&quot;observed&quot;:
                </span>{" "}
                <span className={styles.tEmber}>&quot;buyed&quot;</span>
                <span className={styles.tDim}>,</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"    "}&quot;expected&quot;:
                </span>{" "}
                <span className={styles.tGreen}>&quot;bought&quot;</span>
                <span className={styles.tDim}>,</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"    "}&quot;l1_source&quot;:
                </span>{" "}
                <span className={styles.tRiver}>
                  &quot;Korean has regular
                </span>
              </Line>
              <Line>
                <span className={styles.tRiver}>
                  {"      "}conjugation — no irregular forms&quot;
                </span>
              </Line>
              <Line>
                <span className={styles.tDim}>{"  "}],</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"  "}&quot;correction_action&quot;:
                </span>{" "}
                <span className={styles.tGold}>&quot;recast&quot;</span>
                <span className={styles.tDim}>,</span>
              </Line>
              <Line>
                <span className={styles.tDim}>
                  {"  "}&quot;vocabulary_used&quot;:
                </span>{" "}
                <span className={styles.tCyan}>
                  [&quot;store&quot;,&quot;fruits&quot;]
                </span>
              </Line>
              <Line>
                <span className={styles.tDim}>{"}"}</span>
              </Line>
            </div>
          </div>

          <div>
            <h3 className={styles.trackTitle}>What gets tracked:</h3>
            <div className={styles.trackList}>
              <TrackItem color="var(--ember)" label="Errors">
                Categorized, counted, linked to L1 interference patterns
              </TrackItem>
              <TrackItem color="var(--moss)" label="Grammar">
                Correct and incorrect uses tracked for mastery percentage
              </TrackItem>
              <TrackItem color="var(--river)" label="Vocabulary">
                Every unique word logged, unknown words flagged for review
              </TrackItem>
              <TrackItem color="var(--gold)" label="Fluency">
                Hesitation, self-correction, code-switching, confidence
              </TrackItem>
              <TrackItem color="var(--moss)" label="Interests">
                Books, music, hobbies detected — used to personalize topics
              </TrackItem>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Learning Loops ─── */}
      <section className={styles.section}>
        <SectionLabel color="river">Self-Learning System</SectionLabel>
        <h2 className={styles.h2}>
          Feedback loops{" "}
          <span className={styles.dim}>that compound.</span>
        </h2>
        <p className={styles.sectionDesc}>
          The tutor clusters your errors by root cause, spaces them out for
          review, and adapts difficulty. Every session makes the next one
          better.
        </p>

        <div className={styles.flow}>
          {[
            { label: "You speak", color: "gold" },
            { label: "Errors detected", color: "ember" },
            { label: "Clustered & tagged", color: "river" },
            { label: "Tutor adapts", color: "moss" },
            { label: "Better next session", color: "gold" },
          ].map((step, i) => (
            <div key={i} className={styles.flowStep}>
              {i > 0 && <span className={styles.flowArrow}>→</span>}
              <span
                className={styles.flowNode}
                data-color={step.color}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.loopsGrid}>
          {[
            ["Adaptive Difficulty", "Computes your real level from grammar mastery and pushes harder content as you improve."],
            ["Spaced Repetition", "Prioritizes patterns you struggle with and steers conversation toward them."],
            ["L1 Interference", "Flags errors caused by native-language habits and explains why."],
            ["Error Clustering", "Groups related mistakes by root cause instead of treating them as isolated slip-ups."],
            ["Vocab Tracking", "Highlight a word to save it. Builds a personal dictionary over time."],
            ["Interest Profiling", "Detects what you actually like talking about, and generates topics from it."],
          ].map(([title, desc], i) => (
            <div key={i} className={styles.loopCard}>
              <span className={styles.loopNum}>{i + 1}</span>
              <div>
                <h4 className={styles.loopTitle}>{title}</h4>
                <p className={styles.loopDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Get Started ─── */}
      <section className={styles.section}>
        <SectionLabel color="moss">Get Started</SectionLabel>
        <h2 className={styles.h2}>
          Running in <span className={styles.dim}>under a minute.</span>
        </h2>

        <div className={styles.terminal} style={{ maxWidth: 620 }}>
          <div className={styles.terminalBar}>
            <span className={`${styles.dot} ${styles.dotRed}`} />
            <span className={`${styles.dot} ${styles.dotYellow}`} />
            <span className={`${styles.dot} ${styles.dotGreen}`} />
            <span className={styles.terminalTitle}>setup</span>
          </div>
          <div className={styles.terminalBody}>
            <Line>
              <span className={styles.tDim}># Clone and install</span>
            </Line>
            <Line>
              <span className={styles.tGold}>$</span> git clone
              https://github.com/jeeminhan/open-language
            </Line>
            <Line>
              <span className={styles.tGold}>$</span> cd open-language
            </Line>
            <Line>
              <span className={styles.tGold}>$</span> pip install -r
              requirements.txt
            </Line>
            <Line blank />
            <Line>
              <span className={styles.tDim}># Add your API key</span>
            </Line>
            <Line>
              <span className={styles.tGold}>$</span> echo
              &quot;LLM_API_KEY=your-key-here&quot; &gt; .env
            </Line>
            <Line blank />
            <Line>
              <span className={styles.tDim}># Start learning</span>
            </Line>
            <Line>
              <span className={styles.tGold}>$</span> python main.py
            </Line>
          </div>
        </div>

        <div className={styles.pills}>
          <span className={styles.pill}>
            <span className={styles.tDim}>Default LLM:</span>{" "}
            <span className={styles.pillValue}>Gemini 2.5 Flash</span>
          </span>
          <span className={styles.pill}>
            <span className={styles.tDim}>Also works with:</span> OpenAI, Groq,
            Ollama
          </span>
          <span className={styles.pill}>
            <span className={styles.tDim}>Any language pair:</span> Korean →
            English, etc.
          </span>
        </div>

        <div style={{ textAlign: "center", marginTop: "3rem" }}>
          <Link href="/chat" className={styles.ctaPrimary}>
            Try the web version
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
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className={styles.footer}>
        <p className={styles.footerTitle}>open-language</p>
        <p className={styles.footerDesc}>
          Open source AI language tutor.{" "}
          <code className={styles.code}>python main.py</code> to start.
        </p>
        <p className={styles.footerTech}>
          Built with Gemini + Python + Next.js + SQLite
        </p>
      </footer>
    </div>
  );
}

/* ─── Small helper components ─── */

function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.sectionLabel} data-color={color}>
      {children}
    </div>
  );
}

function Line({
  children,
  blank,
}: {
  children?: React.ReactNode;
  blank?: boolean;
}) {
  return (
    <span className={blank ? styles.lineBlank : styles.line}>{children}</span>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return (
    <span>
      <span className={styles.tPrompt}>You &gt; </span>
      {children}
    </span>
  );
}

function Tutor() {
  return <span className={styles.tTutor}>Tutor</span>;
}

function Gold({
  children,
  bold,
}: {
  children: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <span className={`${styles.tGold} ${bold ? styles.tBold : ""}`}>
      {children}
    </span>
  );
}

function ModeCard({
  color,
  icon,
  title,
  desc,
  items,
}: {
  color: string;
  icon: string;
  title: string;
  desc: string;
  items: string[];
}) {
  return (
    <div className={styles.modeCard} style={{ borderTop: `3px solid ${color}` }}>
      <div className={styles.modeIcon} dangerouslySetInnerHTML={{ __html: icon }} />
      <h3 className={styles.modeTitle}>{title}</h3>
      <p className={styles.modeDesc}>{desc}</p>
      <ul className={styles.modeItems}>
        {items.map((item, i) => (
          <li key={i} style={{ "--dot-color": color } as React.CSSProperties}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrackItem({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.trackItem}>
      <span className={styles.trackLabel} style={{ color }}>
        {label}
      </span>
      <span className={styles.trackDesc}>{children}</span>
    </div>
  );
}
