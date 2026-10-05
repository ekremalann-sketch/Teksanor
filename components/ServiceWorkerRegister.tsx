"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    let active = true;
    let refreshing = false;
    let registration: ServiceWorkerRegistration | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;
    const showWaiting = () => {
      if (active && navigator.serviceWorker.controller && registration?.waiting) {
        setWaiting(registration.waiting);
      }
    };
    const onControllerChange = () => {
      if (refreshing || !navigator.serviceWorker.controller) return;
      refreshing = true;
      window.location.reload();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", onVisibilityChange);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((value) => {
      if (!active) return;
      registration = value;
      showWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration?.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed") showWaiting();
        });
      });
      interval = setInterval(() => registration?.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
    return () => {
      active = false;
      if (interval) clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
  if (!waiting) return null;
  return <aside role="status" aria-live="polite" style={{
    position: "fixed", insetInline: 16, bottom: 16, zIndex: 1000,
    maxWidth: 440, marginInline: "auto", padding: 16, borderRadius: 12,
    color: "#fff", background: "#071729", boxShadow: "0 8px 28px #07172966",
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
  }}>
    <span style={{ flex: "1 1 180px" }}>Teksanor güncellendi. Yeni sürümü açmak için sayfayı yenileyin.</span>
    <button type="button" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}
      style={{ minHeight: 44, padding: "8px 14px", borderRadius: 8, border: 0, cursor: "pointer" }}>
      Güncelle
    </button>
    <button type="button" onClick={() => setWaiting(null)}
      aria-label="Güncelleme bildirimini kapat"
      style={{ minHeight: 44, padding: "8px 10px", borderRadius: 8, border: "1px solid #ffffff88", background: "transparent", color: "#fff", cursor: "pointer" }}>
      Sonra
    </button>
  </aside>;
}
