"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
type Chip={label:string;count:number;href:string};
export default function AttentionStrip({organizationId,revision}:{organizationId:string;revision?:unknown}){
 const [chips,setChips]=useState<Chip[]|null>(null),[announcement,setAnnouncement]=useState("");const previous=useRef(0),previousOrg=useRef("");
 useEffect(()=>{let active=true;const controller=new AbortController();if(previousOrg.current!==organizationId){setChips(null);previous.current=0;previousOrg.current=organizationId;}
 const load=async()=>{if(document.visibilityState!=="visible")return;try{const r=await fetch("/api/attention",{headers:{"X-Organization-Id":organizationId,"X-Teksanor-Background":"1"},cache:"no-store",signal:controller.signal});if(!r.ok)return;const d=await r.json() as {chips:Chip[]};if(!active)return;setChips(d.chips);const count=d.chips.reduce((sum,c)=>sum+c.count,0);if(count>previous.current)setAnnouncement(`${count} kayıt dikkat bekliyor.`);previous.current=count;}catch{/* Ana ekran bağlantısı korunur. */}};
 void load();const timer=window.setInterval(()=>void load(),60000);return()=>{active=false;controller.abort();clearInterval(timer);};},[organizationId,revision]);
 if(!chips)return null;
 return <aside className="attention-strip" aria-label="Dikkat gerektiren işler"><b>Dikkat</b>{chips.length?chips.map(c=><Link key={c.label} href={c.href}>{c.label} · <strong>{c.count}</strong></Link>):<span>Dikkat bekleyen kayıt bulunmuyor</span>}<span className="attention-announcement" aria-live="polite">{announcement}</span></aside>;
}
