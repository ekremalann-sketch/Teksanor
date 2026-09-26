// Rol × firma erişim matrisi: her veri döndüren GET ucu, iki firmadaki sentetik
// kayıtlarla ve 9 kullanıcıyla gerçekten çağrılır. Yetkisiz modül 403, başka
// firmanın işaretli verisi yanıtta asla görünmemeli.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHarness} from './helpers/harness.mjs';

const h=await createHarness('access-matrix',{
  access:'./lib/access.ts', dashboard:'./app/api/dashboard/route.ts', treasury:'./app/api/treasury/route.ts',
  projects:'./app/api/projects/route.ts', tasks:'./app/api/tasks/route.ts', workOrders:'./app/api/work-orders/route.ts',
  assets:'./app/api/assets/route.ts', maintenance:'./app/api/maintenance/route.ts', fieldVisits:'./app/api/field-visits/route.ts',
  procurement:'./app/api/procurement/route.ts', customers:'./app/api/customers/route.ts', customer:'./app/api/customers/[id]/route.ts',
  interactions:'./app/api/customers/[id]/interactions/route.ts', employees:'./app/api/employees/route.ts', risks:'./app/api/risks/route.ts',
  automations:'./app/api/automations/route.ts', uploads:'./app/api/uploads/route.ts', notifications:'./app/api/notifications/route.ts',
  jobs:'./app/api/service/jobs/route.ts', taskId:'./app/api/tasks/[id]/route.ts', riskId:'./app/api/risks/[id]/route.ts', workOrderId:'./app/api/work-orders/[id]/route.ts', paymentId:'./app/api/payments/[id]/route.ts', employeeId:'./app/api/employees/[id]/route.ts', assetId:'./app/api/assets/[id]/route.ts', chat:'./app/api/agents/chat/route.ts', qr:'./app/api/service/qr/route.ts',
});
const {sql,api,req,ctx}=h;
const USERS=[['boss','a','owner','owner'],['admin','a','admin','company_admin'],['ceo','a','member','ceo'],['manager','a','member','manager'],['finance','a','member','finance'],['hr','a','member','hr'],['it','a','member','it'],['employee','a','member','employee'],['outsider','b','owner','owner']];
for(const u of USERS)await h.user(...u);

