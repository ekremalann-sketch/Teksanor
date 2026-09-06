import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const protectedRoutes = [
  "app/api/dashboard/route.ts",
  "app/api/payments/route.ts",
  "app/api/payments/[id]/route.ts",
  "app/api/expenses/route.ts",
  "app/api/treasury/route.ts",
  "app/api/uploads/route.ts",
  "app/api/uploads/[id]/route.ts",
  "app/api/projects/route.ts",
  "app/api/assets/route.ts",
  "app/api/assets/[id]/route.ts",
  "app/api/maintenance/route.ts",
  "app/api/maintenance/[id]/route.ts",
  "app/api/tasks/route.ts",
  "app/api/tasks/[id]/route.ts",
  "app/api/work-orders/route.ts",
  "app/api/work-orders/[id]/route.ts",
  "app/api/field-visits/route.ts",
  "app/api/field-visits/[id]/route.ts",
  "app/api/procurement/route.ts",
  "app/api/procurement/[id]/route.ts",
  "app/api/customers/route.ts",
  "app/api/customers/[id]/route.ts",
  "app/api/employees/route.ts",
  "app/api/employees/[id]/route.ts",
  "app/api/risks/route.ts",
  "app/api/risks/[id]/route.ts",
  "app/api/automations/route.ts",
  "app/api/automations/[id]/route.ts",
  "app/api/agents/chat/route.ts",
  "app/api/notifications/route.ts",
  "app/api/organization/route.ts",
  "app/api/users/route.ts",
];

const mutationRoutes = [
  "app/api/auth/login/route.ts",
  "app/api/auth/logout/route.ts",
  "app/api/auth/password/route.ts",
  "app/api/auth/register/route.ts",
  "app/api/auth/mfa/challenge/route.ts",
  "app/api/auth/mfa/setup/route.ts",
  "app/api/payments/route.ts",
  "app/api/payments/[id]/route.ts",
  "app/api/expenses/route.ts",
  "app/api/treasury/route.ts",
  "app/api/uploads/route.ts",
  "app/api/projects/route.ts",
  "app/api/assets/route.ts",
  "app/api/assets/[id]/route.ts",
  "app/api/maintenance/route.ts",
  "app/api/maintenance/[id]/route.ts",
  "app/api/tasks/route.ts",
  "app/api/tasks/[id]/route.ts",
  "app/api/work-orders/route.ts",
  "app/api/work-orders/[id]/route.ts",
  "app/api/field-visits/route.ts",
  "app/api/field-visits/[id]/route.ts",
  "app/api/procurement/route.ts",
  "app/api/procurement/[id]/route.ts",
  "app/api/customers/route.ts",
  "app/api/customers/[id]/route.ts",
  "app/api/employees/route.ts",
  "app/api/employees/[id]/route.ts",
  "app/api/risks/route.ts",
  "app/api/risks/[id]/route.ts",
  "app/api/automations/route.ts",
  "app/api/automations/[id]/route.ts",
  "app/api/agents/chat/route.ts",
  "app/api/notifications/route.ts",
  "app/api/organization/route.ts",
  "app/api/users/route.ts",
];

test("firma verisi kullanan rotalar organizasyon kontrolü uygular", async () => {
  for (const route of protectedRoutes) {
    const source = await readFile(new URL(`../${route}`, import.meta.url), "utf8");
    assert.match(source, /requireOrganization\(/, `${route} organizasyon kontrolü içermiyor`);
  }
});

test("dosyalar R2 içinde firma önekiyle ayrılır", async () => {
  const source = await readFile(new URL("../app/api/uploads/route.ts", import.meta.url), "utf8");
  assert.match(source, /`\$\{context\.organization\.id\}\//, "R2 nesne anahtarında firma öneki bulunmuyor");
  assert.match(source, /scan_status/, "Dosya güvenlik kontrol durumu kaydedilmiyor");
});

test("MFA gereken kullanıcı için oturum ikinci adım tamamlanmadan açılmaz", async () => {
  const source = await readFile(new URL("../app/api/auth/login/route.ts", import.meta.url), "utf8");
  const mfaBranch = source.slice(source.indexOf("if (user.mfa_enabled"));
  assert.match(mfaBranch, /mfaRequired:\s*true/);
  assert.ok(
    mfaBranch.indexOf("mfaRequired: true") < mfaBranch.indexOf("createSession("),
    "MFA yanıtı oturum açılmadan önce dönmeli",
  );
});

test("MFA kurulumu yönetici çalışma alanını zorunlu olarak kilitlemez", async () => {
  const source = await readFile(new URL("../lib/tenancy.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /user\.role === "admin" && !user\.mfa_enabled/);
  assert.doesNotMatch(source, /MFA_REQUIRED/);
});

test("değiştiren API rotaları cross-site kaynak kontrolü uygular", async () => {
  for (const route of mutationRoutes) {
    const source = await readFile(new URL(`../${route}`, import.meta.url), "utf8");
    assert.match(source, /rejectCrossSiteMutation\(request\)/, `${route} cross-site kaynak kontrolü içermiyor`);
  }
});
