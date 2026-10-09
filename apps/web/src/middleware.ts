import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_ROUTES = [
  "/",
  "/dashboard",
  "/documents",
  "/analysis",
  "/assistant",
  "/research",
  "/reports",
  "/settings",
];

const AUTH_ROUTES = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("legalai_session")?.value;

  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // If user is not logged in and attempts to access a protected route
  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") {
      loginUrl.searchParams.set("from", pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-middleware-cache", "no-cache");
    return response;
  }

  // If user is already logged in and attempts to access login/register,
  // redirect them to the destination in 'from' or to /dashboard
  if (isAuthRoute && sessionToken) {
    const fromParam = request.nextUrl.searchParams.get("from");
    const targetPath =
      fromParam &&
      fromParam.startsWith("/") &&
      !fromParam.startsWith("/login") &&
      !fromParam.startsWith("/register")
        ? fromParam
        : "/dashboard";
    const dashboardUrl = new URL(targetPath, request.url);
    const response = NextResponse.redirect(dashboardUrl);
    response.headers.set("x-middleware-cache", "no-cache");
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-middleware-cache", "no-cache");
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
