import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // Refresh the session (important for token rotation)
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protected app routes
  const isAppRoute =
    path.startsWith("/chat") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/errors") ||
    path.startsWith("/grammar") ||
    path.startsWith("/fluency") ||
    path.startsWith("/pronunciation") ||
    path.startsWith("/sessions") ||
    path.startsWith("/vocabulary") ||
    path.startsWith("/knowledge") ||
    path.startsWith("/architecture");

  // Protected API routes (except auth endpoints)
  const isProtectedApi = path.startsWith("/api/") && !path.startsWith("/api/auth");

  if (!user && isAppRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (!user && isProtectedApi) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // If logged in and on login page, redirect to chat
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
