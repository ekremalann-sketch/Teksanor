// TG2: herkese açık durum sayfası ve günlük yoklama kaydı.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

const {api,sql}=await createHarness('tg2-durum',{status:'./lib/status-log.ts',health:'./app/api/health/route.ts'});
const D=86400000,NOW=Date.UTC(2026,10,20,9);

await test('kayıt: aynı gün 5 dakikada bir başarılı kayıt (açık uç şişirilemez); kesinti her zaman yazılır',async()=>{
  await api.status.recordStatus(true,null,NOW);
  await api.status.recordStatus(true,null,NOW+60_000);
  await api.status.recordStatus(true,null,NOW+6*60_000);
  await api.status.recordStatus(false,'storage',NOW+7*60_000);
  const h=await api.status.statusHistory(NOW+8*60_000);
  const today=h.days.at(-1);assert.equal(today.ok,2);assert.equal(today.fail,1);assert.equal(today.state,'kesinti');
});

await test('geçmiş: 90 gün; yoklama olmayan gün "veri yok"; oran yalnız yoklamalardan',async()=>{
  await api.status.recordStatus(true,null,NOW-3*D);
  const h=await api.status.statusHistory(NOW+8*60_000);
  assert.equal(h.days.length,90);assert.equal(h.days[0].day,new Date(NOW-89*D).toISOString().slice(0,10));
  assert.equal(h.days.at(-4).state,'calisti');assert.equal(h.days.at(-2).state,'veri-yok');
  assert.equal(h.daysWithData,2);assert.equal(h.uptime,75);
});

await test('sağlık ucu başarılı yoklamayı kaydeder; hata metni değil yalnız bağımlılık adı tutulur',async()=>{
  sql.exec('DELETE FROM status_daily');
  assert.equal((await api.health.GET()).status,200);
  const r=sql.prepare('SELECT ok_count,fail_count,last_failure FROM status_daily').get();
  assert.equal(r.ok_count,1);assert.equal(r.fail_count,0);assert.equal(r.last_failure,null);
});

test('sayfa herkese açık, uydurma yüzde yok, yoklama iş akışı sır kullanmaz',()=>{
  const page=readFileSync('app/durum/page.tsx','utf8');
  assert.match(page,/metaFor\("\/durum"\)/);assert.match(page,/Veri yok/);assert.match(page,/Henüz yeterli yoklama kaydı yok/);
  const wf=readFileSync('.github/workflows/durum-yoklama.yml','utf8');
  assert.match(wf,/permissions: \{\}/);assert.doesNotMatch(wf,/secrets\.|uses:/);
  assert.match(readFileSync('db/migrations/20261120_status_daily.sql','utf8'),/CREATE TABLE IF NOT EXISTS status_daily/);
});
