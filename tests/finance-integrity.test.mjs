import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePaymentStatus, parseRequiredPositiveAmount, paymentImportPayload, resolvePaymentStatus } from "../lib/finance.ts";

test("borç girilmeden ödeme ve 'ödendi' durumu reddedilir (eksik ≠ sıfır)", () => {
  assert.throws(() => resolvePaymentStatus({ totalDebt: null, paidAmount: 500 }), /toplam borcu girin/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: null, paidAmount: null, status: "paid" }), /Borç bilinmeden/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: null, paidAmount: null, status: "Kısmi ödendi" }), /Borç bilinmeden/);
  assert.equal(resolvePaymentStatus({ totalDebt: null, paidAmount: null }), "planned");
  assert.equal(resolvePaymentStatus({ totalDebt: null, paidAmount: null, status: "overdue" }), "overdue");
});

test("açıkça 0 girilen borca ödeme yazılamaz", () => {
  assert.throws(() => resolvePaymentStatus({ totalDebt: 0, paidAmount: 10 }), /Borcu 0/);
  assert.equal(resolvePaymentStatus({ totalDebt: 0, paidAmount: 0, status: "paid" }), "paid");
});

test("durum ile tutar tutarlılığı sunucuda zorlanır", () => {
  assert.equal(resolvePaymentStatus({ totalDebt: 1000, paidAmount: 1000 }), "paid");
  assert.equal(resolvePaymentStatus({ totalDebt: 1000, paidAmount: 400 }), "partial");
  assert.equal(resolvePaymentStatus({ totalDebt: 1000, paidAmount: 400, status: "overdue" }), "overdue");
  assert.throws(() => resolvePaymentStatus({ totalDebt: 1000, paidAmount: 400, status: "paid" }), /uyuşmuyor/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: 1000, paidAmount: 400, status: "planned" }), /uyuşmuyor/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: 1000, paidAmount: 1000, status: "overdue" }), /uyuşmuyor/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: 1000, paidAmount: 1200 }), /büyük olamaz/);
  assert.throws(() => resolvePaymentStatus({ totalDebt: 1000, paidAmount: 0, status: "iptal" }), /durumu geçersiz/);
});

test("Türkçe durum etiketleri API kodlarına çevrilir", () => {
  assert.equal(normalizePaymentStatus("Ödendi"), "paid");
  assert.equal(normalizePaymentStatus("KISMİ ÖDENDİ"), "partial");
  assert.equal(normalizePaymentStatus(" gecikti "), "overdue");
  assert.equal(normalizePaymentStatus("planned"), "planned");
  assert.equal(normalizePaymentStatus("bilinmiyor"), null);
});

test("gider tutarı zorunlu, katı ve pozitif okunur", () => {
  assert.equal(parseRequiredPositiveAmount("1.250,50"), 1250.5);
  assert.equal(parseRequiredPositiveAmount(99), 99);
  for (const bad of ["", null, undefined, "abc", "-10", 0, "0", "12abc"]) {
    assert.throws(() => parseRequiredPositiveAmount(bad), undefined, `reddedilmeli: ${String(bad)}`);
  }
});

test("dışa aktarılan Excel yeniden içe alındığında tarih ve boş hücreler korunur", () => {
  const exported = {
    "Dönem": "Eylül 2026", "Kişi": "Demo Sorumlu", "Banka": "Demo Banka", "Hesap": "Demo Hesap",
    "Toplam Limit": 5000, "Toplam Borç": 1200, "Ödenen Tutar": "", "Kalan Borç": 1200, "Aylık Ödeme": 300,
    "Asgari Ödeme": "", "Ödeme Durumu": "planned", "Son Ödeme": "2026-10-05", "Ödendiği Tarih": "", "Not": "Sentetik örnek",
  };
  const payload = paymentImportPayload(exported, "Varsayılan");
  assert.equal(payload.period, "Eylül 2026");
  assert.equal(payload.totalDebt, 1200);
  assert.equal(payload.paidAmount, "", "boş hücre 0'a çevrilmemeli");
  assert.equal(payload.minimumPayment, "");
  assert.equal(payload.dueDate, "2026-10-05");
  assert.equal(payload.paidAt, "");
  assert.equal(payload.importantNote, "Sentetik örnek");
  assert.equal(payload.paymentStatus, "planned");
});

test("'Son Ödeme Tarihi' sütunu ödeme tarihine yazılmaz", () => {
  const payload = paymentImportPayload({ "Dönem": "Ekim", "Son Ödeme Tarihi": new Date("2026-11-01T00:00:00Z"), "Ödeme Tarihi": "2026-10-20", "Gelecek Dönem Taksit": 250 }, "X");
  assert.equal(payload.dueDate, "2026-11-01");
  assert.equal(payload.paidAt, "2026-10-20");
  assert.equal(payload.period, "Ekim");
  assert.equal(payload.nextInstallment, 250);
});

test("Excel formül ve zengin metin hücreleri okunur", () => {
  const payload = paymentImportPayload({ "Toplam Borç": { formula: "A1*2", result: 800 }, "Banka": { richText: [{ text: "Demo " }, { text: "Banka" }] } }, "X");
  assert.equal(payload.totalDebt, 800);
  assert.equal(payload.bankName, "Demo Banka");
});

test("ödeme uçları aynı doğrulamayı kullanır; gider gevşek sayı okumaz", () => {
  for (const file of ["app/api/payments/route.ts", "app/api/payments/[id]/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /resolvePaymentStatus\(/, file);
    assert.doesNotMatch(source, /values\.totalDebt \?\? 0/, `${file} eksik borcu 0 saymamalı`);
  }
  const expenses = readFileSync("app/api/expenses/route.ts", "utf8");
  assert.match(expenses, /parseRequiredPositiveAmount\(/);
  assert.doesNotMatch(expenses, /parseLocalizedNumber\(/);
  const approve = readFileSync("app/api/payments/[id]/route.ts", "utf8");
  assert.match(approve, /workflow_status = 'approved'[^\n]*RETURNING id/, "olmayan kayıt onaylandı sayılmamalı");
});
