import { db } from './db.ts';
import { storyCollectionSchema, storySchema } from '../src/types/story.ts';
import { creatorProfileSchema } from '../src/types/creator.ts';
import { collectionStyles } from '../src/data/presentation.ts';
import { resolveStorySourceUrl } from '../src/lib/sourceLinks.ts';

export async function readCatalog(collection?: import('../src/types/story.ts').StoryCollection, language?: string) {
  const rows = await db.story.findMany({ where: { ...(collection ? { collection } : {}), ...(language ? { language } : {}) }, include: { author: true, scenes: { orderBy: { sceneNumber: 'asc' } } }, orderBy: { publishedAt: 'desc' } });
  const stories = rows.map(row => {
    const storyCollection = storyCollectionSchema.parse(row.collection);
    const generated = row.provenance === 'CREATOR_GENERATED';
    return storySchema.parse({
      id: row.id, title: row.title, description: row.description, creator: row.author.name, creatorId: row.authorId,
      publishedAt: row.publishedAt.toISOString(), featured: row.featured, category: row.regionTag === 'originals' ? 'Original Narrative' : row.regionTag === 'west-africa' ? 'West African Folklore' : row.regionTag === 'zulu' ? 'Zulu Narratives' : row.regionTag === 'east-africa' ? 'East African Fables' : 'Southern African Tales',
      region: row.regionTag, regionTag: row.regionTag, voiceType: row.voiceType, originalAudioUrl: row.originalAudioUrl,
      sourceTitle: row.sourceTitle, sourceUrl: row.sourceUrl ? resolveStorySourceUrl(row.sourceUrl) : undefined, culturalNote: row.culturalNote,
      audio: { id: row.id, url: row.audioUrl, durationSeconds: row.duration, mimeType: 'audio/wav', language: row.language, dialect: null },
      collection: storyCollection, presentation: { stylePreset: storyCollection, styleLabel: collectionStyles[storyCollection].theme, reviewStatus: 'approved', keyframes: row.scenes.map((scene, i) => ({ id: scene.id, title: scene.title, startTime: scene.timestamp, endTime: row.scenes[i + 1]?.timestamp ?? row.duration, caption: scene.narrationText, imageUrl: scene.imageUrl, thumbnailUrl: generated ? scene.imageUrl.replace('/image/upload/','/image/upload/c_fill,w_480/') : scene.imageUrl.replace('w=1920', 'w=480'), imageMimeType: generated ? 'image/png' : 'image/jpeg', altText: generated ? `${scene.title}: AI-generated story illustration.` : `${scene.title}: editorial landscape photograph by ${scene.imageCredit}.`, imageCredit: generated ? undefined : { photographer: scene.imageCredit, sourceUrl: scene.imageSourceUrl } })) },
    });
  });
  const authors = await db.user.findMany({ where: { role: 'CREATOR' }, orderBy: { name: 'asc' } });
  const creators = authors.map((user, i) => creatorProfileSchema.parse({ id: user.id, name: user.name, username: user.username, bio: user.bio, avatarUrl: user.avatarUrl, initials: user.name.split(' ').slice(0, 2).map(s => s[0]).join(''), avatarTone: ['bloom', 'sage', 'gold'][i % 3] }));
  return { stories, creators };
}
