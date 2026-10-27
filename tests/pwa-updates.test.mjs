import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

const {outputFiles} = await build({entryPoints:['lib/pwa-updates.ts'],bundle:true,platform:'node',format:'cjs',write:false});
function events(extra = {}) {
  const listeners = new Map();
  return Object.assign({listeners,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type,new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    emit(type) { for (const callback of listeners.get(type) ?? []) callback(); },
  },extra);
}
async function harness({controlled=true, waiting=true, pending=false, secure=true, reject=false} = {}) {
  const messages=[], notices=[], intervals=new Map(); let reloads=0, updates=0, resolveRegistration;
  const worker={postMessage:message=>messages.push(message)};
  const registration=events({waiting:waiting?worker:null,installing:null,update:async()=>{updates++;}});
  const serviceWorker=events({controller:controlled?{}:null,
    register:()=>reject?Promise.reject(new Error('synthetic unavailable')):pending?new Promise(resolve=>{resolveRegistration=resolve;}):Promise.resolve(registration)});
  const document=events({visibilityState:'visible'});
  const module={exports:{}};
  vm.runInNewContext(outputFiles[0].text,{module,exports:module.exports, navigator:{serviceWorker},document,
    window:{isSecureContext:secure,location:{reload:()=>{reloads++;}}},
    setInterval:callback=>{intervals.set(1,callback);return 1;},clearInterval:id=>intervals.delete(id)});
  const watcher=module.exports.watchServiceWorkerUpdates(worker=>notices.push(worker));
  await new Promise(setImmediate);
  return {worker,registration,serviceWorker,document,watcher,messages,notices,intervals,
    finishRegistration:()=>resolveRegistration(registration),reloads:()=>reloads,updates:()=>updates};
}

test('waiting update is offered without reloading an open form',async()=>{
  const h=await harness(); assert.equal(h.notices.length,1);
  h.serviceWorker.emit('controllerchange'); assert.equal(h.reloads(),0);
  h.watcher.dispose();
});
test('only explicit acceptance sends activation and reloads exactly once',async()=>{
  const h=await harness(); assert.equal(h.watcher.apply({}),false);
  assert.equal(h.watcher.apply(h.worker),true); assert.equal(h.messages[0].type,'SKIP_WAITING');
  h.serviceWorker.emit('controllerchange'); h.serviceWorker.emit('controllerchange');
  assert.equal(h.reloads(),1); h.watcher.dispose();
});
test('first installation does not prompt or reload',async()=>{
  const h=await harness({controlled:false}); assert.equal(h.notices.length,0);
  h.serviceWorker.controller={}; h.serviceWorker.emit('controllerchange');
  assert.equal(h.reloads(),0); h.watcher.dispose();
});
test('later installation is offered; timers and listeners are removed on disposal',async()=>{
  const h=await harness({waiting:false}); const installing=events({state:'installing'});
  h.registration.installing=installing; h.registration.emit('updatefound');
  h.registration.waiting=h.worker; installing.state='installed'; installing.emit('statechange');
  assert.equal(h.notices.length,1);
  h.document.visibilityState='hidden'; h.document.emit('visibilitychange'); assert.equal(h.updates(),0);
  h.document.visibilityState='visible'; h.document.emit('visibilitychange'); assert.equal(h.updates(),1);
  h.intervals.get(1)(); assert.equal(h.updates(),2);
  h.watcher.dispose(); assert.equal(h.intervals.size,0);
  assert.equal(installing.listeners.get('statechange').size,0);
  assert.equal(h.registration.listeners.get('updatefound').size,0);
  h.document.emit('visibilitychange'); assert.equal(h.updates(),2);
  assert.equal(h.watcher.apply(h.worker),false);
});
test('registration resolving after disposal cannot show a banner or start a timer',async()=>{
  const h=await harness({pending:true}); h.watcher.dispose(); h.finishRegistration();
  await new Promise(setImmediate); assert.equal(h.notices.length,0); assert.equal(h.intervals.size,0);
});
test('unsupported secure context and rejected registration leave no prompt',async()=>{
  for(const options of [{secure:false},{reject:true}]) {
    const h=await harness(options); assert.equal(h.notices.length,0); assert.equal(h.intervals.size,0); h.watcher.dispose();
  }
});
