"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import "../service.css";
import {storedOrganization} from "@/lib/org-client";

type Summary={range:{from:string;to:string};collectedCents:number;expenseCents:number;netCents:number;
 byMethod:{method:string;label:string;inCents:number;outCents:number;expenseCents:number;netCents:number}[];
 byActor:{actor:string;count:number;netCents:number}[];
 movements:{kind:string;amount_cents:number;method:string;actor:string;created_at:string;order_number:string;title:string}[];
 expenses:{spent_on:string;description:string;amount_cents:number;method:string;actor:string}[]};
const money=(c:number)=>(c/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const KINDS:Record<string,string>={payment:"Tahsilat",refund:"İade",void:"İptal"};
const org=()=>storedOrganization()||"";

// Gün sonu kasa: dönem seçimi, yönteme ve kişiye göre tahsilat, giderler, net ve CSV indirme.
export default function CashPage(){
 const today=new Date().toISOString().slice(0,10);
 const [period,setPeriod]=useState("gun"),[from,setFrom]=useState(today),[to,setTo]=useState(today);
 const [data,setData]=useState<Summary|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const query=`donem=${period}&bugun=${today}`+(period==="ozel"?`&baslangic=${from}&bitis=${to}`:"");
 const load=useCallback(async()=>{
  setError("");
  try{const r=await fetch("/api/service/cash?"+query,{cache:"no-store",headers:{"X-Organization-Id":org()}});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);}
  catch(e){setError(e instanceof Error?e.message:"Kasa alınamadı.");}
 },[query]);
 useEffect(()=>{void load();},[load]);
 async function addExpense(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const f=Object.fromEntries(new FormData(e.currentTarget));const form=e.currentTarget;setBusy(true);setMessage("");
  try{const r=await fetch("/api/service/cash",{method:"POST",headers:{"Content-Type":"application/json","X-Organization-Id":org()},body:JSON.stringify({spentOn:f.spentOn,description:f.description,method:f.method,amountCents:Math.round(Number(f.amount)*100),requestId:crypto.randomUUID()})});
   const d=await r.json();if(!r.ok)throw new Error(d.error);form.reset();setMessage("Gider kaydedildi.");await load();}
  catch(err){setMessage(err instanceof Error?err.message:"Gider kaydedilemedi.");}finally{setBusy(false);}
 }
 async function download(){
  const r=await fetch("/api/service/cash?format=csv&"+query,{headers:{"X-Organization-Id":org()}});if(!r.ok){setMessage("CSV indirilemedi.");return;}
  const url=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=url;a.download=`kasa-${data?.range.from}-${data?.range.to}.csv`;a.click();URL.revokeObjectURL(url);
 }
 return <main className="service-page service-cash">
  <p><Link href="/servis">← Servis masası</Link></p>
  <h1>Gün sonu kasa</h1>
  <div className="service-chips" role="group" aria-label="Dönem">{[["gun","Bugün"],["hafta","Son 7 gün"],["ay","Bu ay"],["ozel","Tarih aralığı"]].map(([v,l])=><button key={v} type="button" aria-pressed={period===v} onClick={()=>setPeriod(v)}>{l}</button>)}</div>
  {period==="ozel"&&<div className="service-grid"><label>Başlangıç<input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></label><label>Bitiş<input type="date" value={to} min={from} onChange={e=>setTo(e.target.value)}/></label></div>}
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   <section className="service-cash-kpis" aria-label="Özet">
    <div><small>Tahsil edilen</small><b>{money(data.collectedCents)}</b></div>
    <div><small>Gider</small><b>{money(data.expenseCents)}</b></div>
    <div><small>Net kasa</small><b>{money(data.netCents)}</b></div>
   </section>
   <section className="service-card"><h2>Yönteme göre</h2>{data.byMethod.length?<table className="service-cash-table"><thead><tr><th>Yöntem</th><th>Giren</th><th>İade/iptal</th><th>Gider</th><th>Net</th></tr></thead><tbody>{data.byMethod.map(m=><tr key={m.method}><td>{m.label}</td><td>{money(m.inCents)}</td><td>{money(m.outCents)}</td><td>{money(m.expenseCents)}</td><td><b>{money(m.netCents)}</b></td></tr>)}</tbody></table>:<p>Bu dönemde hareket yok.</p>}</section>
   <section className="service-card"><h2>Kim tahsil etti</h2>{data.byActor.length?<ul>{data.byActor.map(a=><li key={a.actor}>{a.actor} · {a.count} hareket · <b>{money(a.netCents)}</b></li>)}</ul>:<p>Bu dönemde tahsilat yok.</p>}</section>
   <section className="service-card"><h2>Gider ekle</h2>
    <form className="service-grid" onSubmit={e=>void addExpense(e)}>
     <label>Tarih<input type="date" name="spentOn" required defaultValue={today}/></label>
     <label>Açıklama<input name="description" required maxLength={200} placeholder="Yakıt, sarf malzeme…"/></label>
     <label>Tutar (TL)<input name="amount" type="number" min="0.01" step="0.01" required/></label>
     <label>Yöntem<select name="method" defaultValue="nakit"><option value="nakit">Nakit</option><option value="kart">Kart</option><option value="havale">Havale/EFT</option><option value="diger">Diğer</option></select></label>
     <button disabled={busy}>Gideri kaydet</button>
    </form>
   </section>
   <section className="service-card"><h2>Hareketler</h2>
    {data.movements.length===0&&data.expenses.length===0?<p>Bu dönemde hareket yok.</p>:<ul className="service-cash-list">
     {data.movements.map((m,i)=><li key={"m"+i}>{m.created_at} · {KINDS[m.kind]??m.kind} · {m.order_number} · {money((m.kind==="payment"?1:-1)*m.amount_cents)} · {m.actor}</li>)}
     {data.expenses.map((e,i)=><li key={"e"+i}>{e.spent_on} · Gider · {e.description} · {money(-e.amount_cents)} · {e.actor}</li>)}
    </ul>}
    <button type="button" onClick={()=>void download()}>CSV indir (Excel)</button>
   </section>
  </>}
  <p role="status">{message||(!data&&!error?"Yükleniyor…":"")}</p>
 </main>;
}
