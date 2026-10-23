import {NextResponse} from "next/server";
import {getCurrentUser,enforceAuthRateLimit} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {rejectCrossSiteMutation} from "@/lib/security";
import {draftFromNote} from "@/lib/ai-privacy";

export async function POST(request:Request){
 const rejected=rejectCrossSiteMutation(request);if(rejected)return rejected;
 const user=await getCurrentUser(request);if(!user)return NextResponse.json({error:"Oturum gerekli."},{status:401});
 try{
  await requireOrganization(request,user);await enforceAuthRateLimit(request,"login",`draft:${user.id}`);
  const b=await request.json() as {note?:string};const note=String(b.note||"").trim().slice(0,6000);
  if(!note)return NextResponse.json({error:"Önce saha notu yazın."},{status:400});
  return NextResponse.json({draft:draftFromNote(note),source:"template"});
 }catch{return NextResponse.json({error:"Taslak oluşturulamadı. Notunuz korunuyor."},{status:503});}
}
