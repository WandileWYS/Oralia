import { createHash } from 'node:crypto';
import { createClient, type Client } from '@libsql/client';

async function tableNames(client: Client) {
  return (await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"))
    .rows.map(row => String(row.name));
}
async function fingerprint(client: Client, tables: string[]) {
  const schema = [];
  for (const table of tables) {
    if (!/^[A-Za-z_]+$/.test(table)) throw new Error('Unexpected schema identifier.');
    const columns = (await client.execute(`PRAGMA table_info("${table}")`)).rows;
    const foreignKeys = (await client.execute(`PRAGMA foreign_key_list("${table}")`)).rows;
    const indexes = (await client.execute(`PRAGMA index_list("${table}")`)).rows;
    const indexDefinitions = [];
    for (const index of indexes.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
      const name = String(index.name);
      if (!/^[A-Za-z_0-9]+$/.test(name)) throw new Error('Unexpected index identifier.');
      indexDefinitions.push({ name, unique: index.unique, columns: (await client.execute(`PRAGMA index_info("${name}")`)).rows.map(({cid: _ordinal,...column})=>column) });
    }
    schema.push({ table, columns:columns.map(({cid: _ordinal,...column})=>column).sort((a,b)=>String(a.name).localeCompare(String(b.name))), foreignKeys, indexes: indexDefinitions });
  }
  return JSON.stringify(schema);
}
export { fingerprint as schemaFingerprint, tableNames as schemaTables };

export async function deployCloudSchema(client: Client, sql: string) {
  const expected = createClient({ url: 'file::memory:' });
  const checksum = createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
  try {
    await expected.executeMultiple(sql);
    const tables = await tableNames(expected);
    const current = await tableNames(client);
    const empty = current.filter(name => name !== '_prisma_migrations' && name !== '_oralia_schema').length === 0;
    if (!empty && (!tables.every(name => current.includes(name)) || await fingerprint(client, tables) !== await fingerprint(expected, tables))) {
      throw new Error('Remote schema is incompatible. No schema or data changes were applied.');
    }
    // A matching, untracked schema can be adopted, but a changed recorded schema cannot.
    if (current.includes('_oralia_schema')) {
      const records = (await client.execute('SELECT checksum FROM _oralia_schema')).rows;
      if (records.some(row => row.checksum !== checksum)) throw new Error('Schema checksum changed. Supply a reviewed migration instead of reinitializing.');
    }
    const statements = empty ? sql.split(';').map(statement => statement.trim()).filter(Boolean) : [];
    await client.batch([
      ...statements,
      'CREATE TABLE IF NOT EXISTS "_oralia_schema" ("checksum" TEXT PRIMARY KEY NOT NULL, "appliedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)',
      { sql: 'INSERT OR IGNORE INTO _oralia_schema(checksum) VALUES (?)', args: [checksum] },
    ], 'write');
    if (await fingerprint(client, tables) !== await fingerprint(expected, tables)) throw new Error('Schema verification failed.');
    return { initialized: empty, checksum };
  } finally { expected.close(); }
}
