# Oralia Agent & Contributor Rules

These rules apply to implementation work in this project. The Phase 1 scaffold and Phase 2 interactive frontend use local demo data; backend services remain planned. Use npm and the committed package-lock.json.

## Required stack

- Use **React**, **TypeScript**, **Tailwind CSS**, and **Vite** for the web application.
- Use functional React components and hooks. Do not introduce a second frontend framework or a server-rendering framework without recording an architecture decision first.
- Keep TypeScript strict. Avoid `any`; use `unknown` at untrusted boundaries and narrow it with validation.
- Validate API request/response data at runtime with shared schemas (Zod or an approved equivalent). Derive TypeScript types from those schemas instead of maintaining duplicate hand-written shapes.
- Keep server-side API and worker code in TypeScript where practical. All AI, email, and object-storage calls must run on the server or in workers.
- Use the repository lockfile and existing package manager. Do not silently upgrade core framework versions or add large dependencies without a clear need.

## Structure and ownership

- Keep UI components, domain logic, API clients, and provider adapters in separate modules. Components should not call vendors directly.
- Use a typed, versioned `/api/v1` client. Keep HTTP parsing, error mapping, and retry policy in the client/data layer.
- Treat server data as server-owned state (TanStack Query or an approved equivalent). Keep UI preferences local or in a small UI store. Do not mirror every server object into a global store.
- Place long-running work in durable server jobs. Every job must have explicit states, safe retries, idempotency behavior, progress reporting, and recoverable error summaries.
- Use private object storage for source recordings and exports. Store references/checksums/metadata in the database, not Base64 blobs. Keep secrets out of the browser bundle, URLs, logs, analytics, and committed files.

## Media and synchronization standards

- Use one `HTMLAudioElement` as the authoritative story clock. The visible keyframe and caption are derived from `audio.currentTime`.
- Do not update React state for every audio clock tick or run `setInterval` as a competing clock. While playing, sample the media clock in one paint-aligned loop and notify React only when a discrete keyframe/caption changes.
- Handle play, pause, seek, metadata/duration changes, playback-rate changes, waiting/playing, ended, visibility return, and audio source replacement explicitly.
- Preload/decode upcoming images and retain the previous image until the next one is ready. An image failure must not stop audio.
- Store keyframe/caption ranges as seconds relative to the audio asset. Validate sorted, non-negative boundaries against known duration. Use half-open intervals `[startSeconds, endSeconds)` consistently.
- Detect recorder MIME support at runtime and store the actual content type. Do not assume all browsers emit the same codec/container.
- Avoid auto-playing sound. Preserve captions/transcript, keyboard controls, focus visibility, descriptive alt text, and reduced-motion preferences.

## Age tiers, content, and cultural context

- Use only these canonical keys: `5-9`, `10-13`, `14-17`, `18+`.
- Keep `contentRating`, review status, tier-specific narration, visual style, subtitles, and keyframes as distinct fields. A style prompt does not establish age suitability.
- Do not serve a tier variant until it has the required review/approval state. If a requested tier variant is missing, return a clear unavailable state instead of substituting another tier.
- Keep source transcript, dialect metadata, normalized text, translation, and editorial corrections separate. Do not silently “correct” a storyteller's original wording.
- Do not invent pan-African visual details. Use supplied region/community/period context, record attribution/rights/consent, and route culturally uncertain assets for editorial review.
- Treat transcripts, prompts, model outputs, image URLs, filenames, and uploaded media as untrusted input. Validate, moderate, and authorize before display/publication. Human review is required for flagged or uncertain school-feed content.

## Offline, storage, and exports

- Treat `navigator.onLine` as a hint only. Show actual request/upload state and preserve durable drafts in IndexedDB where applicable.
- Bound service-worker caches by age/entry count/size and provide an explicit save-for-offline action for substantial media. Show partial downloads and storage failures clearly.
- Version caches and prune obsolete versions. Do not cache signed export URLs or private responses across users.
- Support correct range requests, MIME, CORS, and cache headers for audio playback/seeking. Verify cached and network seek paths on supported browsers.
- Bundle creator outputs as a versioned archive with a manifest and checksums. Email a protected link by default; authorize the user before minting a short-lived download URL.
- Store email sends in a transactional outbox, use idempotency keys, and track delivery state independently from generation state. A notification failure must not delete a completed export.

## Code quality and collaboration

- Keep functions small, names domain-specific, and error states explicit. Avoid hidden global mutable state outside the media controller and approved stores.
- Prefer accessible semantic HTML over clickable generic containers. Every icon-only control needs an accessible name.
- Use the shared CSS theme variables for surfaces, text, borders, and accents. Keep tier-specific theme colors scoped and set text color at each theme boundary. Respect reduced motion and preserve keyboard navigation and native dialog focus behavior.
- Label placeholder translations, simulated waveforms/email, and sample assets explicitly. Storyboard edits must preserve stable frame IDs and recalculate continuous timestamps; their timing is independent of narration. Ensure exported prompts, order, and durations match the inspected payload.
- Keep comments focused on non-obvious decisions; update documentation when a data contract, state transition, or provider boundary changes.
- Add focused automated coverage for new business rules and boundary cases when implementation work is requested. Do not claim a behavior is verified unless it was actually checked.
- Do not introduce implementation code while the task is limited to research/planning. Record unresolved infrastructure/model choices as decisions instead of guessing credentials, limits, or service configuration.