// Her firma tablosuna o firmaya özgü işaretli bir satır ekle.
const ownerOf={a:'boss',b:'outsider'};
function seed(org){
  const tables=sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name).filter(t=>!['organization_members','organization_member_access','organization_profiles','organization_reference_rates','service_approvals','service_jobs'].includes(t));
  for(const t of ['assets','customers',...tables.filter(x=>!['assets','customers'].includes(x))]){
    const cols=sql.prepare(`PRAGMA table_info(${t})`).all();if(!cols.some(c=>c.name==='organization_id'))continue;
    const values={};
    for(const c of cols){
      if(c.name==='organization_id')values[c.name]=org;
      else if(c.name==='id'&&!c.type.includes('INT'))values.id=`${t}-${org}`;
      else if(c.name==='asset_id')values[c.name]=`assets-${org}`;
      else if(c.name==='customer_id')values[c.name]=`customers-${org}`;
      else if(['uploaded_by','created_by','user_id'].includes(c.name))values[c.name]=ownerOf[org];
      else if(c.notnull&&c.dflt_value===null&&!c.pk)values[c.name]=/INT|REAL/.test(c.type)?1:`SECRET-${org}-${t}`;
      else if(/name|title|summary|content|note|description/.test(c.name)&&c.type==='TEXT')values[c.name]=`SECRET-${org}-${t}`;
    }
    if(t==='attachments'){values.record_type='employee';values.record_id=`employees-${org}`;values.file_name=`SECRET-${org}-bordro.pdf`;}
    if(t==='agent_chats'){values.agent_name='Yönetim';values.access_scope=api.access.accessRules.owner.view.slice().sort().join(',');}
    if(t==='notifications')values.is_read=0;
    const keys=Object.keys(values);
    sql.prepare(`INSERT INTO ${t}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>values[k]));
  }
  // Yöneticiye atanmış servis işi (çalışan görmemeli) ve çalışana atanmış servis işi.
  for(const [id,assignee] of [[`svc-private-${org}`,ownerOf[org]],...(org==='a'?[['svc-emp-a','employee']]:[])]){
    sql.prepare('INSERT INTO work_orders(id,organization_id,order_number,title,customer_name,notes) VALUES(?,?,?,?,?,?)').run(id,org,'SRV-'+id,`SVC-${id}`,`MUSTERI-${id}`,`RAPOR-${id}`);
    sql.prepare('INSERT INTO service_jobs(id,organization_id,assigned_user_id,quote_cents,labor_cents) VALUES(?,?,?,?,?)').run(id,org,assignee,100000,77777);
  }
}
seed('a');seed('b');

const ENDPOINTS=[
  ['dashboard','/api/dashboard',()=>api.dashboard.GET,null],
  ['treasury','/api/treasury',()=>api.treasury.GET,'treasury'],
  ['projects','/api/projects',()=>api.projects.GET,'projects'],
  ['tasks','/api/tasks',()=>api.tasks.GET,'tasks'],
  ['work-orders','/api/work-orders',()=>api.workOrders.GET,'work-orders'],
  ['assets','/api/assets',()=>api.assets.GET,'assets'],
  ['maintenance','/api/maintenance',()=>api.maintenance.GET,'maintenance'],
  ['field-visits','/api/field-visits',()=>api.fieldVisits.GET,'field-visits'],
  ['procurement','/api/procurement',()=>api.procurement.GET,'procurement'],
  ['customers','/api/customers',()=>api.customers.GET,'crm'],
  ['employees','/api/employees',()=>api.employees.GET,'hr'],
  ['risks','/api/risks',()=>api.risks.GET,'risks'],
  ['automations','/api/automations',()=>api.automations.GET,'automations'],
  ['uploads','/api/uploads',()=>api.uploads.GET,'files'],
  ['notifications','/api/notifications',()=>api.notifications.GET,null],
  ['service','/api/service/jobs',()=>api.jobs.GET,'work-orders'],
  ['agents','/api/agents/chat?agent=Y%C3%B6netim',()=>api.chat.GET,'agents'],
];
const profileOf=Object.fromEntries(USERS.map(u=>[u[0],u[3]]));
const canView=(user,module)=>!module||api.access.accessRules[profileOf[user]].view.includes(module);

for(const [user,org] of USERS){
  const other=org==='a'?'b':'a';
  await test(`${user} (${profileOf[user]}, firma ${org}): her uçta yalnız yetkili modül ve yalnız kendi firması`,async()=>{
    for(const [name,path,handler,module] of ENDPOINTS){
      const response=await handler()(req(user,path,'GET',undefined,org));
      const text=await response.text();
      assert.ok(!text.includes(`SECRET-${other}`),`${name}: başka firmanın verisi sızdı`);
      assert.ok(!text.includes(`svc-private-${other}`),`${name}: başka firmanın servis işi sızdı`);
      if(canView(user,module))assert.equal(response.status,200,`${name} görünmeli: ${text.slice(0,120)}`);
      else assert.equal(response.status,403,`${name} yetkisiz olmalı`);
    }
  });
  await test(`${user}: başka firma kimliğiyle istek her uçta reddedilir`,async()=>{
    for(const [name,path,handler] of ENDPOINTS){
      const response=await handler()(req(user,path,'GET',undefined,other));
      assert.equal(response.status,403,`${name}`);
    }
  });
}

await test('çalışan: finans, İK ve denetim verisi pano yanıtında yok',async()=>{
  const d=await (await api.dashboard.GET(req('employee','/api/dashboard','GET',undefined,'a'))).json();
  assert.deepEqual([d.summaries,d.payments,d.expenses,d.activity,d.attentionCount],[[],[],[],[],0]);
  const f=await (await api.dashboard.GET(req('finance','/api/dashboard','GET',undefined,'a'))).json();
  assert.ok(f.payments.length>0,'finans ödeme kayıtlarını görmeli');assert.deepEqual(f.activity,[]);
});
await test('çalışan: kendisine atanmamış servis işi hiçbir uçta görünmez',async()=>{
  for(const handler of [api.jobs.GET,api.workOrders.GET]){
    const text=await (await handler(req('employee','/api/x','GET',undefined,'a'))).text();
    assert.ok(text.includes('svc-emp-a'),'kendi servis işi görünmeli');
    assert.ok(!text.includes('svc-private-a'),'başkasına atanmış servis işi (müşteri/rapor) görünmemeli');
  }
  const jobs=await (await api.jobs.GET(req('employee','/api/service/jobs','GET',undefined,'a'))).json();
  assert.equal(jobs.jobs[0].labor_cents,undefined,'iç maliyet görünmemeli');
});
await test('dosya listesi: yetkisi olmayan kaydın (İK) dosya adı görünmez',async()=>{
  const emp=await (await api.uploads.GET(req('employee','/api/uploads','GET',undefined,'a'))).text();
  assert.ok(!emp.includes('SECRET-a-bordro.pdf'),'çalışan İK ekini görmemeli');
  const hr=await (await api.uploads.GET(req('hr','/api/uploads','GET',undefined,'a'))).text();
  assert.ok(hr.includes('SECRET-a-bordro.pdf'),'İK kendi ekini görmeli');
});
await test('müşteri detayı ve QR: başka firmanın kaydı 404',async()=>{
  assert.equal((await api.customer.GET(req('outsider','/api/customers/customers-a','GET',undefined,'b'),ctx('customers-a'))).status,404);
  const i=await api.interactions.GET(req('outsider','/x','GET',undefined,'b'),ctx('customers-a'));assert.ok(!(await i.text()).includes('SECRET-a'));
  assert.equal((await api.qr.GET(req('outsider','/api/service/qr?asset=assets-a','GET',undefined,'b'))).status,404);
  assert.equal((await api.customer.GET(req('boss','/api/customers/customers-a','GET',undefined,'a'),ctx('customers-a'))).status,200);
});
await test('oturumsuz istek her uçta 401',async()=>{
  for(const [name,path,handler] of ENDPOINTS){
    const r=await handler()(new Request('https://test.local'+path));assert.equal(r.status,401,name);
  }
});

// Yazma tarafı: düzenleme yetkisi olmayan rol hiçbir modülde kayıt oluşturamaz.
const WRITE=[
  ['projects','/api/projects',()=>api.projects.POST,'projects',{name:'W',department:'Operasyon yönetimi'},'projects'],
  ['tasks','/api/tasks',()=>api.tasks.POST,'tasks',{title:'W',department:'Operasyon yönetimi'},'tasks'],
  ['customers','/api/customers',()=>api.customers.POST,'crm',{name:'W'},'customers'],
  ['employees','/api/employees',()=>api.employees.POST,'hr',{fullName:'W',department:'Operasyon yönetimi'},'employees'],
  ['risks','/api/risks',()=>api.risks.POST,'risks',{title:'W',department:'Operasyon yönetimi'},'risks'],
  ['procurement','/api/procurement',()=>api.procurement.POST,'procurement',{title:'W',department:'Operasyon yönetimi'},'procurement_requests'],
  ['work-orders','/api/work-orders',()=>api.workOrders.POST,'work-orders',{title:'W'},'work_orders'],
  ['treasury','/api/treasury',()=>api.treasury.POST,'treasury',{action:'balance',accountName:'W',currency:'TRY',amount:'10'},'cash_balances'],
];
for(const [user,org] of USERS.filter(u=>u[1]==='a')){
  await test(`${user}: düzenleme yetkisi olmayan modülde kayıt oluşturamaz`,async()=>{
    for(const [name,path,handler,module,body,table] of WRITE){
      const before=sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
      const r=await handler()(req(user,path,'POST',body,org));
      const after=sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
      const allowed=api.access.accessRules[profileOf[user]].edit.includes(module);
      if(allowed)assert.ok(r.status<300,`${name} izinli olmalı: ${r.status} ${(await r.text()).slice(0,100)}`);
      else{assert.equal(after,before,`${name}: kayıt oluşmamalı`);assert.equal(r.status,403,`${name} reddedilmeli (${r.status})`);}
    }
  });
}

await test('başka firmanın kaydı ID bilinse bile güncellenemez veya silinemez',async()=>{
  const targets=[['tasks','tasks-a',api.taskId],['risks','risks-a',api.riskId],['work_orders','work_orders-a',api.workOrderId],['employees','employees-a',api.employeeId],['assets','assets-a',api.assetId]];
  for(const [table,id,mod] of targets){
    const before=JSON.stringify(sql.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id));
    for(const method of ['PUT','DELETE']){
      if(!mod[method])continue;
      const r=await mod[method](req('outsider','/api/x/'+id,method,{title:'HACK',fullName:'HACK',name:'HACK',status:'completed'},'b'),ctx(id));
      assert.ok([403,404].includes(r.status),`${table} ${method}: ${r.status}`);
    }
    assert.equal(JSON.stringify(sql.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)),before,`${table} değişmemeli`);
  }
  const pay=sql.prepare("SELECT id FROM payment_records WHERE organization_id='a'").get().id;
  for(const body of [{action:'approve'},{period:'X',ownerName:'X',bankName:'X',accountName:'X',totalDebt:'1'}]){
    const r=await api.paymentId.PATCH(req('outsider','/api/payments/'+pay,'PATCH',body,'b'),ctx(pay));assert.equal(r.status,404);
  }
  assert.equal((await api.paymentId.DELETE(req('outsider','/api/payments/'+pay,'DELETE',undefined,'b'),ctx(pay))).status,404);
  assert.ok(sql.prepare('SELECT id FROM payment_records WHERE id=?').get(pay));
});
