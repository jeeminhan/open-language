# Call-UI Design Brief

**For:** claude.ai/design wireframing session
**Goal:** collapse open-language into a single interaction — a voice call with your AI tutor. No menus, no pickers, no dashboard.

---

## The pitch

The app is one thing: **a phone call**. You open it, you see one button, you tap it, you're on a call with your tutor. The tutor has an agenda. When the call ends, you see a short recap. That's the product.

Every decision inside the call is made by voice, the way you'd talk to a human tutor on a Zoom call. There is no settings screen, no navigation, no content library. The tutor asks what you want to work on; you tell them.

## Why this works for language learning

- **Voice is the learning modality anyway** — text chat UI hides that behind bubbles and chrome
- **No blank-page problem** — the tutor opens every call by proposing what to work on
- **One metaphor, zero learning curve** — everyone knows how a phone call works
- **Every call has a concrete outcome** (passed words / goal met / lesson done), so recap screens always have something real to show
- **Strips the app to the two things that matter**: the call, and the memory of the call

## The three agendas (+ one onboarding-only)

Every call is one of three things. There is no free-form chat — open-ended talking happens inside a role-play with a loose prompt.

| Agenda | What it is | How it ends |
|---|---|---|
| **Role-play** | Themed scenario: order coffee, argue about something, tell me about your day. Can be loose or tight. | Goal met (or timeout) |
| **Drill** | 5 words from the user's SRS queue. Use each in a sentence, get graded pass/fail per word. | All words attempted |
| **Guided lesson** | Tutor explains a grammar point or concept, learner practices, then a short role-play using what was taught. | Lesson + practice complete |

**Plus one onboarding-only agenda: Level test.** A new or guest user who opens the app for the first time doesn't see any menu or onboarding flow — they tap Call and the tutor runs a 3-minute structured assessment, assigns them a level, and seeds their drill queue with words that came up. That *is* the "try it without signing in" experience.

## How agenda selection works (voice, not taps)

The user taps Call. The tutor picks up and asks:

> "Hey — good to see you. Want to drill the 5 words from last time, try a new role-play, or work on something specific?"

The user answers by voice:
- "Drill" → tutor routes to drill agenda, agenda strip morphs
- "Role-play ordering ramen" → routes to role-play with that scenario
- "Teach me て-ください" → routes to guided
- Unclear / open-ended → handled as role-play with an open prompt

The user can interrupt ("let's drill") — the tutor skips the rest and routes immediately. Regulars get a shorter opening over time ("drill your queue?") as the tutor learns their pattern.

## Core screens

There are five. That is the entire app.

### 1. Launch popup (first-run only, shown once ever)
- Appears on the very first launch, over a dimmed / atmospheric background
- **NOT dismissible** — no X, no click-outside-close
- Small modal, notebook aesthetic
- Headline: "What are you learning?" (handwritten feel)
- Two buttons stacked:
  - `[ EN → 日本語 ]` Japanese
  - `[ 한국어 → EN ]` English
- Tap one → popup dismisses → home screen comes into focus with that tutor
- Persisted forever; never shown again after the first pick

Scope: exactly two language pairs. EN→JP and KR→EN. Nothing else.

### 2. Home (every launch after the first)
- One button: **Call** (large, centered, tactile)
- Under the button, dim text: tutor name + target-language tag
  - EN→JP: `Yuki · 日本語 tutor`
  - KR→EN: `Sam · English tutor` (name can iterate in design)
- Optional single line: "last called 2 days ago"
- No nav, no tabs, no stats, no cards, nothing else
- Draw both variants side by side so the difference is visible

### 3. Dialing
- Same as current wireframe direction — radio-dial / concentric-rings treatment preferred
- One control: **End** (cancel)
- Ambient ringback cue

### 4. In-call
The main screen. Three zones, top to bottom:

- **Agenda strip** (top or full-center depending on agenda — see below)
- **Tutor avatar** (breathing / pulsing with voice activity)
- **Control cluster**: 3 buttons — mic / captions / end

During the first ~10 seconds, before the tutor routes, the agenda strip reads `…listening` in dim text. Once the tutor routes, it morphs into the agenda-specific layout.

### 5. Recap
- Notebook / journal aesthetic (handwritten feel, Caveat cursive accents)
- Tutor narrates the recap aloud while it is on screen — user can read while hearing
- Body content adapts to which agenda just ended (see recap variants below)
- Dismiss by voice ("thanks") or by tapping anywhere

## The agenda strip — the only UI chrome besides buttons

One element on screen that tells the user what the tutor is currently running. **Passive — no taps, ever.** Updates silently when the tutor routes.

| Agenda | Strip behavior |
|---|---|
| **Drill** | **Dominant.** Avatar shrinks, strip takes center stage. Current word LARGE (e.g. 懐かしい). 5 progress dots below: gold for current, moss for pass, ember for fail, border for pending. The word is the visual prompt — must be legible from across a desk. |
| **Role-play** | Thin header strip. Scenario name + small goal chip. Chip dims grey until goal met, then glows moss. Avatar stays dominant. |
| **Guided** | Thin header strip. Topic name + step counter ("て-ください · 2/4"). Avatar stays dominant. |
| **Level test** | Thin header strip. "Assessing your level · 3/7". Avatar stays dominant. |

