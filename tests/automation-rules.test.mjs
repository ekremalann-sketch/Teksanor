// Otomasyon kuralları gerçekten çalışır: kontrol açıkça seçilir, eşleşmede bildirim ve
// çalışma geçmişi oluşur, zamanlayıcı günde bir kez çalışır, yetkisiz modül atlanır. Sentetik veri.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('automation-rules',{
  automations:'./app/api/automations/route.ts', automation:'./app/api/automations/[id]/route.ts', rules:'./lib/automation-rules.ts',
});
const {sql,api,req,ctx}=h;
await h.user('boss','a','owner','owner');
await h.user('it','a','member','it');
await h.user('emp','a','member','employee');
await h.user('outsider','b','owner','owner');
sql.prepare("INSERT INTO work_orders(id,organization_id,order_number,title,status,scheduled_date) VALUES('wo1','a','WO-1','Kazan bakımı','open','2020-01-01')").run();
sql.prepare("INSERT INTO work_orders(id,organization_id,order_number,title,status,scheduled_date) VALUES('wo2','a','WO-2','Bitti','completed','2020-01-01')").run();
const notes=(u)=>sql.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id=? AND entity_type='automation'").get(u).n;

let ruleId;
await test('kural kontrol seçilmeden oluşturulamaz; seçilince trigger_config saklanır', async()=>{
  assert.equal((await api.automations.POST(req('it','/api/automations','POST',{name:'Geciken işler'},'a'))).status,400);
  const r=await api.automations.POST(req('it','/api/automations','POST',{name:'Geciken işler',check:'work_orders_overdue',triggerType:'schedule'},'a'));
  assert.equal(r.status,200); ruleId=(await r.json()).id;
  const row=sql.prepare('SELECT trigger_type,action_type,trigger_config FROM automation_rules WHERE id=?').get(ruleId);
  assert.deepEqual([row.trigger_type,row.action_type,JSON.parse(row.trigger_config).check],['schedule','notify','work_orders_overdue']);
});

await test('çalışan kural oluşturamaz/çalıştıramaz; başka firma kuralı göremez', async()=>{
  assert.equal((await api.automations.POST(req('emp','/api/automations','POST',{name:'x',check:'tasks_high_priority'},'a'))).status,403);
  assert.equal((await api.automation.POST(req('emp',`/api/automations/${ruleId}`,'POST',undefined,'a'),ctx(ruleId))).status,403);
  assert.equal((await api.automation.POST(req('outsider',`/api/automations/${ruleId}`,'POST',undefined,'b'),ctx(ruleId))).status,404);
});

await test('şimdi çalıştır: gerçek sayım, simülasyon yok, bildirim ve geçmiş oluşur', async()=>{
  const r=await api.automation.POST(req('it',`/api/automations/${ruleId}`,'POST',undefined,'a'),ctx(ruleId));
  const body=await r.json();
  assert.equal(r.status,200);
  assert.equal(body.matched,1,'yalnız açık ve gecikmiş iş emri');
  assert.ok(!/simül/i.test(body.message));
  assert.match(body.detail,/Kazan bakımı/);
  assert.equal(notes('it'),1);
  const history=await (await api.automation.GET(req('it',`/api/automations/${ruleId}`,'GET',undefined,'a'),ctx(ruleId))).json();
  assert.equal(history.runs.length,1);
  assert.equal(history.runs[0].status,'matched');
});

await test('zamanlanmış çalışma aynı gün ikinci kez çalışmaz', async()=>{
  const rule=sql.prepare('SELECT id,name,action_type,trigger_config FROM automation_rules WHERE id=?').get(ruleId);
  const access={profile:'it',viewModules:['work-orders'],editModules:[]};
  const first=await api.rules.runRule({organizationId:'a',rule,userId:'it',access,source:'schedule'});
  const second=await api.rules.runRule({organizationId:'a',rule,userId:'it',access,source:'schedule'});
  assert.equal(first.status,'matched');
  assert.equal(second.status,'skipped');
});

await test('kontrol edilen modülü göremeyen kişi için kural atlanır, veri dönmez', async()=>{
  const rule={id:ruleId,name:'Ödeme',action_type:'notify',trigger_config:JSON.stringify({check:'payments_due'})};
  const access={profile:'employee',viewModules:['overview','tasks'],editModules:[]};
  const r=await api.rules.runRule({organizationId:'a',rule,userId:'emp',access,source:'manual'});
  assert.equal(r.status,'skipped');
  assert.deepEqual(r.sample,[]);
  assert.equal(notes('emp'),0);
});

await test('ödemesi tamamlanan fakat durumu güncellenmemiş kayıt uyarıya girmez', async()=>{
  sql.prepare("INSERT INTO payment_records(id,period,owner_name,bank_name,account_name,monthly_payment,paid_amount,payment_status,due_date,organization_id) VALUES('p1','2026-09','Örnek','Banka','Kart',100,100,'planned','2020-01-01','a')").run();
  const rule={id:'pay1',name:'Ödeme kontrolü',action_type:'notify',trigger_config:JSON.stringify({check:'payments_due'})};
  const access={profile:'owner',viewModules:['payments'],editModules:[]};
  const result=await api.rules.runRule({organizationId:'a',rule,userId:'boss',access,source:'manual'});
  assert.equal(result.matched,0);
});

await test('eski belirsiz kurallar ad sezgisiyle veri taramaz', async()=>{
  assert.equal(api.rules.resolveCheck({id:'x',name:'Vade yaklaşan ödemeler',action_type:'notify',trigger_config:null}),null);
  assert.equal(api.rules.resolveCheck({id:'x',name:'Kritik stok',action_type:'notify',trigger_config:'{bozuk'}),null);
});
await test('prototip anahtarları sorgu seçimi olarak kabul edilmez',()=>{
  assert.equal(api.rules.isRuleCheck('__proto__'),false);
  assert.equal(api.rules.isRuleCheck('constructor'),false);
});
