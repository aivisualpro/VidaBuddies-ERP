import { SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export { decrypt } from "./auth-utils";
import { decrypt as decryptLocal, key } from "./auth-utils";

// 30 days in milliseconds — keeps PWA users logged in
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function login(userData: any) {
  // Create the session with minimal data to keep header size small
  const minimalSession = {
    id: userData.id,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    expires: new Date(Date.now() + SESSION_DURATION_MS)
  };

  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt(minimalSession);

  // Save the session in a cookie — 30 days so PWA stays logged in
  const cookieStore = await cookies();
  cookieStore.set("vb_session", session, { 
    expires, 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: 'lax',
    path: '/'
  });
}

export async function logout() {
  // Destroy the session
  (await cookies()).set("vb_session", "", { expires: new Date(0), path: '/' });
}

export async function getSession() {
  const session = (await cookies()).get("vb_session")?.value;
  if (!session) return null;
  try {
    return await decryptLocal(session);
  } catch (e) {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("vb_session")?.value;
  if (!session) return null;

  // Refresh the session so it doesn't expire — rolling 30-day window
  const parsed = await decryptLocal(session);
  parsed.expires = new Date(Date.now() + SESSION_DURATION_MS);
  const res = NextResponse.next();
  res.cookies.set({
    name: "vb_session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
    secure: process.env.NODE_ENV === "production",
    sameSite: 'lax'
  });
  return res;
}
