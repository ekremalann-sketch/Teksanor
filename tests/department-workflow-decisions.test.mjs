import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceUnitRecord } from '../lib/department-workflows.ts';

const pending = { unit: 'finance', process: 'Ödeme kontrolü', stage: 2, note: 'Belge kontrolü tamamlandı', approver: 'finance-admin', history: [] };

test('assigned manager approval advances to confirmation, rejection returns to intake', () => {
  assert.equal(advanceUnitRecord(pending, 'approve', 'finance-admin', true, 'Onay').stage, 3);
  assert.equal(advanceUnitRecord(pending, 'reject', 'finance-admin', true, 'Eksik belge').stage, 0);
  assert.throws(() => advanceUnitRecord(pending, 'approve', 'other-manager', true, 'Onay'));
});
