// T4: teknik servis akışı koddan çıkıp tanım verisine taşındı; motor tanımdan okur.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { createHarness } from "./helpers/harness.mjs";

const { api } = await createHarness("flow-definition", { f: "./lib/flow-definition.ts", ui: "./lib/service-ui.ts" });
const f = api.f, ui = api.ui;
const flow = f.TECHNICAL_SERVICE_FLOW;

test("teknik servis tanımı geçerli ve eski geçiş tablosuyla birebir aynı", () => {
  assert.deepEqual(f.validateFlowDefinition(flow), []);
  assert.deepEqual(f.transitionsOf(flow), {
    requested: ["quoted", "cancelled"], quoted: ["requested", "cancelled"], quote_approved: ["in_progress", "cancelled"],
    in_progress: ["completed", "cancelled"], completed: ["in_progress"], accepted: ["collected"], collected: [], cancelled: [],
  });
  assert.deepEqual(f.closedStages(flow), ["collected", "cancelled"]);
});

test("aşama başına zorunlu alan tanımdan gelir", () => {
  assert.deepEqual(f.missingRequired(flow, "completed", { outcome: "" }), ["Yapılan işlemi yazın."]);
  assert.deepEqual(f.missingRequired(flow, "completed", { outcome: "Kompresör değişti" }), []);
  assert.deepEqual(f.missingRequired(flow, "in_progress", {}), []);
});

test("saha çalışanı yalnız tanımdaki geçişleri yapabilir", () => {
  assert.equal(f.canTransition(flow, "quote_approved", "in_progress", false), true);
  assert.equal(f.canTransition(flow, "in_progress", "completed", false), true);
  assert.equal(f.canTransition(flow, "requested", "quoted", false), false);
  assert.equal(f.canTransition(flow, "in_progress", "cancelled", false), false);
  assert.equal(f.canTransition(flow, "in_progress", "cancelled", true), true);
});

test("sıradaki adım tanımdan okunur", () => {
  assert.deepEqual(ui.nextStep("quote_approved", false), { kind: "stage", label: "İşe başla", stage: "in_progress", hint: "Teklif onaylandı. Sahaya çıktığınızda işi başlatın." });
  assert.equal(ui.nextStep("quoted", true).kind, "share");
  assert.equal(ui.nextStep("bilinmeyen", true).kind, "info");
});

test("yeni bir iş türü aynı motorla tanımlanabilir; hatalı tanım reddedilir", () => {
  const mounting = { key: "montaj", label: "Montaj", version: 1, stages: [
    { key: "plan", label: "Planlandı", next: ["kurulum"], step: { manage: { kind: "stage", label: "Kuruluma başla", stage: "kurulum", hint: "" }, staff: { kind: "info", hint: "" } } },
    { key: "kurulum", label: "Kurulumda", next: ["bitti"], staffNext: ["bitti"], required: [{ field: "outcome", message: "Kurulum notu gerekli." }], step: { manage: { kind: "info", hint: "" }, staff: { kind: "info", hint: "" } } },
    { key: "bitti", label: "Bitti", next: [], closed: true, required: [{ field: "outcome", message: "Teslim notu gerekli." }], step: { manage: { kind: "info", hint: "" }, staff: { kind: "info", hint: "" } } },
  ] };
  assert.deepEqual(f.validateFlowDefinition(mounting), []);
  assert.deepEqual(f.missingRequired(mounting, "bitti", {}), ["Teslim notu gerekli."]);
  const broken = { ...mounting, stages: [{ ...mounting.stages[0], next: ["yok"] }] };
  assert.ok(f.validateFlowDefinition(broken).length >= 2);
});

test("servis kodu geçişleri ve saha kuralını tanımdan alıyor", () => {
  assert.match(readFileSync("lib/service.ts", "utf8"), /transitionsOf\(TECHNICAL_SERVICE_FLOW\)/);
  const route = readFileSync("app/api/service/jobs/route.ts", "utf8");
  assert.match(route, /canTransition\(TECHNICAL_SERVICE_FLOW,String\(job\.stage\),stage,false\)/);
  assert.match(route, /missingRequired\(TECHNICAL_SERVICE_FLOW,stage,\{outcome,quote_cents:values\[0\]\}\)/);
  assert.doesNotMatch(readFileSync("lib/service-ui.ts", "utf8"), /case "quote_approved"/);
});
