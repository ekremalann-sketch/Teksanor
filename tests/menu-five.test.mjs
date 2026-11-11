// T2: ana menü 5 madde; "Diğer" altındaki ekranları firmanın sektör şablonu belirler.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const menu = await import("../lib/menu.ts");
const all = () => true;

test("ana menü tam 5 madde ve sabit sırada", () => {
  assert.deepEqual(menu.MAIN_MENU.map((m) => m.label), ["Bugün", "İşler", "Takvim", "Müşteriler", "Para"]);
  assert.equal(menu.mainMenu(all).length, 5);
});

test("yetkisi olmayan madde menüde görünmez (teknisyen para ve müşteri görmez)", () => {
  const tech = new Set(["overview", "tasks", "work-orders", "field-visits"]);
  assert.deepEqual(menu.mainMenu((id) => tech.has(id)).map((m) => m.key), ["today", "work", "calendar"]);
  assert.deepEqual(menu.mainMenu((id) => id === "overview").map((m) => m.key), ["today"]);
});

test("yeni firma yalnız şablonunun modüllerini görür", () => {
  assert.equal(menu.sectorTemplate("Teknik Servis"), "teknik-servis");
  assert.equal(menu.sectorTemplate("Asansör bakım ve onarım"), "bakim-onarim");
  assert.equal(menu.sectorTemplate("Mühendislik - Taahhüt"), "taahhut");
  assert.equal(menu.sectorTemplate(""), "genel");
  const service = menu.otherModules("Teknik servis", all);
  assert.ok(service.includes("assets") && service.includes("maintenance"));
  assert.ok(!service.includes("projects") && !service.includes("risks") && !service.includes("agents"));
  const contracting = menu.otherModules("Taahhüt", all);
  assert.ok(contracting.includes("projects") && contracting.includes("risks"));
  assert.ok(!contracting.includes("maintenance"));
  // Sektör girilmemiş eski firmalarda hiçbir ekran kaybolmaz.
  assert.deepEqual(menu.otherModules(null, all), [...menu.OTHER_IDS]);
  // Firma bilgileri her şablonda kalır; görme izni yoksa yine gizlenir.
  assert.ok(menu.otherModules("Teknik servis", all).includes("company"));
  assert.ok(!menu.otherModules("Teknik servis", (id) => id !== "company").includes("company"));
});

test("Dashboard menüyü bu tek kaynaktan çiziyor", () => {
  const src = readFileSync(new URL("../components/Dashboard.tsx", import.meta.url), "utf8");
  assert.match(src, /mainMenu\(canSee\)/);
  assert.match(src, /otherModules\(data\.profile\?\.sector, canSee\)/);
  assert.doesNotMatch(src, /label: "Ekipman ve bakım"/);
});
