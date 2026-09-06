import QRCode from "qrcode/lib/browser.js";
import {getCurrentUser} from "@/lib/auth";
import {requireOrganization} from "@/lib/tenancy";
import {requireModuleAccess} from "@/lib/access";
import {getDb} from "@/lib/db";
export async function GET(request:Request){
 const user=await getCurrentUser(request);if(!user)return new Response("Oturum gerekli",{status:401});
 try{const {organization}=await requireOrganization(request,user);await requireModuleAccess(user,organization,"assets");
 const id=new URL(request.url).searchParams.get("asset")||"";if(!await getDb().prepare("SELECT id FROM assets WHERE id=? AND organization_id=?").bind(id,organization.id).first())return new Response("Bulunamadı",{status:404});
 const target=new URL("/servis",request.url);target.searchParams.set("asset",id);target.searchParams.set("organizationId",organization.id);
 const svg=await QRCode.toString(target.href,{type:"svg",errorCorrectionLevel:"M",margin:2});
 return new Response(svg,{headers:{"Content-Type":"image/svg+xml","Cache-Control":"private, no-store","Content-Disposition":"attachment; filename=ekipman-qr.svg"}});
 }catch{return new Response("Erişim reddedildi",{status:403});}
}
