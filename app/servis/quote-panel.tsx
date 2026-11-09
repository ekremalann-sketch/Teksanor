"use client";
import {useState,type FormEvent} from "react";
import type {QuoteLine} from "@/lib/service-quotes";

type Revision = {revision:number; lines:QuoteLine[]; reason:string; total_cents:number};
const blank = {kind:"item" as const,label:"",quantity:1,unitCents:0};
const money = (cents:number) => (cents/100).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});

export function QuoteLines({lines}:{lines:QuoteLine[]}){
 return <ul>{lines.map((line,i)=><li key={i}>{line.kind==="labor"?"İşçilik · ":""}{line.label} · {line.quantity} × {money(line.unitCents)}</li>)}</ul>;
}

export function QuotePanel({editable,busy,history,save}:{
 editable:boolean;busy:boolean;history:()=>Promise<{history:Revision[]}>;
 save:(lines:QuoteLine[],reason:string)=>Promise<unknown>;
}){
 const [lines,setLines]=useState<QuoteLine[]>([blank]);
 const [reason,setReason]=useState("");
 const [revisions,setRevisions]=useState<Revision[]|null>(null);
 const [error,setError]=useState("");
 const update=(index:number,patch:Partial<QuoteLine>)=>setLines(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 async function load(){
  try{setError("");const result=await history();setRevisions(result.history);if(result.history[0])setLines(result.history[0].lines);}
  catch(e){setError(e instanceof Error?e.message:"Teklifler yüklenemedi.");}
 }
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void save(lines,reason);}
 return <details onToggle={e=>{if(e.currentTarget.open&&!revisions)void load();}}>
  <summary>Teklif kalemleri ve sürümleri</summary>
  {error&&<p role="alert">{error}</p>}
  {editable&&revisions&&<form onSubmit={submit} className="service-grid">
   {lines.map((line,i)=><fieldset key={i} className="service-wide" disabled={busy}>
    <legend>Kalem {i+1}</legend>
    <label>Tür<select value={line.kind} onChange={e=>update(i,{kind:e.target.value==="labor"?"labor":"item"})}><option value="item">Malzeme / hizmet</option><option value="labor">İşçilik</option></select></label>
    <label>Açıklama<input required maxLength={160} value={line.label} onChange={e=>update(i,{label:e.target.value})}/></label>
    <label>Miktar<input required type="number" min="1" value={line.quantity} onChange={e=>update(i,{quantity:e.target.valueAsNumber})}/></label>
    <label>Birim fiyat (TL)<input required type="number" min="0" step="0.01" value={Number.isFinite(line.unitCents)?line.unitCents/100:""} onChange={e=>update(i,{unitCents:Math.round(e.target.valueAsNumber*100)})}/></label>
    <button type="button" disabled={lines.length===1} onClick={()=>setLines(rows=>rows.filter((_,j)=>i!==j))}>Kalemi kaldır</button>
   </fieldset>)}
   <button type="button" disabled={busy||lines.length>=100} onClick={()=>setLines(rows=>[...rows,blank])}>Kalem ekle</button>
   <label>Revizyon gerekçesi<input maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <button disabled={busy}>Teklif sürümünü kaydet</button>
  </form>}
  {revisions?.map(row=><section key={row.revision}><h3>Sürüm {row.revision} · {money(row.total_cents)}</h3><QuoteLines lines={row.lines}/>{row.reason&&<p>{row.reason}</p>}</section>)}
 </details>;
}
