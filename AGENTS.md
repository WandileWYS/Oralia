# Oralia Agent & Contributor Rules

These rules apply to implementation work in this project. The local application uses a React/Vite client and a TypeScript `/api/v1` API backed by Prisma with Turso for hosting and SQLite for isolated local work. Use npm and the committed package-lock.json.

## Required stack

- Use **React**, **TypeScript**, **Tailwind CSS**, and **Vite** for the web application.
- Use functional React components and hooks. Do not introduce a second frontend framework or a server-rendering framework without recording an architecture decision first.
- Keep TypeScript strict. Avoid `any`; use `unknown` at untrusted boundaries and narrow it with validation.
- Validate API request/response data at runtime with shared schemas (Zod or an approved equivalent). Derive TypeScript types from those schemas instead of maintaining duplicate hand-written shapes.
- Keep server-side API and worker code in TypeScript where practical. All AI, email, and object-storage calls must run on the server or in workers.
- **Never import Prisma, database adapters, Node built-ins, or server modules into `src`.** `server/plugin.ts` attaches the API to Vite dev and preview middleware; only `vite.config.ts` imports that plugin. React uses the runtime-validated `src/lib/api.ts` fetch client. Generated Prisma files stay in ignored `server/generated/prisma`.
- Use the repository lockfile and existing package manager. Do not silently upgrade core framework versions or add large dependencies without a clear need.

## Structure and ownership

- Keep UI components, domain logic, API clients, and provider adapters in separate modules. Components should not call vendors directly.
- Use a typed, versioned `/api/v1` client. Keep HTTP parsing, error mapping, and retry policy in the client/data layer.
- The configured database (Turso in hosting; explicit local SQLite for tests/development) is the source of truth for feed stories, profiles, keyframes, creator sessions, voice preferences, and account bookmarks. `useDatabaseCatalog` owns catalog loading/error/retry state; do not silently substitute fixtures after a failed API request. `src/data/presentation.ts` contains only collection style presets.
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
- `usePlaybackSource` checks media availability before requesting a local audio file. Missing audio uses a quiet Web Audio-generated timing track through the same audio element; explicitly identify it as a tone, never narration. Switching sources cancels stale synthesis work and releases blob URLs. Keep original-voice availability distinct from the `STUDIO_AI` seed narration.

## Literary collections, review, and cultural context

