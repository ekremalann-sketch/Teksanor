import { clearDrafts } from "./service-draft";
// Tarayıcı tarafı firma seçimi yardımcıları. Seçili firma localStorage'da "teksanor_organization" anahtarında tutulur.
// Eski/başka kullanıcıya ait bir değer kalıcı kilitlenmeye yol açmasın diye 403'te temizlenir ve istek bir kez başlıksız tekrarlanır.
export const ORGANIZATION_KEY = "teksanor_organization";

export function storedOrganization() {
  try { return new URLSearchParams(location.search).get("organizationId") || localStorage.getItem(ORGANIZATION_KEY) || ""; } catch { return ""; }
}

export function rememberOrganization(id: string | null | undefined) {
  try { if (id) localStorage.setItem(ORGANIZATION_KEY, id); } catch { /* yoksay */ }
}

/** Saklı firma seçimini ve adres çubuğundaki organizationId parametresini temizler. */
export function forgetOrganization() {
  try { localStorage.removeItem(ORGANIZATION_KEY); } catch { /* yoksay */ }
  try {
    const url = new URL(location.href);
    if (url.searchParams.has("organizationId")) { url.searchParams.delete("organizationId"); history.replaceState(history.state, "", url.pathname + url.search + url.hash); }
  } catch { /* yoksay */ }
}

/**
 * Firma başlığıyla istek atar. Okuma isteği 403 dönerse saklı firma temizlenir ve başlıksız bir kez tekrar denenir
 * (sunucu bu durumda kullanıcının ilk üyeliğine düşer). Yazma istekleri tekrarlanmaz; yalnız seçim temizlenir.
 */
export async function organizationFetch(path: string, init: RequestInit = {}, organization = storedOrganization()) {
  const send = (org: string) => fetch(path, { cache: "no-store", ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...(org ? { "X-Organization-Id": org } : {}) } });
  const response = await send(organization);
  if (response.status !== 403 || !organization) return response;
  forgetOrganization();
  const method = (init.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return response;
  return send("");
}

/** Her yerden çıkış: sunucu oturumunu kapatır, firma seçimini ve oturuma bağlı tarayıcı izlerini temizler. */
export async function signOut(redirect = "/giris") {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch { /* ağ hatasında da yerel iz temizlenir */ }
  forgetOrganization();
  try { sessionStorage.removeItem("teksanor_home_applied"); localStorage.removeItem("teksanor_last_activity"); } catch { /* yoksay */ }
  try { clearDrafts(localStorage); } catch { /* storage unavailable */ }
  location.replace(redirect);
}

