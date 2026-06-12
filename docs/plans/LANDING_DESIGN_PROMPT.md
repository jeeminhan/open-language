# Landing Page — Design Kickoff & Visual Elements

**For:** claude.ai/design — a one-shot kickoff
**Reads with:** `LANDING_BRIEF.md` (rationale + scope), `HOME_VIGNETTE_BRIEF.md` (sprite aesthetic A/B/C), `CALL_UI_BRIEF.md` (overall product mood)
**Scope:** the public landing page at `/`. JP-only product for v1.

---

## Kickoff — read this first

Design a landing page for an app that is "a phone call with a Japanese tutor who teaches you, then makes you live in it." The page has one job: get a cold visitor to sign in.

Three things must read in one glance: **the metaphor** (a phone call, a tutor, a coffee shop you keep coming back to), **the loop** (every lesson deposits a word into the same scenario, so the scene grows over weeks), and **the principle** (the curriculum is real — frequency-ranked vocab + JLPT-anchored grammar, picked deterministically). All three are conveyed by **one composition: the same coffee shop at two states — Day 1 sparse, Day 28 full**. No feature grid, no comparison table, no testimonials, no "how it works" section.

Spin up **three directions in parallel** — A. Diorama, B. Open notebook, C. Time-lapse vignette — at mobile + desktop, with a 2x detail of the central composition and one isolated prop. Match the visual tokens exactly (warm dark, gold/ember/moss accents, Geist + Caveat). The aesthetic must extend the same world as the Home and Call screens: late-night, intimate, mechanical-warm — **not** Duolingo-cute, **not** SaaS-marketing, **not** AI-assistant-generic.

The canonical scene is a coffee shop in **Koenji, Tokyo**. Pick that neighborhood's specific texture: narrow storefront, wood + steel + vinyl, slightly grungy, real-people-live-here. Not Shibuya gloss, not Yanaka tourism.

Full direction descriptions, anti-requirements, and copy candidates are in `LANDING_BRIEF.md`.

---

## Canonical setting

| Element | Spec |
|---|---|
| **Neighborhood** | Koenji, west Tokyo. Backstreet, not main drag. Independent cafe vibe. |
| **Time of day** | Morning, ~7am — first light, lamps still on inside. |
| **Season** | Late autumn for Day 1, early winter for Day 28 (subtle — coat on a hook in Day 28, oden mention on the chalkboard, hot drinks, condensation on the window). |
| **Weather** | Overcast, soft directional light from a side window. |
| **Counterparty** | The barista. Not centered — one-third off-axis, mid-action (steaming milk, writing on the chalkboard). |
| **You (the learner)** | Implicit. POV from your seat at the counter, or from a small table near the window. We see your hand or your half-empty cup, not your face. |

---

## What grows between Day 1 and Day 28

The accumulation **is** the proof. Both states are the same scene from the same angle.

| Element | Day 1 | Day 28 |
|---|---|---|
| Chalkboard menu | 3 items | 12+ items, including seasonal (`おでん`, `ホット` drinks) |
| Vocab tags pinned in scene | 3, on counter and menu | 10+, with two tags from Day 1 visibly *still there* (faded ring around them — "this stayed") |
| Side characters | none | a regular at the corner table reading a book, a customer at the door |
| Margin annotation | one tutor note: *"first call — ordered with `ください`"* | three notes, including: *"you ordered less ice yesterday"* and *"〜ちゃう showed up at the izakaya last night"* |
| Soundscape implied | quiet | barista chatting with the regular (visualized as a faint speech bubble: `常連 (jōren) — regular`) |
| Coat hook | empty | one coat — yours. You've been here a while. |

The Day 28 frame should also carry one small **crossover hint** to the larger world: a margin note mentioning the izakaya, the train line, the doctor, or mom. One line, easy to miss. Plants the world without explaining it.

---

## Visual elements library

### Shared across all directions

**Palette tokens (exact):**
```css
--bg: #0a0a0f;          /* near-black, slightly warm */
--bg-card: #12121a;
--text: #e0ddd5;        /* warm off-white */
--text-dim: #8a8780;
--gold: #c4b99a;        /* primary accent */
--ember: #c45e4a;       /* end-call / warning */
--moss: #6b9a5b;        /* connected / passed */
--river: #5b7e9a;       /* secondary accent */
--border: #2a2a36;
```

**Typography:**
- **Geist Sans** — UI and concept line. Fluid via `clamp()`.
- **Geist Mono** — frequency ranks, JLPT levels, vocab headwords (Japanese in mono is unusual — owns the page). E.g., `カップ · #2,184`.
- **Caveat cursive** — every annotation, margin note, hand-tagged label. Slight ink spread. Three weights: pencil-faint (Day 1 ghosts), pen-firm (active), marker-bold (the rare emphasis).

