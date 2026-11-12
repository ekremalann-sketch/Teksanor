"use client";
// T5: Akış düzenleyici — "İşinizin aşamaları". Ad değiştir, kendi aşamanı ekle, zorunlu alan seç. Tek ana düğme: Kaydet.
import Link from "next/link";
import {useCallback,useEffect,useState} from "react";
import {organizationFetch,storedOrganization} from "@/lib/org-client";
import "../service.css";

type Field="outcome"|"quote_cents"|"scheduled_date"|"assigned_user_id";
type Approval={by:"manager"|"user";userId?:string;notCreator:boolean};
type Extra={key:string;label:string;after:"quote_approved"|"in_progress";required?:Field[];approval?:Approval};
type Custom={labels?:Record<string,string>;extra?:Extra[];required?:Record<string,Field[]>};
type Stage={key:string;label:string;closed?:boolean};
type Data={manage:boolean;members?:{id:string;full_name:string}[];version:number;custom:Custom;flow:{stages:Stage[]};base:{stages:Stage[]};requiredFields:Record<Field,string>;stageCounts?:Record<string,number>};
const slug=(s:string)=>"ozel_"+s.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ı/g,"i").replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"").slice(0,24);

export default function FlowEditor(){
 const [data,setData]=useState<Data|null>(null),[custom,setCustom]=useState<Custom>({}),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false),[newName,setNewName]=useState(""),[newAfter,setNewAfter]=useState<Extra["after"]>("in_progress"),[removed,setRemoved]=useState<{key:string;label:string}[]>([]),[moves,setMoves]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{const r=await organizationFetch("/api/service/flow",{cache:"no-store"},storedOrganization());const d=await r.json();if(!r.ok){setMsg(d.error||"Akış alınamadı.");return;}setData(d);setCustom(d.custom||{});setRemoved([]);setMoves({});},[]);
 useEffect(()=>{void load();},[load]);
 if(!data)return <main className="service-shell"><p role="status">{msg||"Yükleniyor…"}</p></main>;
 const extra=custom.extra??[];const labelOf=(s:Stage)=>custom.labels?.[s.key]??s.label;
 const order=(()=>{const list:Stage[]=[];for(const s of data.base.stages){list.push(s);for(const e of extra.filter(x=>x.after===s.key))list.push({key:e.key,label:e.label});}return list;})();
 const req=(k:string):Field[]=>extra.find(e=>e.key===k)?.required??custom.required?.[k]??[];
 function setReq(k:string,f:Field,on:boolean){const cur=new Set(req(k));on?cur.add(f):cur.delete(f);const list=[...cur];
  if(extra.some(e=>e.key===k))setCustom({...custom,extra:extra.map(e=>e.key===k?{...e,required:list}:e)});else setCustom({...custom,required:{...(custom.required??{}),[k]:list}});}
 function setApproval(k:string,a:Approval|undefined){setCustom({...custom,extra:extra.map(e=>e.key===k?{...e,approval:a}:e)});}
 const apOf=(k:string)=>extra.find(e=>e.key===k)?.approval;
 function rename(k:string,v:string){if(extra.some(e=>e.key===k))setCustom({...custom,extra:extra.map(e=>e.key===k?{...e,label:v}:e)});else setCustom({...custom,labels:{...(custom.labels??{}),[k]:v}});}
 function add(){const name=newName.trim();if(name.length<2)return;let key=slug(name);let i=2;while(order.some(s=>s.key===key))key=slug(name)+"_"+i++;setCustom({...custom,extra:[...extra,{key,label:name,after:newAfter,required:[]}]});setNewName("");}
 async function save(){setBusy(true);setMsg("");try{const r=await organizationFetch("/api/service/flow",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({version:data!.version,custom,moves})},storedOrganization());const d=await r.json();if(!r.ok)throw new Error(d.error||"Kaydedilemedi.");setMsg("Akış kaydedildi. Yeni işler ve mevcut işler bu aşamaları kullanır.");await load();}catch(e){setMsg(e instanceof Error?e.message:"Kaydedilemedi.");}finally{setBusy(false);}}
 return <main className="service-shell"><p><Link href="/servis">← Servis masası</Link></p><h1>İşinizin aşamaları</h1>
  <p className="service-muted">Teknik servis işi bu sırayla ilerler. Adları kendi dilinize göre değiştirin, araya kendi aşamanızı (ör. “Parça bekliyor”) ekleyin. Teklif onayı, müşteri onayı ve tahsilat aşamaları para ve onay kurallarına bağlı olduğu için kaldırılamaz.</p>
  <ol className="flow-list">{order.map(s=>{const isExtra=s.key.startsWith("ozel_");return <li key={s.key} className={isExtra?"flow-extra":""}>
   {data.manage?<input aria-label={`${s.label} aşamasının adı`} value={isExtra?s.label:labelOf(s)} onChange={e=>rename(s.key,e.target.value)} maxLength={40}/>:<b>{isExtra?s.label:labelOf(s)}</b>}
   {isExtra&&<small>Sizin eklediğiniz aşama</small>}
   {data.manage&&!s.closed&&<details><summary>Zorunlu alanlar ({req(s.key).length})</summary>{(Object.keys(data.requiredFields) as Field[]).map(f=><label key={f}><input type="checkbox" checked={req(s.key).includes(f)} onChange={e=>setReq(s.key,f,e.target.checked)}/> {data.requiredFields[f]}</label>)}</details>}
   {data.manage&&isExtra&&(()=>{const ap=apOf(s.key);return <details><summary>Onay adımı{ap?" (açık)":""}</summary>
    <label><input type="checkbox" checked={!!ap} onChange={e=>setApproval(s.key,e.target.checked?{by:"manager",notCreator:true}:undefined)}/> Bu aşamada iş onaylanmadan ilerlemesin</label>
    {ap&&<><label>Kim onaylar<select value={ap.by==="user"?ap.userId??"":"manager"} onChange={e=>setApproval(s.key,e.target.value==="manager"?{...ap,by:"manager",userId:undefined}:{...ap,by:"user",userId:e.target.value})}><option value="manager">Herhangi bir yönetici</option>{(data.members??[]).map(m=><option key={m.id} value={m.id}>{m.full_name}</option>)}</select></label>
    <label><input type="checkbox" checked={ap.notCreator} onChange={e=>setApproval(s.key,{...ap,notCreator:e.target.checked})}/> İşi açan kişi onaylayamaz</label>
    <small>Örnek: “Ek parça onayı” aşaması. Onaydan sonra iş değişirse yeniden onay gerekir.</small></>}
   </details>;})()}
   {data.manage&&isExtra&&<button type="button" className="service-danger" onClick={()=>{setCustom({...custom,extra:extra.filter(e=>e.key!==s.key)});if((data.stageCounts?.[s.key]??0)>0)setRemoved([...removed,{key:s.key,label:s.label}]);}}>Aşamayı kaldır</button>}{(data.stageCounts?.[s.key]??0)>0&&<small>{data.stageCounts![s.key]} iş bu aşamada</small>}
  </li>;})}</ol>
  {data.manage&&<>
   <fieldset className="flow-add"><legend>Aşama ekle</legend><label>Ad<input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Parça bekliyor" maxLength={40}/></label>
    <label>Nereden sonra<select value={newAfter} onChange={e=>setNewAfter(e.target.value as Extra["after"])}><option value="quote_approved">{labelOf({key:"quote_approved",label:"Teklif onaylandı"})} sonra</option><option value="in_progress">{labelOf({key:"in_progress",label:"Sahada"})} sonra</option></select></label>
    <button type="button" onClick={add} disabled={newName.trim().length<2}>Listeye ekle</button></fieldset>
   {removed.length>0&&<fieldset className="flow-add"><legend>Kaldırılan aşamalardaki işler</legend>{removed.map(r=><label key={r.key}>“{r.label}” aşamasındaki {data.stageCounts?.[r.key]??0} iş şuraya taşınsın
    <select value={moves[r.key]??""} onChange={e=>setMoves({...moves,[r.key]:e.target.value})}><option value="">Seçin</option>{order.filter(o=>!o.closed&&!removed.some(x=>x.key===o.key)).map(o=><option key={o.key} value={o.key}>{o.key.startsWith("ozel_")?o.label:labelOf(o)}</option>)}</select></label>)}</fieldset>}
   {(()=>{const n=removed.reduce((a,r)=>a+(data.stageCounts?.[r.key]??0),0);return n?<p className="service-muted">Bu değişiklik {n} işi etkiler. Taşınan her iş geçmişine yazılır.</p>:null;})()}
   <p><button type="button" className="service-primary" disabled={busy||removed.some(r=>!moves[r.key])} onClick={()=>void save()}>{busy?"Kaydediliyor…":"Kaydet"}</button></p></>}
  {msg&&<p role="status">{msg}</p>}
 </main>;
}
