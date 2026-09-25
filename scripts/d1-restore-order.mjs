// wrangler d1 export çıktısını boş bir D1'e geri yüklenebilir sıraya dizer.
// Sorun: export tabloları alfabetik yazar ve her tablonun satırlarını hemen ekler;
// çocuk tablo (ör. audit_logs → users) üst tablodan önce gelirse D1 "no such table"
// hatası verir ve D1'de foreign_keys kapatılamaz. Çözüm: PRAGMA → tüm CREATE TABLE
// → tüm INSERT → indeks/tetikleyici/görünüm. İçerik değiştirilmez, yalnız sıralanır.
// Kullanım: node scripts/d1-restore-order.mjs database.sql database.restore.sql
import {readFile,writeFile} from 'node:fs/promises';

/** Tırnak ve yorumlara saygı göstererek SQL betiğini ifadelere böler. */
export function splitSqlStatements(sql){
  const out=[];let current='';let quote=null;
  for(let i=0;i<sql.length;i++){
    const c=sql[i];current+=c;
    if(quote){ if(c===quote){ if(sql[i+1]===quote){current+=sql[++i];} else quote=null; } continue; }
    if(c==="'"||c==='"'||c==='`'){quote=c;continue;}
    if(c==='-'&&sql[i+1]==='-'){const end=sql.indexOf('\n',i);const stop=end<0?sql.length:end;current=current.slice(0,-1);i=stop-1;continue;}
    if(c===';'){const s=current.trim();if(s&&s!==';')out.push(s);current='';}
  }
  if(current.trim())out.push(current.trim().endsWith(';')?current.trim():current.trim()+';');
  return out;
}

export function reorderD1Export(sql){
  const buckets={pragma:[],table:[],insert:[],other:[],late:[]};
  for(const statement of splitSqlStatements(sql)){
    const head=statement.slice(0,40).toUpperCase();
    if(head.startsWith('PRAGMA'))buckets.pragma.push(statement);
    else if(head.startsWith('CREATE TABLE'))buckets.table.push(statement);
    else if(head.startsWith('INSERT'))buckets.insert.push(statement);
    else if(/^CREATE (UNIQUE )?INDEX|^CREATE TRIGGER|^CREATE VIEW/.test(head))buckets.late.push(statement);
    else buckets.other.push(statement);
  }
  if(!buckets.pragma.some(p=>/defer_foreign_keys/i.test(p)))buckets.pragma.unshift('PRAGMA defer_foreign_keys=TRUE;');
  const ordered=[...buckets.pragma,...buckets.table,...buckets.other,...buckets.insert,...buckets.late];
  return {sql:ordered.join('\n')+'\n',counts:Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,v.length]))};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw new Error('Kullanım: node scripts/d1-restore-order.mjs database.sql database.restore.sql');
  const {sql,counts}=reorderD1Export(await readFile(input,'utf8'));
  await writeFile(output,sql,{mode:0o600});
  console.log(`Geri yükleme sırası hazır: ${counts.table} tablo, ${counts.insert} satır, ${counts.late} indeks/tetikleyici → ${output}`);
}
