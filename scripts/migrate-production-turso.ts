import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolveDatabaseConfig } from '../server/environment.ts';
import { deployCloudSchema, schemaFingerprint, schemaTables } from '../server/cloudSchema.ts';

const config=resolveDatabaseConfig({...process.env,DATABASE_URL:undefined});
if(!config.url.startsWith('libsql://'))throw new Error('Cloud credentials are required.');
const cloud=createClient(config);const baseline=createClient({url:'file::memory:'});
const id='20261109120000_localized_multipart';
const sql=await readFile(`prisma/migrations/${id}/migration.sql`,'utf8');
const checksum=createHash('sha256').update(sql.replace(/\r\n/g,'\n')).digest('hex');
const expected=execFileSync(process.execPath,['node_modules/prisma/build/index.js','migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
const schemaChecksum=createHash('sha256').update(expected.replace(/\r\n/g,'\n')).digest('hex');
try{
  const tables=await schemaTables(cloud);
  if(tables.includes('_oralia_migrations')){
    const existing=(await cloud.execute({sql:'SELECT checksum FROM _oralia_migrations WHERE id=?',args:[id]})).rows[0];
    if(existing){if(existing.checksum!==checksum)throw new Error('Migration checksum changed.');await deployCloudSchema(cloud,expected);console.log('Localized multipart migration already applied and verified.');process.exitCode=0;}
    else await apply();
  }else await apply();
}catch{console.error('Localized multipart migration stopped. Verify the baseline schema and connection; no reset is attempted.');process.exitCode=1;}
finally{cloud.close();baseline.close();}

async function apply(){
  for(const name of ['20261105000000_init','20261106000000_thematic_collections','20261107000000_production_pipeline','20261109000000_dynamic_scenes'])await baseline.executeMultiple(await readFile(`prisma/migrations/${name}/migration.sql`,'utf8'));
  const baselineTables=await schemaTables(baseline);
  if(await schemaFingerprint(cloud,baselineTables)!==await schemaFingerprint(baseline,baselineTables))throw new Error('Unexpected cloud schema.');
  const tx=await cloud.transaction('read');const backup:Record<string,unknown>={};
  try{
    for(const table of await schemaTables(tx as unknown as Parameters<typeof schemaTables>[0])){
      if(!/^[A-Za-z_0-9]+$/.test(table))throw new Error('Unexpected table identifier.');
      backup[table]=(await tx.execute(`SELECT * FROM "${table}"`)).rows;
    }
    backup.schema=(await tx.execute("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL")).rows;await tx.commit();
  }finally{tx.close();}
  await mkdir('.qa',{recursive:true});const backupPath=`.qa/turso-before-production-${Date.now()}.json`;
  await writeFile(backupPath,JSON.stringify(backup,(_key,value)=>typeof value==='bigint'?String(value):value));
  const statements=sql.replace(/^--.*$/gm,'').split(';').map(value=>value.trim()).filter(Boolean);
  await cloud.batch([
    ...statements,
    'CREATE TABLE IF NOT EXISTS _oralia_migrations(id TEXT PRIMARY KEY NOT NULL,checksum TEXT NOT NULL,appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    {sql:'INSERT INTO _oralia_migrations(id,checksum) VALUES (?,?)',args:[id,checksum]},
    'DELETE FROM _oralia_schema',
    {sql:'INSERT INTO _oralia_schema(checksum) VALUES (?)',args:[schemaChecksum]},
  ],'write');
  await deployCloudSchema(cloud,expected);
  console.log(JSON.stringify({migration:id,backup:backupPath,verified:true}));
}
