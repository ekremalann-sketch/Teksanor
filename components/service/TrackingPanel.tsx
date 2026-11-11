"use client";
import {useState} from "react";
import QRCode from "qrcode/lib/browser.js";
import {DEFAULT_TRACKING_TEMPLATE,fillTemplate,CUSTOMER_STAGE_LABELS} from "@/lib/service-tracking";

type Props={jobId:string;organizationId:string;title:string;customer:string;stage:string;remainingCents?:number};
const money=(c:number)=>(c/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});

// Müşteriye takip bağlantısı: QR, WhatsApp ile gönderme ve kopyalama. Yeni bağlantı eskisini geçersiz kılar.
export function TrackingPanel({jobId,organizationId,title,customer,stage,remainingCents}:Props){
 const [link,setLink]=useState(""),[qr,setQr]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function create(){
  if(busy)return;setBusy(true);setMessage("");
  try{
   const r=await fetch("/api/service/tracking",{method:"POST",headers:{"Content-Type":"application/json","X-Organization-Id":organizationId},body:JSON.stringify({jobId})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Bağlantı oluşturulamadı.");
   const url=new URL(d.path,location.origin).href;setLink(url);setQr(await QRCode.toDataURL(url,{margin:1,width:320}));
  }catch(e){setMessage(e instanceof Error?e.message:"Bağlantı oluşturulamadı.");}finally{setBusy(false);}
 }
 const text=link?fillTemplate(DEFAULT_TRACKING_TEMPLATE,{müşteri:customer||"",iş:title,durum:CUSTOMER_STAGE_LABELS[stage]??"",link,kalan:remainingCents?money(remainingCents):""}):"";
 return <details className="service-card">
  <summary>Müşteri takip bağlantısı</summary>
  <p>Müşteri üye olmadan işin durumunu, planlanan tarihi ve kalan tutarı görür. İç maliyet ve personel adı gösterilmez.</p>
  {!link&&<button type="button" disabled={busy} onClick={()=>void create()}>Takip bağlantısı oluştur</button>}
  {link&&<div className="service-tracking-share">
   {qr&&<img src={qr} alt="Takip bağlantısı QR kodu" width={160} height={160}/>}
   <input readOnly value={link} aria-label="Takip bağlantısı"/>
   <div className="service-actions">
    <a className="service-open-link share-wa" href={"https://wa.me/?text="+encodeURIComponent(text)} target="_blank" rel="noopener">WhatsApp ile gönder</a>
    <button type="button" onClick={()=>void navigator.clipboard?.writeText(link).then(()=>setMessage("Bağlantı kopyalandı."))}>Kopyala</button>
    <button type="button" disabled={busy} onClick={()=>void create()}>Yeni bağlantı üret</button>
   </div>
   <small>Yeni bağlantı üretirseniz eski bağlantı çalışmaz. QR kodu servis fişine yazdırabilirsiniz.</small>
  </div>}
  <p role="status">{message}</p>
 </details>;
}
