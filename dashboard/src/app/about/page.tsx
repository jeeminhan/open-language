export default function AboutPage() {
  return (
    <div className="space-y-10 max-w-3xl">
      {/* Hero */}
      <div className="py-6">
        <h2 className="text-2xl font-bold mb-3" style={{ color: "var(--gold)" }}>
          Why this exists
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          I built this because every AI language tutor I tried had the same problem:
          they{"'"}d help me in the moment and then forget everything by the next session.
          None of them were actually <em>learning about me</em> the way a real tutor would.
        </p>
      </div>

      {/* Pain points */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--ember)" }}>
            The problems
          </h3>
          <div className="flex-1 h-px" style={{ background: "rgba(196, 94, 74, 0.25)" }} />
        </div>

        <div className="space-y-4">
          <PainPoint
            number={1}
            title={<>&ldquo;I asked what a word meant. It explained it. Then it forgot.&rdquo;</>}
          >
            When I{"'"}m speaking with an AI tutor and I ask &ldquo;what does 편식 mean?&rdquo;,
            that{"'"}s a clear signal — I don{"'"}t know that word. A human tutor would mentally
            note it and bring it back later. Every AI tutor I tried just answered
            the question and moved on. No record. No follow-up. No spaced repetition.
            The vocabulary I was actively struggling with just disappeared into the void.
          </PainPoint>

          <PainPoint
            number={2}
            title={<>&ldquo;I have no idea what I actually know.&rdquo;</>}
          >
            After months of practice, I couldn{"'"}t answer basic questions about my own
            progress. What grammar patterns have I actually used correctly? Which ones
            am I avoiding without realizing it? What{"'"}s my real level versus what I
            registered as? There was no knowledge base, no map of what I{"'"}d covered.
            I didn{"'"}t know what I didn{"'"}t know — and the AI couldn{"'"}t tell me either,
            because it wasn{"'"}t tracking anything.
          </PainPoint>

          <PainPoint
            number={3}
            title={<>&ldquo;The AI makes the same teaching mistakes every session.&rdquo;</>}
          >
            AI tutors don{"'"}t evaluate themselves. They don{"'"}t notice when a correction
            strategy isn{"'"}t working. They don{"'"}t realize they missed a teaching moment.
            Every session starts from zero — same approach, same blind spots, same
            limitations. A human tutor gets better at teaching <em>you</em> over time.
            AI tutors don{"'"}t.
          </PainPoint>

          <PainPoint
            number={4}
            title={<>&ldquo;Errors slip through because real-time checking isn{"'"}t enough.&rdquo;</>}
          >
            In conversation flow, the AI is trying to be a good conversationalist
            <em> and</em> an error checker at the same time. It misses things. Subtle
            particle mistakes, unnatural phrasing, L1 interference patterns — these
            get overlooked in the moment. There{"'"}s no second pass, no outside review,
            no system catching what the tutor missed.
          </PainPoint>

          <PainPoint
            number={5}
            title={<>&ldquo;Every conversation is generic. It doesn{"'"}t know me.&rdquo;</>}
          >
            A real tutor remembers that you love anime, that you{"'"}re into cooking,
            that you just got back from a trip. They use that to make lessons engaging —
            you{"'"}re not practicing grammar in a vacuum, you{"'"}re talking about things
            you actually care about. AI tutors start every session the same way:
            &ldquo;How are you? What did you do today?&rdquo; They never build a picture
            of who you are, what you{"'"}re interested in, or what would make you
            <em> want</em> to keep talking.
          </PainPoint>
        </div>
      </section>

      {/* What this does differently */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="2">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z" />
            <line x1="10" y1="22" x2="14" y2="22" />
          </svg>
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--moss)" }}>
            What this does differently
          </h3>
          <div className="flex-1 h-px" style={{ background: "rgba(126, 154, 110, 0.25)" }} />
        </div>

        <div className="space-y-4">
          <SolutionCard color="var(--gold)" title="Everything is tracked">
            Every word you use, every grammar pattern, every error, every correction.
            When you ask what something means, it goes straight into your vocabulary
            list marked as &ldquo;learning.&rdquo; After each session you can tap any word
            from the conversation to add it to your study list. Nothing gets lost.
          </SolutionCard>

          <SolutionCard color="var(--river)" title="A living knowledge base">
            Your grammar inventory, vocabulary list, error patterns, and fluency metrics
            build up over time into a complete picture of where you are. The system
            computes your effective level from real performance data — not from what you
            registered as. It shows you what you{"'"}re avoiding, what you{"'"}re weak on,
            and what you{"'"}ve mastered. You can finally see the gaps.
          </SolutionCard>

          <SolutionCard color="var(--ember)" title="The AI improves at teaching you">
            After every session, an independent review agent re-reads the full
            conversation to catch errors the real-time tutor missed. The tutor
            evaluates its own performance — what worked, what didn{"'"}t, what teaching
            moments it missed. Error patterns get clustered by root cause. L1
            interference from English is identified and fed back into the next session.
            The tutor literally gets smarter about <em>your</em> specific weaknesses.
          </SolutionCard>

          <SolutionCard color="var(--moss)" title="Spaced repetition without flashcards">
            Instead of a separate flashcard app, the tutor naturally steers
            conversations toward patterns you haven{"'"}t practiced recently or keep
            getting wrong. The repetition is built into the conversation itself — you
            practice weak areas without it feeling like a drill.
          </SolutionCard>

          <SolutionCard color="var(--gold)" title="It learns who you are">
            As you talk, the system automatically detects your interests — books you
            mention, music you like, shows you watch, hobbies, travel, food preferences.
            It builds a profile and uses it to generate conversation topics you actually
            want to discuss. It pulls real, current information from the web about your
            interests so conversations feel authentic, not scripted. Instead of
            &ldquo;describe your hobby,&rdquo; it asks about the specific anime you
            mentioned last week or the restaurant you tried. Grammar practice happens
            naturally because you{"'"}re engaged in topics you care about.
          </SolutionCard>
        </div>
      </section>

      {/* The loops */}
      <section>
        <div className="flex items-center gap-2.5 mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--river)" strokeWidth="2">
            <path d="M3 3v18h18" /><path d="M7 16l4-8 4 4 4-10" />
          </svg>
          <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: "var(--river)" }}>
            9 feedback loops
          </h3>
          <div className="flex-1 h-px" style={{ background: "rgba(91, 126, 154, 0.25)" }} />
        </div>

        <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Each loop feeds into the next. The more you use it, the better it gets at
          teaching you specifically.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {[
            { n: 1, t: "Adaptive Difficulty", d: "Computes your real level from grammar mastery and error rate. Pushes harder as you improve." },
            { n: 2, t: "Spaced Repetition", d: "Prioritizes patterns you haven't practiced recently. Steers conversation toward them naturally." },
            { n: 3, t: "L1 Interference", d: "Identifies errors caused by English habits. Explains why you make the mistake, not just what's wrong." },
            { n: 4, t: "Second-Pass Review", d: "After each session, an outside agent reviews the full conversation to catch what the tutor missed." },
            { n: 5, t: "Tutor Self-Evaluation", d: "Grades its own corrections. Tracks what teaching strategies work for you and which don't." },
            { n: 6, t: "Error Clustering", d: "Groups related errors by root cause instead of showing isolated mistakes." },
            { n: 7, t: "Vocab Tracking", d: "When you ask what a word means, it's saved. Builds a personal dictionary of words you're learning." },
            { n: 8, t: "Topic Difficulty Scoring", d: "Scores each conversation's difficulty so future topics better match your level." },
            { n: 9, t: "Interest Profiling", d: "Detects your interests from conversations, pulls real web info about them, and generates personalized topics you actually want to discuss." },
          ].map((loop) => (
            <div key={loop.n} className="flex gap-3 rounded-xl p-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(91, 126, 154, 0.15)", color: "var(--river)" }}>
                {loop.n}
              </span>
              <div>
                <div className="text-sm font-semibold mb-0.5" style={{ color: "var(--river)" }}>{loop.t}</div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{loop.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Closing */}
      <div className="card" style={{ borderLeft: "3px solid var(--gold)" }}>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
          This isn{"'"}t a chatbot with a language prompt bolted on. It{"'"}s a system
          that builds a persistent model of your knowledge and uses it to get better
          at teaching you. Every session makes the next one smarter.
        </p>
      </div>
    </div>
  );
}

function PainPoint({ number, title, children }: { number: number; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ borderLeft: "3px solid var(--ember)" }}>
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "rgba(196, 94, 74, 0.15)", color: "var(--ember)" }}>
          {number}
        </span>
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text)" }}>{title}</h4>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{children}</p>
        </div>
      </div>
    </div>
  );
}

function SolutionCard({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <h4 className="text-sm font-semibold mb-1.5" style={{ color }}>{title}</h4>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>{children}</p>
    </div>
  );
}
