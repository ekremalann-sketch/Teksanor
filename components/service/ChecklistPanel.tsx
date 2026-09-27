"use client";
import {useCallback,useEffect,useState} from "react";

type Item={id:string;label:string;type:"check"|"text"|"number"|"choice";required:boolean;options?:string[];unit?:string};
type JobChecklist={id:string;name:string;items:Item[];answers:Record<string,unknown>;version:number;completed_at:string|null;missing:string[]};
type Data={templates:{id:string;name:string;items:Item[]}[];checklists:JobChecklist[];locked:boolean;manage:boolean;canWrite:boolean};

// Servis masasındaki iş için saha formları: şablon ekle, maddeleri doldur, kaydet.
// Kurallar sunucuda: zorunlu maddeler bitmeden iş "tamamlandı" yapılamaz; onaydan sonra kilitlenir.
export function ChecklistPanel({jobId,organizationId,onChanged}:{jobId:string;organizationId:string;onChanged?:()=>void}){
 const [data,setData]=useState<Data|null>(null),[drafts,setDrafts]=useState<Record<string,Record<string,unknown>>>({}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[pick,setPick]=useState("");
 const headers={"Content-Type":"application/json","X-Organization-Id":organizationId};
 const apply=(d:Data)=>{setData(d);setDrafts(Object.fromEntries(d.checklists.map(c=>[c.id,{...c.answers}])));};
 const load=useCallback(async()=>{const r=await fetch(`/api/service/checklists?jobId=${encodeURIComponent(jobId)}`,{headers:{"X-Organization-Id":organizationId},cache:"no-store"});const d=await r.json();if(r.ok)return d as Data;throw new Error(d.error||"Formlar alınamadı.");},[jobId,organizationId]);
 useEffect(()=>{let alive=true;load().then(d=>{if(alive)apply(d);}).catch(e=>{if(alive)setMsg(String(e.message||e));});return()=>{alive=false;};},[load]);
 async function post(body:Record<string,unknown>,done:string){setBusy(true);setMsg("");try{const r=await fetch("/api/service/checklists",{method:"POST",headers,body:JSON.stringify({jobId,...body})});const d=await r.json();if(!r.ok)throw new Error(d.error);apply({...(data as Data),checklists:d.checklists});setMsg(done);onChanged?.();}catch(e){setMsg(e instanceof Error?e.message:"Kaydedilemedi.");if(String(e).includes("güncellendi"))apply(await load());}finally{setBusy(false);}}
 if(!data)return <section className="checklist-panel" aria-label="Saha formları"><p role="status">{msg||"Saha formları yükleniyor…"}</p></section>;
 const editable=!data.locked&&(data.canWrite||data.manage);
 const set=(cid:string,iid:string,v:unknown)=>setDrafts(d=>({...d,[cid]:{...d[cid],[iid]:v}}));
 const unused=data.templates.filter(t=>!data.checklists.some(c=>c.name===t.name));
 return <section className="checklist-panel" aria-labelledby={`chk-${jobId}`}>
  <div className="checklist-head"><h3 id={`chk-${jobId}`}>Saha formları</h3>{data.locked&&<span className="service-stage" data-stage="accepted">Kilitli (müşteri onayladı)</span>}</div>
  {editable&&<div className="checklist-attach">
   {unused.length?<><label>Form ekle<select value={pick} onChange={e=>setPick(e.target.value)}><option value="">Şablon seçin</option>{unused.map(t=><option key={t.id} value={t.id}>{t.name} ({t.items.length} madde)</option>)}</select></label>
   <button type="button" disabled={!pick||busy} onClick={()=>{void post({action:"attach",templateId:pick},"Form eklendi.");setPick("");}}>Ekle</button></>:
   <p className="checklist-muted">{data.templates.length?"Tüm şablonlar bu işe eklendi.":data.manage?<>Henüz form şablonu yok. <a href="/servis/sablonlar">Şablon oluşturun</a>.</>:"Henüz form şablonu yok; yöneticiniz oluşturabilir."}</p>}
  </div>}
  {data.checklists.map(c=>{const draft=drafts[c.id]||{};return <form key={c.id} className="checklist-form" onSubmit={e=>{e.preventDefault();void post({action:"answer",id:c.id,version:c.version,answers:draft},c.missing.length?"Form kaydedildi.":"Form kaydedildi.");}}>
   <div className="checklist-form-head"><b>{c.name}</b>{c.completed_at?<span className="service-stage" data-stage="collected">Tamamlandı</span>:<span className="service-stage" data-stage="quoted">{c.missing.length} zorunlu madde eksik</span>}</div>
   <ol>{c.items.map(i=>{const v=draft[i.id];const label=<>{i.label}{i.required&&<abbr title="zorunlu" aria-label="zorunlu"> *</abbr>}{i.unit&&<small> ({i.unit})</small>}</>;return <li key={i.id}>
    {i.type==="check"?<label className="checklist-check"><input type="checkbox" checked={v===true} disabled={!editable} onChange={e=>set(c.id,i.id,e.target.checked)}/>{label}</label>:
     i.type==="choice"?<fieldset disabled={!editable}><legend>{label}</legend><div className="checklist-choices">{i.options?.map(o=><label key={o} className="checklist-check"><input type="radio" name={`${c.id}-${i.id}`} checked={v===o} onChange={()=>set(c.id,i.id,o)}/>{o}</label>)}</div></fieldset>:
     <label><span>{label}</span>{i.type==="number"?<input inputMode="decimal" value={v==null?"":String(v)} disabled={!editable} onChange={e=>set(c.id,i.id,e.target.value)}/>:<textarea rows={2} maxLength={500} value={v==null?"":String(v)} disabled={!editable} onChange={e=>set(c.id,i.id,e.target.value)}/>}</label>}
   </li>;})}</ol>
   {editable&&<button disabled={busy}>Formu kaydet</button>}
  </form>;})}
  <p className="checklist-muted" role="status">{msg}</p>
 </section>;
}
