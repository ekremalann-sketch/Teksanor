// GHSA-xqc2-xf4c-x3h3 (CVE-2026-126187): React Server Components 19.2.0–19.2.8 etkilenir. Sürüm geri düşmesin.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
const safe = (v) => { const [a, b, c] = String(v).replace(/^[^\d]*/, "").split(".").map(Number); return a > 19 || (a === 19 && (b > 2 || (b === 2 && c >= 9))); };

test("react, react-dom ve react-server-dom-webpack 19.2.9 veya üstü", () => {
  for (const name of ["react", "react-dom", "react-server-dom-webpack"]) {
    assert.ok(safe(pkg.dependencies[name]), `${name} package.json: ${pkg.dependencies[name]}`);
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path.endsWith(`node_modules/${name}`)) assert.ok(safe(entry.version), `${path}: ${entry.version}`);
    }
  }
});
