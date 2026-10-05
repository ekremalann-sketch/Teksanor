// Teksanor çevrimdışı kabuğu.
// Güvenlik kuralı: /api/* yanıtları ve oturumlu sayfalar ASLA önbelleğe alınmaz
// (ortak cihazda başkası görmesin). Yalnızca içerik özetli (hash'li) statik dosyalar,
// simgeler ve çevrimdışı sayfası saklanır. Sayfalar her zaman önce ağdan istenir.
const CACHE = "teksanor-shell-v1";
const PRECACHE = ["/offline", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => {}));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("teksanor-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // veri hiçbir zaman saklanmaz

  // Sayfa gezinmesi: ağ; bağlantı yoksa çevrimdışı sayfası. HTML saklanmaz.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }

  // Hash'li derleme dosyaları değişmez: önce önbellek.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((response) => {
        if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
        return response;
      })),
    );
  }
});

// Yeni sürüm kullanıcı onayından sonra etkinleşir.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