**Texture overlays:**
- 3% opacity SVG film grain on the body
- A subtle paper-grain layer on any "drawn/written" element (annotations, chalkboard, notebook pages)
- Soft warm vignette pulling toward the center of the composition

**Vocab tag treatment (the most important repeating element):**
- Small rectangle, ~80×30px at base, washi-tape attached to the surface it labels
- Front: the headword in Geist Mono Japanese (`お会計`), the rank below in 10px Mono dim (`#871`)
- One faint pencil checkmark in the corner if `mastered`, an ember dot if introduced-this-session
- Tape colors: gold (mastered), moss (introduced), ember (struggled — ghost only, no Day 28 prop)
- Day 1 to Day 28 retention cue: kept tags get a faint outer ring stroke ("rings on a tree"), proving persistence

**Memory annotation treatment:**
- Caveat cursive, slightly off-axis, ~14–16px
- Always in a margin or floated near the prop it modifies
- Color: gold for tutor's hand, ember for emphasis (rare), `--text-dim` for ghosts of past sessions
- Include one or two intentional mark-out / re-write moments to feel handwritten

**CTA treatment:**
- Primary: full-width-on-mobile button, Geist Sans 16px medium, `--text` on a `--bg-card` surface with a warm 1px `--gold` border. Google "G" mark left-aligned. Subtle inner-glow on hover, no gradient.
- Secondary: text-only, `--text-dim`, lowercase, italic optional, sits in the same row.
- Avoid: rounded blob buttons, iridescent gradients, oversize "Get Started"-style CTAs, pulse animations.

**Concept line treatment:**
- Geist Sans, fluid 28px → 56px via `clamp()`. Tight tracking. One line, never two.
- Always above the central composition on desktop, below on mobile.
- The word that names the metaphor (*scene, coffee shop, tutor*) gets a Caveat underline instead of a typographic accent. Hand-drawn feeling.

---

### Direction A — Diorama

The composition is a small 3D theater set, isometric or near-side-view, showing the coffee shop at Day 1 and Day 28 stacked or side-by-side.

**Set elements (Day 1, sparse):**
- Wooden L-counter, one stool
- Vintage lever espresso machine (La Marzocco-ish, brass + chrome — the warm metal contrasts with the dark)
- A small chalkboard menu with three items written in Caveat
- One pendant lamp casting a tight warm pool
- A single barista silhouette (matching whichever Home aesthetic — A ukiyo-e, B silhouette-in-window, C rotoscope)
- Three vocab tags floating with hairline lines connecting them to the props

**Set elements added by Day 28:**
- A regular at a corner table (book, half-finished coffee)
- A coat on a hook (yours)
- An expanded chalkboard menu, with seasonal items in different chalk colors
- More cups stacked behind the counter
- A small paper sign taped to the register
- Eight more vocab tags (some with the "kept" outer ring)
- Three margin annotations now visible
- A subtle plant or seasonal touch (small persimmon on the counter — tying back to the *柿* memory artifact)

**Frame & lighting:**
- The diorama sits on a dark surface that feels like a stage; the bg fades to `--bg` at the edges
- Overhead key light, warm. Single rim light from window-direction (left or right, consistent across both states)
- Soft drop shadow under the set

**Connector between Day 1 and Day 28:**
- A thin Caveat marker arc connecting the two states with a hand-written label: *"every lesson goes in here"* or *"day 1 → day 28"*

**Risk:** dioramas read as infographic kitsch when the perspective is too perfectly isometric. Soften with painterly lighting or hand-drawn linework.

---

### Direction B — Open notebook

The composition is a notebook lying open on a dark desk, top-down, photographed-feeling.

**Notebook physical:**
- Cream paper, slightly aged, faint grid or dot pattern
- Page edges show wear, slight yellow on the corners
- A bookmark ribbon (gold or ember) trailing into the gutter
- One small coffee ring on the right page, faint
- Subtle page curl shadow at the spine

