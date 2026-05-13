import { NextResponse } from "next/server";
import { getSession, logout } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

export async function GET() {
  console.time("[session] total");

  // Parallelize session decryption and DB connection — independent operations
  const [session] = await Promise.all([
    getSession(),
    connectToDatabase(),
  ]);

  if (!session) {
    console.timeEnd("[session] total");
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (session.role === "Supplier") {
    console.timeEnd("[session] total");
    return NextResponse.json({ authenticated: true, user: session });
  }

  // Only fetch isActive — no need for the full Mongoose document
  const user = await VidaUser.findById(session.id, { isActive: 1 }).lean();

  if (!user || !(user as any).isActive) {
    await logout();
    console.timeEnd("[session] total");
    return NextResponse.json({ authenticated: false, error: "Account inactive" }, { status: 401 });
  }

  console.timeEnd("[session] total");
  return NextResponse.json({ authenticated: true, user: session });
}