- Use only StoryCollection keys FOLK_AND_FABLE and EPIC_AND_CHRONICLE. ALL belongs only to CollectionFilter browsing state; never store or export it as a story collection.
- A Story has one presentation containing review status, style and keyframes. Collection describes literary character, not audience suitability. Keep review gating independent of style.
- Use getPlayableStories and getCreatorStories for consistent collection filtering and explicit creator ownership. Direct public story links resolve independently of the active browse filter.
- Keep RegionTag and RegionFilter independent of literary collections. Never infer provenance from a title, photograph, or collection name.
- Preserve original narration, source/dialect metadata, measured cues, attribution and cultural context. Do not invent translations or community endorsements.
- Seeds contain six Folk & Fable stories and two Epic & Chronicle stories, each with four scenes. Narration is STUDIO_AI, not a supplied original microphone recording.
- Require editorial review for uncertain or flagged material. A literary label does not certify school suitability.
- Preserve immutable migration SQL. Legacy categorization references may exist only there for safe data conversion; active code, tests, docs and skills use the thematic contract.

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
- Use the shared CSS theme variables for surfaces, text, borders, and accents. Keep collection-specific theme colors scoped and set text color at each theme boundary. Respect reduced motion and preserve keyboard navigation and native dialog focus behavior.
- Use `--radius-pill` for compact controls, `--radius-control` (16px) for fields, and curved card containers of at least 16px. Preserve the static ambient background and readable surface colors across themes. Use `NeuralButton` for AI workflow actions so idle, busy, disabled, and reduced-motion treatments stay consistent; keep simulation labels accurate.
- Use `DropdownSelect` for single-choice UI selectors rather than native `select`/`option` popups. Keep controlled values in their existing owner, and preserve combobox/listbox semantics, arrow/Home/End/typeahead navigation, Escape/Tab/outside dismissal, and menu positioning within clipped player/reader containers.
- Use `AudioDraftPlayer` for themed studio playback around the recording hook's existing audio ref. Keep controls synchronized with media events; do not add native audio control bars or an independent playback timer. Header identity derives from the persisted session and retains an initials fallback. Catalog refresh failures must expose retry feedback; unresolved profile links must not be declared missing while a refresh is pending.
- Label simulated recording waveforms, AI preparation, and email explicitly. Storyboard edits must preserve stable frame IDs and recalculate continuous timestamps; their timing is independent of narration. Ensure exported prompts, order, voice preference, source attribution, and durations match the inspected payload.
- Keep reader discovery, public profiles, and listening available without sign-in. The user-authorized **local OTP simulator** accepts any six-digit PIN; it never sends email or verifies ownership. `/auth/otp/request` and `/auth/otp/verify` create an expiring, single-use challenge and a database-backed creator/session. Reserved collection emails cannot be claimed. `usePersistentSession` owns the browser session; per the Phase 4 requirement, it persists in `oralia-creator-session` until logout or expiry. The API stores a hash of the bearer token and authorizes account bookmark and voice writes. This simulator is not production authentication. Do not replace it with real email delivery or publish it as secure verification without an explicit change in scope.
- `useStoryBookmark` uses `/bookmarks` and idempotent `PUT`/`DELETE /bookmarks/:storyId` for signed-in users. Guest story IDs remain device-local under `oralia-saved-stories`; bookmarking does not download media. Sign-out revokes the server session and clears local credentials. Public profile payloads exclude emails and session tokens.
- Preserve migration history. On a fresh checkout run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed` before dev. Seeds upsert eight tales/32 scenes/four collection profiles without deleting users or bookmarks. Keep local databases, credentials, generated client files, and QA artifacts ignored. Never reset a user's database to repair a routine schema change.
- Run `npm test` and `npm run build` for backend/domain changes. The API tests migrate and seed an isolated SQLite database and verify session expiry, challenge reuse, authorization, voice preference, bookmark idempotency, and reseeding. Use browser checks for playback, OTP, filters, modal focus/close behavior, exports, and responsive layouts; record actual results.
- Keep comments focused on non-obvious decisions; update documentation when a data contract, state transition, or provider boundary changes.
- Add focused automated coverage for new business rules and boundary cases when implementation work is requested. Do not claim a behavior is verified unless it was actually checked.
- Do not introduce implementation code while the task is limited to research/planning. Record unresolved infrastructure/model choices as decisions instead of guessing credentials, limits, or service configuration.

## Hosting and provider preparation

- Keep Turso credentials server-only and ignored. Runtime/seed resolve TURSO_DATABASE_URL plus TURSO_AUTH_TOKEN; explicit file DATABASE_URL wins only outside Vercel. Prisma CLI schema operations stay local. Never run tests against cloud merely because .env contains cloud credentials.
- api/index.ts and Vite middleware share handleApi. Preserve raw request bodies, /api/v1 paths and origin checks. Generate Prisma/mediaManifest before checks; use the manifest for media availability, never runtime stat of public files. Builds must not contact a database.
- Cloud schema initialization is explicit, atomic, checksum-recorded and rejects unexpected schemas. No resets, automatic destructive updates, migration or seed on build/request. Read-only cloud verification is separate from isolated test writes.
- PRESENTATION_MODE=true explicitly enables simulated PIN sign-in. Every current session is simulated and must never authorize paid image calls. The images endpoint returns truthful bundled placeholders; keep provider calls, secrets and raw errors out of client bundles. Real generation/storage and verified auth remain deferred.
