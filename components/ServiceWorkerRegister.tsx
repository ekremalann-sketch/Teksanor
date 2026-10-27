"use client";

import {useEffect, useRef, useState} from 'react';
import {watchServiceWorkerUpdates} from '../lib/pwa-updates';

export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const controls = useRef<ReturnType<typeof watchServiceWorkerUpdates> | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const watcher = watchServiceWorkerUpdates(setWaiting);
    controls.current = watcher;
    return () => { controls.current = null; watcher.dispose(); };
  }, []);
  if (!waiting) return null;
  return <aside role="status" aria-live="polite" className="pwa-update-notice">
    <span>Teksanor güncellendi. Açık formdaki bilgilerinizi kaydettikten sonra yeni sürümü açın.</span>
    <button type="button" className="pwa-update-apply" onClick={() => controls.current?.apply(waiting)}>Güncelle</button>
    <button type="button" className="pwa-update-later" aria-label="Güncelleme bildirimini kapat" onClick={() => setWaiting(null)}>Sonra</button>
  </aside>;
}
