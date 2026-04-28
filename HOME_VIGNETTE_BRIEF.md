# Home + First-Run Vignette Design Brief

**For:** claude.ai/design wireframing session
**Companion to:** `CALL_UI_BRIEF.md` (the overall call-UI spec)
**Scope:** the two Home screen variants (Yuki, Sam) and a 15-second first-run vignette that introduces the product.

---

## What the product is

A voice call with your AI language tutor. One button: **Call**. You tap it, you're on a call, the tutor runs an agenda (drill / role-play / guided), you hang up, you see a notebook recap. That is the whole app. No menus, no tile grids, no chat bubbles, no nav, no gamification chrome.

Feel: FaceTime meets a late-night radio station. Dark, warm, intimate. **Not Duolingo. Not generic AI-assistant.**

Two language pairs only:

- EN → 日本語 · tutor name: **Yuki**
- 한국어 → EN · tutor name: **Sam** (name can iterate)

## What to design in this session

1. **Two Home screen variants (mobile + desktop):**
   - Yuki (EN→JP)
   - Sam (KR→EN)

   Each has: centered Call button, tutor name + target-language tag beneath, optional "last called 2 days ago" line. Nothing else.

2. **One 15s first-run vignette (mobile + desktop)** — three beats, sprite-driven, re-triggerable. It resolves into the Home screen on its final frame — no cut, no loading. The idle pose at t=15s *is* the Home avatar, if Home carries an avatar in the chosen direction.

3. **Re-trigger affordance on Home:** tapping the tutor-name line (`Yuki · 日本語 tutor`) re-plays the vignette. No new icon, no new chrome — the existing text line is the handle. Add a subtle hover / press state so it reads as tappable.

## The 15s vignette — three beats, scripted

| Beat | t      | Visual | Caption |
|------|--------|--------|---------|
| 1 | 0–5s | Tutor sprite turns toward camera, phone-ring SFX rises | "This is Yuki. She's your tutor." |
| 2 | 5–10s | Sprite at a notebook; small annotation marks float up and pin themselves into the margins | "She tracks every mistake." |
| 3 | 10–15s | Inside the notebook, three micro-vignettes cross-fade: a coffee cup (role-play), 5 dots filling gold (drill), an open scroll (guided). Call button materializes below. | "And teaches you three ways." |

Sam's vignette is identical in structure, with "This is Sam. He's your tutor." as the beat-1 caption.

The notebook motif in beats 2 and 3 is **load-bearing** — the recap screen already uses a notebook aesthetic with handwritten Caveat accents. The vignette plants that visual vocabulary.

**Skip affordance:** small dim "skip" label, top-right. Also tap-anywhere advances by one beat.

## Three aesthetic directions — draw all three, side by side

Produce each Home + vignette in these three sprite treatments so we can compare.

### A. Ukiyo-e / minhwa

- Yuki as ukiyo-e brushstroke figure in a warm JP interior (shoji screen, lantern glow, tatami edge)
- Sam as minhwa folk-painting figure in a Seoul evening interior (hanok doorway, paper lantern, low table)
- Hand-painted frames (4–6 per gesture), visible brush texture, grainy
- Culturally anchored but not kitschy — no kimono-stock, no hanbok-stock. Think contemporary illustrator riffing on the tradition, not a stock-image pastiche.

### B. Silhouette-in-window

- Yuki as a backlit silhouette behind a shoji window, warm interior glow bleeding through paper
- Sam as a silhouette against a Seoul high-rise evening skyline, one window lit warm
- Only gesture + breathing animates. Reads as "person on a call," not "mascot."
- Extremely moody, matches "late-night radio" harder than any other direction.

### C. Rotoscope / film-grain pencil

- Hand-drawn rotoscoped frames, heavy grain, pencil-sketch linework that redraws slightly each frame (boiling-line animation)
- Monochrome palette + one warm accent (gold for Yuki, ember for Sam)
- Feels like a short film title sequence. Most unusual choice, most risk of feeling "arty" rather than inviting.

For all three: the sprite moves in **4–6 discrete frames per gesture**, not smooth tweening. Sprite-sheet-ready (ideally 512×512 per frame, PNG alpha). Include the idle loop, the beat-2 notebook pose, and the beat-3 "teaching" pose at minimum.

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

3% opacity SVG grain overlay on body. Geist Sans (UI), Geist Mono (numeric), Caveat cursive (notebook accents only — beat 2 and 3 annotations, recap handwriting). Fluid type via `clamp()`.

Dark only. No light mode.

## What to avoid

- No Duolingo-style mascots (no big eyes, no cute creatures, no exaggerated cartoon proportions)
- No generic AI-assistant styling (no sparkles, no "thinking…" dots, no pulsing chat icon)
- No gamification chrome (no XP, no streaks, no progress bars, no levels surfaced on Home)
- No menus, tabs, sidebars, nav, or tile grids anywhere on Home
- No chat-bubble left/right columns
- No stock cultural tropes (no cherry blossoms as decoration, no generic torii, no hanbok-in-a-palace clichés)

## Deliverables

For each of the three aesthetic directions:

1. Home · Yuki (mobile)
2. Home · Yuki (desktop)
3. Home · Sam (mobile)
4. Home · Sam (desktop)
5. Vignette beat 1 frame (both tutors)
6. Vignette beat 2 frame (both tutors)
7. Vignette beat 3 frame, with Call button resolving in (both tutors)
8. Idle-loop keyframes (both tutors) — the pose Home carries

Label each artboard with the aesthetic direction (A / B / C) and the frame name. Put the three directions in parallel columns so we can compare the same beat across aesthetics at a glance.

## References (tone, not style to copy)

- iOS native Phone in-call screen — proportions, button language
- FaceTime full-bleed avatar treatment
- Granola's post-meeting recap — information density, warmth
- Krisp's minimal control cluster
- Analog radio dials — warmth of mechanical UI
- Title sequences: *Paprika*, *Mind Game*, *Memories of Murder* — for direction C rotoscope mood
