import { db } from './db.ts';
import { storyCollectionSchema, storySchema } from '../src/types/story.ts';
import { creatorProfileSchema } from '../src/types/creator.ts';
import { collectionStyles } from '../src/data/presentation.ts';
import { resolveStorySourceUrl } from '../src/lib/sourceLinks.ts';

export async function readCatalog(collection?: import('../src/types/story.ts').StoryCollection) {
  const rows = await db.story.findMany({ where: collection ? { collection } : undefined, include: { author: true, scenes: { orderBy: { sceneNumber: 'asc' } } }, orderBy: { publishedAt: 'desc' } });
  const stories = rows.map(row => {
    const storyCollection = storyCollectionSchema.parse(row.collection);
    return storySchema.parse({
      id: row.id, title: row.title, description: row.description, creator: row.author.name, creatorId: row.authorId,
      publishedAt: row.publishedAt.toISOString(), featured: row.featured, category: row.regionTag === 'west-africa' ? 'West African Folklore' : row.regionTag === 'zulu' ? 'Zulu Narratives' : row.regionTag === 'east-africa' ? 'East African Fables' : 'Southern African Tales',
      region: row.regionTag, regionTag: row.regionTag, voiceType: row.voiceType, originalAudioUrl: row.originalAudioUrl,
      sourceTitle: row.sourceTitle, sourceUrl: resolveStorySourceUrl(row.sourceUrl), culturalNote: row.culturalNote,
      audio: { id: row.id, url: row.audioUrl, durationSeconds: row.duration, mimeType: 'audio/wav', language: 'en', dialect: null },
      collection: storyCollection, presentation: { stylePreset: storyCollection, styleLabel: collectionStyles[storyCollection].theme, reviewStatus: 'approved', keyframes: row.scenes.map((scene, i) => ({ id: scene.id, title: scene.title, startTime: scene.timestamp, endTime: row.scenes[i + 1]?.timestamp ?? row.duration, caption: scene.narrationText, imageUrl: scene.imageUrl, thumbnailUrl: scene.imageUrl.replace('w=1920', 'w=480'), imageMimeType: 'image/jpeg', altText: `${scene.title}: editorial landscape photograph by ${scene.imageCredit}.`, imageCredit: { photographer: scene.imageCredit, sourceUrl: scene.imageSourceUrl } })) },
    });
  });
  const authors = await db.user.findMany({ where: { role: 'CREATOR' }, orderBy: { name: 'asc' } });
  const creators = authors.map((user, i) => creatorProfileSchema.parse({ id: user.id, name: user.name, username: user.username, bio: user.bio, avatarUrl: user.avatarUrl, initials: user.name.split(' ').slice(0, 2).map(s => s[0]).join(''), avatarTone: ['bloom', 'sage', 'gold'][i % 3] }));
  return { stories, creators };
}
