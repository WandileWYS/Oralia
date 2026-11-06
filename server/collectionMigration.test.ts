import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

test('collection migration preserves identities, bookmarks, scenes and unknown legacy stories', async () => {
  await mkdir('.qa', { recursive: true });
  const file = `.qa/collection-migration-${randomUUID()}.db`;
  const client = createClient({ url: `file:./${file}` });
  try {
    await client.executeMultiple(await readFile('prisma/migrations/20261105000000_init/migration.sql', 'utf8'));
    const oldColumns = (await client.execute('PRAGMA table_info(Story)')).rows;
    const oldCategoryColumn = String(oldColumns[oldColumns.findIndex(column => column.name === 'description') + 1].name);
    const migration = await readFile('prisma/migrations/20261106000000_thematic_collections/migration.sql', 'utf8');
    const legacyValues = migration.match(new RegExp(`"${oldCategoryColumn}" IN \\('([^']+)','([^']+)'\\)`));
    assert.ok(legacyValues);
    await client.execute("INSERT INTO User(id,name,username,email,avatarUrl,bio) VALUES ('u','Author','author','author@example.test','/favicon.svg','Bio')");
    const seeds = JSON.parse(await readFile('prisma/content/stories.json', 'utf8')) as { id: string; collection: string }[];
    const records = [...seeds, { id: 'legacy-younger', collection: 'FOLK_AND_FABLE' }, { id: 'legacy-older', collection: 'EPIC_AND_CHRONICLE' }];
    for (const record of records) {
      // Values here are extracted from immutable historical SQL, not active application categories.
      const younger = legacyValues[1];
      await client.execute({ sql: `INSERT INTO Story(id,title,description,"${oldCategoryColumn}",regionTag,audioUrl,duration,authorId,sourceTitle,sourceUrl,culturalNote) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, args: [record.id,'Story','Description',record.id === 'legacy-older' ? 'legacy-other' : younger,'west-africa','/audio.wav',10,'u','Source','https://example.test/source','Note'] });
      await client.execute({ sql: 'INSERT INTO KeyframeScene(id,storyId,sceneNumber,title,narrationText,imageUrl,timestamp,imageCredit,imageSourceUrl) VALUES (?,?,1,?,?,?,?,?,?)', args: [record.id+'-scene',record.id,'Scene','Narration','https://example.test/image',0,'Artist','https://example.test/photo'] });
    }
    await client.execute("INSERT INTO Bookmark(id,userId,storyId) VALUES ('b','u','goso-the-teacher')");
    await client.execute("INSERT INTO Session(id,userId,expiresAt) VALUES ('hashed-token','u','2030-01-01')");
    await client.executeMultiple(await readFile('prisma/migrations/20261106000000_thematic_collections/migration.sql', 'utf8'));
    const rows = (await client.execute('SELECT id,collection FROM Story')).rows;
    for (const record of records) assert.equal(rows.find(row => row.id === record.id)?.collection, record.collection);
    assert.equal((await client.execute('SELECT * FROM Bookmark')).rows[0].storyId, 'goso-the-teacher');
    assert.equal((await client.execute('SELECT * FROM Session')).rows[0].id, 'hashed-token');
    assert.equal((await client.execute('SELECT * FROM KeyframeScene')).rows.length, records.length);
    assert.equal((await client.execute('PRAGMA foreign_key_check')).rows.length, 0);
    assert.equal((await client.execute('PRAGMA table_info(Story)')).rows.some(row => row.name === oldCategoryColumn), false);
  } finally { client.close(); await unlink(file).catch(() => undefined); }
});
