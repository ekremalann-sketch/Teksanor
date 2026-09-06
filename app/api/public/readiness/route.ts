import { NextResponse } from "next/server";
import { criticalBacklog, departmentReality, readinessSnapshot, roadmapPhases, workingModules } from "@/lib/readiness";

export async function GET() {
  return NextResponse.json({ readinessSnapshot, workingModules, criticalBacklog, roadmapPhases, departmentReality }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
