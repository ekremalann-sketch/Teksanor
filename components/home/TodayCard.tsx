"use client";
import {useEffect,useState} from "react";
import {ArrowRight,CalendarClock,CheckCircle2,Circle,ClipboardList,X} from "lucide-react";
import {bucketOf,BUCKET_LABEL,localDay,sortJobs} from "@/lib/service-ui";

type Job={id:string;title:string;customer_name:string|null;stage:string;scheduled_date:string|null;updated_at?:string};
type Jobs={jobs:Job[];members:{id:string;username?:string}[];manage:boolean};
type Profile={legal_name?:string;tax_number?:string;address?:string}|null;

// Panelin en üstündeki "Bugün" kartı: kişinin açık servis işleri önceliğe göre ve tek dokunuşla açılır.
// Yönetici için ayrıca "Başlangıç listesi": sistemi kullanıma hazırlamak için kalan adımlar.
export function TodayCard({organizationId,profile,canManage,onNavigate}:{organizationId:string;profile:Profile;canManage:boolean;onNavigate:(page:string)=>void}){
 const [data,setData]=useState<Jobs|null>(null),[templates,setTemplates]=useState<number|null>(null),[hidden,setHidden]=useState(false);
 useEffect(()=>{
  let alive=true;const h={"X-Organization-Id":organizationId};
  fetch("/api/service/jobs",{headers:h,cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(alive)setData(d);}).catch(()=>{});
  if(canManage)fetch("/api/service/checklists",{headers:h,cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(alive&&d)setTemplates(d.templates?.length??0);}).catch(()=>{});
  try{setHidden(localStorage.getItem(`teksanor-setup-done:${organizationId}`)==="1");}catch{}
  return()=>{alive=false;};
 },[organizationId,canManage]);
 if(!data)return null; // servis modülü yetkisi yoksa kart gösterilmez
 const today=localDay();
 const open=sortJobs(data.jobs.filter(j=>bucketOf(j,today)!=="closed"),today);
 const n=(b:string)=>open.filter(j=>bucketOf(j,today)===b).length;
 const steps=[
  {done:Boolean(profile?.legal_name&&profile?.tax_number&&profile?.address),label:"Firma unvanı, vergi no ve adresini girin",hint:"Teklif, servis formu ve fatura taslağında kullanılır.",go:()=>onNavigate("company")},
  {done:data.members.some(member=>!["admin1","admin2"].includes(String(member.username||""))),label:"Ekibinizi ekleyin",hint:"Her teknisyen kendi telefonundan yalnız kendi işlerini görür.",go:()=>onNavigate("users")},
  {done:(templates??0)>0,label:"Bir saha formu şablonu seçin",hint:"Hazır şablonlar: klima bakım, jeneratör testi, iş güvenliği.",href:"/servis/sablonlar"},
  {done:data.jobs.length>0,label:"İlk servis işini açın",hint:"Talep → teklif → onay → saha → tahsilat.",href:"/servis"},
 ];
 const remaining=steps.filter(s=>!s.done).length;
 const showSetup=canManage&&data.manage&&remaining>0&&!hidden;
 return <section className="today-card" aria-labelledby="today-title">
  <div className="today-head"><span><CalendarClock size={20}/><b id="today-title">Bugün</b></span>
   <div className="today-counts"><span className={n("overdue")?"bad":""}>Geciken <b>{n("overdue")}</b></span><span>Bugün <b>{n("today")}</b></span><span>Bu hafta <b>{n("week")}</b></span><span>Tarihsiz <b>{n("unscheduled")}</b></span></div>
   <a className="today-open" href="/servis">Servis masası <ArrowRight size={16}/></a></div>
  {open.length?<ul className="today-list">{open.slice(0,5).map(j=>{const b=bucketOf(j,today);return <li key={j.id}><a href={`/servis?job=${encodeURIComponent(j.id)}`}><span className={`today-tag ${b}`}>{j.stage==="accepted"?"Tahsilat bekliyor":BUCKET_LABEL[b]}</span><span><b>{j.title}</b><small>{j.customer_name||"Müşteri belirtilmedi"}{j.scheduled_date?` · ${new Date(j.scheduled_date+"T12:00:00").toLocaleDateString("tr-TR",{weekday:"short",day:"numeric",month:"short"})}`:""}</small></span><ArrowRight size={16}/></a></li>;})}</ul>
   :<p className="today-empty"><ClipboardList size={18}/>{data.manage?"Açık servis işi yok.":"Size atanmış açık iş yok. Yöneticiniz iş atadığında burada görünür."}</p>}
  {open.length>5&&<a className="today-more" href="/servis">Tümünü gör ({open.length})</a>}
  {showSetup&&<div className="setup-list" aria-label="Başlangıç listesi">
   <div className="setup-head"><b>Başlangıç listesi · {steps.length-remaining}/{steps.length}</b><button type="button" aria-label="Başlangıç listesini gizle" onClick={()=>{setHidden(true);try{localStorage.setItem(`teksanor-setup-done:${organizationId}`,"1");}catch{}}}><X size={16}/></button></div>
   <ol>{steps.map(s=><li key={s.label} className={s.done?"done":""}>{s.done?<CheckCircle2 size={18}/>:<Circle size={18}/>}<span><b>{s.label}</b><small>{s.hint}</small></span>{!s.done&&(s.href?<a href={s.href}>Başla</a>:<button type="button" onClick={s.go}>Başla</button>)}</li>)}</ol>
  </div>}
 </section>;
}
