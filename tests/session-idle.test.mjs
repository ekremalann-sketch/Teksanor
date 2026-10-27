import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';
// Sunucu tarafı 30 dk boşta kalma: arka plan yoklaması (x-teksanor-background:1) oturumu uzatmaz.
const h=await createHarness('session-idle',{attention:'./app/api/attention/route.ts'});
await h.user('tech','a','member','employee');
const tokenHash=async()=>{const {createHash}=await import('node:crypto');return createHash('sha256').update(h.tokens.tech).digest('hex');};
const setSeen=async(minutes)=>{const t=await tokenHash();h.sql.prepare("INSERT INTO session_activity(token_hash,last_seen_at) VALUES(?,datetime('now',?)) ON CONFLICT(token_hash) DO UPDATE SET last_seen_at=excluded.last_seen_at").run(t,`-${minutes} minutes`);};
const seenAgo=async()=>h.sql.prepare("SELECT (julianday('now')-julianday(last_seen_at))*1440 AS m FROM session_activity WHERE token_hash=?").get(await tokenHash()).m;
const background=(path)=>{const r=h.req('tech',path,'GET',undefined,'a');const headers=new Headers(r.headers);headers.set('X-Teksanor-Background','1');return new Request(r.url,{headers});};

await test('Arka plan yoklaması session_activity alanını tazelemez',async()=>{
 await setSeen(20);
 const r=await h.api.attention.GET(background('/api/attention'));
 assert.equal(r.status,200);
 assert.ok(await seenAgo()>19,'yoklama boşta kalma süresini sıfırlamamalı');
});
await test('Gerçek kullanıcı isteği etkinliği tazeler',async()=>{
 await setSeen(20);
 assert.equal((await h.api.attention.GET(h.req('tech','/api/attention','GET',undefined,'a'))).status,200);
 assert.ok(await seenAgo()<1);
});
await test('30 dk boşta kalan oturum yoklamayla canlı kalmaz: 401',async()=>{
 await setSeen(31);
 assert.equal((await h.api.attention.GET(background('/api/attention'))).status,401);
 assert.equal(await h.api.auth.getCurrentUser(h.req('tech','/api/attention')),null);
});
