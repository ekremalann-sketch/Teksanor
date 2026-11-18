"use client";
// T9: telefondan saha fotoğrafı. Fotoğraf cihazda 1600 px WebP'ye küçültülür (konum/EXIF silinir), sonra yüklenir.
import {useCallback,useEffect,useRef,useState} from "react";
import {organizationFetch} from "@/lib/org-client";

type File_={id:string;file_name:string;created_at:string;full_name:string;scan_status:string};

async function toWebp(file:File,max=1600):Promise<Blob>{
 const bmp=await createImageBitmap(file);const scale=Math.min(1,max/Math.max(bmp.width,bmp.height));
 const c=document.createElement("canvas");c.width=Math.round(bmp.width*scale);c.height=Math.round(bmp.height*scale);
 c.getContext("2d")!.drawImage(bmp,0,0,c.width,c.height);bmp.close();
 return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("Fotoğraf hazırlanamadı.")),"image/webp",0.8));
}

export default function PhotoPanel({jobId,organizationId,canWrite}:{jobId:string;organizationId:string;canWrite:boolean}){
 const [files,setFiles]=useState<File_[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(false);const input=useRef<HTMLInputElement>(null);
 const load=useCallback(async()=>{const r=await organizationFetch(`/api/uploads?recordType=work_order&recordId=${encodeURIComponent(jobId)}`,{cache:"no-store"},organizationId);if(r.ok)setFiles(((await r.json()).files||[]).filter((f:File_)=>f.scan_status==="reencoded_image"));},[jobId,organizationId]);
 useEffect(()=>{void load();},[load]);
 async function upload(list:FileList|null){if(!list?.length)return;setBusy(true);setMsg("");
  try{for(const [i,f] of Array.from(list).entries()){setMsg(`${i+1}/${list.length} hazırlanıyor…`);const blob=await toWebp(f);const fd=new FormData();fd.set("file",new File([blob],`saha-${Date.now()}-${i+1}.webp`,{type:"image/webp"}));fd.set("recordType","work_order");fd.set("recordId",jobId);fd.set("kind","photo");
   const r=await organizationFetch("/api/uploads",{method:"POST",body:fd},organizationId);if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||"Yüklenemedi.");}
   setMsg("Fotoğraf eklendi.");await load();}catch(e){setMsg(e instanceof Error?e.message:"Yüklenemedi.");}finally{setBusy(false);if(input.current)input.current.value="";}}
 return <section className="service-card service-photos" aria-labelledby="photos-h"><h3 id="photos-h">Saha fotoğrafları</h3>
  {files.length?<ul className="service-photo-list">{files.map(f=><li key={f.id}><a href={`/api/uploads/${encodeURIComponent(f.id)}?organizationId=${encodeURIComponent(organizationId)}`} target="_blank" rel="noopener">{f.file_name}</a><small>{f.full_name} · {new Date(f.created_at).toLocaleString("tr-TR")}</small></li>)}</ul>:<p className="service-muted">Henüz fotoğraf yok.</p>}
  {canWrite&&<><input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={e=>void upload(e.target.files)}/><button type="button" disabled={busy} onClick={()=>input.current?.click()}>{busy?"Yükleniyor…":"Fotoğraf ekle"}</button></>}
  {msg&&<p role="status" className="service-muted">{msg}</p>}
 </section>;
}
