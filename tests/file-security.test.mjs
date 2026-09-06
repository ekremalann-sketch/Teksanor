import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectUpload} from '../lib/file-security.ts';
const bytes=(s)=>new TextEncoder().encode(s).buffer;
test('upload rejects an executable extension and mismatched declared content',()=>{
 assert.throws(()=>inspectUpload('invoice.exe','application/pdf',bytes('%PDF-1.7')));
 assert.throws(()=>inspectUpload('invoice.png','application/pdf',bytes('%PDF-1.7')));
 assert.throws(()=>inspectUpload('photo.png','image/png',bytes('<script>alert(1)</script>')));
});
test('valid PDF signature is policy checked and never called antivirus clean',()=>{const r=inspectUpload('invoice.pdf','application/pdf',bytes('%PDF-1.7'));assert.equal(r.scanMode,'signature-and-content-policy')});
