import { NextResponse } from "next/server";
import { getSession, logout } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  if (session.role === "Supplier") {
    return NextResponse.json({ authenticated: true, user: session });
  }

  await connectToDatabase();
  const user = await VidaUser.findById(session.id);

  if (!user || !user.isActive) {
    await logout();
    return NextResponse.json({ authenticated: false, error: "Account inactive" }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user: session });
}
