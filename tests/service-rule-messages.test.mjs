import test from 'node:test';import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
// İş kuralı ihlalinde kullanıcı genel hata yerine nedeni görmeli; beklenmeyen hatalar gizli kalmalı. Yalnız sentetik veri.
const h=await createHarness('service-rule-messages',{jobs:'./app/api/service/jobs/route.ts'});
const {api,sql,req}=h;await h.user('sim-owner','sim-org','owner','owner');await h.user('sim-tech','sim-org','member','employee');
const act=(b,u='sim-owner')=>api.jobs.POST(req(u,'/api/service/jobs','POST',b,'sim-org'));
let n=0;async function job(){const c=await act({action:'create',title:'SIM kural işi '+(++n),assignedUserId:'sim-tech'});assert.equal(c.status,201);return (await c.json()).id;}
const ver=id=>sql.prepare('SELECT version FROM service_jobs WHERE id=?').get(id).version;

test('onaylanmış raporu değiştirme denemesi nedeniyle reddedilir',async()=>{
 const id=await job();sql.prepare("UPDATE service_jobs SET stage='accepted',outcome='SIM rapor' WHERE id=?").run(id);
 const r=await act({action:'update',id,version:ver(id),outcome:'SIM değişmiş rapor'});
 assert.equal(r.status,400);assert.equal((await r.json()).error,'Müşterinin onayladığı rapor değiştirilemez.');
});
test('teknisyen onaysız işte kayıt yapamaz ve nedenini görür',async()=>{
 const id=await job();
 const r=await act({action:'update',id,version:ver(id),stage:'in_progress'},'sim-tech');
 assert.equal(r.status,400);assert.match((await r.json()).error,/Saha kaydı için onaylı veya devam eden iş seçin|önceki adımları tamamlayın/);
});
test('geçersiz durum geçişi nedeniyle reddedilir',async()=>{
 const id=await job();
 const r=await act({action:'update',id,version:ver(id),stage:'collected'});
 assert.equal(r.status,400);assert.equal((await r.json()).error,'Bu durum değişikliği için önceki adımları tamamlayın.');
});
test('beklenmeyen veritabanı hatası ayrıntı sızdırmaz',async()=>{
 const id=await job();
 sql.exec("CREATE TRIGGER fail_sj BEFORE UPDATE ON service_jobs BEGIN SELECT RAISE(ABORT,'SIM internal detail'); END");
 try{const r=await act({action:'update',id,version:ver(id),stage:'quoted',quote:10});assert.equal(r.status,400);assert.equal((await r.json()).error,'Servis işlemi tamamlanamadı.');}
 finally{sql.exec('DROP TRIGGER fail_sj');}
});
