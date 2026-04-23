"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

interface AuthReady {
  user: User | null;
  isGuest: boolean;
  ready: boolean;
  error: string | null;
}

/**
 * Ensures there is a signed-in user (anonymous if needed) before rendering
 * gated UI. `isGuest` mirrors Supabase's built-in `user.is_anonymous` flag.
 *
 * Note: anonymous sign-ins are gated server-side by a per-IP rate limit set in
 * the Supabase dashboard (Auth → Rate Limits). Abuse protection beyond that
 * (Turnstile) is tracked separately in GUEST_FLOW.md step 5.
 */
export function useAuthReady(): AuthReady {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowser();

    async function bootstrap() {
      const { data: getData } = await supabase.auth.getUser();
      if (cancelled) return;

      if (getData.user) {
        setUser(getData.user);
        setReady(true);
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
      if (cancelled) return;

      if (signInError || !signInData.user) {
        setError(signInError?.message ?? "Guest sign-in failed");
        setReady(true);
        return;
      }

      setUser(signInData.user);
      setReady(true);
    }

    bootstrap();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    isGuest: user?.is_anonymous === true,
    ready,
    error,
  };
}
