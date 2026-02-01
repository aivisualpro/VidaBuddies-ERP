import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth-utils";

const protectedRoutes = ["/dashboard", "/admin", "/inventory"];
const publicRoutes = ["/login"];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  
  // Skip API and static assets
  if (path.startsWith('/api') || path.includes('_next') || path.includes('.')) {
    return NextResponse.next();
  }

  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route)) || path === "/";
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get("vb_session")?.value;
  let session = null;
  if (cookie) {
    try {
      session = await decrypt(cookie);
    } catch (e) {
      // session is invalid
    }
  }

  // Log for debugging
  console.log(`[Middleware] Path: ${path}, Session: ${!!session}, Protected: ${isProtectedRoute}`);

  if (isProtectedRoute && !session && path !== "/login") {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (session && (path === "/login" || path === "/")) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
