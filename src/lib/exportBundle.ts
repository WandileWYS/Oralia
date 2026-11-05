import type { CreatorAssetBundle } from '../types/story';

export function buildManifest(bundle: CreatorAssetBundle) {
  return {
    schemaVersion: 'oralia-storyboard-v2',
    demo: true,
    project: { id: bundle.id, name: bundle.projectName, ageTier: bundle.ageTier, pitch: bundle.pitch },
    timingBasis: 'editable-storyboard-seconds',
    durationSeconds: bundle.frames.at(-1)?.endTime ?? 0,
    generation: 'sample-artwork-not-generated-from-pitch',
    notification: { mode: 'simulated', sent: false },
    frames: bundle.frames.map((frame, index) => ({ ...frame, filename: `images/scene-${index + 1}.svg`, durationSeconds: Math.round((frame.endTime - frame.startTime) * 1000) / 1000 })),
  };
}

export async function packageStoryboard(bundle: CreatorAssetBundle) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const draft = buildManifest(bundle);
  const frames = await Promise.all(draft.frames.map(async frame => {
    const response = await fetch(frame.imageUrl);
    if (!response.ok || !response.headers.get('content-type')?.includes('svg')) throw new Error('Sample illustration unavailable.');
    const bytes = await response.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    zip.file(frame.filename, bytes);
    return { ...frame, sizeBytes: bytes.byteLength, sha256, mimeType: 'image/svg+xml' };
  }));
  const manifest = { ...draft, frames };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('storyboard.json', JSON.stringify({ ...bundle, demo: true, timingBasis: draft.timingBasis, frames }, null, 2));
  zip.file('README.txt', 'Oralia editable storyboard demo\n\nOriginal sample illustrations; not generated from the submitted pitch.\nFrame order, prompts, durations, and contiguous timestamps reflect your edits.\nStoryboard timing is independent of the original sample narration.\nNo recordings are included or uploaded. No email was sent.\nThe manifest includes SHA-256 checksums for the image files.\n');
  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, manifest, files: ['manifest.json', 'storyboard.json', 'README.txt', ...frames.map(frame => frame.filename)] };
}
export type PackagedStoryboard = Awaited<ReturnType<typeof packageStoryboard>>;
