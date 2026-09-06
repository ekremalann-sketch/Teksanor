import test from "node:test";
import assert from "node:assert/strict";
import { assertPaymentAmounts, inferredPaymentStatus, parseLocalizedNumber, remainingDebt } from "../lib/finance.ts";

test("kısmi ödeme kalan borcu doğru hesaplar", () => {
  assert.equal(remainingDebt({ totalDebt: 100_000, paidAmount: 35_000 }), 65_000);
  assert.equal(inferredPaymentStatus({ totalDebt: 100_000, paidAmount: 35_000 }), "partial");
});

test("tam ödeme borcu sıfırlar", () => {
  assert.equal(remainingDebt({ totalDebt: 50_000, paidAmount: 50_000 }), 0);
  assert.equal(inferredPaymentStatus({ totalDebt: 50_000, paidAmount: 50_000 }), "paid");
});

test("fazla ve negatif ödeme reddedilir", () => {
  assert.throws(() => assertPaymentAmounts({ totalDebt: 10, paidAmount: 11 }));
  assert.throws(() => assertPaymentAmounts({ totalDebt: -1, paidAmount: 0 }));
});


test("Türkçe para ve ondalık formatlarını güvenli okur", () => {
  assert.equal(parseLocalizedNumber("12.500,75"), 12500.75);
  assert.equal(parseLocalizedNumber("₺1.299,50"), 1299.5);
  assert.equal(parseLocalizedNumber("1500"), 1500);
  assert.equal(parseLocalizedNumber(""), 0);
});
