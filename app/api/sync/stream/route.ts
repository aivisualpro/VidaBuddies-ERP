import { NextResponse } from "next/server";

// Stub: silences 404 noise from LagniappePRO SSE fallback
export async function GET() {
  return NextResponse.json({});
}
