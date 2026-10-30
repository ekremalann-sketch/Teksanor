"use client";
import { filterList } from "@/lib/list-filter";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useModalKeys } from "../shared/useModalKeys";
import { CalendarCheck2, Check, Factory, Gauge, MapPin, Plus, Trash2, Wrench, X } from "lucide-react";

export type Asset = {
  id:string; asset_code:string; name:string; category:string; brand?:string; model?:string; serial_number?:string;
  location?:string; status:"active"|"maintenance"|"inactive"|"retired"; responsible_name?:string;
  purchase_date?:string; warranty_end?:string; notes?:string; maintenance_count:number; next_maintenance_date?:string;
};
export type MaintenancePlan = {
  id:string; asset_id:string; asset_code:string; asset_name:string; asset_location?:string; title:string;
  frequency_type:"day"|"week"|"month"|"year"|"usage"; frequency_value:number; next_due_date?:string;
  assigned_to?:string; checklist_text?:string; status:"active"|"paused"|"completed"; last_completed_at?:string;
};
type Props<T>={items:T[];organizationId:string;reload:()=>Promise<void>|void;notify:(text:string)=>void;search?:string};

async function api(url:string,organizationId:string,method:string,payload?:unknown){
  const response=await fetch(url,{method,headers:{"Content-Type":"application/json","X-Organization-Id":organizationId},body:payload===undefined?undefined:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({})) as {error?:string};
  if(!response.ok) throw new Error(result.error||"İşlem tamamlanamadı.");
  return result;
}
const fmt=(v?:string)=>v?new Date(`${v}T12:00:00`).toLocaleDateString("tr-TR"):"—";
const statusLabel={active:"Aktif",maintenance:"Bakımda",inactive:"Pasif",retired:"Kullanım dışı"};
const frequencyLabel={day:"gün",week:"hafta",month:"ay",year:"yıl",usage:"kullanım birimi"};

function Modal({title,onClose,onSubmit,children,saving}:{title:string;onClose:()=>void;onSubmit:(event:FormEvent<HTMLFormElement>)=>void;children:React.ReactNode;saving:boolean}){
  useModalKeys(onClose);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><form className="entry-modal" role="dialog" aria-modal="true" onSubmit={onSubmit}>
    <div className="modal-head"><div><span>VARLIK VE BAKIM</span><h2>{title}</h2></div><button type="button" onClick={onClose}><X size={19}/></button></div>
    {children}<div className="modal-actions"><button type="button" className="outline-button" onClick={onClose}>Vazgeç</button><button className="panel-primary" disabled={saving}>{saving?"Kaydediliyor...":"Kaydet"}</button></div>
  </form></div>
}

export type AssetType={id:string;name:string;default_frequency_type:string|null;default_frequency_value:number|null;checklist_text:string|null;asset_count:number};
const freqText=(t:AssetType)=>t.default_frequency_type&&t.default_frequency_value?`Her ${t.default_frequency_value} ${frequencyLabel[t.default_frequency_type as keyof typeof frequencyLabel]} bakım`:"Bakım sıklığı yok";

/** Firma tanımlı ekipman türleri: firma neyi takip ediyorsa (klima, jeneratör, asansör…) kendisi ekler. */
function AssetTypesPanel({types,organizationId,reload,notify}:{types:AssetType[];organizationId:string;reload:()=>Promise<void>;notify:(t:string)=>void}){
  const[saving,setSaving]=useState(false),[name,setName]=useState(""),[ft,setFt]=useState(""),[fv,setFv]=useState("1"),[cl,setCl]=useState("");
  async function add(e:FormEvent){e.preventDefault();if(saving)return;setSaving(true);try{await api("/api/asset-types",organizationId,"POST",{name,frequencyType:ft,frequencyValue:Number(fv),checklistText:cl});setName("");setFt("");setFv("1");setCl("");notify(`${name} türü eklendi. Artık varlık eklerken bu türü seçebilirsiniz.`);await reload();}catch(err){notify(err instanceof Error?err.message:"Eklenemedi.")}finally{setSaving(false)}}
  async function remove(t:AssetType){try{await api(`/api/asset-types?id=${encodeURIComponent(t.id)}`,organizationId,"DELETE");notify(`${t.name} türü kaldırıldı; bu türdeki varlıklar silinmedi.`);await reload();}catch(err){notify(err instanceof Error?err.message:"Kaldırılamadı.")}}
  return <details className="asset-types-panel" open={!types.length}><summary><b>Ekipman türleriniz</b><span>{types.length?`${types.length} tür`:"Henüz tür yok — firmanızın takip ettiği ekipmanları ekleyin"}</span></summary>
    <p className="checklist-muted">Firmanız neyi takip ediyorsa onu ekleyin: ör. klima, jeneratör, asansör, forklift, kompresör. Bakım sıklığı yazarsanız bu türde yeni varlık eklenince bakım planı kendiliğinden önerilir.</p>
    {types.length>0&&<ul className="asset-type-list">{types.map(t=><li key={t.id}><span><b>{t.name}</b><small>{freqText(t)} · {t.asset_count} varlık</small></span><button type="button" className="outline-button" onClick={()=>void remove(t)} aria-label={`${t.name} türünü kaldır`}>Kaldır</button></li>)}</ul>}
    <form className="asset-type-form" onSubmit={add}>
      <label><span>Tür adı <em>zorunlu</em></span><input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder="ör. Jeneratör" required/></label>
      <div className="asset-type-field" role="group" aria-label="Bakım sıklığı"><span>Bakım sıklığı <em>isteğe bağlı</em></span><span className="asset-type-freq"><input type="number" min="1" max="999" value={fv} onChange={e=>setFv(e.target.value)} disabled={!ft} aria-label="Tekrar değeri"/><select value={ft} onChange={e=>setFt(e.target.value)} aria-label="Sıklık birimi"><option value="">Yok</option><option value="day">gün</option><option value="week">hafta</option><option value="month">ay</option><option value="year">yıl</option></select></span></div>
      <label className="full"><span>Kontrol listesi <em>isteğe bağlı</em></span><textarea rows={2} value={cl} onChange={e=>setCl(e.target.value)} maxLength={2000} placeholder="Her satıra bir madde: Yağ seviyesi, Akü voltajı, Yük testi"/></label>
      <button className="panel-primary" disabled={saving||name.trim().length<2}>{saving?"Ekleniyor…":"Türü ekle"}</button>
    </form>
  </details>;
}

export function AssetsView({items,organizationId,reload,notify,search=""}:Props<Asset>){
  const[open,setOpen]=useState(false),[saving,setSaving]=useState(false);
  const[types,setTypes]=useState<AssetType[]>([]),[category,setCategory]=useState(""),[custom,setCustom]=useState("");
  const loadTypes=useCallback(async()=>{try{const r=await api("/api/asset-types",organizationId,"GET") as {assetTypes?:AssetType[]};setTypes(r.assetTypes??[]);}catch{/* görüntüleme yetkisi yoksa liste boş kalır */}},[organizationId]);
  useEffect(()=>{const t=setTimeout(()=>void loadTypes(),0);return()=>clearTimeout(t);},[loadTypes]);
  const chosen=types.find(t=>t.name===category);
  const term=search.toLocaleLowerCase("tr-TR").trim();
  const filtered=useMemo(()=>filterList(items,"assets",search),[items,search]);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(saving)return;setSaving(true);try{const form=Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string,unknown>;form.category=category==="__other"?custom.trim()||"Ekipman":category||"Ekipman";form.autoPlan=form.autoPlan==="on";const r=await api("/api/assets",organizationId,"POST",form) as {planId?:string|null};setOpen(false);setCategory("");setCustom("");notify(r.planId?"Varlık eklendi ve türün bakım planı açıldı (Bakım planları ekranında).":"Varlık kaydı oluşturuldu.");await reload();await loadTypes();}catch(err){notify(err instanceof Error?err.message:"Kaydedilemedi.");}finally{setSaving(false)}}
  async function setStatus(asset:Asset,status:string){try{await api(`/api/assets/${asset.id}`,organizationId,"PUT",{name:asset.name,category:asset.category,status,brand:asset.brand,model:asset.model,serialNumber:asset.serial_number,location:asset.location,responsibleName:asset.responsible_name,purchaseDate:asset.purchase_date,warrantyEnd:asset.warranty_end,notes:asset.notes});notify("Varlık durumu güncellendi.");await reload();}catch(err){notify(err instanceof Error?err.message:"Güncellenemedi.")}}
  async function remove(id:string){if(!confirm("Bu varlık ve bağlı bakım planları silinsin mi?"))return;try{await api(`/api/assets/${id}`,organizationId,"DELETE");notify("Varlık silindi.");await reload();}catch(err){notify(err instanceof Error?err.message:"Silinemedi.")}}
  return <><section className="finance-workbook-head"><div><span>EKİPMANLAR</span><h2>Ekipmanları, sorumluları ve bakım geçmişini tek kayıt altında tutun.</h2><p>Her varlık firma içinde benzersiz bir kod alır; konum, durum ve yaklaşan bakım tarihi görünür olur.</p></div><div className="workbook-actions"><em>{items.length} varlık</em><button className="panel-primary" onClick={()=>setOpen(true)}><Plus size={17}/>Yeni ekipman</button></div></section>
    <AssetTypesPanel types={types} organizationId={organizationId} reload={loadTypes} notify={notify}/>
    <section className="asset-summary-grid"><article><Factory/><span><b>{items.filter(x=>x.status==="active").length}</b>Aktif varlık</span></article><article><Wrench/><span><b>{items.filter(x=>x.status==="maintenance").length}</b>Bakımda</span></article><article><CalendarCheck2/><span><b>{items.filter(x=>x.next_maintenance_date).length}</b>Planlı bakım</span></article></section>
    <section className="project-card-grid">{filtered.map(a=><article key={a.id}><div className="project-card-top"><span>{a.asset_code} · {a.category}</span><em className={`asset-status ${a.status}`}>{statusLabel[a.status]}</em></div><h3>{a.name}</h3><p>{[a.brand,a.model].filter(Boolean).join(" · ")||"Marka ve model belirtilmedi."}</p><dl><div><dt>Konum</dt><dd>{a.location||"—"}</dd></div><div><dt>Sorumlu</dt><dd>{a.responsible_name||"—"}</dd></div><div><dt>Bakım planı</dt><dd>{a.maintenance_count||0}</dd></div><div><dt>Sonraki bakım</dt><dd>{fmt(a.next_maintenance_date)}</dd></div></dl><div className="asset-card-actions"><select value={a.status} onChange={e=>void setStatus(a,e.target.value)}><option value="active">Aktif</option><option value="maintenance">Bakımda</option><option value="inactive">Pasif</option><option value="retired">Kullanım dışı</option></select><button className="outline-button" onClick={()=>void remove(a.id)}><Trash2 size={15}/></button></div></article>)}</section>
    {!filtered.length&&<section className="table-card"><div className="empty-state"><Factory size={30}/><b>Varlık kaydı yok</b><p>Önce yukarıdan firmanızın takip ettiği ekipman türlerini ekleyin (ör. klima, jeneratör, asansör), sonra her cihazı kaydedin.</p><button className="panel-primary" onClick={()=>setOpen(true)}><Plus size={16}/>İlk varlığı ekle</button></div></section>}
    {open&&<Modal title="Yeni ekipman kaydı" onClose={()=>setOpen(false)} onSubmit={submit} saving={saving}><div className="form-grid"><label><span>Ekipman adı</span><input name="name" required placeholder="Örn. Jeneratör 01"/></label><label><span>Ekipman kodu</span><input name="assetCode" placeholder="Boşsa otomatik oluşur"/></label><label><span>Ekipman türü</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Genel ekipman</option>{types.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}<option value="__other">Başka (yazın)…</option></select></label>{category==="__other"&&<label><span>Tür adı</span><input value={custom} onChange={e=>setCustom(e.target.value)} maxLength={60} placeholder="ör. Forklift"/></label>}{chosen?.default_frequency_type&&<label className="full asset-autoplan"><input type="checkbox" name="autoPlan" defaultChecked/> <span>{chosen.name} için bakım planı aç ({freqText(chosen)})</span></label>}<details className="full"><summary>Daha fazla bilgi (isteğe bağlı)</summary><div className="form-grid"><label><span>Durum</span><select name="status" defaultValue="active"><option value="active">Aktif</option><option value="maintenance">Bakımda</option><option value="inactive">Pasif</option></select></label><label><span>Marka</span><input name="brand"/></label><label><span>Model</span><input name="model"/></label><label><span>Seri numarası</span><input name="serialNumber"/></label><label><span>Konum</span><input name="location"/></label><label><span>Sorumlu</span><input name="responsibleName"/></label><label><span>Garanti bitişi</span><input name="warrantyEnd" type="date"/></label><label className="full"><span>Not</span><textarea name="notes" rows={3}/></label></div></details></div></Modal>}
  </>;
}

