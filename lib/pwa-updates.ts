// A new worker activates only after the user accepts the update.
export function watchServiceWorkerUpdates(onWaiting: (worker: ServiceWorker) => void) {
  let active = true;
  let accepted = false;
  let refreshing = false;
  let registration: ServiceWorkerRegistration | undefined;
  let installing: ServiceWorker | null = null;
  let interval: ReturnType<typeof setInterval> | undefined;
  const showWaiting = () => {
    if (active && navigator.serviceWorker.controller && registration?.waiting) onWaiting(registration.waiting);
  };
  const onStateChange = () => { if (installing?.state === 'installed') showWaiting(); };
  const onUpdateFound = () => {
    installing?.removeEventListener('statechange', onStateChange);
    installing = registration?.installing ?? null;
    installing?.addEventListener('statechange', onStateChange);
  };
  const onControllerChange = () => {
    if (!active || !accepted || refreshing || !navigator.serviceWorker.controller) return;
    refreshing = true;
    window.location.reload();
  };
  const update = () => registration?.update().catch(() => {});
  const onVisible = () => { if (document.visibilityState === 'visible') update(); };
  const dispose = () => {
    active = false;
    if (interval !== undefined) clearInterval(interval);
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    document.removeEventListener('visibilitychange', onVisible);
    registration?.removeEventListener('updatefound', onUpdateFound);
    installing?.removeEventListener('statechange', onStateChange);
  };
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker.register('/sw.js', {scope:'/'}).then(value => {
      if (!active) return;
      registration = value;
      showWaiting();
      registration.addEventListener('updatefound', onUpdateFound);
      onUpdateFound();
      interval = setInterval(update, 60 * 60 * 1000);
    }).catch(() => {});
  }
  return {
    dispose,
    apply(worker: ServiceWorker) {
      if (!active || registration?.waiting !== worker) return false;
      accepted = true;
      try { worker.postMessage({type:'SKIP_WAITING'}); return true; }
      catch { accepted = false; return false; }
    },
  };
}
