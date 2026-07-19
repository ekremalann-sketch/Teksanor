import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const clientDir = join(root, "dist", "client");
const serverDir = join(root, "dist", "server");
const pagesDir = join(root, "dist", "pages");

await rm(pagesDir, { recursive: true, force: true });
await mkdir(pagesDir, { recursive: true });

// Pages serves the client assets and loads one bundled Vinext Worker in advanced mode.
await cp(clientDir, pagesDir, { recursive: true });
await build({
  stdin: {
    contents: `
      import app from "./dist/server/index.js";

      export default {
        async fetch(request, env, context) {
          const url = new URL(request.url);
          const publicPages = new Set([
            "/", "/cozumler", "/muhendislik", "/yapay-zeka", "/yapay-zeka-hizmeti", "/hakkimizda",
            "/icerikler/yapay-zeka-is-analizi", "/icerikler/veri-karar-destek",
            "/icerikler/surec-otomasyonu", "/icerikler/muhendislik-danismanligi"
          ]);
          const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
          const cacheablePage = request.method === "GET" && acceptsHtml && publicPages.has(url.pathname);
          const cacheKey = cacheablePage ? new Request(url.origin + url.pathname, { method: "GET" }) : null;

          if (cacheKey) {
            const cached = await caches.default.match(cacheKey);
            if (cached) return cached;
          }

          if (request.method === "GET" || request.method === "HEAD") {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) {
              const contentType = asset.headers.get("content-type") || "";
              if (contentType.includes("text/html")) {
                const headers = new Headers(asset.headers);
                headers.set("Cache-Control", cacheablePage ? "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800" : "no-store");
                const html = new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
                if (cacheKey) context.waitUntil(caches.default.put(cacheKey, html.clone()));
                return html;
              }
              return asset;
            }
          }

          const response = await app.fetch(request, env, context);
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) return response;
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", cacheablePage ? "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800" : "no-store");
          const html = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
          if (cacheKey && response.ok) context.waitUntil(caches.default.put(cacheKey, html.clone()));
          return html;
        },
      };
    `,
    resolveDir: root,
    sourcefile: "pages-entry.js",
    loader: "js",
  },
  outfile: join(pagesDir, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  minify: true,
  external: ["node:*", "cloudflare:*"],
});

console.log("Cloudflare Pages output prepared in dist/pages");
