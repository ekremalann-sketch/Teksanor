// Ortak davranış testi altyapısı: gerçek rota kodu esbuild ile paketlenir,
// bellek içi node:sqlite üzerinde D1 benzeri arayüzle çalışır. Yalnız sentetik veri.
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';

export async function createHarness(name, modules, options={}){
  const sql=new DatabaseSync(options.file??':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const statement=(query,values=[])=>({query,values,bind(...v){return statement(query,v)},async first(){return sql.prepare(query).get(...values)??null},async all(){return {results:sql.prepare(query).all(...values)}},async run(){const r=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(r.changes)}}}});
  const db={prepare:statement,async exec(q){sql.exec(q)},async batch(list){sql.exec('BEGIN');try{const out=list.map(s=>{const st=sql.prepare(s.query);return st.columns().length?{results:st.all(...s.values),success:true}:{success:true,meta:{changes:Number(st.run(...s.values).changes)}}});sql.exec('COMMIT');return out}catch(e){sql.exec('ROLLBACK');throw e}}};
  globalThis.__teksanorTestEnv={DB:db,UPLOADS:{head:async()=>null}};
  await mkdir('tests/.tmp',{recursive:true});
  const contents=Object.entries({auth:'./lib/auth.ts',database:'./lib/db.ts',...modules}).map(([k,p])=>`export * as ${k} from '${p}';`).join('\n');
  const outfile=`tests/.tmp/${name}.mjs`;
  await build({stdin:{contents,resolveDir:process.cwd()},outfile,bundle:true,platform:'node',format:'esm',logLevel:'silent',define:{__TEKSANOR_COMMIT__:'"test-sha"'},plugins:[{name:'runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'runtime',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env=globalThis.__teksanorTestEnv'}));b.onResolve({filter:/^next\/server$/},()=>({path:'response',namespace:'response'}));b.onLoad({filter:/.*/,namespace:'response'},()=>({contents:'export class NextResponse extends Response {static json(data,init){return Response.json(data,init)}}'}));}}]});
  const api=await import('../../'+outfile+'?'+Date.now());
  await api.database.ensureSchema();
  const tokens={};
  async function user(id,org,memberRole,profile){
    if(!sql.prepare('SELECT id FROM users WHERE id=?').get(id)){const p=await api.auth.hashPassword('Test-password-123!');sql.prepare('INSERT INTO users(id,username,email,full_name,password_hash,password_salt,role) VALUES(?,?,?,?,?,?,?)').run(id,id,id+'@example.test',id,p.hash,p.salt,'user');tokens[id]=await api.auth.createSession(id);}
    if(!sql.prepare('SELECT id FROM organizations WHERE id=?').get(org))sql.prepare('INSERT INTO organizations(id,name,slug) VALUES(?,?,?)').run(org,'Firma '+org,'firma-'+org);
    sql.prepare('INSERT OR REPLACE INTO organization_members(organization_id,user_id,role) VALUES(?,?,?)').run(org,id,memberRole);
    sql.prepare('INSERT OR REPLACE INTO organization_member_access(organization_id,user_id,access_profile) VALUES(?,?,?)').run(org,id,profile);
  }
  const req=(u,path,method='GET',body,org)=>new Request('https://test.local'+path,{method,headers:{Cookie:'teksanor_session='+tokens[u],...(org?{'X-Organization-Id':org}:{}),'Content-Type':'application/json',Origin:'https://test.local'},body:body===undefined?undefined:JSON.stringify(body)});
  const ctx=(id)=>({params:Promise.resolve({id})});
  return {sql,api,user,req,ctx,tokens};
}
