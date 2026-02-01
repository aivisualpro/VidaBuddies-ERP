import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";

export async function POST(request: Request) {
  console.log("[Auth API] Login request received");
  try {
    const { email, password } = await request.json();
    console.log(`[Auth API] Attempting login for: ${email}`);

    await connectToDatabase();
    
    // In a real app, you would hash and compare passwords.
    // For now, we find the user by email.
    const user = await VidaUser.findOne({ email: email.toLowerCase() });

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your account is inactive. Please contact your administrator." }, { status: 403 });
    }

    // Assuming password check passes for now since user didn't specify password hashing logic yet
    // and the original code just checked email.
    
    const userData = {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.AppRole || "Manager",
      avatar: user.profilePicture || "/logo.png",
    };

    await login(userData);

    return NextResponse.json({ success: true, user: userData });
  } catch (error: any) {
    console.error("[Auth API] Login Error:", error);
    return NextResponse.json({ 
      error: error.message || "Authentication failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined
    }, { status: 500 });
  }
}
