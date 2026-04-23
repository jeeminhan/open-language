import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/onboarding"]);
const PUBLIC_PREFIXES = [
  "/login/",
  "/signup/",
  "/onboarding/",
  "/auth/",
  "/_next/",
];

const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/webhooks/",
];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  if (path === "/favicon.ico") return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isPublicApi(path: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

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

  const isApi = path.startsWith("/api/");
  const isPublicApiRoute = isPublicApi(path);
  const isPublic = isPublicPath(path);

  if (!user && isApi && !isPublicApiRoute) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!user && !isPublic && !isApi) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // If logged in and on login page, redirect to chat
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html)$).*)",
  ],
};
