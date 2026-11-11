"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useState,type FormEvent} from "react";
import "../service.css";
import {storedOrganization} from "@/lib/org-client";

type Part={id:string;code:string;name:string;barcode:string|null;unit_cost_cents:number;sale_price_cents:number;on_hand:number;critical_level:number;reserved:number};
const money=(c:number)=>(c/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const tl=(c:number)=>(c/100).toFixed(2);
const headers=()=>({"Content-Type":"application/json","X-Organization-Id":storedOrganization()||""});

// Stok: parça listesi, kritik seviye uyarısı, depo girişi, düzenleme ve CSV. Yalnız yönetici.
export default function StockPage(){
 const [parts,setParts]=useState<Part[]|null>(null),[critical,setCritical]=useState(0),[q,setQ]=useState(""),[onlyCritical,setOnlyCritical]=useState(false);
 const [edit,setEdit]=useState<Part|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
 const load=useCallback(async()=>{try{const r=await fetch("/api/service/parts",{cache:"no-store",headers:headers()});const d=await r.json();if(!r.ok)throw new Error(d.error);setParts(d.parts);setCritical(d.critical);}catch(e){setError(e instanceof Error?e.message:"Stok alınamadı.");}},[]);
 useEffect(()=>{void load();},[load]);
 const shown=useMemo(()=>(parts??[]).filter(p=>(!onlyCritical||(p.critical_level>0&&p.on_hand<=p.critical_level))&&(`${p.code} ${p.name} ${p.barcode??""}`.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr")))),[parts,q,onlyCritical]);
 async function send(body:Record<string,unknown>,ok:string){
  if(busy)return;setBusy(true);setMessage("");
  try{const r=await fetch("/api/service/parts",{method:"POST",headers:headers(),body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);setMessage(ok);setEdit(null);await load();}
  catch(e){setMessage(e instanceof Error?e.message:"İşlem yapılamadı.");}finally{setBusy(false);}
 }
 const form=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();return Object.fromEntries(new FormData(e.currentTarget)) as Record<string,string>;};
 const cents=(v:string)=>Math.round(Number(v)*100);
 async function download(){const r=await fetch("/api/service/parts?format=csv",{headers:headers()});if(!r.ok){setMessage("CSV indirilemedi.");return;}const u=URL.createObjectURL(await r.blob());const a=document.createElement("a");a.href=u;a.download="stok.csv";a.click();URL.revokeObjectURL(u);}
 return <main className="service-page service-cash">
  <p><Link href="/servis">← Servis masası</Link></p>
  <h1>Stok {critical>0&&<span className="service-stock-badge">{critical} parça kritik seviyede</span>}</h1>
  {error&&<p role="alert">{error}</p>}
  <div className="service-grid"><label>Ara<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Kod, ad veya barkod"/></label>
   <label className="service-check"><input type="checkbox" checked={onlyCritical} onChange={e=>setOnlyCritical(e.target.checked)}/> Yalnız kritik olanlar</label></div>
  {parts&&(shown.length?<div className="service-table-wrap"><table className="service-cash-table"><thead><tr><th>Parça</th><th>Depoda</th><th>İşlerde</th><th>Alış / Satış</th><th></th></tr></thead><tbody>
   {shown.map(p=>{const low=p.critical_level>0&&p.on_hand<=p.critical_level;return <tr key={p.id} className={low?"service-stock-low":""}>
    <td><b>{p.code}</b> · {p.name}{p.barcode&&<small> · {p.barcode}</small>}</td>
    <td>{p.on_hand}{low&&<small> (kritik: {p.critical_level})</small>}</td><td>{p.reserved}</td>
    <td>{money(p.unit_cost_cents)} / {money(p.sale_price_cents)}</td>
    <td><button type="button" onClick={()=>setEdit(p)}>Düzenle</button></td></tr>;})}
  </tbody></table></div>:<p>{parts.length?"Aramaya uyan parça yok.":"Henüz parça yok. Aşağıdan ilk parçanızı tanımlayın."}</p>)}
  {edit&&<section className="service-card"><h2>{edit.code} düzenle</h2>
   <form className="service-grid" onSubmit={e=>{const f=form(e);void send({action:"part-update",partId:edit.id,name:f.name,barcode:f.barcode,unitCostCents:cents(f.cost),salePriceCents:cents(f.sale),criticalLevel:Number(f.critical)},"Parça güncellendi.");}}>
    <label>Ad<input name="name" required maxLength={160} defaultValue={edit.name}/></label>
    <label>Barkod<input name="barcode" maxLength={64} defaultValue={edit.barcode??""}/></label>
    <label>Alış (TL)<input name="cost" type="number" min="0" step="0.01" required defaultValue={tl(edit.unit_cost_cents)}/></label>
    <label>Satış (TL)<input name="sale" type="number" min="0" step="0.01" required defaultValue={tl(edit.sale_price_cents)}/></label>
    <label>Kritik seviye<input name="critical" type="number" min="0" step="1" required defaultValue={edit.critical_level}/></label>
    <button disabled={busy}>Kaydet</button>
   </form>
   <form className="service-grid" onSubmit={e=>{const f=form(e);void send({action:"part-receive",partId:edit.id,quantity:Number(f.qty),requestId:crypto.randomUUID()},"Depo girişi yapıldı.");}}>
    <label>Gelen adet<input name="qty" type="number" min="1" step="1" required defaultValue={1}/></label><button disabled={busy}>Depo girişi yap</button>
   </form>
   <button type="button" onClick={()=>setEdit(null)}>Kapat</button>
  </section>}
  <details className="service-card"><summary>Yeni parça tanımla</summary>
   <form className="service-grid" onSubmit={e=>{const f=form(e);void send({action:"part-create",code:f.code,name:f.name,unitCostCents:cents(f.cost)},"Parça tanımlandı.");}}>
    <label>Kod<input name="code" required maxLength={40}/></label><label>Ad<input name="name" required maxLength={160}/></label>
    <label>Alış (TL)<input name="cost" type="number" min="0" step="0.01" required/></label><button disabled={busy}>Tanımla</button>
   </form>
  </details>
  <button type="button" onClick={()=>void download()}>CSV indir (Excel)</button>
  <p role="status">{message||(!parts&&!error?"Yükleniyor…":"")}</p>
 </main>;
}
