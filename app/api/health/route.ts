import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const row = await getDb().prepare("SELECT COUNT(*) AS c FROM organizations").first<{ c: number }>();
    return NextResponse.json({ status: "ok", database: "up", organizations: row?.c ?? 0, time: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: "degraded", database: "down", error: error instanceof Error ? error.message : "bilinmeyen" }, { status: 500 });
  }
}
