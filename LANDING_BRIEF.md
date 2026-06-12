# Landing Page Design Brief

**For:** claude.ai/design wireframing session
**Companion to:** `CALL_UI_BRIEF.md`, `HOME_VIGNETTE_BRIEF.md`
**Scope:** the public landing page at `/` — the first thing a cold visitor sees, before sign-in.

---

## What the product is

A voice call with your AI language tutor. One button: **Call**. You tap it, you're on a call, the tutor runs an agenda, you hang up, you see a notebook recap.

The pedagogy is one loop, not two halves:

- You pick (or are given) a **roleplay scenario** — a real-life scene you'd want to handle. *Ordering at a coffee shop. Catching up with a friend. Arguing with a landlord.*
- Every lesson is tied to that scene. The words, the grammar, the phrasing — all chosen because the scene needs them.
- The moment you learn something, it **gets deposited into the scenario**. The new word goes on the menu. The new grammar pattern shows up in the barista's reply. The phrase you nailed last week is now something the regular at the next table says back to you.
- Over weeks, the scenario gets richer. Same coffee shop, but week 4 has thirty words, three side characters, a running joke, and a debate about oat milk. You feel the scene fill up.

And it remembers: every word you asked about, every mistake you keep making, every topic you love. The scene is the memory made visible. ChatGPT doesn't do any of this.

**The curriculum isn't vibes.** Every lesson is picked from open linguistic data: a **frequency dictionary** that orders Japanese by how often each word actually appears, and a **JLPT-anchored grammar curriculum** that walks the ~600 canonical patterns from N5 (beginner) to N1 (advanced). Given what we know you already know, the next lesson is whatever is the **next-most-frequent thing you don't yet know** — the highest-leverage word, the next grammar point a real speaker would teach you. The scene fills in roughly the order the language uses itself.

Feel: FaceTime meets a late-night radio station. Dark, warm, intimate. **Not Duolingo. Not generic AI-assistant. Not SaaS-marketing.**

## Where this page sits in the flow

```
Landing (/)  →  Sign in  →  Home (Yuki)  →  Call  →  Recap
```

The landing's only job is to get a cold visitor onto the call. It is **not** a feature page, not a comparison page, not a testimonials page. The product converts in the call itself — the landing should hand them off as fast as possible.

## What's essential — and only this

Three things, in this order:

1. **The concept, in one line.** Name the metaphor explicitly. Something like *"Pick a scene. Learn it word by word. Live in it."* or *"A coffee shop you keep coming back to, in Japanese."* The phone-call framing is still load-bearing for the rest of the flow — but the *pedagogical* hook on the landing is **the scenario that grows**.

2. **The scenario, growing — in principled order.** This is the page's centerpiece — one composition, not a feature grid. Show **the same scene at two states**: a sparse "session 1" state with two or three labeled props, and a "session 4" state of the same scene with many more — new menu items, side characters, a margin annotation that wasn't there before, a phrase the learner used last week now showing up as another customer's line. Each prop carries a small frequency rank (`#42 · top-1000`, `#318`, `〜てしまう · DOJG basic §47`) so the visitor can see the curriculum is principled, not random. The accumulation between the two states *is* the feature, the proof of memory, and the differentiator from ChatGPT — all in one image.

3. **One CTA that drops them into the flow.** "Sign in with Google" as the primary. "Try one call without signing in" as a quiet secondary, same row, smaller. No third option.

Everything else — ChatGPT comparison, mistake-tracking card, interest tags, standalone quiz card, footer chrome — gets cut. The growing scenario *is* the feature section, the memory section, and the differentiator section, collapsed into one frame.

## Three directions — design all three side by side

Every direction must show **the same scene at two states** so the visitor sees the accumulation. Pick one canonical landing scenario and stick with it across all three directions for comparability — recommended: **a coffee shop**. Same shop, two states.

### A. Diorama / set

The landing is an isometric or near-side-view diorama of the coffee shop, rendered as a small theater set.

