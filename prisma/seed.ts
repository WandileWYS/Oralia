import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '../server/db.ts';
import { ageTierSchema } from '../src/types/story.ts';

const seedSchema = z.object({ id: z.string(), title: z.string(), description: z.string(), ageTier: ageTierSchema, regionTag: z.string(), authorId: z.string(), sourceTitle: z.string(), sourceUrl: z.string().url(), culturalNote: z.string(), scenes: z.array(z.object({ title: z.string(), text: z.string() })).length(4) });
const narrationSchema = z.object({ id: z.string(), durationSeconds: z.number().positive(), cues: z.array(z.object({ title: z.string(), caption: z.string(), startTime: z.number().nonnegative(), endTime: z.number().positive() })).length(4) });
const seeds = seedSchema.array().parse(JSON.parse(await readFile(new URL('./content/stories.json', import.meta.url), 'utf8')));
const tracks = narrationSchema.array().parse(JSON.parse(await readFile(new URL('./content/narration.json', import.meta.url), 'utf8')));
const photos = [
  ['1547471080-7cc2caa01a7e', 'Damian Patkowski', 'https://unsplash.com/photos/T-LfvX-7IVg'],
  ['1766409874040-d4b233e92089', 'Omar', 'https://unsplash.com/photos/63Hbr_LAHg8'],
  ['1760199078412-73d0a72b0a55', 'Darya Luganskaya', 'https://unsplash.com/photos/nY4WH1s72SA'],
  ['1619203921846-ba381b842a89', 'Leon Pauleikhoff', 'https://unsplash.com/photos/gV8r3I9lvM4'],
];
const authors = [
  ['akan-collection', 'Akan Story Collection', 'akan_stories', 'English adaptations of Fante and Akan tales collected by Barker and Sinclair in 1917. An editorial collection, not a contemporary storyteller identity.'],
  ['southern-collection', 'Southern African Story Collection', 'southern_stories', 'Animal tales from James A. Honey’s 1910 collection. Regional attributions follow the source rather than assuming every southern African tale is Zulu.'],
  ['zulu-collection', 'Zulu Narrative Collection', 'zulu_narratives', 'Attributed English adaptations of recorded Zulu narratives. Historical translations are identified and should not be treated as a single definitive account of living traditions.'],
  ['swahili-collection', 'Zanzibar Story Collection', 'zanzibar_stories', 'English adaptations from Edward Steere’s 1870 Swahili Tales, collected in Zanzibar. These stories belong to a varied Indian Ocean storytelling context.'],
];
try {
  await db.$transaction(async tx => {
    for (const [id, name, username, bio] of authors) {
      const data = { name, username, email: `${username}@collections.oralia.invalid`, bio, role: 'CREATOR' as const, avatarUrl: '/favicon.svg' };
      await tx.user.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
    for (const [index, seed] of seeds.entries()) {
      const track = tracks.find(item => item.id === seed.id);
      if (!track || track.cues.some((cue, i) => cue.caption !== seed.scenes[i].text || cue.startTime !== (i ? track.cues[i - 1].endTime : 0)) || track.cues[3].endTime !== track.durationSeconds) throw new Error(`Narration mismatch: ${seed.id}`);
      const { scenes, ...record } = seed;
      const data = { ...record, audioUrl: `/media/${seed.id}.wav`, duration: track.durationSeconds, voiceType: 'STUDIO_AI' as const, featured: index === 2, publishedAt: new Date(`2026-11-${String(5 - Math.floor(index / 2)).padStart(2, '0')}T10:00:00Z`) };
      await tx.story.upsert({ where: { id: seed.id }, create: data, update: data });
      for (const [i, scene] of scenes.entries()) {
        const photo = photos[(i + index) % photos.length];
        const fields = { storyId: seed.id, sceneNumber: i + 1, title: scene.title, narrationText: scene.text, timestamp: track.cues[i].startTime, imageUrl: `https://images.unsplash.com/photo-${photo[0]}?fm=jpg&fit=crop&w=1920&q=85`, imageCredit: photo[1], imageSourceUrl: photo[2] };
        await tx.keyframeScene.upsert({ where: { storyId_sceneNumber: { storyId: seed.id, sceneNumber: i + 1 } }, create: { id: `${seed.id}-${i + 1}`, ...fields }, update: fields });
      }
    }
  }, { timeout: 30000 });
  console.log(`Seeded ${seeds.length} sourced tales, ${seeds.length * 4} scenes, and ${authors.length} editorial profiles. Existing user accounts/bookmarks preserved.`);
} finally { await db.$disconnect(); }
