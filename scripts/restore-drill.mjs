// D1 yedek → izole geri yükleme tatbikatı. Üretime DOKUNMAZ: tüm veri tabanları
// wrangler'ın yerel (--local) D1'idir ve geçici bir klasörde yaşar. Yalnız sentetik veri.
// Kullanım: node --experimental-strip-types scripts/restore-drill.mjs
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createHarness} from '../tests/helpers/harness.mjs';
import {reorderD1Export} from './d1-restore-order.mjs';
import {readFile} from 'node:fs/promises';

const root=process.cwd();
const wrangler=resolve(root,'node_modules/.bin/wrangler');
const dir=await mkdtemp(join(tmpdir(),'teksanor-restore-drill-'));
const log=(...a)=>console.log('[drill]',...a);
// Her veri tabanı kendi klasöründe, wrangler'ın varsayılan yerel D1 konumunda (.wrangler/state).
const config=JSON.stringify({name:'teksanor-restore-drill',compatibility_date:'2026-07-16',d1_databases:[{binding:'DB',database_name:'drill',database_id:'00000000-0000-4000-8000-00000000d1d1'}]});
for(const state of ['source','raw-restore','restored']){await mkdir(join(dir,state),{recursive:true});await writeFile(join(dir,state,'wrangler.jsonc'),config);}
const d1=(state,args)=>execFileSync(wrangler,['d1',...args,'drill','--local'],{cwd:join(dir,state),encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false',CI:'1'}});

// 1) Uygulamanın gerçek şeması + gerçek rotalarla üretilmiş sentetik veri.
const h=await createHarness('restore-drill-seed',{payments:'./app/api/payments/route.ts',jobs:'./app/api/service/jobs/route.ts'});
await h.user('demo-owner','org-demo','owner','owner');await h.user('demo-tech','org-demo','member','employee');
for(const [bank,debt,paid] of [['Demo Banka A','12.500,75','2.500'],['Demo Banka B','3.000',''],['Demo Banka C','800','800']])
  await h.api.payments.POST(h.req('demo-owner','/api/payments','POST',{period:'Eylül 2026',ownerName:'Demo',bankName:bank,accountName:'Demo Hesap',totalDebt:debt,paidAmount:paid},'org-demo'));
await h.api.jobs.POST(h.req('demo-owner','/api/service/jobs','POST',{action:'create',title:'Sentetik servis',customerName:'Demo Müşteri',assignedUserId:'demo-tech'},'org-demo'));
const seedFile=join(dir,'seed.sqlite');h.sql.exec(`VACUUM INTO '${seedFile}'`);
const seedSql=join(dir,'seed.sql');
// Önce tüm şema, sonra ertelenmiş yabancı anahtar denetimiyle veri (D1 export ile aynı yaklaşım).
execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);items=[l for l in c.iterdump() if not l.startswith(('BEGIN TRANSACTION','COMMIT'))]
tables=[l for l in items if l.startswith('CREATE TABLE')];rest=[l for l in items if l.startswith('CREATE') and not l.startswith('CREATE TABLE')];rows=[l for l in items if l.startswith('INSERT')]
open(sys.argv[2],'w').write('\\n'.join(['PRAGMA defer_foreign_keys=true;']+tables+rest+rows))`,seedFile,seedSql]);
d1('source',['execute','--file',seedSql,'--yes']);
log('kaynak D1 (üretim benzeri, yerel) hazır');

// 2) Yedek: üretimdeki scripts/backup-d1.mjs ile aynı komut (--remote yerine --local).
const backup=join(dir,'backup.sql');d1('source',['export','--output',backup]);
log('yedek alındı:',backup);

// 3a) Ham export boş D1'e doğrudan yüklenebiliyor mu? (Bilinen sorun: alfabetik tablo sırası.)
let rawOk=true;try{d1('raw-restore',['execute','--file',backup,'--yes']);}catch(e){rawOk=false;log('ham export doğrudan geri YÜKLENEMEDİ:',(String(e.stderr).match(/no such table[^\\\n]*/)||['hata'])[0]);}
// 3b) Sıralanmış yedek: doğrulayıcı (FK açık) + gerçek yerel D1'e geri yükleme.
const ordered=join(dir,'backup.restore.sql');const re=reorderD1Export(await readFile(backup,'utf8'));await writeFile(ordered,re.sql);
execFileSync('python3',[resolve(root,'scripts/verify-sql-backup.py'),ordered],{stdio:'inherit'});
d1('restored',['execute','--file',ordered,'--yes']);
log(`sıralanmış yedek (${re.counts.table} tablo, ${re.counts.insert} satır) boş ve izole D1'e geri yüklendi`);

// 4) Tablo tablo satır sayısı ve içerik özeti karşılaştırması.
async function sqliteFile(state){const base=join(dir,state,'.wrangler','state','v3','d1','miniflare-D1DatabaseObject');const f=(await readdir(base)).find(n=>n.endsWith('.sqlite')&&!n.startsWith('metadata'));return join(base,f);}
function fingerprint(file){const db=new DatabaseSync(file,{readOnly:true});const out={};for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all()){const rows=db.prepare(`SELECT * FROM "${name}"`).all().map(r=>JSON.stringify(Object.entries(r).sort())).sort();out[name]={rows:rows.length,hash:createHash('sha256').update(rows.join('\n')).digest('hex').slice(0,16)};}db.close();return out;}
const source=fingerprint(await sqliteFile('source'));const restored=fingerprint(await sqliteFile('restored'));
const mismatches=Object.keys({...source,...restored}).filter(t=>JSON.stringify(source[t])!==JSON.stringify(restored[t]));
const important=['users','organizations','organization_members','payment_records','work_orders','service_jobs','audit_logs','organization_period_summaries'];
for(const t of important)log(`${t.padEnd(30)} kaynak=${source[t]?.rows} geri_yüklenen=${restored[t]?.rows} ${source[t]?.hash===restored[t]?.hash?'aynı':'FARKLI'}`);
if(mismatches.length)throw new Error('Geri yükleme farklı: '+mismatches.join(', '));
log(`${Object.keys(source).length} tablonun tamamı birebir aynı`);

