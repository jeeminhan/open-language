# Guest-first flow (planned)

Let first-time visitors start a full session without signing in. At the end of their first session, prompt them to save progress by linking a Google identity.

> **Status:** Not built yet. Landing copy currently says "Sign in with Google. Takes 10 seconds." which is honest for today. Flip copy to "Start free — sign in to save" once this ships.

---

## Approach

Use Supabase's built-in **anonymous auth + identity linking**. Zero schema changes, no data-migration code:

- `supabase.auth.signInAnonymously()` creates a real `auth.users` row with a UUID and `is_anonymous = true`.
- Every existing table (errors, vocabulary, interests, sessions) already keys on `user_id` — works unchanged.
- `supabase.auth.linkIdentity({ provider: 'google' })` attaches Google to the same UUID. All guest-session data survives.

---

## Build order

### 1. Enable in Supabase dashboard
- Auth → Providers → turn on **Anonymous**.
- Set anonymous-per-IP rate limit (~5/hour) in the dashboard.

### 2. Guest bootstrap in `/chat`
- In `src/app/(app)/chat/page.tsx` (or `(app)/layout.tsx` if it should cover more than chat): on mount, if `supabase.auth.getUser()` returns null, call `supabase.auth.signInAnonymously()` and show a skeleton/spinner for ~1s.
- On failure, fall back to the existing `/login` redirect.

### 3. `useIsGuest()` hook
- New hook returning `user?.is_anonymous === true` (this is a built-in Supabase flag).
- Gate the post-session save prompt, and likely LearnerSwitcher, off this.

### 4. Post-session save modal
- Whenever the session-end hook fires (voice auto-disconnect, journal "done", chat idle), if guest → modal: "Save your progress? Sign in with Google."
- Button: `supabase.auth.linkIdentity({ provider: 'google' })`.
- "Maybe later" dismisses; session continues as guest.

### 5. Abuse protection (mandatory, not polish)
- New route `/api/guest/claim` that server-verifies a Cloudflare Turnstile token **before** the client is allowed to call `signInAnonymously()`.
- Reuse `src/lib/rateLimit.ts` to cap guest creations per IP.
- Why mandatory: Gemini Live voice is expensive. Refresh-loop bots could drain quota overnight.

### 6. Cleanup cron (optional)
- Supabase cron or Vercel cron: nightly delete anonymous users older than N days with no linked identity.
- Cascading FK constraints already delete their sessions / errors / vocab.

### 7. Copy pass (after 1–5 ship)
- Hero note → "Start free — sign in to save."
- Add "No sign-in for your first session" micro-line under primary CTA.

---

## Known sharp edges

- **Quota keying**: `src/lib/rateLimit.ts` must continue working correctly across the link. Anonymous UUID = post-link UUID, so it should, but confirm no code branches on `is_anonymous`.
- **Multiple learners**: `LearnerSwitcher` probably doesn't make sense for guests. Pin them to one default learner at anonymous-user creation.
- **Session-end detection**: voice, chat, and journal each have their own "end" moment. Confirm each triggers the save prompt exactly once — that's where subtle bugs hide.
- **Cost**: an unclaimed anonymous visitor chewing through Gemini Live adds cost the project won't recover. The 5/hr/IP cap + daily per-user quota together are what keep this safe.

---

## Rough effort

~1 focused day. The real risk isn't auth — it's abuse protection and covering every session-end path for the save prompt.
