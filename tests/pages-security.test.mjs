import test from 'node:test';
import assert from 'node:assert/strict';
import {secure,addNonce,contentSecurityPolicy} from '../scripts/pages-security.mjs';

test('HTML yanıtında her betik aynı nonce ile işaretlenir; CSP unsafe-inline betiğe izin vermez',async()=>{
  const html='<html><head><script src="/a.js" type="module"></script><script>self.__x=1</script><script nonce="eski">y()</script></head><body></body></html>';
  const r=await secure(new Response(html,{headers:{'content-type':'text/html; charset=utf-8'}}),'/');
  const csp=r.headers.get('content-security-policy');const nonce=csp.match(/'nonce-([^']+)'/)[1];
  const body=await r.text();
  assert.equal((body.match(new RegExp(`nonce="${nonce.replace(/[+/=]/g,'\\$&')}"`,'g'))||[]).length,2,'nonce eklenen betikler');
  assert.match(body,/nonce="eski"/,'mevcut nonce korunur');
  assert.match(csp,/script-src 'self' 'nonce-/);assert.doesNotMatch(csp.split('script-src')[1].split(';')[0],/unsafe-inline/);
  assert.equal(r.headers.get('cache-control'),'no-store, no-cache, must-revalidate');
});
test('her yanıtta farklı nonce üretilir',async()=>{
  const n=async()=>(await secure(new Response('<script></script>',{headers:{'content-type':'text/html'}}),'/')).headers.get('content-security-policy');
  assert.notEqual(await n(),await n());
});
test('API ve varlık yanıtlarında gövde değişmez, güvenlik başlıkları eklenir',async()=>{
  const r=await secure(Response.json({ok:true}),'/api/health');
  assert.deepEqual(await r.json(),{ok:true});
  for(const h of ['x-frame-options','strict-transport-security','cross-origin-resource-policy','x-permitted-cross-domain-policies'])assert.ok(r.headers.get(h),h);
  assert.equal(r.headers.get('cache-control'),'private, no-store');
  assert.equal(contentSecurityPolicy(null).includes("'unsafe-inline'; script-src 'self';"),true);
});
test('addNonce saldırganın nonce taklidini yeni etikete taşımaz',()=>{
  assert.equal(addNonce('<script data-x="1">',"N"),'<script nonce="N" data-x="1">');
});
