import { NextResponse } from "next/server";
import { login } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VerificationCode from "@/lib/models/VerificationCode";
import { decrypt } from "@/lib/auth-utils";

const MAX_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const { code, verificationToken } = await request.json();

    if (!code || !verificationToken) {
      return NextResponse.json({ error: "Missing verification code or token" }, { status: 400 });
    }

    // Verify the token
    let tokenPayload: any;
    try {
      tokenPayload = await decrypt(verificationToken);
    } catch {
      return NextResponse.json({ error: "Verification session expired. Please login again." }, { status: 401 });
    }

    if (tokenPayload.purpose !== "2fa") {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 401 });
    }

    await connectToDatabase();

    // Find the verification code
    const verification = await VerificationCode.findOne({
      userId: tokenPayload.userId,
      expiresAt: { $gt: new Date() },
    });

    if (!verification) {
      return NextResponse.json({ error: "Verification code expired. Please login again." }, { status: 410 });
    }

    // Check max attempts
    if (verification.attempts >= MAX_ATTEMPTS) {
      await VerificationCode.deleteOne({ _id: verification._id });
      return NextResponse.json({ error: "Too many failed attempts. Please login again." }, { status: 429 });
    }

    // Verify the code
    if (verification.code !== code.trim()) {
      verification.attempts += 1;
      await verification.save();
      const remaining = MAX_ATTEMPTS - verification.attempts;
      return NextResponse.json({
        error: `Invalid code. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`,
      }, { status: 401 });
    }

    // Code is valid! Clean up and create session
    await VerificationCode.deleteOne({ _id: verification._id });

    // Fetch user data for session
    const user = await VidaUser.findById(tokenPayload.userId);
    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found or account deactivated." }, { status: 404 });
    }

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.AppRole || "Manager",
      avatar: user.profilePicture || "/logo.png",
    };

    await login(userData);

    return NextResponse.json({ success: true, user: userData });
  } catch (error: any) {
    console.error("[Auth API] Verification Error:", error);
    return NextResponse.json({
      error: error.message || "Verification failed",
    }, { status: 500 });
  }
}
