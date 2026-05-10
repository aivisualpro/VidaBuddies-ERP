import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Returns the current build ID / deployment version.
 * On Vercel: uses VERCEL_GIT_COMMIT_SHA (set automatically).
 * Locally: uses a timestamp so it never triggers update banners.
 */
export function GET() {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    "dev";

  return NextResponse.json({ buildId }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
