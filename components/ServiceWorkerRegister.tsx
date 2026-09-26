"use client";
import {useEffect} from "react";

// Çevrimdışı kabuğunu yalnız güvenli bağlamda (https veya localhost) kaydeder.
export function ServiceWorkerRegister(){
 useEffect(()=>{
  if(!("serviceWorker" in navigator)||!window.isSecureContext)return;
  navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{/* desteklenmiyorsa sessizce geç */});
 },[]);
 return null;
}
