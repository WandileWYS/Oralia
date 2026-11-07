import { useState } from 'react';
import type { Keyframe } from '../types/story';

/** Use a smaller CDN rendition and keep the scene's identity readable on image failure. */
export function SceneThumbnail({ frame, alt = '', loading = 'lazy', fullSize = false }: { frame: Keyframe; alt?: string; loading?: 'eager' | 'lazy'; fullSize?: boolean }) {
  const source = fullSize ? frame.imageUrl : frame.thumbnailUrl || frame.imageUrl;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === source) return <span className="thumbnail-unavailable" role="img" aria-label={`${frame.title ?? 'Story scene'}: image could not load`}><span>{frame.title ?? frame.caption}</span></span>;
  return <img src={source} alt={alt} loading={loading} decoding="async" onError={() => setFailedSource(source)} />;
}
