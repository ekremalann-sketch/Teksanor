import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("runtime requirements and environment names are documented", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.engines.node, /22/);
  const example = await readFile(new URL("../.dev.vars.example", import.meta.url), "utf8");
  for (const key of ["APP_ORIGIN", "MFA_ENCRYPTION_KEY", "FILE_SCAN_REQUIRED"]) assert.match(example, new RegExp(`^${key}=`, "m"));
});

test("Pages output applies security and API no-store headers in advanced mode", async () => {
  const builder = await readFile(new URL("../scripts/build-pages.mjs", import.meta.url), "utf8");
  assert.match(builder, /Content-Security-Policy/);
  assert.match(builder, /private, no-store/);
  assert.match(builder, /X-Content-Type-Options/);
});
