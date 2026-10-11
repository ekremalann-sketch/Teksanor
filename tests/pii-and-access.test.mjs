// Yapay zekâya giden metinde kişisel tanımlayıcıların gizlenmesi ve rol ana ekranları.
import assert from 'node:assert/strict';
import test from 'node:test';
import { maskPII } from '../lib/pii.ts';
import { accessRules, homeFor } from '../lib/access-rules.ts';

test('maskeleme: telefon, e-posta, TCKN, IBAN gizlenir; olağan metin kalır', () => {
  const out = maskPII('Ali 0532 123 45 67 ali@ornek.com 12345678901 TR33 0006 1005 1978 6457 8413 26 kombi arızası');
  assert.doesNotMatch(out, /0532|ali@ornek|12345678901|TR33/);
  assert.match(out, /\[TELEFON_MASKELI\]/); assert.match(out, /\[EPOSTA_MASKELI\]/); assert.match(out, /\[KIMLIK_MASKELI\]/); assert.match(out, /\[IBAN_MASKELI\]/);
  assert.match(out, /kombi arızası/);
  assert.equal(maskPII('3 iş gecikti, toplam 4.500 TL'), '3 iş gecikti, toplam 4.500 TL');
});

test('rol ana ekranı: teknisyen servise, finans ödemelere, İK ve BT kendi birimine düşer', () => {
  assert.equal(homeFor('employee'), '/servis');
  assert.equal(homeFor('finance'), '#panel=payments');
  assert.equal(homeFor('hr'), '/birimler?birim=ik');
  assert.equal(homeFor('it'), '/birimler?birim=bt');
  assert.equal(homeFor('manager', 'Satın alma ve tedarik'), '#panel=procurement');
  assert.equal(homeFor('owner'), '#panel=overview');
  assert.ok(!accessRules.employee.view.includes('payments'), 'çalışan finans görmez');
});
