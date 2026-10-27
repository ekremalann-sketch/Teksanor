import { getCurrentUser } from "@/lib/auth";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { NextResponse } from "next/server";
import { criticalBacklog, departmentReality, readinessSnapshot, roadmapPhases, workingModules } from "@/lib/readiness";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({error:"Oturum gerekli."},{status:401});
  try { const {organization}=await requireOrganization(request,user); if(!canManageOrganization(user,organization)) throw new Error(); }
  catch { return NextResponse.json({error:"Yönetici yetkisi gerekli."},{status:403}); }
  return NextResponse.json({ readinessSnapshot, workingModules, criticalBacklog, roadmapPhases, departmentReality }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
