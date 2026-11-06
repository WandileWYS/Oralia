import type { CreatorAssetBundle } from '../types/story';

const imageExtensions: Record<string, string> = { 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function buildManifest(bundle: CreatorAssetBundle) {
  return {
    schemaVersion: 'oralia-storyboard-v2',
    project: { id: bundle.id, name: bundle.projectName, ageTier: bundle.ageTier, pitch: bundle.pitch, voiceType: bundle.voiceType },
    source: bundle.source,
    timingBasis: 'editable-storyboard-seconds',
    durationSeconds: bundle.frames.at(-1)?.endTime ?? 0,
    generation: 'database-storyboard-with-edited-prompts',
    notification: { mode: 'simulated', sent: false },
    frames: bundle.frames.map((frame, index) => ({ ...frame, filename: `images/scene-${index + 1}.${imageExtensions[frame.imageMimeType || 'image/svg+xml']}`, durationSeconds: Math.round((frame.endTime - frame.startTime) * 1000) / 1000 })),
  };
}

export async function packageStoryboard(bundle: CreatorAssetBundle) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const draft = buildManifest(bundle);
  const frames = await Promise.all(draft.frames.map(async frame => {
    const response = await fetch(frame.imageUrl);
    const mimeType = response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!response.ok || !imageExtensions[mimeType]) throw new Error('Scene image unavailable.');
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const filename = frame.filename.replace(/\.[^.]+$/, `.${imageExtensions[mimeType]}`);
    zip.file(filename, bytes);
    return { ...frame, filename, sizeBytes: bytes.byteLength, sha256, mimeType };
  }));
  const manifest = { ...draft, frames };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('storyboard.json', JSON.stringify({ ...bundle, timingBasis: draft.timingBasis, frames }, null, 2));
  zip.file('README.txt', 'Oralia editable storyboard\n\nDatabase-sourced editorial imagery; not generated from the submitted pitch.\nPhotographer and story source information is included in CREDITS.txt and the manifest.\nFrame order, prompts, durations, and contiguous timestamps reflect your edits.\nStoryboard timing is independent of the source narration.\nNo recordings are included or uploaded. No email was sent.\nThe manifest includes SHA-256 checksums for the image files.\n');
  const sourceCredit = bundle.source ? `${bundle.source.title}\n${bundle.source.url}\n${bundle.source.note}\n\n` : '';
  zip.file('CREDITS.txt', sourceCredit + frames.map(frame => `${frame.filename}\n${frame.imageCredit ? `Photo: ${frame.imageCredit.photographer} / Unsplash\n${frame.imageCredit.sourceUrl}` : 'See the source artwork rights before publication'}\n`).join('\n'));
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, manifest, files: ['manifest.json', 'storyboard.json', 'README.txt', 'CREDITS.txt', ...frames.map(frame => frame.filename)] };
}
export type PackagedStoryboard = Awaited<ReturnType<typeof packageStoryboard>>;
