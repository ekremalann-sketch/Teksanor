import test from 'node:test';import assert from 'node:assert/strict';import {createHarness} from './helpers/harness.mjs';
const h=await createHarness('upload-atomic',{upload:'./app/api/uploads/route.ts'});
await h.user('sim','a','owner','owner');
const env=globalThis.__teksanorTestEnv,fetchOriginal=globalThis.fetch;
env.FILE_SCAN_URL='https://scanner.example.invalid';env.FILE_SCAN_TOKEN='synthetic-only';
let puts=[],deletes=[],putFails=false,deleteFails=false;
env.UPLOADS={async put(k){if(putFails)throw Error('synthetic put');puts.push(k)},async delete(k){deletes.push(k);if(deleteFails)throw Error('synthetic delete')}};
globalThis.fetch=async()=>Response.json({clean:true});
function upload(){const f=new FormData();f.set('file',new File(['%PDF-1.7\nSIM'], 'SIM.pdf',{type:'application/pdf'}));return h.api.upload.POST(new Request('https://test.local/api/uploads',{method:'POST',headers:{Cookie:'teksanor_session='+h.tokens.sim,Origin:'https://test.local','X-Organization-Id':'a'},body:f}));}
await test('audit failure rolls back file metadata and compensates stored object',async()=>{h.sql.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs WHEN NEW.entity_type='attachment' BEGIN SELECT RAISE(ABORT,'synthetic'); END");try{assert.equal((await upload()).status,503);assert.equal(h.sql.prepare('SELECT count(*) n FROM attachments').get().n,0);assert.deepEqual(deletes,puts);deleteFails=true;assert.equal((await upload()).status,503);assert.equal(h.sql.prepare('SELECT count(*) n FROM attachments').get().n,0);}finally{h.sql.exec('DROP TRIGGER fail_audit');deleteFails=false;}});
await test('scanner outage never writes object; object failure never creates metadata',async()=>{const before=puts.length;globalThis.fetch=async()=>{throw Error('synthetic scanner')};assert.equal((await upload()).status,503);assert.equal(puts.length,before);globalThis.fetch=async()=>Response.json({clean:true});putFails=true;assert.equal((await upload()).status,503);assert.equal(h.sql.prepare('SELECT count(*) n FROM attachments').get().n,0);putFails=false;});
await test('success creates file metadata and exactly one audit',async()=>{assert.equal((await upload()).status,201);assert.equal(h.sql.prepare('SELECT count(*) n FROM attachments').get().n,1);assert.equal(h.sql.prepare("SELECT count(*) n FROM audit_logs WHERE entity_type='attachment'").get().n,1);});
globalThis.fetch=fetchOriginal;
