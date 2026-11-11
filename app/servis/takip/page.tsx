"use client";
import {useEffect,useState} from "react";
import "../service.css";

type Tracking={company:string;number:string;title:string;status:string;stage:string;updatedAt:string;plannedDate:string|null;totalCents:number;paidCents:number;remainingCents:number};
const money=(c:number)=>(c/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const STEPS=[["requested","Talep alındı"],["quoted","Teklif"],["quote_approved","Onay"],["in_progress","İşlemde"],["completed","Tamamlandı"],["accepted","Teslim"]] as const;
const ORDER=["requested","quoted","quote_approved","in_progress","completed","accepted","collected"];

// Müşterinin üyeliksiz servis takip sayfası. Kod adres çubuğunun # kısmında gelir; sunucu kayıtlarına düşmez.
export default function ServiceTracking(){
 const [data,setData]=useState<Tracking|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  const code=new URLSearchParams(location.hash.slice(1)).get("kod")||"";
  if(!code){setError("Takip bağlantısı eksik. Firmanızın gönderdiği bağlantıyı açın.");return;}
  fetch("/api/service/tracking?code="+encodeURIComponent(code),{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}).catch(e=>setError(e instanceof Error?e.message:"Bilgi alınamadı."));
 },[]);
 const reached=data?ORDER.indexOf(data.stage):-1;
 return <main className="service-approval service-tracking">
  <h1>Servis takibi</h1>
  {error&&<p role="alert">{error}</p>}
  {!data&&!error&&<p role="status">Yükleniyor…</p>}
  {data&&<section className="service-card">
   <p className="service-muted">{data.company} · {data.number}</p>
   <h2>{data.title}</h2>
   <p className="service-tracking-status" role="status"><b>{data.status}</b></p>
   {data.stage!=="cancelled"&&<ol className="service-tracking-steps">{STEPS.map(([key,label])=><li key={key} className={ORDER.indexOf(key)<=reached?"done":""}>{label}</li>)}</ol>}
   <dl className="service-tracking-facts">
    {data.plannedDate&&<div><dt>Planlanan tarih</dt><dd>{data.plannedDate}</dd></div>}
    <div><dt>Son güncelleme</dt><dd>{data.updatedAt}</dd></div>
    {data.totalCents>0&&<><div><dt>Toplam</dt><dd>{money(data.totalCents)}</dd></div><div><dt>Ödenen</dt><dd>{money(data.paidCents)}</dd></div><div><dt>Kalan</dt><dd><b>{money(data.remainingCents)}</b></dd></div></>}
   </dl>
   <small className="service-muted">Bu sayfa yalnız size gönderilen bağlantıyla açılır. Sorularınız için servis firmanızı arayın.</small>
  </section>}
 </main>;
}