- One scene, presented twice in stacked frames or a soft side-by-side: `Day 1` (sparse — counter, one barista silhouette, two menu items, three vocab tags floating) and `Day 28` (same set — now with a regular at a corner table, a chalkboard menu of fifteen items, side dialogue tags, a margin note that says *you ordered "less ice" yesterday*, a phrase bubble in the learner's own voice).
- Vocab tags float above the props they're attached to: `カップ`, `お会計`, `アイス少なめ`. Tags from "Day 1" persist into "Day 28" but with a faint ring around them, like rings on a tree.
- A subtle arrow, marker scribble, or growth-line between the two states. Caveat cursive on the connecting note: *"every lesson goes in here."*
- Concept line above. CTA below.

Risk: dioramas can look like infographic kitsch. Reward: the accumulation is *literally* visible, and the diorama makes the scenario feel like a place rather than a feature.

### B. Open notebook

The landing is a notebook lying open on a dark desk, shot from above. The two pages are the same scenario at two points in time.

- **Left page — week 1.** Handwritten title: `☕  Coffee shop, week 1`. A small hand-drawn floor plan with three labels: `barista`, `counter`, `register`. A short dialogue, two lines. Three vocab cards taped to the page.
- **Right page — week 4.** Same title, week 4. Same floor plan, but now there's a regular at a corner table, a side-table conversation in the margin, a longer dialogue with branching choices. Eight vocab cards. Two of them are visibly the same cards from the left page, faded and re-taped — *"this is still here."* A Caveat margin note: *"this scene gets bigger every call."*
- Between the pages, in the gutter: a small bookmark ribbon labeled `open-language` and the concept line in a smaller hand.
- Bottom-right: a printed-tape label with the CTAs. "Sign in with Google" primary, "try one call" secondary.
- Subtle paper grain, slight page curl shadow, warm desk-lamp vignette.

Risk: skeuomorphism dated badly in 2014, and "before/after" can read as marketing if the rhythm is wrong. Reward: the notebook motif is already load-bearing in Recap and Home, and the two-page spread is the most natural place in the design system to show "same thing, more of it."

### C. Time-lapse vignette

The landing is a short silent loop of the coffee-shop scene filling in.

- **Beat 1 (0–3s):** sparse coffee shop. Two props labeled. One line of dialogue floats in.
- **Beat 2 (3–7s):** time-lapse — props slide in one by one (a chalkboard menu writes itself in Caveat, a regular sits down, a vocab card pins itself to the wall, another, another). Each addition is paired with a tiny tag in the corner: `+ カップ` `+ お会計` `+ "less ice"`. The scene gets warmer as it fills.
- **Beat 3 (resolve):** the scene settles at a "week 4" state. Concept line fades in, CTA materializes. The shop continues to breathe — one customer raises a cup, the chalkboard's chalk dust drifts.
- Sprite treatment must match the chosen Home aesthetic (A / B / C from `HOME_VIGNETTE_BRIEF.md`) so landing → Home is a continuous shot.

Risk: motion-heavy landings hurt LCP, and a "filling-in" loop is easy to over-animate into something that feels like a product tour. Reward: the accumulation as motion is the most direct way to communicate the loop, and the visitor literally watches the scene grow before their eyes.

## Visual tokens — match exactly

```css
--bg: #0a0a0f;          /* near-black, slightly warm */
--bg-card: #12121a;
--text: #e0ddd5;        /* warm off-white */
--text-dim: #8a8780;
--gold: #c4b99a;        /* primary accent */
--ember: #c45e4a;       /* end call / warning */
--moss: #6b9a5b;        /* connected / passed */
--river: #5b7e9a;       /* secondary accent */
--border: #2a2a36;
```

3% opacity SVG grain overlay on body. Geist Sans (UI), Geist Mono (numeric), Caveat cursive (notebook annotations only). Fluid type via `clamp()`. Dark only — no light mode, no theme toggle.

## What to avoid

- No feature grids, no three-up cards, no comparison tables, no "vs ChatGPT" sections
- No testimonials, no logo bars, no "trusted by," no press quotes
- No screenshot carousels, no product-tour modals, no scrollytelling beyond what direction C requires
- No gradient-blob hero, no centered-headline-plus-CTA-plus-iridescent-button SaaS template
- No Duolingo mascots, no AI sparkles, no "powered by" badges
- No second CTA section at the bottom — one CTA, one place
- No footer beyond a single line: project name + GitHub link
- No copy explaining *how* the memory works — show one artifact, trust it

## Copy to work from (rewrite freely, but keep this short)

- Concept line, candidates:
  - *"Pick a scene. Learn it word by word. Live in it."*
  - *"A coffee shop you keep coming back to, in Japanese."*
  - *"Every lesson goes into the same scene. The scene gets bigger."*
  - *"Learn the words. The barista will use them next week."*
  - *"The next 1,000 words, in the order you'll actually hear them."*
  - *"A frequency dictionary, the JLPT, and a coffee shop."*
- Two-state labels, candidates: `Day 1 / Day 28` · `Week 1 / Week 4` · `First call / Eighth call` · `Sparse / Full`
- Vocab tag examples (props, with frequency rank): `カップ · #2,184` · `お会計 · #871` · `アイス少なめ · learner phrase` · `常連 · #3,402` · `おかわり · #1,940`
- Grammar tags (JLPT-anchored): `〜てしまう · N4` · `〜ちゃう · N4 (casual)` · `〜たほうがいい · N4`
- Side-character tags (week-4 only): `a regular at a corner table` · `the rude tourist` · `the barista's apprentice`
- Margin annotation candidates: *"you ordered less ice yesterday"* · *"this is still here from week 1"* · *"〜ちゃう showed up again"* · *"next up: 上 (top-500)"*
- Primary CTA: **Sign in with Google** (with Google mark)
- Secondary CTA: *try one call without signing in* (quiet, lowercase)

## Deliverables

For each of the three directions:

1. Landing · mobile (375×812)
2. Landing · desktop (1440×900)
3. The two-state composition at 2x — Day 1 and Day 28 isolated side by side, full quality, so we can judge prop density, vocab-tag treatment, and the rhythm between the two states
4. One isolated scenario prop at 2x — a vocab tag with its margin annotation, so we can judge typography and ink quality at detail level
5. (Direction C only) four keyframes from the time-lapse — sparse start, mid-fill, near-full, resolved hero

Label each artboard `A / B / C` and put the three directions in parallel columns so we can compare the same beat across them.

## References (tone, not style to copy)

- iOS Phone incoming-call screen — direction A
- A real Moleskine spread, dim desk-lamp lighting — direction B
- *Paprika*, *Mind Game* title sequences — direction C
- Granola's post-meeting recap — typography warmth
- Linear's landing — for the discipline of "one idea per screen," not the visuals
- Anti-reference: any SaaS landing with a feature grid below the hero