// 5) Uygulama geri yüklenen veri tabanında gerçekten çalışıyor mu?
const copy=join(dir,'restored-app.sqlite');new DatabaseSync(await sqliteFile('restored'),{readOnly:true}).exec(`VACUUM INTO '${copy}'`);
const app=await createHarness('restore-drill-app',{dashboard:'./app/api/dashboard/route.ts',jobs:'./app/api/service/jobs/route.ts'},{file:copy});
const user=await app.api.auth.loginWithUsername({username:'demo-owner',password:'Test-password-123!'});
const token=await app.api.auth.createSession(user.id);
const request=(path)=>new Request('https://test.local'+path,{headers:{Cookie:'teksanor_session='+token,'X-Organization-Id':'org-demo'}});
const dash=await (await app.api.dashboard.GET(request('/api/dashboard'))).json();
const jobs=await (await app.api.jobs.GET(request('/api/service/jobs'))).json();
if(dash.payments.length!==3||jobs.jobs.length!==1)throw new Error('Uygulama geri yüklenen veriyi okuyamadı');
const debt=dash.payments.find(p=>p.bank_name==='Demo Banka A');
if(debt.total_debt!==12500.75||debt.paid_amount!==2500)throw new Error('Tutarlar geri yüklemede bozuldu');
log(`uygulama geri yüklenen DB'de giriş yaptı; pano ${dash.payments.length} ödeme, servis masası ${jobs.jobs.length} iş gösterdi; 12.500,75 TL tutarı korundu`);
if(!process.env.KEEP_DRILL)await rm(dir,{recursive:true,force:true});
log(`TATBİKAT BAŞARILI — ham export doğrudan yüklenebilir: ${rawOk?'evet':'hayır (sıralama gerekli)'}; üretim veri tabanı kullanılmadı.`);
