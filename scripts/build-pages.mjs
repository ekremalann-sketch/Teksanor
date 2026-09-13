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

      const securityHeaders = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=()",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; form-action 'self'; upgrade-insecure-requests",
      };

      function secure(response, pathname) {
        const headers = new Headers(response.headers);
        for (const [name, value] of Object.entries(securityHeaders)) headers.set(name, value);
        if (pathname.startsWith("/api/")) headers.set("Cache-Control", "private, no-store");
        const contentType = headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
          headers.set("CDN-Cache-Control", "no-store");
        }
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }

      export default {
        async fetch(request, env, context) {
          const pathname = new URL(request.url).pathname;
          if (!pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) {
              return secure(asset, pathname);
            }
          }

          const response = await app.fetch(request, env, context);
          return secure(response, pathname);
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
