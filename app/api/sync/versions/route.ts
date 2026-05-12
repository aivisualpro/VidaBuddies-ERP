import { NextResponse } from "next/server";

// Stub: silences 404 noise from LagniappePRO polling on the same port
export async function GET() {
  return NextResponse.json({});
}
