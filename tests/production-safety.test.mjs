import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

test('production deploy depends on reusable security workflow',()=>{
 const deploy=readFileSync('.github/workflows/cloudflare-pages.yml','utf8');
 const security=readFileSync('.github/workflows/security.yml','utf8');
 assert.match(deploy,/needs: security-gate/);
 assert.match(deploy,/uses: \.\/\.github\/workflows\/security.yml/);
 assert.match(security,/workflow_call:/);
});
test('isolated restore rejects an empty SQL backup',()=>{
 const result=spawnSync('python3',['scripts/verify-sql-backup.py','/dev/null'],{encoding:'utf8'});
 assert.equal(result.status,1);
 assert.match(result.stderr,/missing required application tables/);
});
