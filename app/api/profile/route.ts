import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import connectToDatabase from "@/lib/db";
import VidaUser from "@/lib/models/VidaUser";
import VidaSupplier from "@/lib/models/VidaSupplier"; // just in case for a supplier
import { encryptPassword } from "@/lib/encryption";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectToDatabase();
    
    const user: any = await VidaUser.findById(session.id).lean();
    if (user) {
      return NextResponse.json({
        name: user.name,
        email: user.email,
        phone: user.phone || "N/A",
        address: user.address || "N/A",
        role: user.AppRole,
        designation: user.designation,
        bio: user.bioDescription,
        profilePicture: user.profilePicture || "/logo.png"
      });
    }

    const supplier: any = await VidaSupplier.findById(session.id).lean();
    if (supplier) {
      return NextResponse.json({
        name: supplier.name,
        email: supplier.portalEmail,
        phone: supplier.contactNumber || "N/A",
        address: "N/A",
        role: "Supplier",
        designation: "Supplier Portal User",
        bio: "",
        profilePicture: "/logo.png"
      });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { password } = await request.json();
    if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

    await connectToDatabase();
    
    // Attempt user first
    const user = await VidaUser.findById(session.id);
    if (user) {
      // In Auth, password is plain text (except for supplier which uses encryptPassword)
      await VidaUser.findByIdAndUpdate(session.id, { password });
      return NextResponse.json({ success: true });
    }

    // Try supplier
    const supplier = await VidaSupplier.findById(session.id);
    if (supplier) {
      // Supplier logic uses encrypted string
      await VidaSupplier.findByIdAndUpdate(session.id, { portalPassword: encryptPassword(password) });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "User not found" }, { status: 404 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
