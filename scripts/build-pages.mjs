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
          if (request.method === "GET" || request.method === "HEAD") {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) {
              const contentType = asset.headers.get("content-type") || "";
              if (contentType.includes("text/html")) {
                const headers = new Headers(asset.headers);
                headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
                headers.set("Pragma", "no-cache");
                return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
              }
              return asset;
            }
          }

          const response = await app.fetch(request, env, context);
          const contentType = response.headers.get("content-type") || "";
          if (!contentType.includes("text/html")) return response;
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
          headers.set("Pragma", "no-cache");
          return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
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
