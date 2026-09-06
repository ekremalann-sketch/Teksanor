import {env} from "cloudflare:workers";
// Optional scanner contract: POST raw bytes -> { clean: boolean }. Never treats an outage as a clean scan.
export async function scanMalware(buffer:ArrayBuffer,contentType:string){
 const c=env as unknown as {FILE_SCAN_URL?:string;FILE_SCAN_TOKEN?:string;FILE_SCAN_REQUIRED?:string};
 if(!c.FILE_SCAN_URL||!c.FILE_SCAN_TOKEN){if(c.FILE_SCAN_REQUIRED==="true")throw new Error("Dosya tarama hizmeti hazır değil; yükleme durduruldu.");return "policy_checked";}
 const url=new URL(c.FILE_SCAN_URL);if(url.protocol!=="https:")throw new Error("Güvenli tarama adresi gerekli.");
 const r=await fetch(url,{method:"POST",signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${c.FILE_SCAN_TOKEN}`,"Content-Type":contentType},body:buffer,redirect:"error"});
 if(!r.ok)throw new Error("Dosya tarama hizmetine erişilemedi.");
 const result=await r.json() as {clean?:boolean};if(result.clean!==true)throw new Error("Dosya güvenlik taramasından geçemedi.");return "clean";
}