Design the Drill strip as the focal point of its variant of the screen — it replaces the avatar as the primary visual element. Design the other three strips to be unobtrusive context for a call that is still avatar-centric.

## Controls spec (in-call)

Three circular buttons, bottom-anchored, large tactile targets (min 72px on mobile).

| Control | States | Visual |
|---|---|---|
| **Mic** | Live / Muted | filled when live; outlined + diagonal + `--ember` when muted |
| **Captions** | Off / On | dim icon off; `--gold` icon on, transcript visible above |
| **End** | — | `--ember` filled, phone-down icon, largest of the three |

Every control is also voice-addressable ("captions on", "mute me", "goodbye"). Taps and voice are redundant, not exclusive — the mic button especially exists because someone walks into the room and you need instant silence without announcing it.

## Recap variants (notebook shell, different bodies)

Same notebook aesthetic for all four. Different body content:

| Agenda | Body content |
|---|---|
| **Role-play** | Goal status ("reached in 6 turns" / "didn't reach"), words the tutor flagged, 1–2 sentence "you did well at X, work on Y" note |
| **Drill** | Headline score ("4/5 passed"), per-word row: word · the sentence you attempted · one-line feedback · pass/fail icon |
| **Guided** | "Lesson complete · て-ください", list of phrases you used, suggestion to drill them next time |
| **Level test** | "Your level: B1" + 2-sentence justification + list of 5 seeded drill words ("saved for next time") + "Sign in to save →" as primary CTA |

Primary CTA on most recaps: **Call again**. On the level-test recap it is **Sign in to save**.

## What to avoid

- **No menus, pickers, or tile grids** anywhere in the app — with the single exception of the first-run launch popup. The tutor is the picker for everything else.
- **No chat bubbles** (left/right columns). Captions, when shown, appear as a single centered column of dim text below the avatar.
- **No top nav, sidebar, or tab bar.** Ever. The home screen, call screen, and recap screen do not have navigation.
- **No progress bars, streaks, XP, gamification chrome.**
- **No card grids.** The notebook recap is the only "content page" in the app; it is deliberately not a card grid.
- **No sparkle / star icons, no "thinking..." dots, no generic AI-assistant styling.**
- **No light mode.** Dark, warm, intimate.

## Visual language (existing tokens — match these)

```css
--bg: #0a0a0f;          /* near-black, slightly warm */
--bg-card: #12121a;
--bg-hover: #1a1a26;
--text: #e0ddd5;        /* warm off-white */
--text-dim: #8a8780;
--gold: #c4b99a;        /* primary accent — active states, current word */
--ember: #c45e4a;       /* end call, failed drill, warnings */
--moss: #6b9a5b;        /* connected, passed drill, goal met */
--river: #5b7e9a;       /* secondary accent, guided-lesson accent */
--border: #2a2a36;
```

3% opacity SVG grain overlay on body stays. Geist Sans (UI), Geist Mono (numeric), Caveat cursive (notebook-recap accents). Fluid type via `clamp()`.

Feel: FaceTime meets a late-night radio station. Not Duolingo.

## References

- iOS native Phone in-call screen (control layout, proportions)
- FaceTime full-bleed avatar treatment
- Granola's post-meeting recap (recap tone and information density)
- Krisp's minimal control cluster
- Analog radio dials (for the dialing screen)

## What I want from this wireframe session

Mobile-first. Desktop variants only for Home.

### New screens
1. **Launch popup** — two tiles, non-dismissible (mobile + desktop)
2. **Home screen variants** — two side-by-side mockups:
   - EN → 日本語 (Yuki)
   - 한국어 → EN (Sam, name can iterate)
   Mobile + desktop for each.
3. **Agenda strip variants** (drawn on top of the existing in-call A/B):
   - Neutral "…listening" state (first ~10s of any call)
   - Drill strip (dominant, word + dots)
   - Role-play strip (thin, scenario + goal chip)
   - Guided strip (thin, topic + step counter)
   - Level-test strip (thin, progress counter)
4. **Recap body variants** (drawn on top of the existing notebook recap shell):
   - Role-play recap body
   - Drill recap body
   - Guided recap body
   - Level-test recap body (with "Sign in to save" CTA)

### Screens that stay as already drawn
- Dialing (prefer the radio-dial direction)
- In-call captions-off (avatar dominant)
- In-call captions-on (with transcript history — not teleprompter)
- Recap shell (notebook, handwritten feel)
- Desktop in-call + PIP mini
- Mid-call toast ("saved to Review")

### Screens no longer needed
- Pre-call picker / tile grid (the tutor replaces this)
- "Just chat" agenda variants (the agenda is cut entirely)
- Separate onboarding steps for level selection (level test replaces this)
- 4-tile pair picker (collapsed to a 2-option popup)
