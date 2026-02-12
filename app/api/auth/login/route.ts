import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VerificationCode from "@/lib/models/VerificationCode";
import { Resend } from "resend";
import crypto from "crypto";
import { key } from "@/lib/auth-utils";

const resend = new Resend(process.env.RESEND_API_KEY);

function generate6DigitCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(request: Request) {
  console.log("[Auth API] Login request received");
  try {
    const { email, password } = await request.json();
    console.log(`[Auth API] Attempting login for: ${email}`);

    await connectToDatabase();

    const user = await VidaUser.findOne({ email: email.toLowerCase() });

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your account is inactive. Please contact your administrator." }, { status: 403 });
    }

    // Generate 6-digit verification code
    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any previous codes for this user
    await VerificationCode.deleteMany({ userId: user._id });

    // Store the new code
    await VerificationCode.create({
      userId: user._id,
      code,
      email: user.email,
      expiresAt,
    });

    // Send code via email
    const { error: emailError } = await resend.emails.send({
      from: "Vida Buddies <noreply@app.vidabuddies.com>",
      to: [user.email],
      subject: "Your Vida Buddies Login Code",
      html: `
        <div style="font-family: 'Poppins', 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #09090b; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #18181b 0%, #09090b 100%); padding: 40px 40px 30px 40px; text-align: center;">
            <img src="https://vida-buddies-erp.vercel.app/logo.png" alt="Vida Buddies" style="width: 64px; height: 64px; margin-bottom: 16px;" />
            <h1 style="color: #fafafa; font-size: 22px; font-weight: 700; margin: 0 0 8px 0; letter-spacing: -0.5px;">Verification Code</h1>
            <p style="color: #71717a; font-size: 14px; margin: 0;">Enter this code to complete your login</p>
          </div>
          <div style="padding: 40px;">
            <div style="background: linear-gradient(135deg, #1c1c21 0%, #18181b 100%); border: 1px solid #27272a; border-radius: 16px; padding: 32px; text-align: center; margin-bottom: 24px;">
              <p style="margin: 0 0 12px 0; color: #71717a; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your 6-Digit Code</p>
              <div style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #fafafa; font-family: 'SF Mono', 'Fira Code', monospace; padding: 8px 0;">${code}</div>
            </div>
            <div style="background: #1c1c21; border-radius: 12px; padding: 16px; border: 1px solid #27272a;">
              <p style="color: #a1a1aa; font-size: 13px; margin: 0; line-height: 20px;">
                ⏱️ This code expires in <strong style="color: #fafafa;">10 minutes</strong>
              </p>
              <p style="color: #71717a; font-size: 12px; margin: 8px 0 0 0; line-height: 18px;">
                If you did not request this code, please ignore this email or contact your administrator immediately.
              </p>
            </div>
          </div>
          <div style="padding: 24px 40px; border-top: 1px solid #1c1c21; text-align: center;">
            <p style="color: #52525b; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} Vida Buddies. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error("[Auth API] Email send error:", emailError);
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }

    // Create a short-lived verification token to tie the 2FA step to this user
    const verificationToken = await new SignJWT({
      userId: user._id.toString(),
      email: user.email,
      purpose: "2fa",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(key);

    // Mask the email for display
    const parts = user.email.split("@");
    const masked = parts[0].substring(0, 2) + "***@" + parts[1];

    console.log(`[Auth API] 2FA code sent to ${user.email}`);
    return NextResponse.json({
      requiresVerification: true,
      verificationToken,
      maskedEmail: masked,
      message: "Verification code sent to your email",
    });
  } catch (error: any) {
    console.error("[Auth API] Login Error:", error);
    return NextResponse.json({
      error: error.message || "Authentication failed",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }, { status: 500 });
  }
}
