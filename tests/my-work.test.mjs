import test from 'node:test';import assert from 'node:assert/strict';import {createHarness} from './helpers/harness.mjs';
// "İşlerim": herkes yalnız kendisine atanan servis işlerini ve sorumlu olduğu birimin kuyruğunu görür.
const h=await createHarness('my-work',{route:'./app/api/my-work/route.ts',jobs:'./app/api/service/jobs/route.ts'});const {api,req}=h;
await h.user('owner','a','owner','owner');await h.user('tech','a','member','employee');await h.user('other','a','member','employee');
for(const [assignee,title] of [['tech','Kurgusal kombi bakımı'],['other','Kurgusal klima arızası']]){const r=await api.jobs.POST(req('owner','/api/service/jobs','POST',{action:'create',title,assignedUserId:assignee,scheduledDate:'2020-01-01'},'a'));assert.equal(r.status,201,await r.text());}
await test('Teknisyen yalnız kendisine atanan servisi görür; gecikme işaretlenir',async()=>{
 const d=await (await api.route.GET(req('tech','/api/my-work','GET',undefined,'a'))).json();
 const services=d.items.filter(i=>i.kind==='service');
 assert.deepEqual(services.map(i=>i.title),['Kurgusal kombi bakımı']);assert.equal(services[0].overdue,true);assert.ok(services[0].href.startsWith('/servis?job='));
});
await test('Oturum yoksa liste verilmez',async()=>{const r=await api.route.GET(new Request('https://test.local/api/my-work'));assert.equal(r.status,401);});
