// Cloudflare Pages çalışanının güvenlik başlıkları. build-pages.mjs bunu _worker.js'e paketler;
// tests/pages-security.test.mjs doğrudan çalıştırır.

export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Permitted-Cross-Domain-Policies": "none",
};

/**
 * Betikler yalnız bu yanıta özgü nonce ile çalışır ('unsafe-inline' yok): sayfaya
 * sızan bir <script> etiketi çalışmaz. Stillerde React style={{…}} öznitelikleri
 * için 'unsafe-inline' korunur (stil enjeksiyonu betik çalıştırmaz).
 */
export function contentSecurityPolicy(nonce) {
  const script = nonce ? `'self' 'nonce-${nonce}'` : "'self'";
  return [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'none'",
    "img-src 'self' data: blob: https:", "font-src 'self' data:", "style-src 'self' 'unsafe-inline'",
    `script-src ${script}`, "connect-src 'self' https:", "form-action 'self'", "upgrade-insecure-requests",
  ].join("; ");
}

export function createNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function addNonce(html, nonce) {
  return html.replace(/<script\b(?![^>]*\bnonce=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
}

export async function secure(response, pathname, method = "GET") {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
  if (pathname.startsWith("/api/")) headers.set("Cache-Control", "private, no-store");
  const isHtml = (headers.get("content-type") || "").includes("text/html") && method !== "HEAD";
  let body = response.body;
  if (isHtml) {
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    headers.set("CDN-Cache-Control", "no-store");
    const nonce = createNonce();
    body = addNonce(await response.text(), nonce);
    headers.delete("content-length");
    headers.set("Content-Security-Policy", contentSecurityPolicy(nonce));
  } else {
    headers.set("Content-Security-Policy", contentSecurityPolicy(null));
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
