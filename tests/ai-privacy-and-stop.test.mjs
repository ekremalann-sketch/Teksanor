import test from 'node:test';import assert from 'node:assert/strict';import {createHarness} from './helpers/harness.mjs';
// Yapay zekâya serbest metin/isim gitmez; servis taslağı dışarı çıkmaz; acil durdurma tüm kuralları durdurur.
const h=await createHarness('ai-privacy',{chat:'./app/api/agents/chat/route.ts',draft:'./app/api/service/draft/route.ts',automations:'./app/api/automations/route.ts',rule:'./app/api/automations/[id]/route.ts'});const {api,req,ctx}=h;
await h.user('owner','a','owner','owner');await h.user('tech','a','member','employee');
await test('Asistan: dış servise yazılan metin ve isim gitmez, yalnız konu ve sayılar gider',async()=>{
 globalThis.__teksanorTestEnv.OPENAI_API_KEY='test-key';const sent=[];const original=globalThis.fetch;
 globalThis.fetch=async(url,init)=>{sent.push(String(init?.body||''));return Response.json({choices:[{message:{content:'Öneri'}}]});};
 try{const r=await api.chat.POST(req('owner','/api/agents/chat','POST',{agentName:'Yönetim',message:'Ahmet Yılmaz ödemeleri geciktirdi mi? Not: gizli müşteri bilgisi',externalProcessingAcknowledged:true},'a'));
  assert.equal(r.status,200,await r.clone().text());const body=sent.join('\n');
  assert.ok(!body.includes('Ahmet'));assert.ok(!body.includes('gizli müşteri'));assert.ok(body.includes('Finans ve ödemeler'));
 }finally{globalThis.fetch=original;delete globalThis.__teksanorTestEnv.OPENAI_API_KEY;}
});
await test('Servis taslağı dış servise gitmez; not korunur',async()=>{
 globalThis.__teksanorTestEnv.OPENAI_API_KEY='test-key';const original=globalThis.fetch;let called=false;globalThis.fetch=async()=>{called=true;return Response.json({});};
 try{const r=await api.draft.POST(req('tech','/api/service/draft','POST',{note:'pompa contası değişti. basınç testi yapıldı'},'a'));const d=await r.json();
  assert.equal(r.status,200);assert.equal(called,false);assert.equal(d.source,'template');assert.match(d.draft,/Pompa contası değişti\./);
 }finally{globalThis.fetch=original;delete globalThis.__teksanorTestEnv.OPENAI_API_KEY;}
});
await test('Acil durdurma: yalnız yönetici; açıkken kural çalışmaz, yeniden başlatılabilir',async()=>{
 const list=await (await api.automations.GET(req('owner','/api/automations','GET',undefined,'a'))).json();const rule=list.automations[0];assert.ok(rule);
 assert.equal((await api.automations.PATCH(req('tech','/api/automations','PATCH',{action:'emergency-stop'},'a'))).status,403);
 const stop=await api.automations.PATCH(req('owner','/api/automations','PATCH',{action:'emergency-stop'},'a'));assert.equal((await stop.json()).paused,true);
 const control=await (await api.automations.GET(req('owner','/api/automations?control=1','GET',undefined,'a'))).json();assert.equal(control.paused,true);
 const run=await api.rule.POST(req('owner',`/api/automations/${rule.id}`,'POST',undefined,'a'),ctx(rule.id));const rb=await run.json();assert.match(JSON.stringify(rb),/acil durdurma/i);
 const resume=await api.automations.PATCH(req('owner','/api/automations','PATCH',{action:'resume'},'a'));assert.equal((await resume.json()).paused,false);
});
