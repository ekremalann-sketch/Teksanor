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
      import { secure } from "./scripts/pages-security.mjs";

      export default {
        async fetch(request, env, context) {
          const pathname = new URL(request.url).pathname;
          if (!pathname.startsWith("/api/") && (request.method === "GET" || request.method === "HEAD")) {
            const asset = await env.ASSETS.fetch(request);
            if (asset.status !== 404) {
              return secure(asset, pathname, request.method);
            }
          }

          const response = await app.fetch(request, env, context);
          return secure(response, pathname, request.method);
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
