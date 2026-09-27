"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import "../service.css";

type Job={id:string;version:number;title:string;customer_name:string;order_number:string;scheduled_date:string|null;stage:string;assigned_user_id:string|null};
type Data={jobs:Job[];members:{id:string;full_name:string}[];manage:boolean;userId:string;organization:{id:string;name:string}};
const CLOSED=["accepted","collected","cancelled"];
const DAILY_LIMIT=3; // kişi başı günde 3'ten fazla iş aşırı yük sayılır
// Yerel takvim günü (Türkiye saatinde gece yarısından sonra UTC bir gün geride kalmasın).
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function monday(d:Date){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate(),12);x.setDate(x.getDate()-(x.getDay()+6)%7);return x;}
const addDays=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const dayName=(d:Date)=>d.toLocaleDateString("tr-TR",{weekday:"short",day:"numeric",month:"short"});

// Planlama panosu: teknisyen × gün. Yönetici bir işe tıklayıp tarih ve sorumlu atar.
// Çalışan yalnız kendi satırını görür (sunucu zaten yalnız ona atanan işleri döndürür).
export default function PlanBoard(){
 const [data,setData]=useState<Data|null>(null),[week,setWeek]=useState(()=>monday(new Date())),[edit,setEdit]=useState<Job|null>(null),[date,setDate]=useState(""),[who,setWho]=useState(""),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const org=()=>{try{return new URLSearchParams(location.search).get("organizationId")||localStorage.getItem("teksanor_organization")||"";}catch{return "";}};
 const fetchJobs=useCallback(async()=>{const r=await fetch("/api/service/jobs",{headers:{"X-Organization-Id":org()},cache:"no-store"});if(r.status===401){location.href="/giris";throw new Error("Giriş gerekli.");}const d=await r.json();if(!r.ok)throw new Error(d.error||"Plan alınamadı.");return d as Data;},[]);
 useEffect(()=>{let alive=true;fetchJobs().then(d=>{if(alive)setData(d);}).catch(e=>{if(alive)setMsg(String(e.message||e));});return()=>{alive=false;};},[fetchJobs]);
 const days=useMemo(()=>Array.from({length:7},(_,i)=>addDays(week,i)),[week]);
 const people=useMemo(()=>{if(!data)return [];const list=data.manage?data.members.map(m=>({id:m.id,name:m.full_name})):[{id:data.userId,name:"Benim işlerim"}];if(data.manage&&!list.some(p=>p.id===data.userId))list.unshift({id:data.userId,name:"Ben"});return list;},[data]);
 const open=(data?.jobs||[]).filter(j=>!CLOSED.includes(j.stage));
 const unscheduled=open.filter(j=>!j.scheduled_date);
 const today=iso(new Date());
 function choose(j:Job){if(!data?.manage)return;setEdit(j);setDate(j.scheduled_date||"");setWho(j.assigned_user_id||data.userId);setMsg("");}
 async function save(){if(!edit||!data)return;setBusy(true);try{const r=await fetch("/api/service/jobs",{method:"POST",headers:{"Content-Type":"application/json","X-Organization-Id":data.organization.id},body:JSON.stringify({action:"schedule",id:edit.id,version:edit.version,scheduledDate:date||null,assignedUserId:who})});const d=await r.json();if(!r.ok)throw new Error(d.error);setEdit(null);setMsg("Plan kaydedildi.");setData(await fetchJobs());}catch(e){setMsg(e instanceof Error?e.message:"Kaydedilemedi.");}finally{setBusy(false);}}
 const card=(j:Job)=><button key={j.id} type="button" className="plan-card" onClick={()=>choose(j)} aria-label={`${j.title}, ${j.customer_name||"müşteri yok"}${data?.manage?", planı değiştir":""}`}><b>{j.title}</b><small>{j.order_number} · {j.customer_name||"Müşteri yok"}</small></button>;
 return <main className="service-shell">
  <header className="service-header"><div><Link href="/servis">← Servis masası</Link><h1>Planlama panosu</h1><p>{data?.organization.name||"Yükleniyor"} · kişi başı günde {DAILY_LIMIT}+ iş uyarı verir</p></div></header>
  <div className="plan-toolbar"><button type="button" onClick={()=>setWeek(addDays(week,-7))}>← Önceki hafta</button><strong>{dayName(days[0])} – {dayName(days[6])}</strong><button type="button" onClick={()=>setWeek(addDays(week,7))}>Sonraki hafta →</button><button type="button" onClick={()=>setWeek(monday(new Date()))}>Bu hafta</button></div>
  <p className="service-message" role="status">{msg}</p>
  {edit&&<section className="plan-editor" aria-label="İşi planla"><div><b>{edit.title}</b><p className="checklist-muted">{edit.order_number}</p></div>
   <label>Tarih<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Sorumlu<select value={who} onChange={e=>setWho(e.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <div className="service-actions"><button type="button" disabled={busy} onClick={()=>void save()}>Planı kaydet</button><button type="button" onClick={()=>{setDate("");}}>Tarihi kaldır</button><button type="button" onClick={()=>setEdit(null)}>Vazgeç</button></div></section>}
  <div className="plan-grid" role="region" aria-label="Haftalık iş planı: satırlar teknisyen, sütunlar gün" tabIndex={0}>
   <div className="plan-h">Teknisyen</div>
   {days.map(d=><div key={iso(d)} className={`plan-h ${iso(d)===today?"today":""}`}>{dayName(d)}</div>)}
   {people.map(p=><div key={p.id} style={{display:"contents"}}>
    <div className="plan-person">{p.name}</div>
    {days.map(d=>{const list=open.filter(j=>j.assigned_user_id===p.id&&j.scheduled_date===iso(d));const over=list.length>DAILY_LIMIT;return <div key={iso(d)} className={`plan-cell ${over?"overload":""}`} role="group" aria-label={`${p.name}, ${dayName(d)}: ${list.length} iş`}>{over&&<span className="plan-warn">Aşırı yük: {list.length} iş</span>}{list.map(card)}</div>;})}
   </div>)}
  </div>
  <section className="plan-unscheduled"><h2>Tarihsiz işler ({unscheduled.length})</h2>{unscheduled.length?<ul>{unscheduled.map(j=><li key={j.id}>{card(j)}</li>)}</ul>:<p className="checklist-muted">Tüm açık işler planlandı.</p>}</section>
 </main>;
}
