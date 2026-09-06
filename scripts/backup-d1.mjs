import {spawnSync} from 'node:child_process';
import {mkdir,chmod,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
// Explicit database name required. Export does not restore or modify production.
const name=process.argv[2];if(!name||!/^[a-zA-Z0-9_-]+$/.test(name))throw new Error('Usage: node scripts/backup-d1.mjs DATABASE_NAME');
const dir=resolve('.private-backups',new Date().toISOString().replace(/[:.]/g,'-'));
await mkdir(dir,{recursive:true,mode:0o700});const output=resolve(dir,'database.sql');
const r=spawnSync('npx',['--no-install','wrangler','d1','export',name,'--remote','--output',output],{stdio:'inherit'});
if(r.status!==0)process.exit(r.status??1);
await chmod(output,0o600);await writeFile(resolve(dir,'manifest.json'),JSON.stringify({database:name,createdAt:new Date().toISOString(),restoreTested:false,r2Included:false},null,2),{mode:0o600});
console.log('Database export saved. Run an isolated restore drill; copy R2 objects separately.');
