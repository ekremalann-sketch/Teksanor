"use client";
import {useEffect} from "react";
import {signOut} from "@/lib/org-client";

// Çalışma alanı sayfalarında 30 dk kullanıcı etkinliği olmazsa oturum kapatılır (sunucu da 30 dk boşta kalmayı uygular).
// Arka plan yoklamaları oturumu uzatmaz; buna karşılık gerçek kullanıcı etkinliği (yazma, dokunma) varken
// en fazla 5 dk'da bir hafif bir istekle sunucu oturumu canlı tutulur — uzun not yazan teknisyen kaydederken girişe atılmaz.
const KEY="teksanor_last_activity";
const IDLE_MS=30*60*1000, PING_MS=5*60*1000;
const WORKSPACE=/^\/(panel|servis|birimler|kullanicilar|ornek-isletme|hesap-guvenligi|veri-yonetimi)(\/|$)/;
export default function IdleSessionGuard(){useEffect(()=>{
 // Müşteriye açık onay sayfası oturum gerektirmez.
 if(!WORKSPACE.test(location.pathname)||location.pathname.startsWith("/servis/onay"))return;
 let leaving=false,last=Date.now(),lastPing=Date.now();
 const write=(value:number)=>{try{localStorage.setItem(KEY,String(value));}catch{/* yoksay */}};
 const read=()=>{try{return Number(localStorage.getItem(KEY)||0);}catch{return 0;}};
 write(last);
 const activity=()=>{last=Date.now();if(last-read()>10_000)write(last);
  if(last-lastPing>PING_MS){lastPing=last;void fetch("/api/auth/session",{cache:"no-store",credentials:"same-origin"}).catch(()=>undefined);}};
 const check=async()=>{const seen=Math.max(last,read());if(leaving||Date.now()-seen<IDLE_MS)return;leaving=true;await signOut("/giris?reason=idle&returnTo="+encodeURIComponent(location.pathname+location.search+location.hash));};
 const visible=()=>{if(document.visibilityState==="visible")void check();};
 document.addEventListener("pointerdown",activity);document.addEventListener("keydown",activity);document.addEventListener("visibilitychange",visible);
 const timer=window.setInterval(()=>void check(),30_000);
 return()=>{window.clearInterval(timer);document.removeEventListener("pointerdown",activity);document.removeEventListener("keydown",activity);document.removeEventListener("visibilitychange",visible);};
},[]);return null;}
