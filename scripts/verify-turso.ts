import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { resolveDatabaseConfig } from '../server/environment.ts';
import { db } from '../server/db.ts';
import { catalogSchema } from '../src/types/api.ts';
import { readCatalog } from '../server/catalog.ts';
import { storyCollectionSchema } from '../src/types/story.ts';

assert.ok(resolveDatabaseConfig(process.env).url.startsWith('libsql://'), 'Cloud verification requires a Turso runtime configuration.');
try {
  const seeds = z.array(z.object({ id: z.string(), collection: storyCollectionSchema })).parse(JSON.parse(await readFile('prisma/content/stories.json', 'utf8')));
  const stories = await db.story.findMany({ where: { id: { in: seeds.map(seed => seed.id) } }, include: { author: true, scenes: { orderBy: { sceneNumber: 'asc' } } } });
  assert.equal(stories.length, 8);
  for (const seed of seeds) {
    const story = stories.find(story => story.id === seed.id)!;
    assert.equal(story.collection, seed.collection);
    assert.ok(story.author);
    assert.equal(story.scenes.length, 4);
    story.scenes.forEach((scene, i) => {
      assert.equal(scene.sceneNumber, i + 1);
      assert.ok(Number.isFinite(scene.timestamp) && scene.timestamp >= 0 && scene.timestamp < story.duration);
      assert.ok(i === 0 ? scene.timestamp === 0 : scene.timestamp > story.scenes[i - 1].timestamp);
    });
  }
  const catalog = catalogSchema.parse(await readCatalog());
  for (const seed of seeds) assert.ok(catalog.stories.some(story => story.id === seed.id));
  console.log(JSON.stringify({ verifiedSeedStories: stories.length, seedScenes: stories.reduce((sum, story) => sum + story.scenes.length, 0), folk: stories.filter(story => story.collection === 'FOLK_AND_FABLE').length, epic: stories.filter(story => story.collection === 'EPIC_AND_CHRONICLE').length, totalStories: catalog.stories.length, totalProfiles: catalog.creators.length }));
} finally { await db.$disconnect(); }
