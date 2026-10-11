import test from 'node:test';
import assert from 'node:assert/strict';
import { runLimited } from '../lib/request-pool.ts';
await test('Ekran açılışında sunucuya aynı anda en fazla dört liste isteği gider',async()=>{
 let running=0,max=0,completed=0;
 await runLimited(Array.from({length:13},(_,i)=>i),async()=>{running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,2));running--;completed++;});
 assert.equal(completed,13);assert.equal(max,4);
});
await test('Firma değişimi iptalinden sonra bekleyen liste istekleri başlamaz',async()=>{
 const controller=new AbortController();let started=0;
 await runLimited([1,2,3,4,5,6],async()=>{started++;controller.abort();},4,controller.signal);
 assert.equal(started,1);
});
