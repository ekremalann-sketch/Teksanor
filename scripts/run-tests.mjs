import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=(await readdir(new URL('../tests/',import.meta.url))).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);
if(!files.length)throw new Error('No test files found. Refusing to pass an empty test suite.');
const r=spawnSync(process.execPath,['--experimental-strip-types','--test',...files],{stdio:'inherit'});
process.exit(r.status??1);
