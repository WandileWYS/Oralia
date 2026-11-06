import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { ageTierSchema, type Story, type StoryVariant } from '../types/story.ts';
import { creatorHref, getCreatorStories, getPlayableStories, parsePublicView, storyHref } from './catalog.ts';
import { creatorEmailSchema } from '../types/creator.ts';
import { resolveStorySourceUrl } from './sourceLinks.ts';

test('legacy chapter links resolve to verified anchors while other attribution stays unchanged', () => {
  const collection = 'https://www.gutenberg.org/files/66923/66923-h/66923-h.htm';
  assert.equal(resolveStorySourceUrl(`${collection}#ch01`), `${collection}#ch1`);
  assert.equal(resolveStorySourceUrl(`${collection}#ch02`), `${collection}#ch2`);
  for (const url of [`${collection}#ch1`, `${collection}#ch20`, 'https://example.test/other-source#ch01']) assert.equal(resolveStorySourceUrl(url), url);
});

const variant: StoryVariant = { ageTier: '5-9', stylePreset: 'fairytale', styleLabel: 'Fairytale', contentRating: 'gentle', reviewStatus: 'approved', keyframes: [{ id: 'one', title: 'Scene one', startTime: 0, endTime: 5, imageUrl: '/image.svg', altText: 'A tree.', caption: 'A story.' }] };
const story: Story = { id: 'one', title: 'Story one', description: '', creator: 'Same name', creatorId: 'creator-one', category: 'Fiction', publishedAt: '2026-11-05T10:00:00Z', audio: { id: 'audio', url: '/audio.wav', mimeType: 'audio/wav', durationSeconds: 5, language: 'en', dialect: null }, tierVariants: { '5-9': variant } };

test('catalog and public profile use exact approved age variants and explicit creator identity', () => {
  const pending = { ...story, id: 'pending', tierVariants: { '5-9': { ...variant, reviewStatus: 'pending' as const } } };
  const other = { ...story, id: 'other', creatorId: 'creator-two' };
  const draft = { ...story, id: 'draft', publishedAt: undefined };
  const empty = { ...story, id: 'empty', tierVariants: { '5-9': { ...variant, keyframes: [] } } };
  assert.equal(getPlayableStories([story, pending, empty], '5-9').length, 1);
  assert.deepEqual(getPlayableStories([story], '18+'), []);
  assert.deepEqual(getCreatorStories([story, other, pending, draft], 'creator-one', '5-9').map(entry => entry.story.id), ['one']);
  assert.deepEqual(getCreatorStories([story], 'unknown', '5-9'), []);
});

test('public story/profile URLs round-trip and malformed links fail safely', () => {
  assert.deepEqual(parsePublicView(storyHref('a story')), { kind: 'story', key: 'a story' });
  assert.deepEqual(parsePublicView(creatorHref('mirasol')), { kind: 'creator', key: 'mirasol' });
  for (const value of ['#main', '#stories/', '#stories/%E0%A4', '#unknown/name', '#creators/a/b']) assert.equal(parsePublicView(value), null);
});

test('creator email is normalized and validated before requesting a challenge', () => {
  assert.equal(creatorEmailSchema.parse('  Mira@Example.test  '), 'mira@example.test');
  assert.equal(creatorEmailSchema.safeParse('not an email').success, false);
  assert.equal(creatorEmailSchema.safeParse('').success, false);
});

test('every added story has distinct PCM narration and four measured captions matching its source text', () => {
  const seeds = z.array(z.object({ id: z.string(), ageTier: ageTierSchema, scenes: z.array(z.object({ title: z.string(), text: z.string() })).length(4) })).parse(JSON.parse(readFileSync(new URL('../../prisma/content/stories.json', import.meta.url), 'utf8')));
  const audio = z.array(z.object({ id: z.string(), durationSeconds: z.number().positive(), cues: z.array(z.object({ title: z.string(), caption: z.string(), startTime: z.number(), endTime: z.number() })).length(4) })).parse(JSON.parse(readFileSync(new URL('../../prisma/content/narration.json', import.meta.url), 'utf8')));
  assert.equal(new Set(seeds.map(seed => seed.id)).size, 8);
  for (const seed of seeds) {
    const track = audio.find(item => item.id === seed.id)!;
    assert.ok(track);
    const wav = readFileSync(new URL(`../../public/media/${seed.id}.wav`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
    assert.equal(wav.readUInt32LE(24), 22050);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    assert.ok(Math.abs((wav.length - 44) / 44100 - track.durationSeconds) < 0.00001);
    track.cues.forEach((cue, index) => {
      assert.equal(cue.caption, seed.scenes[index].text);
      assert.equal(cue.title, seed.scenes[index].title);
      assert.equal(cue.startTime, index === 0 ? 0 : track.cues[index - 1].endTime);
      assert.ok(cue.endTime > cue.startTime);
    });
    assert.equal(track.cues.at(-1)!.endTime, track.durationSeconds);
  }
});
