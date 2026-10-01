// Servis masası kolay kullanım yardımcıları: önceliklendirme, sıradaki adım ve paylaşım bağlantıları.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
const {api}=await createHarness('service-ui',{ui:'./lib/service-ui.ts'});
const {bucketOf,sortJobs,nextStep,shareLinks,localDay,addDays}=api.ui;

test('yerel gün: Türkiye saatinde gece yarısından sonra UTC kayması yok',()=>{
  const d=new Date(2026,9,1,0,30);assert.equal(localDay(d),'2026-10-01');assert.equal(addDays('2026-12-30',3),'2027-01-02');
});
test('öncelik: geciken → bugün → bu hafta → tarihsiz → ileri → kapalı',()=>{
  const t='2026-10-01';
  const jobs=[{id:'c',stage:'collected',scheduled_date:'2026-09-01'},{id:'l',stage:'requested',scheduled_date:'2026-11-01'},{id:'u',stage:'requested',scheduled_date:null},{id:'w',stage:'in_progress',scheduled_date:'2026-10-03'},{id:'t',stage:'quoted',scheduled_date:t},{id:'o',stage:'quote_approved',scheduled_date:'2026-09-28'}];
  assert.deepEqual(sortJobs(jobs,t).map(j=>j.id),['o','t','w','u','l','c']);
  assert.equal(bucketOf({stage:'accepted',scheduled_date:'2026-09-01'},t),'overdue','onaylanmış ama tahsil edilmemiş iş açık sayılır');
  assert.equal(bucketOf({stage:'cancelled',scheduled_date:t},t),'closed');
});
test('sıradaki adım: role göre doğru eylem; çalışan yönetici işini göremez',()=>{
  assert.deepEqual([nextStep('quote_approved',false).kind,nextStep('quote_approved',false).stage],['stage','in_progress']);
  assert.equal(nextStep('in_progress',false).needsNote,true);
  assert.equal(nextStep('quoted',true).kind,'share');assert.equal(nextStep('quoted',false).kind,'info');
  assert.equal(nextStep('completed',true).purpose,'completion');
  for(const s of ['requested','quoted','quote_approved','in_progress','completed','accepted','collected','cancelled'])for(const m of [true,false])assert.ok(nextStep(s,m).hint.length>10);
});
test('paylaşım: bağlantı kodlanır, WhatsApp/e-posta adresleri güvenli',()=>{
  const l=shareLinks('https://x.test/servis/onay#token=ab&c','A & B','Klima "bakım"','quote');
  assert.ok(l.whatsapp.startsWith('https://wa.me/?text='));assert.ok(!l.whatsapp.includes(' '));
  assert.ok(l.email.startsWith('mailto:?subject='));assert.match(decodeURIComponent(l.whatsapp),/token=ab&c/);
});
