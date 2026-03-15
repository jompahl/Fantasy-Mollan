import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "johndahlberg14@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (session?.user?.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { username, newPassword } = body ?? {};

  if (!username || typeof username !== "string" || !newPassword || typeof newPassword !== "string") {
    return NextResponse.json({ error: "username and newPassword are required" }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(newPassword, 12);

  const { error, data: updated } = await supabase
    .from("credentials_users")
    .update({ password_hash })
    .eq("username", username.trim())
    .select("username");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
