import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/chat";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Route new users to onboarding, returning users to their destination
  const res = await fetch(new URL("/api/learners", url.origin), {
    headers: { cookie: cookieStore.toString() },
  });
  let hasLearners = false;
  if (res.ok) {
    const learners = await res.json();
    hasLearners = Array.isArray(learners) && learners.length > 0;
  }

  const destination = next !== "/chat" ? next : hasLearners ? "/chat" : "/onboarding";
  return NextResponse.redirect(new URL(destination, url.origin));
}
