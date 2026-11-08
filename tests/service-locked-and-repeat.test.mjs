import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
// Onaylı işte not kilitli; teknisyen kayıt yapamayacağı işte Kaydet görmez; "Bu işi tekrar aç" bilgileri doldurur ama tarihi boş bırakır.
test('servis ekranı kuralları', async()=>{
 const s=await readFile('app/servis/page.tsx','utf8');
 assert.match(s,/readOnly=\{!data\?\.canWrite\|\|\["accepted","collected"\]\.includes\(current\.stage\)\}/);
 assert.match(s,/Müşteri raporu onayladı; not artık değiştirilemez\./);
 assert.match(s,/\(data\?\.manage\|\|\["quote_approved","in_progress"\]\.includes\(current\.stage\)\)&&<div className="service-savebar/);
 assert.match(s,/Bu işi tekrar aç/);
 assert.doesNotMatch(s,/name="scheduledDate"[^>]*defaultValue=\{prefill/,'tekrar açılan işte tarih boş kalmalı');
 const css=await readFile('app/servis/service.css','utf8');
 assert.match(css,/\.service-list\{position:static;max-height:none;overflow:visible\}/);
});
