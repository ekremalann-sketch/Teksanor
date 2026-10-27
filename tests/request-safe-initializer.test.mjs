import test from 'node:test';
import assert from 'node:assert/strict';
import {requestSafeInitializer} from '../lib/request-safe-initializer.ts';

test('an abandoned first request cannot stall the next login readiness check', async () => {
  let calls = 0, releaseFirst;
  const initialize = requestSafeInitializer(async () => {
    if (++calls === 1) await new Promise(resolve => { releaseFirst = resolve; });
  });
  const database = {};
  const abandoned = initialize(database);
  const result = await Promise.race([
    initialize(database).then(() => 'ready'),
    new Promise(resolve => setTimeout(() => resolve('stalled'), 100)),
  ]);
  releaseFirst();
  await abandoned;
  assert.equal(result, 'ready');
  assert.equal(calls, 2);
  await initialize(database);
  assert.equal(calls, 2, 'only completed initialization is cached');
});

test('a failed initialization is retried on the next request', async () => {
  let calls = 0;
  const initialize = requestSafeInitializer(async () => {
    if (++calls === 1) throw new Error('request canceled');
  });
  const database = {};
  await assert.rejects(initialize(database), /request canceled/);
  await initialize(database);
  await initialize(database);
  assert.equal(calls, 2);
});

test('successful initialization of one database does not skip a different binding', async () => {
  const seen = [];
  const initialize = requestSafeInitializer(async db => { seen.push(db); });
  const first = {}, second = {};
  await initialize(first);
  await initialize(first);
  await initialize(second);
  assert.deepEqual(seen, [first, second]);
});
