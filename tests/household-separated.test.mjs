// T1: hane bütçesi kavramları firma ürününden ayrıldı.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHarness} from './helpers/harness.mjs';

test('kayıt ekranında "Bireysel hesap" seçeneği yok; firma hesabı varsayılan', ()=>{
 const src=readFileSync('app/giris/page.tsx','utf8');
 assert.doesNotMatch(src,/Bireysel hesap/);
 assert.doesNotMatch(src,/setAccountType\("personal"\)/);
});

test('firma hesabında hane bütçesi panelleri menüden ve doğrudan bağlantıdan gizli', ()=>{
 const src=readFileSync('components/Dashboard.tsx','utf8');
 assert.match(src,/const HOUSEHOLD_MODULES: string\[\] = \["financial", "payments", "treasury"\]/);
 assert.match(src,/householdHidden && HOUSEHOLD_MODULES\.includes\(item\.id\)/);
 assert.match(src,/data\.organization\.kind !== "personal" && HOUSEHOLD_MODULES\.includes\(active\)\) setActive\("overview"\)/);
});

const h=await createHarness('household-separated',{kind:'./lib/account-kind.ts'});
test('sunucu: kişisel hesap isteği bayrak kapalıyken firma hesabı olarak açılır', ()=>{
 const {accountKindFor}=h.api.kind;
 assert.equal(accountKindFor('personal',undefined),'business');
 assert.equal(accountKindFor('personal','1'),'business');
 assert.equal(accountKindFor('business','true'),'business');
 assert.equal(accountKindFor('personal','true'),'personal');
 assert.match(readFileSync('app/api/auth/register/route.ts','utf8'),/accountKindFor\(body\.accountType, process\.env\.HOUSEHOLD_FINANCE_ENABLED\)/);
});