**Left page — week 1:**
- Hand-printed title: `☕ Koenji coffee shop · week 1`
- Below: a small pencil floor plan — counter, stool, register, window — three labels in Caveat
- A short dialogue, two lines, in Caveat (your line in pencil, the barista's in pen)
- Three vocab cards taped to the page with washi (gold tape)
- One margin annotation, pencil

**Right page — week 4:**
- Same title scheme: `☕ Koenji coffee shop · week 4`
- Same floor plan, redrawn — now with two added labels (corner table, coat hook)
- Longer dialogue, with branching choices marked by arrows
- Eight vocab cards taped — **two of them visibly the same cards from the left page**, faded, edges curled, washi tape darker from age. *"this is still here."*
- Three margin annotations: one referencing yesterday's order, one cross-referencing the izakaya (the world hint), one in ember-marker emphasis
- One pasted Polaroid-style photo of the barista's hand pulling a shot — small, off-corner

**Gutter / spine:**
- Bookmark ribbon
- A small printed-tape label running across the spine: `open-language` in Geist Mono
- The concept line in Caveat below the title, smaller hand

**Bottom-right of right page:**
- Another printed-tape label with the CTAs. "Sign in with Google" (primary), "try one call" (secondary).

**Risk:** skeuomorphism aged badly. Save it with restraint — paper grain, real ink behavior, real margin discipline. No drop shadows on every element.

---

### Direction C — Time-lapse vignette

A short silent loop, 8–10 seconds total, of the coffee shop filling in. Same scene, real-time accumulation. Resolves into a static hero state.

**Beat 1 — sparse start (0–3s):**
- Empty coffee shop, lamps on, morning light just starting
- The barista enters frame, begins setting up
- Two vocab tags slide in and pin themselves to the counter — `カップ`, `お会計`
- Caption (small, top-left, fades): `Day 1`

**Beat 2 — time-lapse fill (3–7s):**
- Time accelerates — props slide / appear with subtle pop animation
  - The chalkboard menu writes itself in Caveat, line by line
  - A regular enters and sits at the corner table
  - Vocab tags pin themselves in sequence: `アイス少なめ`, `常連`, `おかわり`, `ホット`, `おでん`
  - Each new tag accompanied by a small corner notification: `+ お会計 · #871`
  - Coat appears on the hook
  - Margin annotations write themselves into the bottom-margin
- The light shifts subtly warmer as the scene populates

**Beat 3 — resolved hero (7s onward, looping subtly):**
- Scene settles at "Day 28" state
- Concept line fades in below the scene
- The two oldest vocab tags get their faint "kept" rings drawn on
- CTA row materializes
- The shop continues to breathe — barista wipes the counter, the regular turns a page, steam rises from a cup
- Caption (small, top-left): `Day 28`

**Animation rules:**
- Sprite/scene treatment matches the Home aesthetic chosen from `HOME_VIGNETTE_BRIEF.md` (A ukiyo-e / B silhouette / C rotoscope)
- Frame-stepped, not smooth-tweened (4–6 frames per gesture)
- Tag pin-ins use a single-frame "snap" + a tiny shake settle, no bouncy easing
- No camera movement — the camera stays. The world fills.

**Resolved hero is the seo-priority frame** — make sure that frame alone reads as a complete landing page, since some users will load with reduced-motion preference and skip the loop entirely. With reduced motion, jump directly to beat 3.

**Risk:** motion-heavy landings hurt LCP and "filling-in" loops can feel performative. Reward: this is the most direct way to *show* the loop the product actually is.

---

## Mood references (tone, not style to copy)

- **iOS Phone incoming-call screen** — proportions, typography weight, button hierarchy
- **A real Koenji cafe** — narrow, wood + steel + vinyl, lamp-warm, slightly grungy. Image-search "Koenji coffee shop interior" for the right texture; avoid Shibuya, Yanaka, or chain-cafe references.
- **Granola post-meeting recap** — for the warmth of mechanical UI and the typographic-discipline-with-handwritten-annotations balance
- **A used Moleskine spread, dim desk-lamp lighting** — direction B
- **Title sequences:** *Paprika*, *Mind Game*, *Memories of Murder* — direction C rotoscope mood
- **Hayao Miyazaki kitchen scenes** (Spirited Away bathhouse kitchen, Totoro mom's kitchen) — for the warm-mechanical interior light quality
- **Late-night radio station webpages** circa 2010 (NTS, Radio Garden) — the "you are the only listener right now" intimacy

## Anti-references — do not pull from

- Duolingo green/yellow/owl
- Generic AI-assistant landing pages (Notion AI, Anthropic launch pages, OpenAI hero patterns)
- SaaS marketing template sites (Framer / Webflow showcase pages)
- Cherry blossom / torii gate / generic "Japan" stock imagery
- Stock dashboard mockups (line charts, KPI tiles)
- Anything with sparkle particles, gradient blobs, or aurora backgrounds
- iridescent / glossy buttons
- Shibuya scramble / neon Tokyo (we are in a backstreet, not Times Square)

---

## Deliverables

For each direction (A / B / C), as parallel columns at presentation time:

1. **Landing · mobile** (375×812)
2. **Landing · desktop** (1440×900)
3. **2x detail of the central composition** — Day 1 / Day 28 isolated, full quality, so we can judge prop density, vocab-tag treatment, and the rhythm between states
4. **2x detail of one isolated prop** — a vocab tag with its margin annotation — to judge typography and ink quality
5. **(Direction C only)** four keyframes from the loop: sparse start, mid-fill, near-full, resolved hero

Label every artboard `A | B | C` in the corner. Put the three directions in parallel columns, same beat per row. The point of the comparison is to see the *same idea* expressed three ways.

## What we'll do with the output

We pick a direction, lock the central composition treatment, then `LANDING_BRIEF.md` plus this doc become the implementation spec. Front-end build follows the chosen direction; the other two directions go into `docs/explorations/` so we have provenance for the choice.
