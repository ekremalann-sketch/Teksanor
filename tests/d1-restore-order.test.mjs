import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {reorderD1Export,splitSqlStatements} from '../scripts/d1-restore-order.mjs';

// wrangler d1 export biçiminde: alfabetik tablo sırası, çocuk tablo verisi üst tablodan önce.
const EXPORT=`PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE audit_logs (id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), detail TEXT);
INSERT INTO "audit_logs" ("id","user_id","detail") VALUES('a1','u1','not; noktalı virgül ve ''tırnak''
çok satırlı');
CREATE TABLE organizations (id TEXT PRIMARY KEY);
INSERT INTO "organizations" ("id") VALUES('o1');
CREATE TABLE payment_records (id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id), created_by TEXT REFERENCES users(id));
INSERT INTO "payment_records" ("id","organization_id","created_by") VALUES('p1','o1','u1');
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id));
CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT);
INSERT INTO "users" ("id","username") VALUES('u1','demo');
CREATE INDEX idx_pay ON payment_records(organization_id);`;
const verify=(sql)=>{const d=mkdtempSync(join(tmpdir(),'d1o-'));const f=join(d,'x.sql');writeFileSync(f,sql);return spawnSync('python3',['scripts/verify-sql-backup.py',f],{encoding:'utf8'});};

test('bölücü tırnak içindeki noktalı virgül ve satır sonlarını korur',()=>{
  const parts=splitSqlStatements(EXPORT);
  assert.equal(parts.length,11);
  assert.match(parts[2],/'not; noktalı virgül ve ''tırnak''\nçok satırlı'\);$/);
});
test('sıralama: PRAGMA → tüm tablolar → satırlar → indeks; içerik kaybı yok',()=>{
  const {sql,counts}=reorderD1Export(EXPORT);
  assert.deepEqual(counts,{pragma:1,table:5,insert:4,other:0,late:1});
  const lastTable=sql.lastIndexOf('CREATE TABLE'),firstInsert=sql.indexOf('INSERT');
  assert.ok(lastTable<firstInsert,'tüm tablolar satırlardan önce');
  assert.ok(sql.indexOf('CREATE INDEX')>sql.lastIndexOf('INSERT'));
  assert.ok(sql.includes("'not; noktalı virgül ve ''tırnak''\nçok satırlı'"));
});
test('doğrulayıcı FK açıkken ham exportu reddeder, sıralanmışı kabul eder',()=>{
  const raw=verify(EXPORT);assert.equal(raw.status,1);assert.match(raw.stderr,/no such table/);
  const ok=verify(reorderD1Export(EXPORT).sql);assert.equal(ok.status,0,ok.stderr);assert.match(ok.stdout,/Local restore integrity passed/);
});
test('kopuk yabancı anahtar içeren yedek reddedilir',()=>{
  const broken=reorderD1Export(EXPORT.replace("VALUES('p1','o1','u1')","VALUES('p1','YOK','u1')")).sql;
  const r=verify(broken);assert.equal(r.status,1);assert.match(r.stderr,/FOREIGN KEY|integrity/);
});
