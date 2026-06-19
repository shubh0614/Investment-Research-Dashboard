import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Routes the proxy should never redirect away from.
  // API routes handle their own auth and return JSON 401/403 — never redirect them to /login.
  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/api/");

  // We must create a mutable response so @supabase/ssr can refresh auth cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          // Propagate any refreshed cookies to both the request and the response.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT server-side and refreshes the session when needed.
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (isPublic) return response;
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Authenticated user on a public auth page → send to the app.
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Authenticated user with no profile → must complete onboarding first.
  if (pathname !== "/onboarding" && !pathname.startsWith("/api/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run on every request except Next.js internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)",
  ],
};
