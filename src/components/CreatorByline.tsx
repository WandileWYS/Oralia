import type { CreatorProfile } from '../types/creator';
import { creatorHref } from '../lib/catalog';
import { cn } from '../lib/utils';

export function CreatorAvatar({ creator, large = false }: { creator: CreatorProfile; large?: boolean }) {
  return <span className={cn('creator-avatar', large && 'large')} data-tone={creator.avatarTone} role="img" aria-label={`${creator.name} avatar`}>{creator.avatarUrl && <img src={creator.avatarUrl} alt="" onError={event => { event.currentTarget.hidden = true; }} />}{creator.initials}</span>;
}

export function CreatorByline({ creator }: { creator: CreatorProfile }) {
  return <a className="creator-byline" href={creatorHref(creator.username)} aria-label={`View @${creator.username}'s creator profile`} aria-haspopup="dialog"><CreatorAvatar creator={creator} /><span><small>By</small> @{creator.username}</span></a>;
}
