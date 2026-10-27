import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { accessRules, type AccessProfile } from "@/lib/access";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const current = await getCurrentUser(request);
  if (!current) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, current); }
  catch (error) { return NextResponse.json({ error: "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(current, context.organization)) return NextResponse.json({ error: "Şirket yöneticisi yetkisi gerekli." }, { status: 403 });
  const body = (await request.json()) as { username?: string; fullName?: string; password?: string; role?: string; accessProfile?: string; department?: string; jobRole?: string };
  const username = body.username?.trim().toLowerCase() ?? "";
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || !body.fullName || !body.password || body.password.length < 10 || body.password.length > 128) {
    return NextResponse.json({ error: "3-32 karakterli kullanıcı adı, görünen ad ve en az 10 karakterli parola gereklidir." }, { status: 400 });
  }
  const id = createId("user");
  const credentials = await hashPassword(body.password);
  const requestedProfile = body.role === "admin" ? "company_admin" : body.accessProfile;
  const accessProfile = (requestedProfile && requestedProfile in accessRules ? requestedProfile : "employee") as AccessProfile;
  if (accessProfile === "owner") return NextResponse.json({ error: "Firma sahipliği bu ekrandan devredilemez." }, { status: 400 });
  try {
    await getDb().batch([
      getDb().prepare("INSERT INTO users (id, username, email, full_name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?, 'user')")
        .bind(id, username, `${username}@users.teksanor.internal`, body.fullName.trim(), credentials.hash, credentials.salt),
      getDb().prepare("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)")
        .bind(context.organization.id, id, accessProfile === "company_admin" ? "admin" : "member"),
      getDb().prepare(`INSERT INTO organization_member_access
        (organization_id, user_id, job_role, department, access_profile) VALUES (?, ?, ?, ?, ?)`)
        .bind(context.organization.id, id, body.jobRole?.trim() || accessProfile, body.department?.trim() || null, accessProfile),
    ]);
    await addAudit(current.id, "create", "user", id, `${body.fullName} kullanıcısı oluşturuldu.`, context.organization.id);
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Bu kullanıcı adı zaten kayıtlı olabilir." }, { status: 409 });
  }
}

export async function GET(request:Request){
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 try{const {organization}=await requireOrganization(request,user);if(!canManageOrganization(user,organization))throw new Error();
 const rows=await getDb().prepare(`SELECT u.id,u.username,u.full_name,m.role,m.active,a.access_profile,a.job_role,a.department FROM organization_members m JOIN users u ON u.id=m.user_id LEFT JOIN organization_member_access a ON a.organization_id=m.organization_id AND a.user_id=m.user_id WHERE m.organization_id=? ORDER BY m.active DESC, u.full_name`).bind(organization.id).all();
 return NextResponse.json({users:rows.results,currentUserId:user.id,organizationId:organization.id},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Firma yöneticisi yetkisi gerekli."},{status:403});}
}
