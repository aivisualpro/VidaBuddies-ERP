import { NextRequest, NextResponse } from "next/server";
import { logout } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await logout();
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  await logout();
  const searchParams = req.nextUrl.searchParams;
  if (searchParams.get("redirect") === "true") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.json({ success: true });
}
