import { NextResponse } from "next/server";
import { ensureDefaultAdminAccounts, getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await ensureDefaultAdminAccounts();
    const user = await getCurrentUser(request);
    return NextResponse.json({ ready: true, authenticated: Boolean(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal hazırlanamadı.";
    return NextResponse.json({ ready: false, error: message }, { status: 503 });
  }
}