export function MaintenanceView({items,assets,organizationId,reload,notify,search=""}:Props<MaintenancePlan>&{assets:Asset[]}){
  const[open,setOpen]=useState(false),[saving,setSaving]=useState(false);
  const term=search.toLocaleLowerCase("tr-TR").trim(),today=new Date().toISOString().slice(0,10);
  const filtered=filterList(items,"maintenance",search);
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);try{await api("/api/maintenance",organizationId,"POST",Object.fromEntries(new FormData(e.currentTarget).entries()));setOpen(false);notify("Bakım planı oluşturuldu.");await reload();}catch(err){notify(err instanceof Error?err.message:"Kaydedilemedi.");}finally{setSaving(false)}}
  async function complete(id:string){try{await api(`/api/maintenance/${id}`,organizationId,"PUT",{action:"complete"});notify("Bakım tamamlandı; sonraki tarih otomatik hesaplandı.");await reload();}catch(err){notify(err instanceof Error?err.message:"Tamamlanamadı.")}}
  async function remove(id:string){if(!confirm("Bu bakım planı silinsin mi?"))return;try{await api(`/api/maintenance/${id}`,organizationId,"DELETE");notify("Bakım planı silindi.");await reload();}catch(err){notify(err instanceof Error?err.message:"Silinemedi.")}}
  const overdue=items.filter(x=>x.status==="active"&&x.next_due_date&&x.next_due_date<today).length;
  return <><section className="finance-workbook-head"><div><span>PERİYODİK BAKIM</span><h2>Bakım takvimini ekipman geçmişiyle birlikte yönetin.</h2><p>Bakım tamamlandığında bir sonraki tarih sıklığa göre otomatik hesaplanır; geciken planlar ayrıca görünür.</p></div><div className="workbook-actions"><em>{overdue} geciken</em><button className="panel-primary" disabled={!assets.length} onClick={()=>setOpen(true)}><Plus size={17}/>Yeni bakım planı</button></div></section>
    <section className="table-card"><div className="responsive-table"><table><thead><tr><th>Varlık</th><th>Bakım</th><th>Sıklık</th><th>Sonraki tarih</th><th>Sorumlu</th><th>Durum</th><th/></tr></thead><tbody>{filtered.map(p=>{const late=p.status==="active"&&!!p.next_due_date&&p.next_due_date<today;return <tr key={p.id}><td><b>{p.asset_code}</b><small className="cell-note">{p.asset_name}</small></td><td>{p.title}</td><td>Her {p.frequency_value} {frequencyLabel[p.frequency_type]}</td><td><span className={late?"maintenance-late":""}>{fmt(p.next_due_date)}</span></td><td>{p.assigned_to||"—"}</td><td><span className={`asset-status ${p.status}`}>{p.status==="active"?(late?"Gecikti":"Aktif"):p.status==="paused"?"Duraklatıldı":"Tamamlandı"}</span></td><td><div className="row-actions">{p.status==="active"&&<button title="Bakımı tamamla" onClick={()=>void complete(p.id)}><Check size={15}/></button>}<button className="danger" onClick={()=>void remove(p.id)}><Trash2 size={15}/></button></div></td></tr>})}</tbody></table></div>{!filtered.length&&<div className="empty-state"><CalendarCheck2 size={30}/><b>Bakım planı yok</b><p>{assets.length?"İlk periyodik bakım planını oluşturun.":"Önce varlık envanterine bir ekipman ekleyin."}</p></div>}</section>
    {open&&<Modal title="Yeni bakım planı" onClose={()=>setOpen(false)} onSubmit={submit} saving={saving}><div className="form-grid"><label className="full"><span>Varlık</span><select name="assetId" required><option value="">Seçin</option>{assets.map(a=><option key={a.id} value={a.id}>{a.asset_code} · {a.name}</option>)}</select></label><label className="full"><span>Bakım başlığı</span><input name="title" required placeholder="Örn. Aylık mekanik kontrol"/></label><label><span>Sıklık</span><select name="frequencyType" defaultValue="month"><option value="day">Gün</option><option value="week">Hafta</option><option value="month">Ay</option><option value="year">Yıl</option><option value="usage">Kullanım birimi</option></select></label><label><span>Tekrar değeri</span><input name="frequencyValue" type="number" min="1" defaultValue="1"/></label><label><span>İlk bakım tarihi</span><input name="nextDueDate" type="date"/></label><label><span>Sorumlu</span><input name="assignedTo"/></label><label className="full"><span>Kontrol listesi</span><textarea name="checklistText" rows={4} placeholder={"Yağ seviyesi\nBağlantılar\nGüvenlik kontrolü"}/></label></div></Modal>}
  </>;
}
