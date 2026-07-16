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
  entryPoints: [join(serverDir, "index.js")],
  outfile: join(pagesDir, "_worker.js"),
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  minify: true,
  external: ["node:*", "cloudflare:*"],
});

console.log("Cloudflare Pages output prepared in dist/pages");
