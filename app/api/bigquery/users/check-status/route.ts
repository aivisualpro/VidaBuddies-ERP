import { NextResponse } from "next/server";

// Stub: silences 404 noise from LagniappePRO heartbeat plugin
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
