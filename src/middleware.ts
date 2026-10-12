import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Page-level guard. API routes do their own checks (and also re-check the account is active).
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  const toLogin = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  };

  if (pathname.startsWith("/admin")) {
    if (!session) return toLogin();
    if (session.role !== "HR_ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/scanner";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/scanner") && !session) return toLogin();

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/scanner/:path*"],
};
