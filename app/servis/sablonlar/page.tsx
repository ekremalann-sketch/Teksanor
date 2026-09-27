"use client";
import Link from "next/link";
import {useCallback,useEffect,useState,type FormEvent} from "react";
import "../service.css";

type ItemType="check"|"text"|"number"|"choice";
type Item={label:string;type:ItemType;required:boolean;options?:string[];unit?:string};
type Data={templates:{id:string;name:string;items:Item[]}[];starters:{name:string;items:Item[]}[];manage:boolean};
const TYPE_LABEL:Record<ItemType,string>={check:"Onay kutusu",text:"Metin",number:"Ölçüm (sayı)",choice:"Seçenekli"};
const blank=():Item=>({label:"",type:"check",required:true});

// Form şablonu tasarımcısı: yönetici maddeleri ekler/sıralar; hazır sektör şablonlarından başlayabilir.
export default function Templates(){
 const [data,setData]=useState<Data|null>(null),[name,setName]=useState(""),[items,setItems]=useState<Item[]>([blank()]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);
 const org=()=>{try{return new URLSearchParams(location.search).get("organizationId")||localStorage.getItem("teksanor_organization")||"";}catch{return "";}};
 const fetchData=useCallback(async()=>{const r=await fetch("/api/service/checklists",{headers:{"X-Organization-Id":org()},cache:"no-store"});if(r.status===401){location.href="/giris";throw new Error("Giriş gerekli.");}const d=await r.json();if(!r.ok)throw new Error(d.error);return d as Data;},[]);
 useEffect(()=>{let alive=true;fetchData().then(d=>{if(alive)setData(d);}).catch(e=>{if(alive)setMsg(String(e.message||e));});return()=>{alive=false;};},[fetchData]);
 const update=(i:number,patch:Partial<Item>)=>setItems(list=>list.map((it,j)=>j===i?{...it,...patch}:it));
 const move=(i:number,d:number)=>setItems(list=>{const n=[...list];const t=i+d;if(t<0||t>=n.length)return n;[n[i],n[t]]=[n[t],n[i]];return n;});
 async function post(body:unknown,done:string){setBusy(true);setMsg("");try{const r=await fetch("/api/service/checklists",{method:"POST",headers:{"Content-Type":"application/json","X-Organization-Id":org()},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);setMsg(done);setData(await fetchData());return true;}catch(e){setMsg(e instanceof Error?e.message:"Kaydedilemedi.");return false;}finally{setBusy(false);}}
 async function submit(e:FormEvent){e.preventDefault();if(await post({action:"template.create",name,items},"Şablon kaydedildi. Servis masasında işe ekleyebilirsiniz.")){setName("");setItems([blank()]);}}
 if(data&&!data.manage)return <main className="service-shell"><p>Form şablonlarını yönetici düzenler. <Link href="/servis">Servis masasına dön</Link></p></main>;
 return <main className="service-shell">
  <header className="service-header"><div><Link href="/servis">← Servis masası</Link><h1>Form şablonları</h1><p>Sahada doldurulan kontrol listeleri. Zorunlu (*) maddeler bitmeden iş tamamlanamaz.</p></div></header>
  <p className="service-message" role="status">{msg}</p>
  <section className="service-card">
   <h2>Hazır şablondan başla</h2>
   <div className="builder-starters">{data?.starters.map(s=><button key={s.name} type="button" onClick={()=>{setName(s.name);setItems(s.items.map(i=>({...i})));}}>{s.name}</button>)}</div>
   <form onSubmit={submit}>
    <label>Şablon adı<input required minLength={2} maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
    <h3>Maddeler ({items.length}/40)</h3>
    {items.map((it,i)=><div key={i} className="builder-item" role="group" aria-label={`Madde ${i+1}`}>
     <label>Madde {i+1}<input required minLength={2} maxLength={200} value={it.label} onChange={e=>update(i,{label:e.target.value})}/></label>
     <label>Tür<select value={it.type} onChange={e=>update(i,{type:e.target.value as ItemType,options:e.target.value==="choice"?(it.options||["Uygun","Uygun değil"]):undefined})}>{(Object.keys(TYPE_LABEL) as ItemType[]).map(t=><option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></label>
     {it.type==="choice"?<label>Seçenekler (virgülle)<input value={(it.options||[]).join(", ")} onChange={e=>update(i,{options:e.target.value.split(",").map(x=>x.trim()).filter(Boolean)})}/></label>:it.type==="number"?<label>Birim<input maxLength={16} value={it.unit||""} placeholder="ör. bar, °C, V" onChange={e=>update(i,{unit:e.target.value})}/></label>:<span/>}
     <label className="checklist-check"><input type="checkbox" checked={it.required} onChange={e=>update(i,{required:e.target.checked})}/>Zorunlu</label>
     <div className="service-actions" style={{margin:0}}><button type="button" aria-label={`Madde ${i+1} yukarı`} onClick={()=>move(i,-1)}>↑</button><button type="button" aria-label={`Madde ${i+1} aşağı`} onClick={()=>move(i,1)}>↓</button><button type="button" aria-label={`Madde ${i+1} sil`} disabled={items.length===1} onClick={()=>setItems(l=>l.filter((_,j)=>j!==i))}>Sil</button></div>
    </div>)}
    <div className="service-actions"><button type="button" disabled={items.length>=40} onClick={()=>setItems(l=>[...l,blank()])}>Madde ekle</button><button disabled={busy}>Şablonu kaydet</button></div>
   </form>
  </section>
  <section className="service-card" style={{marginTop:20}}><h2>Kayıtlı şablonlar</h2>
   <div className="template-list">{data?.templates.map(t=><article key={t.id}><span><b>{t.name}</b><br/><small className="checklist-muted">{t.items.length} madde · {t.items.filter(i=>i.required).length} zorunlu</small></span><button type="button" disabled={busy} onClick={()=>void post({action:"template.archive",id:t.id},"Şablon arşivlendi; eklenmiş formlar korunur.")}>Arşivle</button></article>)}
   {data&&!data.templates.length&&<p className="checklist-muted">Henüz şablon yok.</p>}</div></section>
 </main>;
}
