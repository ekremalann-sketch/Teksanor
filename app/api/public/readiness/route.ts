import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    await getDb().prepare("SELECT 1 AS ok").first();
    return NextResponse.json({ ready: true, service: "teksanor", time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
